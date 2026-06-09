const express = require('express');
const router  = express.Router();
const ctrl    = require('./product.controller');
const upload  = require('../../middleware/upload.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');

router.get('/',         authMiddleware, ctrl.getProducts);
router.get('/shop',     authMiddleware, ctrl.getShopProducts);
router.get('/:id',      authMiddleware, ctrl.getProductById);
router.post('/',        authMiddleware, upload.single('image'), ctrl.createProduct);
router.patch('/:id',    authMiddleware, upload.single('image'), ctrl.updateProduct);
router.delete('/:id',   authMiddleware, ctrl.deleteProduct);

module.exports = router;
