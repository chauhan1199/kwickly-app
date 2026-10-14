const Customer = require('../modules/customer/customer.model');
const Shop = require('../modules/shop/shop.model');
const WalletTxn = require('../modules/wallet/wallet.model');
const { AdminWallet, AdminWalletTxn } = require('../modules/adminWallet/adminWallet.model');
const PlatformLedger = require('../modules/ledger/platformLedger.model');
const logger = require('./logger.helper');
const { emitToRoom, emitToAll } = require('./socket.helper');

/**
 * Idempotent Settlement Engine for Service Jobs
 * Ensures funds are disbursed exactly once upon Completion OTP verification
 */
const settleJobCompletion = async ({ job, session = null }) => {
    if (!job || !job._id) throw new Error('Job reference required for settlement');

    const idempotencyKey = `settle_job_${job._id.toString()}`;
    const existingSettlement = await PlatformLedger.findOne({ idempotencyKey }).session(session);

    if (existingSettlement) {
        logger.info(`[SettlementEngine] Job #${job._id} already settled — skipping duplicate execution.`);
        return existingSettlement;
    }

    const workerQuote = Number(job.payment?.workerPayout || job.payment?.quotedAmount || job.finalPrice || job.budget || 0);
    const platformFee = Number(job.payment?.platformFee || 0);
    const gstAmount = Number(job.payment?.gst || job.payment?.gstAmount || 0);
    const customerTotal = Number(job.payment?.amount || (workerQuote + platformFee + gstAmount));

    const settlementId = `STL_JOB_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const transactionId = `TXN_JOB_${job._id.toString().slice(-6)}_${Date.now()}`;

    // 1. Credit Worker Wallet with 100% of their quoted price (0% commission!)
    const updatedWorker = await Customer.findByIdAndUpdate(
        job.workerId,
        {
            $inc: {
                'wallet.balance': workerQuote,
                'workerProfile.totalJobs': 1,
                'workerProfile.totalEarned': workerQuote
            }
        },
        { returnDocument: 'after', session }
    );

    await WalletTxn.create([{
        userId: job.workerId,
        type: 'JOB_CREDIT',
        amount: workerQuote,
        balance: (updatedWorker?.wallet?.balance || 0) - workerQuote,
        balanceAfter: updatedWorker?.wallet?.balance || workerQuote,
        refId: String(job._id),
        status: 'COMPLETED',
        description: `Earnings for Service Job #${job._id.toString().slice(-6)} (100% Payout, 0% Commission)`
    }], { session });

    // 2. Credit Kwickly Treasury with Customer Platform Fee and record GST Liability
    const adminW = await AdminWallet.findOneAndUpdate(
        {},
        {
            $inc: {
                balance: platformFee,
                totalCommission: platformFee,
                platformFeeRevenue: platformFee,
                gstLiability: gstAmount
            }
        },
        { returnDocument: 'after', upsert: true, session }
    );

    await AdminWalletTxn.create([{
        type: 'PLATFORM_FEE_COLLECTED',
        amount: platformFee,
        balanceAfter: adminW?.balance || platformFee,
        description: `Customer Platform Fee on Job #${job._id.toString().slice(-6)} (Gross: ₹${customerTotal})`,
        referenceId: job._id,
        referenceModel: 'Job',
        meta: {
            workerQuote,
            platformFee,
            gstAmount,
            customerTotal,
            settlementId
        }
    }], { session });

    // 3. Record Immutable Platform Ledger Entry (Source of Truth)
    const ledgerEntry = await PlatformLedger.create([{
        transactionId,
        settlementId,
        idempotencyKey,
        entityType: 'SERVICE_JOB',
        entityId: job._id,
        referenceNumber: `JOB-${job._id.toString().slice(-6).toUpperCase()}`,
        grossAmount: customerTotal,
        partnerAmount: workerQuote,
        platformFee,
        gstAmount,
        partnerCommissionPercent: 0,
        fromAccount: { accountType: 'ESCROW', userId: job.customerId },
        toAccount: { accountType: 'WORKER_WALLET', userId: job.workerId },
        paymentMethod: job.payment?.method || 'UPI',
        paymentStatus: 'PAID',
        settlementStatus: 'SETTLED',
        description: `Service Job Settlement: Worker ₹${workerQuote} (100%), Kwickly Fee ₹${platformFee}, GST ₹${gstAmount}`,
        configSnapshot: {
            appliedAt: new Date(),
            rule: '0% Partner Commission, Customer Paid Fee'
        }
    }], { session }).then(arr => arr[0]);

    emitToRoom(`worker_${job.workerId}`, 'WALLET_CREDITED', {
        amount: workerQuote,
        balance: updatedWorker?.wallet?.balance,
        jobId: job._id
    });
    emitToAll('DASHBOARD_UPDATE', {
        type: 'JOB_SETTLED',
        jobId: job._id,
        workerEarnings: workerQuote,
        platformFee,
        gstAmount
    });

    return ledgerEntry;
};

/**
 * Books a CASH service job. The customer handed the full amount to the worker, and
 * the worker's wallet has already been charged the platform fee + GST, so here we
 * only record the fee as revenue and the GST as a liability, the same way online
 * jobs are booked, plus the ledger entry the admin reports read.
 */
const settleCashJob = async ({ job, session = null }) => {
    const idempotencyKey = `settle_job_${job._id.toString()}`;
    const existing = await PlatformLedger.findOne({ idempotencyKey }).session(session);
    if (existing) return existing;

    const workerQuote = Number(job.payment?.workerPayout || job.payment?.quotedAmount || 0);
    const platformFee = Number(job.payment?.platformFee || 0);
    const gstAmount = Number(job.payment?.gst || job.payment?.gstAmount || 0);
    const customerTotal = Number(job.payment?.amount || (workerQuote + platformFee + gstAmount));
    const settlementId = `STL_JOB_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await Customer.findByIdAndUpdate(
        job.workerId,
        { $inc: { 'workerProfile.totalJobs': 1, 'workerProfile.totalEarned': workerQuote } },
        { session }
    );

    const adminW = await AdminWallet.findOneAndUpdate(
        {},
        { $inc: { balance: platformFee, totalCommission: platformFee, platformFeeRevenue: platformFee, gstLiability: gstAmount } },
        { returnDocument: 'after', upsert: true, session }
    );
    await AdminWalletTxn.create([{
        type: 'PLATFORM_FEE_COLLECTED',
        amount: platformFee,
        balanceAfter: adminW?.balance || platformFee,
        description: `Customer Platform Fee on cash Job #${job._id.toString().slice(-6)} (Gross: ₹${customerTotal})`,
        referenceId: job._id,
        referenceModel: 'Job',
        meta: { workerQuote, platformFee, gstAmount, customerTotal, settlementId, method: 'CASH' }
    }], { session });

    const [entry] = await PlatformLedger.create([{
        transactionId: `TXN_JOB_${job._id.toString().slice(-6)}_${Date.now()}`,
        settlementId,
        idempotencyKey,
        entityType: 'SERVICE_JOB',
        entityId: job._id,
        referenceNumber: `JOB-${job._id.toString().slice(-6).toUpperCase()}`,
        grossAmount: customerTotal,
        partnerAmount: workerQuote,
        platformFee,
        gstAmount,
        partnerCommissionPercent: 0,
        fromAccount: { accountType: 'WORKER_WALLET', userId: job.workerId },
        toAccount: { accountType: 'KWICKLY_TREASURY' },
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        settlementStatus: 'SETTLED',
        description: `Cash Job: customer paid worker ₹${customerTotal} in cash; fee ₹${platformFee} + GST ₹${gstAmount} taken from worker wallet`,
        configSnapshot: { appliedAt: new Date(), rule: '0% Partner Commission, Customer Paid Fee' }
    }], { session });

    emitToAll('DASHBOARD_UPDATE', { type: 'JOB_SETTLED', jobId: job._id, platformFee, gstAmount });
    return entry;
};

/**
 * Idempotent Settlement Engine for Shop Orders
 * Ensures funds are disbursed exactly once upon Delivery OTP verification
 */
const settleShopOrderDelivery = async ({ order, session = null }) => {
    if (!order || !order._id) throw new Error('Order reference required for settlement');

    // The shop is paid only for money that has actually arrived: wallet/verified UPI
    // orders must be PAID; cash/COD orders are collected at the door (cash branch).
    const isCashOrder = ['CASH', 'COD'].includes(order.payment?.method);
    if (!isCashOrder && order.payment?.status !== 'PAID') {
        throw Object.assign(new Error('Order payment is not confirmed; it cannot be settled'), { statusCode: 409 });
    }

    const idempotencyKey = `settle_order_${order._id.toString()}`;
    const existingSettlement = await PlatformLedger.findOne({ idempotencyKey }).session(session);

    if (existingSettlement) {
        logger.info(`[SettlementEngine] Order #${order._id} already settled — skipping duplicate execution.`);
        return existingSettlement;
    }

    const netProductSales = Number(order.netProductSales || (order.subtotal - (order.promoDiscount || order.discount || 0)) || 0);
    const deliveryFee = Number(order.deliveryFee || 0);
    const platformFee = Number(order.platformFee || 0);
    const gstAmount = Number(order.gstAmount || 0);
    const customerTotal = Number(order.total || order.totalAmount || (netProductSales + deliveryFee + platformFee + gstAmount));

    const settlementId = `STL_ORD_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const transactionId = `TXN_ORD_${order.orderNumber || order._id.toString().slice(-6)}_${Date.now()}`;

    const shopPayout = netProductSales + deliveryFee;
    if (isCashOrder) {
        return settleCashShopOrder({ order, session, idempotencyKey, settlementId, transactionId, netProductSales, deliveryFee, platformFee, gstAmount, customerTotal, shopPayout });
    }

    // 1. Credit Shop In-App Wallet with 100% of net product sales + delivery fee (0% commission!)
    const updatedShop = await Shop.findByIdAndUpdate(
        order.shopId,
        {
            $inc: {
                'wallet.balance': shopPayout,
                totalRevenue: shopPayout
            }
        },
        { returnDocument: 'after', session }
    );

    // 1b. Record the payout in the shop owner's transaction history
    if (updatedShop?.ownerId && shopPayout > 0) {
        await WalletTxn.create([{
            userId: updatedShop.ownerId,
            type: 'ORDER_CREDIT',
            amount: shopPayout,
            balance: (updatedShop.wallet?.balance || 0) - shopPayout,
            balanceAfter: updatedShop.wallet?.balance || shopPayout,
            refId: String(order._id),
            status: 'COMPLETED',
            description: `Order payout for #${order.orderNumber || String(order._id).slice(-6)} (Product ₹${netProductSales} + Delivery ₹${deliveryFee}, 0% Commission)`
        }], { session });
    }

    // 2. Credit Kwickly Treasury with Customer Platform Fee and record GST Liability
    const adminW = await AdminWallet.findOneAndUpdate(
        {},
        {
            $inc: {
                balance: platformFee,
                totalCommission: platformFee,
                platformFeeRevenue: platformFee,
                gstLiability: gstAmount
            }
        },
        { returnDocument: 'after', upsert: true, session }
    );

    await AdminWalletTxn.create([{
        type: 'PLATFORM_FEE_COLLECTED',
        amount: platformFee,
        balanceAfter: adminW?.balance || platformFee,
        description: `Customer Platform Fee on Shop Order #${order.orderNumber || order._id} (Gross: ₹${customerTotal})`,
        referenceId: order._id,
        referenceModel: 'ShopOrder',
        meta: {
            netProductSales,
            platformFee,
            gstAmount,
            deliveryFee,
            customerTotal,
            settlementId
        }
    }], { session });

    // 3. Record Immutable Platform Ledger Entry (Source of Truth)
    const ledgerEntry = await PlatformLedger.create([{
        transactionId,
        settlementId,
        idempotencyKey,
        entityType: 'SHOP_ORDER',
        entityId: order._id,
        referenceNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
        grossAmount: customerTotal,
        partnerAmount: netProductSales,
        platformFee,
        gstAmount,
        deliveryFee,
        partnerCommissionPercent: 0,
        fromAccount: { accountType: 'ESCROW', userId: order.customerId },
        toAccount: { accountType: 'SHOP_WALLET', shopId: order.shopId },
        paymentMethod: order.payment?.method || 'UPI',
        paymentStatus: 'PAID',
        settlementStatus: 'SETTLED',
        description: `Shop Order Settlement: Shop ₹${netProductSales} (100%), Delivery ₹${deliveryFee}, Fee ₹${platformFee}, GST ₹${gstAmount}`,
        configSnapshot: {
            appliedAt: new Date(),
            rule: '0% Shop Commission, Customer Paid Fee'
        }
    }], { session }).then(arr => arr[0]);

    emitToRoom(`shop_${order.shopId}`, 'WALLET_CREDITED', {
        amount: shopPayout,
        balance: updatedShop?.wallet?.balance,
        orderId: order._id
    });
    emitToAll('DASHBOARD_UPDATE', {
        type: 'ORDER_SETTLED',
        orderId: order._id,
        shopEarnings: shopPayout,
        deliveryFee,
        platformFee,
        gstAmount
    });

    return ledgerEntry;
};

/**
 * Books a CASH/COD shop order. The shop's rider collected the full total in cash,
 * so the shop already holds product + delivery; the platform fee + GST it also
 * collected are taken from the shop wallet (which may go negative, like a worker's
 * on a cash job), booked as fee revenue + GST liability, with a ledger entry.
 */
const settleCashShopOrder = async ({ order, session, idempotencyKey, settlementId, transactionId, netProductSales, deliveryFee, platformFee, gstAmount, customerTotal, shopPayout }) => {
    const feeToDeduct = platformFee + gstAmount;
    const updatedShop = await Shop.findByIdAndUpdate(
        order.shopId,
        { $inc: { 'wallet.balance': -feeToDeduct, totalRevenue: shopPayout } },
        { returnDocument: 'after', session }
    );
    if (updatedShop?.ownerId && feeToDeduct > 0) {
        await WalletTxn.create([{
            userId: updatedShop.ownerId,
            type: 'ORDER_DEBIT',
            amount: feeToDeduct,
            balance: updatedShop.wallet?.balance || 0,
            refId: String(order._id),
            status: 'COMPLETED',
            description: `Platform fee ₹${platformFee} + GST ₹${gstAmount} collected in cash for Order #${order.orderNumber || String(order._id).slice(-6)}`
        }], { session });
    }

    const adminW = await AdminWallet.findOneAndUpdate(
        {},
        { $inc: { balance: platformFee, totalCommission: platformFee, platformFeeRevenue: platformFee, gstLiability: gstAmount } },
        { returnDocument: 'after', upsert: true, session }
    );
    await AdminWalletTxn.create([{
        type: 'PLATFORM_FEE_COLLECTED',
        amount: platformFee,
        balanceAfter: adminW?.balance || platformFee,
        description: `Customer Platform Fee on cash Shop Order #${order.orderNumber || order._id} (Gross: ₹${customerTotal})`,
        referenceId: order._id,
        referenceModel: 'ShopOrder',
        meta: { netProductSales, platformFee, gstAmount, deliveryFee, customerTotal, settlementId, method: 'CASH' }
    }], { session });

    const [entry] = await PlatformLedger.create([{
        transactionId,
        settlementId,
        idempotencyKey,
        entityType: 'SHOP_ORDER',
        entityId: order._id,
        referenceNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
        grossAmount: customerTotal,
        partnerAmount: netProductSales,
        platformFee,
        gstAmount,
        deliveryFee,
        partnerCommissionPercent: 0,
        fromAccount: { accountType: 'SHOP_WALLET', shopId: order.shopId },
        toAccount: { accountType: 'KWICKLY_TREASURY' },
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        settlementStatus: 'SETTLED',
        description: `Cash Shop Order: customer paid shop ₹${customerTotal} in cash; fee ₹${platformFee} + GST ₹${gstAmount} taken from shop wallet`,
        configSnapshot: { appliedAt: new Date(), rule: '0% Shop Commission, Customer Paid Fee' }
    }], { session });

    emitToRoom(`shop_${order.shopId}`, 'WALLET_DEBITED', { amount: feeToDeduct, balance: updatedShop?.wallet?.balance, orderId: order._id });
    emitToAll('DASHBOARD_UPDATE', { type: 'ORDER_SETTLED', orderId: order._id, shopEarnings: shopPayout, deliveryFee, platformFee, gstAmount });
    return entry;
};

/**
 * Idempotent Reversal Engine for Shop Orders
 * Used when an already-DELIVERED + SETTLED order is cancelled (e.g. return /
 * dispute): claws the shop payout back (bounded by shop balance), reverses
 * the platform fee + GST from treasury, refunds the customer, and records
 * a REVERSED ledger entry linked to the original settlement.
 */
const reverseShopOrderDelivery = async ({ order, session = null }) => {
    if (!order || !order._id) throw new Error('Order reference required for reversal');

    const original = await PlatformLedger.findOne({
        idempotencyKey: `settle_order_${order._id.toString()}`
    }).session(session);
    if (!original) {
        logger.info(`[SettlementEngine] Order #${order._id} has no original settlement — nothing to reverse.`);
        return null;
    }

    const reversalKey = `settle_order_${order._id.toString()}_reverse`;
    const existingReversal = await PlatformLedger.findOne({ idempotencyKey: reversalKey }).session(session);
    if (existingReversal) {
        logger.info(`[SettlementEngine] Order #${order._id} already reversed — skipping duplicate execution.`);
        return existingReversal;
    }

    const netProductSales = Number(original.partnerAmount || 0);
    // The shop was credited product sales plus the delivery fee, so both come back.
    // On a cash order the shop kept that money as cash and paid fee + GST from its
    // wallet, so the same amount comes back from the wallet (net: shop keeps nothing).
    const shopPayout = netProductSales + Number(original.deliveryFee || 0);
    const isCash = original.paymentMethod === 'CASH';
    const platformFee = Number(original.platformFee || 0);
    const gstAmount = Number(original.gstAmount || 0);
    const customerTotal = Number(original.grossAmount || order.total || 0);

    const settlementId = `REV_ORD_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const transactionId = `TXN_ORD_REV_${order.orderNumber || order._id.toString().slice(-6)}_${Date.now()}`;

    // 1. Claw back the shop payout — bounded by the shop's current balance so
    //    we can never drive a shop wallet negative through a reversal.
    const shop = await Shop.findById(order.shopId).select('wallet.balance ownerId').session(session).lean();
    let clawedBack = 0;
    if (shop) {
        // Cash: the shop holds the customer's cash, so the clawback may take its wallet negative.
        clawedBack = isCash ? shopPayout : Math.min(shopPayout, Math.max(0, shop.wallet?.balance || 0));
        if (clawedBack > 0) {
            const updatedShop = await Shop.findByIdAndUpdate(
                order.shopId,
                { $inc: { 'wallet.balance': -clawedBack, totalRevenue: -clawedBack } },
                { returnDocument: 'after', session }
            );
            await WalletTxn.create([{
                userId: shop.ownerId,
                type: 'ORDER_DEBIT',
                amount: clawedBack,
                balance: updatedShop?.wallet?.balance || 0,
                refId: String(order._id),
                status: 'COMPLETED',
                description: `Reversal of settled payout for cancelled Order #${order.orderNumber || String(order._id).slice(-6)}`
            }], { session });
        }
    }

    // 2. Reverse platform fee + GST from treasury
    const adminDebit = platformFee + gstAmount;
    if (adminDebit > 0) {
        const adminW = await AdminWallet.findOneAndUpdate(
            {},
            {
                $inc: {
                    balance: -platformFee,
                    platformFeeRevenue: -platformFee,
                    gstLiability: -gstAmount
                }
            },
            { returnDocument: 'after', upsert: true, session }
        );
        await AdminWalletTxn.create([{
            type: 'FEE_REVERSAL',
            amount: adminDebit,
            balanceAfter: adminW?.balance || 0,
            description: `Fee reversal for cancelled delivered Order #${order.orderNumber || String(order._id).slice(-6)}`,
            referenceId: order._id,
            referenceModel: 'ShopOrder',
            meta: { platformFee, gstAmount, settlementId }
        }], { session });
    }

    // 3. Refund the customer to their wallet
    if (customerTotal > 0) {
        const refundedCustomer = await Customer.findByIdAndUpdate(
            order.customerId,
            { $inc: { 'wallet.balance': customerTotal } },
            { returnDocument: 'after', session }
        );
        await WalletTxn.create([{
            userId: order.customerId,
            type: 'REFUND',
            amount: customerTotal,
            balance: refundedCustomer?.wallet?.balance || 0,
            refId: String(order._id),
            status: 'COMPLETED',
            description: `Refund for cancelled delivered order #${order.orderNumber || String(order._id).slice(-6)}`
        }], { session });
    }

    // 4. Mark the original settlement REVERSED and record the reversal entry
    await PlatformLedger.findOneAndUpdate(
        { idempotencyKey: original.idempotencyKey },
        { settlementStatus: 'REVERSED' },
        { session }
    );

    const ledgerEntry = await PlatformLedger.create([{
        transactionId,
        settlementId,
        idempotencyKey: reversalKey,
        entityType: 'SHOP_ORDER',
        entityId: order._id,
        referenceNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
        grossAmount: -customerTotal,
        partnerAmount: -clawedBack,
        platformFee: -platformFee,
        gstAmount: -gstAmount,
        partnerCommissionPercent: 0,
        fromAccount: { accountType: 'SHOP_WALLET', shopId: order.shopId },
        toAccount: { accountType: 'ESCROW', userId: order.customerId },
        paymentMethod: order.payment?.method || 'WALLET',
        paymentStatus: 'REFUNDED',
        settlementStatus: 'REVERSED',
        description: `Shop Order Reversal: shop clawed back ₹${clawedBack} of ₹${shopPayout}, customer refunded ₹${customerTotal}`,
        configSnapshot: {
            appliedAt: new Date(),
            rule: 'Post-delivery cancellation reversal',
            originalSettlementId: original.settlementId
        }
    }], { session }).then(arr => arr[0]);

    emitToRoom(`shop_${order.shopId}`, 'WALLET_DEBITED', {
        amount: clawedBack,
        orderId: order._id
    });
    emitToAll('DASHBOARD_UPDATE', {
        type: 'ORDER_SETTLEMENT_REVERSED',
        orderId: order._id,
        shopClawback: clawedBack,
        customerRefund: customerTotal
    });

    return ledgerEntry;
};

module.exports = {
    settleJobCompletion,
    settleCashJob,
    settleShopOrderDelivery,
    reverseShopOrderDelivery
};
