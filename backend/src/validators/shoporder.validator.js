const Joi = require('joi');

const placeOrderSchema = Joi.object({
    shopId: Joi.string().required(),
    items: Joi.array().items(
        Joi.object({
            productId: Joi.string().required(),
            name: Joi.string().required(),
            price: Joi.number().required().min(0),
            qty: Joi.number().integer().required().min(1)
        })
    ).min(1).required(),
    deliveryAddress: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        pincode: Joi.string().required(),
        area: Joi.string().allow('')
    }).required(),
    deliveryLocation: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).required()
});

const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid('PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED').required()
});

module.exports = {
    placeOrderSchema,
    updateOrderStatusSchema
};
