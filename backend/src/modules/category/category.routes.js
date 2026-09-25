const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { createCategorySchema, updateCategorySchema, addSubcategorySchema, updateSubcategorySchema } = require('../../validators/category.validator');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const { delCache } = require('../../helpers/redis.helper');
const upload = require('../../middleware/upload.middleware');

// Public list route (No auth required to browse services)
router.get('/', categoryController.getCategories);

// Protected admin management routes
router.use(authMiddleware);
router.use(authorize('ADMIN'));

// Admin suggestion routes (must be before /:categoryId catch-all)
router.post('/clear-cache', categoryController.clearCache);
router.get('/suggestions', categoryController.getSuggestions);
router.patch('/suggestions/:id', categoryController.processSuggestion);

router.post('/', upload.single('image'), validate(createCategorySchema), categoryController.createCategory);
router.patch('/:id', upload.single('image'), validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.post('/:id/subcategories', upload.single('image'), validate(addSubcategorySchema), categoryController.addSubcategory);
router.patch('/:id/subcategories/:subId', upload.single('image'), validate(updateSubcategorySchema), categoryController.updateSubcategory);
router.delete('/:id/subcategories/:subId', categoryController.deleteSubcategory);

module.exports = router;
