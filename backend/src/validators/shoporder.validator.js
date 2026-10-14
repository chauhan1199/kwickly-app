const Joi = require('joi');

const placeOrderSchema = Joi.object({
    shopId: Joi.string().required(),
    items: Joi.array().items(
        Joi.object({
            productId: Joi.string().required(),
            name: Joi.string().required(),
            price: Joi.number().required().min(0),
            qty: Joi.number().integer().required().min(1)
        }).unknown(true)
    ).min(1).required(),
    deliveryAddress: Joi.string().required(),
    paymentMethod: Joi.string().valid('WALLET', 'UPI', 'COD', 'CASH').default('WALLET'),
    // A real [lng, lat] is required: it is checked against the shop's delivery radius.
    deliveryLocation: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().ordered(
            Joi.number().min(-180).max(180).required(),
            Joi.number().min(-90).max(90).required()
        ).length(2).required()
    }).required().messages({ 'any.required': 'Delivery location is required. Please pick your address on the map.' }),
    deliverySlot: Joi.alternatives().try(Joi.string(), Joi.object(), Joi.allow(null, '')).optional(),
    promoCode: Joi.string().optional().allow('', null)
}).unknown(true);

const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid('CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED').required(),
    otp: Joi.string().optional(),
    note: Joi.string().max(300).allow('').optional(),
    // Who is carrying the order; only meaningful with OUT_FOR_DELIVERY.
    deliveryStaffId: Joi.string().hex().length(24).allow(null, '').optional()
});

module.exports = {
    placeOrderSchema,
    updateOrderStatusSchema
};
