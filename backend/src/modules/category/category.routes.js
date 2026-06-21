const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { createCategorySchema, updateCategorySchema, addSubcategorySchema } = require('../../validators/category.validator');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const { delCache } = require('../../helpers/redis.helper');

// Public list route (No auth required to browse services)
router.get('/', categoryController.getCategories);

// Protected admin management routes
router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/suggestions', categoryController.getSuggestions);
router.patch('/suggestions/:id', categoryController.processSuggestion);

router.post('/', validate(createCategorySchema), categoryController.createCategory);
router.patch('/:id', validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.post('/:id/subcategories', validate(addSubcategorySchema), categoryController.addSubcategory);
router.delete('/:id/subcategories/:subId', categoryController.deleteSubcategory);

module.exports = router;
