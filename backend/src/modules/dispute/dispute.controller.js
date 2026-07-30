const { StatusCodes } = require('http-status-codes');
const Dispute = require('./dispute.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');

const CACHE_KEY = 'admin_disputes_list';

exports.getDisputes = catchAsync(async (req, res) => {
    const cached = await getCache(CACHE_KEY);
    if (cached) return successResponse(res, cached, 'Disputes fetched');

    const disputes = await Dispute.find()
        .populate('customerId', 'name phone email avatar')
        .populate('workerId', 'name phone email avatar')
        .populate('jobId', 'category title payment status')
        .populate('shopOrderId', 'orderNumber total status')
        .sort('-createdAt')
        .lean();
    
    await setCache(CACHE_KEY, disputes, 300);
    
    return successResponse(res, disputes, 'Disputes fetched');
});

exports.openDispute = catchAsync(async (req, res) => {
    const { jobId, shopOrderId, reason, description, issue } = req.body;
    const customerId = req.user._id;

    let targetId, model, field;
    if (jobId) {
        targetId = jobId;
        model = require('../job/job.model');
        field = 'jobId';
    } else {
        targetId = shopOrderId;
        model = require('../shoporder/shoporder.model');
        field = 'shopOrderId'; // Assuming you might add this to dispute model or rely on jobId field as generic ref
    }

    const item = await model.findById(targetId);
    if (!item) return errorResponse(res, 'Reference item not found', StatusCodes.NOT_FOUND);
    if (String(item.customerId) !== String(customerId)) {
        return errorResponse(res, 'Unauthorized to open dispute for this item', StatusCodes.FORBIDDEN);
    }

    const existingDispute = await Dispute.findOne({ customerId, [field]: targetId, status: { $ne: 'RESOLVED' } });
    if (existingDispute) {
        return errorResponse(res, 'An active dispute already exists for this item', StatusCodes.CONFLICT);
    }

    const workerId = item.workerId || item.shopId; // Store shopId in workerId if shop order

    const dispute = await Dispute.create({
        [field]: targetId,
        customerId,
        workerId,
        issue: issue || reason,
        reason,
        description,
        status: 'OPEN'
    });

    // Link Dispute collection entry to the job's embedded dispute system
    if (field === 'jobId' && item.dispute) {
        item.disputeId = dispute._id;
        await item.save();
    }

    await delCache(CACHE_KEY);
    triggerDashboardUpdate();

    return successResponse(res, dispute, 'Dispute opened successfully', StatusCodes.CREATED);
});

exports.updateDisputeStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, resolution, resolutionNotes, refundAmount } = req.body;
    
    const finalResolution = resolution || resolutionNotes;

    const dispute = await Dispute.findById(id).populate('jobId').populate('shopOrderId');
    if (!dispute) return errorResponse(res, 'Dispute not found', StatusCodes.NOT_FOUND);

    // Idempotency guard â€” prevent double refund
    if (status === 'REFUNDED' && dispute.status === 'REFUNDED') {
        return errorResponse(res, 'This dispute has already been refunded', StatusCodes.CONFLICT);
    }

    // Wallet execution for REFUND
    let actualRefundAmount = 0;
    if (status === 'REFUNDED') {
        const originalAmount = dispute.jobId?.payment?.amount || dispute.shopOrderId?.total || 0;
        actualRefundAmount = refundAmount !== undefined ? Number(refundAmount) : originalAmount;

        if (actualRefundAmount > originalAmount) {
            return errorResponse(res, `Refund amount (₹${actualRefundAmount}) cannot exceed the original payment amount (₹${originalAmount})`, StatusCodes.BAD_REQUEST);
        }

        if (actualRefundAmount > 0) {
            const Customer = require('../customer/customer.model');
            const Shop = require('../shop/shop.model');
            const WalletTxn = require('../wallet/wallet.model');
            const Notification = require('../notification/notification.model');
            const { emitToUser } = require('../../helpers/socket.helper');

            // 1. Credit Customer
            const customer = await Customer.findByIdAndUpdate(dispute.customerId, { $inc: { 'wallet.balance': actualRefundAmount } }, { returnDocument: 'after' });
            if (customer) {
                await WalletTxn.create({
                    userId: customer._id,
                    type: 'REFUND',
                    amount: actualRefundAmount,
                    balance: customer.wallet.balance,
                    status: 'COMPLETED',
                    description: `Dispute Refund for Ref: ${dispute._id.toString().slice(-8)}`
                });

                await Notification.create({
                    userId: customer._id, title: 'Dispute Refunded',
                    message: `Your dispute has been resolved. â‚¹${actualRefundAmount} has been refunded to your wallet.`,
                    type: 'DIRECT', action: 'WALLET_CREDIT', entityType: 'DISPUTE', entityId: dispute._id
                });
                emitToUser(customer._id.toString(), 'NEW_NOTIFICATION', { message: `â‚¹${actualRefundAmount} refunded for dispute.` });
            }

            // 2. Handle Provider Deduction
            if (dispute.workerId) {
                // Check if there is an active settlement
                const Settlement = require('../settlement/settlement.model');
                const settlement = await Settlement.findOne({
                    $or: [{ orderId: dispute.shopOrderId }, { orderId: dispute.jobId }]
                });

                if (settlement && settlement.status === 'PENDING') {
                    // Money was never paid to the provider, so we just cancel the pending settlement.
                    // We don't deduct from their wallet since they never got it.
                    settlement.status = 'CANCELLED';
                    settlement.note = `Cancelled due to Dispute Refund Ref: ${dispute._id.toString().slice(-8)}`;
                    await settlement.save();

                    await Notification.create({
                        userId: dispute.workerId, title: 'Settlement Cancelled',
                        message: `A dispute was resolved against you. Your pending settlement of â‚¹${settlement.shopEarning} has been cancelled.`,
                        type: 'DIRECT', action: 'SYSTEM', entityType: 'DISPUTE', entityId: dispute._id
                    });
                    emitToUser(dispute.workerId.toString(), 'NEW_NOTIFICATION', { message: `Pending settlement cancelled due to dispute.` });
                } else {
                    // Either no settlement tracking (direct payment) or it was already SETTLED.
                    // We must claw back the money from their wallet.
                    let pQuery = { _id: dispute.workerId };
                    let pModel = Customer;
                    const shop = await Shop.findOne({ ownerId: dispute.workerId });
                    if (shop) {
                        pModel = Shop;
                        pQuery = { _id: shop._id };
                    }

                    // Check provider has sufficient balance before debiting
                    const provider = await pModel.findById(pQuery._id).select('wallet.balance');
                    if (!provider || (provider.wallet?.balance || 0) < actualRefundAmount) {
                        // Provider doesn't have enough â€” only deduct what they have
                        const maxDeduct = Math.max(0, provider?.wallet?.balance || 0);
                        if (maxDeduct > 0) {
                            await pModel.findByIdAndUpdate(pQuery._id, { $inc: { 'wallet.balance': -maxDeduct } });
                            await WalletTxn.create({
                                userId: dispute.workerId, type: 'ADJUSTMENT', amount: maxDeduct,
                                balance: 0, status: 'COMPLETED',
                                description: `Partial dispute deduction (max available) Ref: ${dispute._id.toString().slice(-8)}`
                            });
                        }
                    } else {
                        await pModel.findByIdAndUpdate(pQuery._id, { $inc: { 'wallet.balance': -actualRefundAmount } });
                        await WalletTxn.create({
                            userId: dispute.workerId, type: 'ADJUSTMENT', amount: actualRefundAmount,
                            balance: (provider.wallet?.balance || 0) - actualRefundAmount, status: 'COMPLETED',
                            description: `Dispute Deduction Ref: ${dispute._id.toString().slice(-8)}`
                        });
                    }

                    await Notification.create({
                        userId: dispute.workerId, title: 'Dispute Adjustment',
                        message: `A dispute was resolved against you. â‚¹${actualRefundAmount} has been deducted from your wallet.`,
                        type: 'DIRECT', action: 'WALLET_DEBIT', entityType: 'DISPUTE', entityId: dispute._id
                    });
                    emitToUser(dispute.workerId.toString(), 'NEW_NOTIFICATION', { message: `â‚¹${actualRefundAmount} deducted for dispute.` });
                }
            }
        }
    }

    dispute.status = status;
    dispute.resolutionNotes = finalResolution;
    if (['RESOLVED', 'REFUNDED', 'DISMISSED'].includes(status)) dispute.resolvedAt = new Date();
    await dispute.save();

    logAdminActivity('UPDATE', 'DISPUTE', dispute._id, 
        `Dispute marked as ${status.toUpperCase()}`, 
        `Resolution: ${finalResolution || 'None'}${status==='REFUNDED' ? ` | Refunded: ₹${actualRefundAmount}` : ''}`, 
        req.user._id
    );

    await delCache(CACHE_KEY);
    triggerDashboardUpdate();

    return successResponse(res, dispute, 'Dispute updated');
});
