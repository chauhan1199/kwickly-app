const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.use(authMiddleware);

router.get('/',          authorize('CUSTOMER'),       cartController.getCart);
router.post('/',          authorize('CUSTOMER'),       cartController.addToCart);
router.delete('/clear',   authorize('CUSTOMER'),       cartController.clearCart);
router.patch('/:itemId',  authorize('CUSTOMER'),       cartController.updateCartItem);
router.delete('/:itemId', authorize('CUSTOMER'),       cartController.removeCartItem);

module.exports = router;
