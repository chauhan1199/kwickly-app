const { StatusCodes } = require('http-status-codes');
const Suggestion = require('./suggestion.model');
const Category = require('../category/category.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');

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
    
    if (!reason) return errorResponse(res, 'Approval reason is required', StatusCodes.BAD_REQUEST);

    const sug = await Suggestion.findById(id);
    if (!sug) return errorResponse(res, 'Suggestion not found', StatusCodes.NOT_FOUND);

    if (sug.type === 'new_category') {
        await Category.create({
            name: sug.payload.name,
            icon: sug.payload.icon || '🔧',
            description: sug.payload.description,
            subcategories: sug.payload.suggestedSubcategories.map(name => ({
                name,
                description: `Service: ${name}`,
                active: true
            }))
        });
        await delCache('categories_list');
    } else {
        const cat = await Category.findById(sug.payload.parentCategoryId);
        if (cat) {
            cat.subcategories.push({
                name: sug.payload.name,
                description: sug.payload.description,
                active: true
            });
            await cat.save();
            await delCache('categories_list');
        }
    }

    sug.status = 'approved';
    sug.approveReason = reason;
    await sug.save();

    await delCache(CACHE_KEY);
    triggerDashboardUpdate();

    return successResponse(res, sug, 'Suggestion approved');
});

exports.rejectSuggestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    const sug = await Suggestion.findByIdAndUpdate(id, { 
        status: 'rejected', 
        rejectReason: reason 
    }, { new: true });

    if (!sug) return errorResponse(res, 'Suggestion not found', StatusCodes.NOT_FOUND);

    await delCache(CACHE_KEY);
    triggerDashboardUpdate();

    return successResponse(res, sug, 'Suggestion rejected');
});
