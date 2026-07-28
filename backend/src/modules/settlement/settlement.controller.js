const { StatusCodes } = require('http-status-codes');
const Settlement = require('./settlement.model');
const Shop = require('../shop/shop.model');
const WalletTxn = require('../wallet/wallet.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { collectCommission } = require('../adminWallet/adminWallet.service');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const Notification = require('../notification/notification.model');
const { emitToUser, emitToAll } = require('../../helpers/socket.helper');
const logger = require('../../helpers/logger.helper');

exports.getSettlements = catchAsync(async (req, res) => {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const settlements = await Settlement.find(filter)
        .populate('shopId', 'name')
        .populate('orderId', 'orderNumber total')
        .sort({ createdAt: -1 });

    return successResponse(res, settlements, 'Settlements fetched');
});

exports.settle = catchAsync(async (req, res) => {
    const { shopAmount, commissionAmount, note } = req.body;
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) return errorResponse(res, 'Settlement not found', StatusCodes.NOT_FOUND);
    if (settlement.status !== 'PENDING') {
        return errorResponse(res, 'Settlement already processed', StatusCodes.BAD_REQUEST);
    }

    settlement.shopEarning = shopAmount || settlement.shopEarning;
    settlement.platformCommission = commissionAmount || settlement.platformCommission;

    // H12: Validate that shop earning + commission equals total amount
    if (Math.abs((settlement.shopEarning + settlement.platformCommission) - settlement.totalAmount) > 0.01) {
        return errorResponse(res, 'shopEarning + platformCommission must equal totalAmount', StatusCodes.BAD_REQUEST);
    }

    // H13: Track commission collection status
    let commissionStatus = 'OK';
    if (settlement.platformCommission > 0) {
        try {
            await collectCommission(
                settlement.platformCommission,
                `Commission from ${settlement.type} settlement #${settlement._id.toString().slice(-6)}`,
                settlement._id,
                'Settlement',
                { shopId: settlement.shopId, customerId: settlement.customerId }
            );
        } catch (e) {
            logger.error(`Commission collection failed for settlement #${settlement._id}: ${e.message}`, { settlementId: settlement._id, amount: settlement.platformCommission, error: e });
            commissionStatus = 'FAILED';
        }
    }

    // H11: Credit shop wallet FIRST, then mark SETTLED
    const shop = await Shop.findOneAndUpdate(
        { _id: settlement.shopId },
        { $inc: { 'wallet.balance': settlement.shopEarning } },
        { returnDocument: 'after' }
    );
    if (shop) {
        await WalletTxn.create({
            userId: shop.ownerId,
            type: 'ORDER_CREDIT',
            amount: settlement.shopEarning,
            balance: shop.wallet.balance,
            refId: String(settlement._id),
            status: 'COMPLETED',
            description: `Settlement payout for order #${String(settlement.orderId).slice(-6)}`
        });
    }

    // H13: Mark PARTIAL if commission collection failed, otherwise SETTLED
    settlement.status = commissionStatus === 'FAILED' ? 'PARTIAL' : 'SETTLED';
    settlement.settledAt = new Date();
    settlement.settledBy = req.user._id;
    settlement.note = note;
    await settlement.save();

    logAdminActivity('SETTLE', 'SHOP', settlement.shopId,
        'Settlement Processed',
        `₹${settlement.shopEarning} settled to shop wallet (commission: ₹${settlement.platformCommission})${commissionStatus === 'FAILED' ? ' [PARTIAL — commission collection failed]' : ''}`,
        req.user._id
    );

    if (shop) {
        const notif = await Notification.create({
            userId: shop.ownerId,
            title: 'Settlement Processed',
            message: `Your settlement of â‚¹${settlement.shopEarning} has been credited to your wallet.`,
            type: 'DIRECT',
            action: 'SETTLE',
            entityType: 'PAYOUT',
            entityId: settlement._id
        });
        emitToUser(shop.ownerId, 'NOTIFICATION', notif);
        emitToAll('NOTIFICATION', { title: 'Settlement Processed', message: `Settlement for shop ${shop.name || ''} processed`, targetRole: 'ADMIN' });
    }

    return successResponse(res, settlement, 'Settlement processed');
});

exports.bulkSettle = catchAsync(async (req, res) => {
    const { settlementIds } = req.body;
    const results = [];

    for (const id of settlementIds) {
        const settlement = await Settlement.findById(id);
        if (settlement && settlement.status === 'PENDING') {
            // H13: Track commission status per settlement
            let commissionStatus = 'OK';
            if (settlement.platformCommission > 0) {
                try {
                    await collectCommission(
                        settlement.platformCommission,
                        `Bulk commission from ${settlement.type} settlement #${settlement._id.toString().slice(-6)}`,
                        settlement._id,
                        'Settlement',
                        { shopId: settlement.shopId, customerId: settlement.customerId }
                    );
                } catch (e) {
                    logger.error(`Bulk commission collection failed for settlement #${settlement._id}: ${e.message}`, { settlementId: settlement._id, amount: settlement.platformCommission, error: e });
                    commissionStatus = 'FAILED';
                }
            }

            // H11: Credit shop wallet FIRST
            const shop = await Shop.findOneAndUpdate(
                { _id: settlement.shopId },
                { $inc: { 'wallet.balance': settlement.shopEarning } },
                { returnDocument: 'after' }
            );
            if (shop) {
                await WalletTxn.create({
                    userId: shop.ownerId,
                    type: 'ORDER_CREDIT',
                    amount: settlement.shopEarning,
                    balance: shop.wallet.balance,
                    refId: String(settlement._id),
                    status: 'COMPLETED',
                    description: `Bulk settlement payout for order #${String(settlement.orderId).slice(-6)}`
                });
            }

            // H11: THEN mark status (PARTIAL if commission failed)
            settlement.status = commissionStatus === 'FAILED' ? 'PARTIAL' : 'SETTLED';
            settlement.settledAt = new Date();
            settlement.settledBy = req.user._id;
            await settlement.save();

            results.push(id);

            if (shop) {
                const notif = await Notification.create({
                    userId: shop.ownerId,
                    title: 'Settlement Processed',
                    message: `Your settlement of â‚¹${settlement.shopEarning} has been credited to your wallet.`,
                    type: 'DIRECT',
                    action: 'SETTLE',
                    entityType: 'PAYOUT',
                    entityId: settlement._id
                });
                emitToUser(shop.ownerId, 'NOTIFICATION', notif);
            }
        }
    }

    emitToAll('NOTIFICATION', { title: 'Bulk Settlement Completed', message: `${results.length} settlements processed`, targetRole: 'ADMIN' });
    return successResponse(res, { settled: results.length, ids: results }, 'Bulk settlement completed');
});

exports.getPendingSettlements = catchAsync(async (req, res) => {
    const settlements = await Settlement.find({ status: 'PENDING' })
        .populate('shopId', 'name')
        .sort({ createdAt: -1 });

    const total = settlements.reduce((sum, s) => sum + s.shopEarning, 0);
    return successResponse(res, { settlements, total, count: settlements.length }, 'Pending settlements');
});
