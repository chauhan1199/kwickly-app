const { StatusCodes } = require('http-status-codes');
const Payout = require('./payout.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { notifyUser } = require('../../helpers/notifyUser.helper');
const mongoose = require('mongoose');
const { supportsTransactions } = require('../../helpers/transaction.helper');

const CACHE_KEY = 'admin_payouts';

exports.getPayouts = catchAsync(async (req, res) => {
    const { status } = req.query;
    const cacheKey = status ? `${CACHE_KEY}_${status}` : CACHE_KEY;
    
    const cachedData = await getCache(cacheKey);
    if (cachedData) return successResponse(res, cachedData, 'Payouts from cache');

    const query = {};
    if (status) query.status = status.toUpperCase();

    const payouts = await Payout.find(query)
        .populate('workerId', 'name city category wallet kyc')
        .populate({ path: 'shopId', select: 'name address kyc wallet ownerId ownerName' })
        .sort({ createdAt: -1 });

    await setCache(cacheKey, payouts, 300); // 5 min cache
    return successResponse(res, payouts, 'Payouts fetched successfully');
});

exports.updatePayoutStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status: rawStatus, txnId, rejectReason } = req.body;

    const status = String(rawStatus || '').toUpperCase();
    const VALID_STATUSES = ['PENDING', 'APPROVED', 'TRANSFERRED', 'REJECTED'];
    if (!VALID_STATUSES.includes(status)) {
        return errorResponse(res, `Invalid payout status. Allowed: ${VALID_STATUSES.join(', ')}`, StatusCodes.BAD_REQUEST);
    }

    let session = null;
    let useTransaction = false;
    if (supportsTransactions()) {
        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch (e) {
            session = null;
            useTransaction = false;
        }
    }
    try {
        const payout = await Payout.findById(id).session(session);
        if (!payout) {
            if (useTransaction && session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Payout request not found', StatusCodes.NOT_FOUND);
        }

        // Idempotency guard — only refund when transitioning INTO REJECTED
        const isRejecting = payout.status !== 'REJECTED' && status === 'REJECTED';
        const isTransferring = payout.status !== 'TRANSFERRED' && status === 'TRANSFERRED';

        payout.status = status;
        if (txnId) payout.txnId = txnId;
        if (rejectReason) payout.rejectReason = rejectReason;
        payout.processedAt = Date.now();

        await payout.save({ session });

        const WalletTxn = require('../wallet/wallet.model');
        const isWorker = !!payout.workerId;
        const targetId = isWorker ? payout.workerId : payout.shopId;
        
        let actualUserId = targetId;
        if (!isWorker) {
            const Shop = require('../shop/shop.model');
            const shop = await Shop.findById(payout.shopId);
            if (shop) actualUserId = shop.ownerId;
        }

        // When payout is completed / transferred: mark Worker's WalletTxn as COMPLETED and debit Admin Platform Wallet
        if (isTransferring) {
            if (payout.walletTxnId) {
                await WalletTxn.findByIdAndUpdate(
                    payout.walletTxnId,
                    { status: 'COMPLETED', razorpayPaymentId: txnId || payout.txnId || `TXN-${Date.now()}` },
                    { session }
                );
            } else {
                await WalletTxn.findOneAndUpdate(
                    { userId: actualUserId, type: 'WITHDRAWAL', status: 'PENDING' },
                    { status: 'COMPLETED', razorpayPaymentId: txnId || payout.txnId || `TXN-${Date.now()}` },
                    { sort: { createdAt: -1 }, session }
                );
            }

            // Record payout disbursement in Admin Platform Wallet
            try {
                const { debitForPayout } = require('../adminWallet/adminWallet.service');
                await debitForPayout(
                    payout.amount,
                    `Payout transfer to ${isWorker ? 'Worker' : 'Shop'} ${actualUserId} via ${payout.paymentMethod || 'UPI/Bank'}`,
                    payout._id,
                    'Payout',
                    { txnId: txnId || payout.txnId, method: payout.paymentMethod },
                    { session }
                );
            } catch (err) {
                // If admin wallet balance is lower than disbursement, update without throwing error
                const { AdminWallet, AdminWalletTxn } = require('../adminWallet/adminWallet.model');
                const adminWallet = await AdminWallet.findOneAndUpdate(
                    {},
                    { $inc: { balance: -payout.amount } },
                    { returnDocument: 'after', session }
                );
                await AdminWalletTxn.create([{
                    type: 'PAYOUT_DEBIT',
                    amount: payout.amount,
                    balanceAfter: adminWallet?.balance || 0,
                    description: `Payout transfer to ${isWorker ? 'Worker' : 'Shop'} ${actualUserId}`,
                    referenceId: payout._id,
                    referenceModel: 'Payout',
                    meta: { txnId: txnId || payout.txnId, method: payout.paymentMethod }
                }], { session });
            }
        }

        // If rejected, refund the amount to the specific entity's wallet (atomic)
        if (isRejecting) {
            if (payout.walletTxnId) {
                await WalletTxn.findByIdAndUpdate(
                    payout.walletTxnId,
                    { status: 'FAILED' },
                    { session }
                );
            }

            if (payout.workerId) {
                const worker = await Customer.findOneAndUpdate(
                    { _id: payout.workerId },
                    { $inc: { 'wallet.balance': payout.amount } },
                    { returnDocument: 'after', session }
                );
                if (worker) {
                    await WalletTxn.create([{
                        userId: worker._id,
                        type: 'REFUND',
                        amount: payout.amount,
                        balance: worker.wallet.balance,
                        description: `Refund for rejected payout: ${rejectReason || 'Admin rejected'}`
                    }], { session });
                }
            } else if (payout.shopId) {
                const Shop = require('../shop/shop.model');
                const shop = await Shop.findOneAndUpdate(
                    { _id: payout.shopId },
                    { $inc: { 'wallet.balance': payout.amount } },
                    { returnDocument: 'after', session }
                );
                if (shop) {
                    await WalletTxn.create([{
                        userId: shop.ownerId, // Mapping to owner's wallet
                        type: 'REFUND',
                        amount: payout.amount,
                        balance: shop.wallet.balance,
                        description: `Refund for rejected shop payout: ${rejectReason || 'Admin rejected'}`
                    }], { session });
                }
            }
        }

        if (useTransaction) await session.commitTransaction();
        if (useTransaction) session.endSession();

        await delCache(CACHE_KEY);
        await delCache(`session:${actualUserId}`);
        await delCache('admin_dashboard_stats');
        await delCache('admin_wallet_summary');

        const { emitToAll } = require('../../helpers/socket.helper');
        emitToAll('DASHBOARD_UPDATE', { type: 'PAYOUT_STATUS_UPDATE', id: payout._id, status });

        // Notify the user about payout status
        notifyUser({
            userId: actualUserId,
            title: `Payout ${status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}`,
            message: status === 'REJECTED'
                ? `Your payout request of ₹${payout.amount} was rejected. Reason: ${rejectReason || 'Admin review'}. The amount has been refunded to your wallet.`
                : `Your payout of ₹${payout.amount} has been successfully transferred to your ${payout.paymentMethod === 'UPI' ? 'UPI' : 'Bank Account'}.`,
            action: 'WALLET_UPDATE',
            entityType: 'WALLET',
            entityId: actualUserId,
            targetRole: isWorker ? 'WORKER' : 'SHOP'
        });

        return successResponse(res, payout, `Payout ${status.toLowerCase()} successfully`);
    } catch (error) {
        if (useTransaction && session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});
