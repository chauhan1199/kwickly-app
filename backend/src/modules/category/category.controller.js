const { StatusCodes } = require('http-status-codes');
const Category = require('./category.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');

const CACHE_KEY = 'categories_list';

exports.getCategories = catchAsync(async (req, res) => {
    const cachedData = await getCache(CACHE_KEY);
    if (cachedData) {
        return successResponse(res, cachedData, 'Categories fetched from cache');
    }

    const categories = await Category.find().sort('name');
    await setCache(CACHE_KEY, categories, 3600);

    return successResponse(res, categories, 'Categories fetched successfully');
});

exports.createCategory = catchAsync(async (req, res) => {
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') } });
    if (existing) {
        return errorResponse(res, `Category "${existing.name}" already exists`, StatusCodes.CONFLICT);
    }

    if (req.body.subcategories?.length) {
        const seen = new Set();
        for (const sub of req.body.subcategories) {
            const key = sub.name.trim().toLowerCase();
            if (seen.has(key)) {
                return errorResponse(res, `Duplicate subcategory "${sub.name}" in request`, StatusCodes.BAD_REQUEST);
            }
            seen.add(key);
        }
    }

    const category = await Category.create(req.body);
    
    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity(
        'CREATE', 'CATEGORY', category._id,
        'Category Created',
        `New category "${category.name}" created with ${category.subcategories.length} subcategories`,
        req.user?._id
    ).catch(() => {});
    
    return successResponse(res, category, 'Category created successfully', StatusCodes.CREATED);
});

exports.updateCategory = catchAsync(async (req, res) => {
    if (req.body.name) {
        const existing = await Category.findOne({
            name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') },
            _id: { $ne: req.params.id }
        });
        if (existing) {
            return errorResponse(res, `Category "${existing.name}" already exists`, StatusCodes.CONFLICT);
        }
    }

    if (req.body.subcategories?.length) {
        const seen = new Set();
        for (const sub of req.body.subcategories) {
            const key = sub.name.trim().toLowerCase();
            if (seen.has(key)) {
                return errorResponse(res, `Duplicate subcategory "${sub.name}" in request`, StatusCodes.BAD_REQUEST);
            }
            seen.add(key);
        }
    }

    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    const changes = [];
    if (req.body.active !== undefined) changes.push(`status: ${req.body.active ? 'Active' : 'Hidden'}`);
    if (req.body.name) changes.push(`name: "${req.body.name}"`);
    if (req.body.subcategories) changes.push(`subcategories: ${req.body.subcategories.length} items`);

    logAdminActivity(
        'UPDATE', 'CATEGORY', category._id,
        'Category Updated',
        `Category "${category.name}" updated${changes.length ? ' — ' + changes.join(', ') : ''}`,
        req.user?._id
    ).catch(() => {});

    return successResponse(res, category, 'Category updated successfully');
});

exports.deleteCategory = catchAsync(async (req, res) => {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity(
        'DELETE', 'CATEGORY', req.params.id,
        'Category Deleted',
        `Category "${category.name}" deleted with ${category.subcategories.length} subcategories`,
        req.user?._id
    ).catch(() => {});

    return successResponse(res, null, 'Category deleted successfully');
});

exports.addSubcategory = catchAsync(async (req, res) => {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    const subName = req.body.name.trim();
    const duplicate = category.subcategories.find(s => s.name.toLowerCase() === subName.toLowerCase());
    if (duplicate) {
        return errorResponse(res, `Subcategory "${duplicate.name}" already exists in "${category.name}"`, StatusCodes.CONFLICT);
    }

    category.subcategories.push(req.body);
    await category.save();

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity(
        'CREATE', 'CATEGORY', category._id,
        'Subcategory Added',
        `Subcategory "${req.body.name}" added to "${category.name}"`,
        req.user?._id
    ).catch(() => {});

    return successResponse(res, category, 'Subcategory added successfully');
});

exports.deleteSubcategory = catchAsync(async (req, res) => {
    const { id, subId } = req.params;
    const category = await Category.findById(id);
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    const sub = category.subcategories.id(subId);
    if (!sub) {
        return errorResponse(res, 'Subcategory not found', StatusCodes.NOT_FOUND);
    }

    const subName = sub.name;
    category.subcategories.pull(subId);
    await category.save();

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();

    logAdminActivity(
        'DELETE', 'CATEGORY', category._id,
        'Subcategory Deleted',
        `Subcategory "${subName}" removed from "${category.name}"`,
        req.user?._id
    ).catch(() => {});

    return successResponse(res, category, 'Subcategory deleted successfully');
});

exports.getSuggestions = catchAsync(async (req, res) => {
    const Suggestion = require('../suggestion/suggestion.model');
    const suggestions = await Suggestion.find().populate('workerId', 'name email phone').sort('-createdAt');
    return successResponse(res, suggestions, 'Suggestions fetched successfully');
});

exports.processSuggestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, adminFeedback } = req.body;

    const Suggestion = require('../suggestion/suggestion.model');
    const suggestion = await Suggestion.findById(id);
    if (!suggestion) {
        return errorResponse(res, 'Suggestion not found', StatusCodes.NOT_FOUND);
    }

    suggestion.status = status === 'APPROVED' ? 'approved' : 'rejected';
    if (adminFeedback) suggestion.approveReason = adminFeedback;
    await suggestion.save();

    if (status === 'APPROVED') {
        if (suggestion.type === 'new_category') {
            const existingCat = await Category.findOne({ name: { $regex: new RegExp(`^${suggestion.payload?.name || suggestion.name}$`, 'i') } });
            if (existingCat) {
                return errorResponse(res, `Category "${existingCat.name}" already exists`, StatusCodes.CONFLICT);
            }
            await Category.create({
                name: suggestion.payload?.name || suggestion.name,
                icon: suggestion.payload?.icon || '📋',
                color: '#6366F1',
                description: suggestion.payload?.description || '',
                active: true,
                subcategories: (suggestion.payload?.suggestedSubcategories || []).map(name => ({ name, active: true }))
            });
        } else if (suggestion.type === 'new_subcategory') {
            const parentCat = await Category.findById(suggestion.payload?.parentCategoryId);
            if (parentCat) {
                const subName = suggestion.payload?.name || suggestion.name;
                const dup = parentCat.subcategories.find(s => s.name.toLowerCase() === subName.toLowerCase());
                if (!dup) {
                    parentCat.subcategories.push({ name: subName, active: true });
                    await parentCat.save();
                }
            }
        }
        await delCache(CACHE_KEY);
        await delCache('admin_dashboard_stats');
        triggerDashboardUpdate();
    }

    return successResponse(res, suggestion, 'Suggestion processed successfully');
});
