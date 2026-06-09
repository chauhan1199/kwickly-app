const express = require('express');
const router  = express.Router();
const ctrl    = require('./product.controller');
const upload  = require('../../middleware/upload.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize          = require('../../middleware/role.middleware');
const validate           = require('../../middleware/validate.middleware');
const { createProductSchema, updateProductSchema } = require('../../validators/product.validator');

router.get('/',         authMiddleware, ctrl.getProducts);
router.get('/shop',     authMiddleware, ctrl.getShopProducts);
router.get('/:id',      authMiddleware, ctrl.getProductById);
router.post('/',        authMiddleware, upload.single('image'), validate(createProductSchema), ctrl.createProduct);
router.patch('/:id',    authMiddleware, upload.single('image'), validate(updateProductSchema), ctrl.updateProduct);
router.delete('/:id',   authMiddleware, ctrl.deleteProduct);

module.exports = router;
