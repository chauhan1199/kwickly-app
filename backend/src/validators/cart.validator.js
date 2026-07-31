const Joi = require('joi');

// Add to cart schema
const addToCartSchema = Joi.object({
  productId: Joi.string().required(),
  shopId: Joi.string().required(),
  quantity: Joi.number().min(1).max(100).required(),
  name: Joi.string().min(2).max(100).required(),
  price: Joi.number().min(0).required(),
  image: Joi.string().optional(),
  customization: Joi.string().max(500).optional(),
});

// Update cart item schema
const updateCartItemSchema = Joi.object({
  quantity: Joi.number().min(1).max(100).required(),
});

// Remove from cart schema
const removeFromCartSchema = Joi.object({
  itemId: Joi.string().required(),
});

// Clear cart schema
const clearCartSchema = Joi.object({
  shopId: Joi.string().optional(),
});

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
  removeFromCartSchema,
  clearCartSchema,
};
