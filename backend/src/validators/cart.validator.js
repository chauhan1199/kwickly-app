const Joi = require('joi');

// Add to cart schema (matches controller + mobile contract: { shopId, productId, qty })
const addToCartSchema = Joi.object({
  productId: Joi.string().required(),
  shopId: Joi.string().required(),
  qty: Joi.number().integer().min(1).max(100).required(),
  image: Joi.string().optional(),
  customization: Joi.string().max(500).optional(),
});

// Update cart item schema — qty 0 removes the item (mobile decrement-to-zero path)
const updateCartItemSchema = Joi.object({
  qty: Joi.number().integer().min(0).max(100).required(),
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
