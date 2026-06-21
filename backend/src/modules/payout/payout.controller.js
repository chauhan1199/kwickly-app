const { StatusCodes } = require('http-status-codes');
const Payout = require('./payout.model');
const Customer = require('../customer/customer.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');

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
    const { status, txnId, rejectReason } = req.body;

    const mongoose = require('mongoose');
    const isSingle = mongoose.connection.client.topology.s.description.type === 'Single';
    const session = isSingle ? null : await mongoose.startSession();
    if (session) session.startTransaction();
    try {
        const payout = await Payout.findById(id).session(session);
        if (!payout) {
            if (session) await session.abortTransaction();
            if (session) session.endSession();
            return errorResponse(res, 'Payout request not found', StatusCodes.NOT_FOUND);
        }

        payout.status = status.toUpperCase();
        if (txnId) payout.txnId = txnId;
        if (rejectReason) payout.rejectReason = rejectReason;
        payout.processedAt = Date.now();

        await payout.save({ session });

        // If rejected, refund the amount to the specific entity's wallet
        if (status.toUpperCase() === 'REJECTED') {
            const WalletTxn = require('../wallet/wallet.model');
            if (payout.workerId) {
                const worker = await Customer.findById(payout.workerId).session(session);
                if (worker) {
                    worker.wallet.balance += payout.amount;
                    await worker.save({ session });
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
                const shop = await Shop.findById(payout.shopId).session(session);
                if (shop) {
                    shop.wallet.balance += payout.amount;
                    await shop.save({ session });
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

        if (session) await session.commitTransaction();
        if (session) session.endSession();

        await delCache(CACHE_KEY);
        return successResponse(res, payout, `Payout ${status.toLowerCase()} successfully`);
    } catch (error) {
        if (session) await session.abortTransaction();
        if (session) session.endSession();
        throw error;
    }
});
