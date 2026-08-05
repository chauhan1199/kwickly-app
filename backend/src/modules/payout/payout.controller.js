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

        payout.status = status;
        if (txnId) payout.txnId = txnId;
        if (rejectReason) payout.rejectReason = rejectReason;
        payout.processedAt = Date.now();

        await payout.save({ session });

        // If rejected, refund the amount to the specific entity's wallet (atomic)
        if (isRejecting) {
            const WalletTxn = require('../wallet/wallet.model');
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

        // Notify the user about payout status
        const isWorker = !!payout.workerId;
        const targetId = isWorker ? payout.workerId : payout.shopId;
        
        let actualUserId = targetId;
        if (!isWorker) {
            const Shop = require('../shop/shop.model');
            const shop = await Shop.findById(payout.shopId);
            if (shop) actualUserId = shop.ownerId;
        }

        notifyUser({
            userId: actualUserId,
            title: `Payout ${status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}`,
            message: status === 'REJECTED'
                ? `Your payout request of â‚¹${payout.amount} was rejected. Reason: ${rejectReason || 'Admin review'}. The amount has been refunded to your wallet.`
                : `Your payout of â‚¹${payout.amount} has been successfully processed.`,
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
