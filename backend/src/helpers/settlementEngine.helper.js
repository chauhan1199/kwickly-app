const mongoose = require('mongoose');
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
 * Idempotent Settlement Engine for Shop Orders
 * Ensures funds are disbursed exactly once upon Delivery OTP verification
 */
const settleShopOrderDelivery = async ({ order, session = null }) => {
    if (!order || !order._id) throw new Error('Order reference required for settlement');

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

    // 1. Credit Shop In-App Wallet with 100% of net product sales (0% commission!)
    const updatedShop = await Shop.findByIdAndUpdate(
        order.shopId,
        {
            $inc: {
                'wallet.balance': netProductSales,
                totalRevenue: netProductSales
            }
        },
        { returnDocument: 'after', session }
    );

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
        amount: netProductSales,
        balance: updatedShop?.wallet?.balance,
        orderId: order._id
    });
    emitToAll('DASHBOARD_UPDATE', {
        type: 'ORDER_SETTLED',
        orderId: order._id,
        shopEarnings: netProductSales,
        deliveryFee,
        platformFee,
        gstAmount
    });

    return ledgerEntry;
};

module.exports = {
    settleJobCompletion,
    settleShopOrderDelivery
};
