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
    paymentMethod: Joi.string().valid('WALLET', 'UPI', 'COD').default('WALLET'),
    deliveryLocation: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number().allow(null)).default([72.5714, 23.0225])
    }).optional().default({ type: 'Point', coordinates: [72.5714, 23.0225] }),
    deliverySlot: Joi.alternatives().try(Joi.string(), Joi.object(), Joi.allow(null, '')).optional(),
    promoCode: Joi.string().optional().allow('', null)
}).unknown(true);

const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid('CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED').required(),
    otp: Joi.string().optional()
});

module.exports = {
    placeOrderSchema,
    updateOrderStatusSchema
};
