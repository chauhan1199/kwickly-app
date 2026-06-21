const { StatusCodes } = require('http-status-codes');
const Suggestion = require('./suggestion.model');
const Category = require('../category/category.model');
const Notification = require('../notification/notification.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate, emitToUser } = require('../../helpers/socket.helper');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');

const CATEGORY_COLORS = ['#2563EB','#F97316','#16A34A','#DC2626','#7C3AED','#0EA5E9','#92400E','#0F766E','#BE185D','#1D4ED8'];
const CACHE_KEY = 'admin_suggestions_list';

exports.getSuggestions = catchAsync(async (req, res) => {
    const cached = await getCache(CACHE_KEY);
    if (cached) return successResponse(res, cached, 'Suggestions fetched');

    const suggestions = await Suggestion.find().populate('workerId', 'name city').sort('-createdAt').lean();
    await setCache(CACHE_KEY, suggestions, 3600);
    
    return successResponse(res, suggestions, 'Suggestions fetched');
});

exports.approveSuggestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason || !reason.trim()) return errorResponse(res, 'Approval reason is required', StatusCodes.BAD_REQUEST);

    const sug = await Suggestion.findById(id);
    if (!sug) return errorResponse(res, 'Suggestion not found', StatusCodes.NOT_FOUND);

    if (sug.status !== 'pending') {
        return errorResponse(res, `Suggestion already ${sug.status}`, StatusCodes.BAD_REQUEST);
    }

    let createdCategory = null;
    let createdSubcategory = null;

    if (sug.type === 'new_category') {
        const existingCat = await Category.findOne({ name: { $regex: new RegExp(`^${sug.payload.name}$`, 'i') } });
        if (existingCat) {
            return errorResponse(res, `Category "${existingCat.name}" already exists. Suggestion rejected.`, StatusCodes.CONFLICT);
        }

        const randomColor = CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];
        createdCategory = await Category.create({
            name: sug.payload.name,
            icon: sug.payload.icon || '🔧',
            color: randomColor,
            description: sug.payload.description,
            subcategories: (sug.payload.suggestedSubcategories || []).map(name => ({
                name,
                description: `Service: ${name}`,
                active: true
            }))
        });
        await delCache('categories_list');
    } else {
        const cat = await Category.findById(sug.payload.parentCategoryId);
        if (!cat) return errorResponse(res, 'Parent category not found', StatusCodes.NOT_FOUND);
        
        const duplicateSub = cat.subcategories.find(s => s.name.toLowerCase() === sug.payload.name.toLowerCase());
        if (duplicateSub) {
            return errorResponse(res, `Subcategory "${sug.payload.name}" already exists in ${cat.name}`, StatusCodes.CONFLICT);
        }

        cat.subcategories.push({
            name: sug.payload.name,
            description: sug.payload.description,
            active: true
        });
        await cat.save();
        createdSubcategory = { name: sug.payload.name, categoryName: cat.name };
        await delCache('categories_list');
    }

    sug.status = 'approved';
    sug.approveReason = reason;
    await sug.save();

    await delCache(CACHE_KEY);
    triggerDashboardUpdate();

    const workerUserId = typeof sug.workerId === 'object' ? sug.workerId._id : sug.workerId;
    if (workerUserId) {
        const title = sug.type === 'new_category'
            ? `Category "${sug.payload.name}" Approved`
            : `Subcategory "${sug.payload.name}" Approved`;
        const message = sug.type === 'new_category'
            ? `Your suggested category "${sug.payload.name}" has been approved and is now live on the platform. ${reason}`
            : `Your suggested subcategory "${sug.payload.name}" has been added to "${createdSubcategory?.categoryName || 'the category'}". ${reason}`;

        const notification = await Notification.create({
            userId: workerUserId,
            title,
            message,
            type: 'DIRECT',
            action: 'CREATE',
            entityType: 'CATEGORY',
            entityId: createdCategory?._id || sug.payload.parentCategoryId,
            performedBy: req.admin?._id || req.user?._id,
            targetRole: 'WORKER'
        });

        emitToUser(workerUserId, 'NEW_NOTIFICATION', notification);
    }

    const adminId = req.user?._id;
    const sugLabel = sug.type === 'new_category' ? 'Category' : 'Subcategory';
    await logAdminActivity(
        'CREATE', 'CATEGORY', createdCategory?._id || sug.payload.parentCategoryId,
        `${sugLabel} Suggestion Approved`,
        `${sugLabel} suggestion "${sug.payload.name}" from ${typeof sug.workerId === 'object' ? sug.workerId.name : 'Worker'} approved`,
        adminId
    );

    return successResponse(res, sug, 'Suggestion approved successfully');
});

exports.rejectSuggestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) return errorResponse(res, 'Rejection reason is required', StatusCodes.BAD_REQUEST);
    
    const sug = await Suggestion.findById(id);
    if (!sug) return errorResponse(res, 'Suggestion not found', StatusCodes.NOT_FOUND);

    if (sug.status !== 'pending') {
        return errorResponse(res, `Suggestion already ${sug.status}`, StatusCodes.BAD_REQUEST);
    }

    sug.status = 'rejected';
    sug.rejectReason = reason;
    await sug.save();

    await delCache(CACHE_KEY);
    triggerDashboardUpdate();

    const workerUserId = typeof sug.workerId === 'object' ? sug.workerId._id : sug.workerId;
    if (workerUserId) {
        const title = sug.type === 'new_category'
            ? `Category "${sug.payload.name}" Not Approved`
            : `Subcategory "${sug.payload.name}" Not Approved`;
        const message = sug.type === 'new_category'
            ? `Your suggested category "${sug.payload.name}" was not approved at this time. Reason: ${reason}`
            : `Your suggested subcategory "${sug.payload.name}" for "${sug.payload.parentCategory}" was not approved. Reason: ${reason}`;

        const notification = await Notification.create({
            userId: workerUserId,
            title,
            message,
            type: 'DIRECT',
            action: 'UPDATE',
            entityType: 'CATEGORY',
            entityId: sug.payload.parentCategoryId,
            performedBy: req.admin?._id || req.user?._id,
            targetRole: 'WORKER'
        });

        emitToUser(workerUserId, 'NEW_NOTIFICATION', notification);
    }

    const adminId = req.user?._id;
    const sugLabel = sug.type === 'new_category' ? 'Category' : 'Subcategory';
    await logAdminActivity(
        'UPDATE', 'CATEGORY', sug.payload.parentCategoryId,
        `${sugLabel} Suggestion Rejected`,
        `${sugLabel} suggestion "${sug.payload.name}" from ${typeof sug.workerId === 'object' ? sug.workerId.name : 'Worker'} rejected`,
        adminId
    );

    return successResponse(res, sug, 'Suggestion rejected');
});
