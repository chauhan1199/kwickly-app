const { StatusCodes } = require('http-status-codes');
const Category = require('./category.model');
const CategorySuggestion = require('./suggestion.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');

const CACHE_KEY = 'categories_list';

exports.getCategories = catchAsync(async (req, res) => {
    // 1. Try to get from Redis cache
    const cachedData = await getCache(CACHE_KEY);
    if (cachedData) {
        return successResponse(res, cachedData, 'Categories fetched from cache');
    }

    // 2. Fetch from DB
    const categories = await Category.find().sort('name');
    
    // 3. Save to Redis for next time (expire in 1 hour)
    await setCache(CACHE_KEY, categories, 3600);

    return successResponse(res, categories, 'Categories fetched successfully');
});

exports.createCategory = catchAsync(async (req, res) => {
    const category = await Category.create(req.body);
    
    // Invalidate cache
    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();
    
    return successResponse(res, category, 'Category created successfully', StatusCodes.CREATED);
});

exports.updateCategory = catchAsync(async (req, res) => {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    // Invalidate cache
    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, category, 'Category updated successfully');
});

exports.deleteCategory = catchAsync(async (req, res) => {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    // Invalidate cache
    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, null, 'Category deleted successfully');
});

exports.addSubcategory = catchAsync(async (req, res) => {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    category.subcategories.push(req.body);
    await category.save();

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    return successResponse(res, category, 'Subcategory added successfully');
});

exports.getSuggestions = catchAsync(async (req, res) => {
    const suggestions = await CategorySuggestion.find().populate('suggestedBy', 'name email phone').populate('parentCategory', 'name').sort('-createdAt');
    return successResponse(res, suggestions, 'Suggestions fetched successfully');
});

exports.processSuggestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, adminFeedback } = req.body;

    const suggestion = await CategorySuggestion.findById(id);
    if (!suggestion) {
        return errorResponse(res, 'Suggestion not found', StatusCodes.NOT_FOUND);
    }

    suggestion.status = status;
    if (adminFeedback) suggestion.adminFeedback = adminFeedback;
    await suggestion.save();

    if (status === 'APPROVED') {
        if (suggestion.type === 'CATEGORY') {
            await Category.create({ name: suggestion.name, active: true });
        } else if (suggestion.type === 'SUBCATEGORY') {
            const parentCat = await Category.findById(suggestion.parentCategory);
            if (parentCat) {
                parentCat.subcategories.push({ name: suggestion.name, active: true });
                await parentCat.save();
            }
        }
        await delCache(CACHE_KEY);
        await delCache('admin_dashboard_stats');
        triggerDashboardUpdate();
    }

    return successResponse(res, suggestion, 'Suggestion processed successfully');
});
