const { StatusCodes } = require('http-status-codes');
const DeliveryStaff = require('./deliveryStaff.model');
const Shop = require('../shop/shop.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

exports.getStaff = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    const staff = await DeliveryStaff.find({ shopId: shop._id });
    return successResponse(res, staff, 'Delivery staff fetched');
});

exports.addStaff = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    // Whitelist allowed fields to prevent mass assignment
    const { name, phone } = req.body;
    if (!name) return errorResponse(res, 'Staff name is required', StatusCodes.BAD_REQUEST);
    if (phone && !/^\d{10,15}$/.test(phone)) {
        return errorResponse(res, 'Phone must be 10-15 digits', StatusCodes.BAD_REQUEST);
    }
    const existing = await DeliveryStaff.findOne({ phone, shopId: shop._id });
    if (existing) return errorResponse(res, 'Staff with this phone already exists', StatusCodes.CONFLICT);
    const staff = await DeliveryStaff.create({ name, phone, shopId: shop._id });
    return successResponse(res, staff, 'Staff added', StatusCodes.CREATED);
});

exports.updateStaff = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    // Whitelist allowed fields to prevent mass assignment
    const { name, phone } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    const staff = await DeliveryStaff.findOneAndUpdate(
        { _id: req.params.staffId, shopId: shop._id },
        { $set: updateData },
        { returnDocument: 'after' }
    );
    if (!staff) return errorResponse(res, 'Staff not found', StatusCodes.NOT_FOUND);
    return successResponse(res, staff, 'Staff updated');
});

exports.removeStaff = catchAsync(async (req, res) => {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return errorResponse(res, 'Shop not found', StatusCodes.NOT_FOUND);
    const staff = await DeliveryStaff.findOne({ _id: req.params.staffId, shopId: shop._id });
    if (!staff) return errorResponse(res, 'Staff not found', StatusCodes.NOT_FOUND);
    if (staff.activeOrderId) {
        const Order = require('../order/order.model');
        const activeOrder = await Order.findOne({ _id: staff.activeOrderId, status: { $in: ['NEW', 'CONFIRMED', 'PACKING'] } });
        if (activeOrder) {
            return errorResponse(res, 'Cannot remove staff with active delivery', StatusCodes.BAD_REQUEST);
        }
        staff.activeOrderId = null;
        await staff.save();
    }
    await DeliveryStaff.deleteOne({ _id: staff._id });
    return successResponse(res, null, 'Staff removed');
});
