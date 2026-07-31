const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { addToCartSchema, updateCartItemSchema } = require('../../validators/cart.validator');

router.use(authMiddleware);

router.get('/',          authorize('CUSTOMER'),       cartController.getCart);
router.post('/',          authorize('CUSTOMER'), validate(addToCartSchema), cartController.addToCart);
router.delete('/clear',   authorize('CUSTOMER'),       cartController.clearCart);
router.patch('/:itemId',  authorize('CUSTOMER'), validate(updateCartItemSchema), cartController.updateCartItem);
router.delete('/:itemId', authorize('CUSTOMER'),       cartController.removeCartItem);

module.exports = router;
