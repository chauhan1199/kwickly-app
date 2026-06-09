const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

// Public list route (No auth required to browse services)
router.get('/', categoryController.getCategories);

// Protected admin management routes
router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/suggestions', categoryController.getSuggestions);
router.patch('/suggestions/:id', categoryController.processSuggestion);

router.post('/', categoryController.createCategory);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.post('/:id/subcategories', categoryController.addSubcategory);

module.exports = router;
