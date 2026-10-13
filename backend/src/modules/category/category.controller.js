const { StatusCodes } = require('http-status-codes');
const Category = require('./category.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { uploadImage, cleanupImage } = require('../../services/cloudinary.service');

// Helper to escape regex special characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const { getCache, setCache, delCache } = require('../../helpers/redis.helper');
const { triggerDashboardUpdate } = require('../../helpers/socket.helper');
const { logAdminActivity } = require('../../helpers/adminActivity.helper');
const logger = require('../../helpers/logger.helper');

const CACHE_KEY = 'categories_list';

// High-demand, frequently used consumer service categories ranking
const FREQUENT_SERVICES_PRIORITY = [
    'clean',       // Cleaning Service
    'plumb',       // Plumbing Service
    'electric',    // Electrical service
    'ac &',        // Ac & Hvac service
    'hvac',
    'car',         // Car service
    'bike',        // Bike / Two wheeler service
    'wheeler',
    'appliance',   // Home appliance repair
    'carpenter',   // Carpentry & furniture
    'furniture',
    'paint',       // Painting & waterproofing
    'cook',        // Cook & food service
    'salon',       // Beauty & saloon at home
    'beauty',
    'pest',        // Pest control service
    'spa',         // Spa & massage therapy
    'child',       // Baby & child care
    'fitness',     // Fitness & wellness at home
    'packers',     // Packers & movers
];

const normalizeForMatch = (str) => {
    return (str || '')
        .toLowerCase()
        .replace(/\b(services?|at home|repair|work|technician|expert)\b/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim();
};

const matchesCategory = (categoryName, jobCategory) => {
    if (!categoryName || !jobCategory) return false;
    const cWords = normalizeForMatch(categoryName).split(/\s+/).filter(w => w.length >= 3);
    const jWords = normalizeForMatch(jobCategory).split(/\s+/).filter(w => w.length >= 3);
    return jWords.some(jw => cWords.some(cw => cw === jw || (cw.startsWith(jw) && jw.length >= 4) || (jw.startsWith(cw) && cw.length >= 4)));
};

const COMMON_SUB_PRIORITY = [
    'general',
    'deep clean',
    'foam wash',
    'wash',
    'tuning',
    'service',
    'inspection',
    'repair',
    'leak',
    'oil change',
    'cooling',
    'gas',
    'facial',
    'hair',
    'massage',
    'wiring',
    'installation',
    'switch',
    'board',
];

const getSubFrequencyScore = (subName, subCountsMap = {}) => {
    let score = 0;
    const lower = (subName || '').toLowerCase();

    for (const [jobSub, count] of Object.entries(subCountsMap)) {
        if (matchesCategory(subName, jobSub)) {
            score += count * 50;
        }
    }

    for (let i = 0; i < COMMON_SUB_PRIORITY.length; i++) {
        if (lower.includes(COMMON_SUB_PRIORITY[i])) {
            score += (COMMON_SUB_PRIORITY.length - i) * 10;
            break;
        }
    }

    return score;
};

const getCategoryFrequencyScore = (catName, jobCountsMap = {}) => {
    let score = 0;
    const lower = (catName || '').toLowerCase();

    // 1. Boost based on actual real-time jobs in the database
    for (const [jobCat, count] of Object.entries(jobCountsMap)) {
        if (matchesCategory(catName, jobCat)) {
            score += count * 50;
        }
    }

    // 2. Priority weighting for everyday household services
    for (let i = 0; i < FREQUENT_SERVICES_PRIORITY.length; i++) {
        if (lower.includes(FREQUENT_SERVICES_PRIORITY[i])) {
            score += (FREQUENT_SERVICES_PRIORITY.length - i) * 20;
            break;
        }
    }

    return score;
};

exports.getCategories = catchAsync(async (req, res) => {
    const isAdmin = req.originalUrl.includes('/admin');
    const forceRefresh = req.query.refresh === 'true' || req.headers['cache-control'] === 'no-cache';

    let categories;
    const cachedData = forceRefresh ? null : await getCache(CACHE_KEY);

    if (cachedData) {
        categories = cachedData;
    } else {
        const rawCategories = await Category.find().lean();
        let jobCountsMap = {};
        let subCountsMap = {};
        try {
            const Job = require('../job/job.model');
            const jobs = await Job.find({}).select('category subcategory').lean();
            jobs.forEach(j => {
                if (j.category) {
                    jobCountsMap[j.category] = (jobCountsMap[j.category] || 0) + 1;
                }
                if (j.subcategory) {
                    subCountsMap[j.subcategory] = (subCountsMap[j.subcategory] || 0) + 1;
                }
            });
        } catch (_) {}

        categories = rawCategories.map(c => {
            const bookingCount = Object.entries(jobCountsMap).reduce((acc, [k, v]) => {
                return matchesCategory(c.name, k) ? acc + v : acc;
            }, c.bookingCount || 0);
            const frequencyScore = getCategoryFrequencyScore(c.name, jobCountsMap);

            let sortedSubs = (c.subcategories || []).map(s => {
                const subBookingCount = Object.entries(subCountsMap).reduce((acc, [k, v]) => {
                    return matchesCategory(s.name, k) ? acc + v : acc;
                }, s.bookingCount || 0);
                const subFrequencyScore = getSubFrequencyScore(s.name, subCountsMap);
                return {
                    ...s,
                    bookingCount: subBookingCount,
                    frequencyScore: subFrequencyScore
                };
            });

            // Sort subcategories by most frequently used first
            sortedSubs.sort((s1, s2) => {
                if ((s2.frequencyScore || 0) !== (s1.frequencyScore || 0)) {
                    return (s2.frequencyScore || 0) - (s1.frequencyScore || 0);
                }
                if ((s2.bookingCount || 0) !== (s1.bookingCount || 0)) {
                    return (s2.bookingCount || 0) - (s1.bookingCount || 0);
                }
                return (s1.name || '').localeCompare(s2.name || '');
            });

            return {
                ...c,
                bookingCount,
                frequencyScore,
                subcategories: sortedSubs
            };
        });

        // Sort descending by frequencyScore / bookingCount, then alphabetical
        categories.sort((a, b) => {
            if ((b.frequencyScore || 0) !== (a.frequencyScore || 0)) {
                return (b.frequencyScore || 0) - (a.frequencyScore || 0);
            }
            if ((b.bookingCount || 0) !== (a.bookingCount || 0)) {
                return (b.bookingCount || 0) - (a.bookingCount || 0);
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        await setCache(CACHE_KEY, categories, 3600);
    }

    if (!isAdmin) {
        // Deep copy to avoid mutating cached object
        const categoriesCopy = JSON.parse(JSON.stringify(categories));
        const activeCategories = categoriesCopy.filter(c => c.active !== false).map(c => {
            if (c.subcategories) {
                c.subcategories = c.subcategories.filter(s => s.active !== false);
            }
            return c;
        });
        return successResponse(res, activeCategories, 'Categories fetched successfully');
    }

    return successResponse(res, categories, 'Categories fetched successfully');
});

// GET /api/v1/categories/:categoryId (Public - subcategories by category) ──
exports.getCategoryById = catchAsync(async (req, res) => {
    const { categoryId } = req.params;

    const cachedData = await getCache(CACHE_KEY);
    let categories = cachedData;
    if (!categories) {
        categories = await Category.find().sort('name').lean();
        if (categories) await setCache(CACHE_KEY, categories, 3600);
    }

    const category = categories.find(c => c._id.toString() === categoryId);
    if (!category) return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);

    const subcategories = (category.subcategories || []).filter(s => s.active !== false);
    return successResponse(res, { ...category, subcategories }, 'Category fetched');
});

//POST /api/v1/categories (Admin) ────────────────────────────────────────
exports.createCategory = catchAsync(async (req, res) => {
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${escapeRegex(req.body.name.trim())}$`, 'i') } }).lean();
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

    const categoryData = { ...req.body };
    if (req.file) {
        const { url } = await uploadImage(req.file.buffer, 'kwickly/categories');
        categoryData.imageUrl = url;
    }

    const category = await Category.create(categoryData);

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    await delCache('top_pros_list');
    triggerDashboardUpdate();

    logAdminActivity(
        'CREATE', 'CATEGORY', category._id,
        'Category Created',
        `New category "${category.name}" created with ${category.subcategories.length} subcategories`,
        req.user?._id
    ).catch(e => logger.error('Activity log failed:', e.message));

    return successResponse(res, category, 'Category created successfully', StatusCodes.CREATED);
});

exports.updateCategory = catchAsync(async (req, res) => {
    if (req.body.name) {
        const existing = await Category.findOne({
            name: { $regex: new RegExp(`^${escapeRegex(req.body.name.trim())}$`, 'i') },
            _id: { $ne: req.params.id }
        }).lean();
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

    const updateData = { ...req.body };
    if (req.file) {
        const existing = await Category.findById(req.params.id).select('imageUrl').lean();
        const { url } = await uploadImage(req.file.buffer, 'kwickly/categories');
        updateData.imageUrl = url;
        if (existing?.imageUrl && existing.imageUrl !== url) {
            cleanupImage(existing.imageUrl);
        }
    }

    const category = await Category.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    await delCache('top_pros_list');
    triggerDashboardUpdate();

    const changes = [];
    if (req.body.active !== undefined) changes.push(`status: ${req.body.active ? 'Active' : 'Hidden'}`);
    if (req.body.name) changes.push(`name: "${req.body.name}"`);
    if (req.body.subcategories) changes.push(`subcategories: ${req.body.subcategories.length} items`);
    if (req.file) changes.push('image updated');

    logAdminActivity(
        'UPDATE', 'CATEGORY', category._id,
        'Category Updated',
        `Category "${category.name}" updated${changes.length ? ' — ' + changes.join(', ') : ''}`,
        req.user?._id
    ).catch(e => logger.error('Activity log failed:', e.message));

    return successResponse(res, category, 'Category updated successfully');
});

exports.deleteCategory = catchAsync(async (req, res) => {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    // Clean up category image from Cloudinary
    if (category.imageUrl) {
        cleanupImage(category.imageUrl);
    }
    // Clean up subcategory images from Cloudinary
    if (category.subcategories?.length) {
        for (const sub of category.subcategories) {
            if (sub.imageUrl) {
                cleanupImage(sub.imageUrl);
            }
        }
    }

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    await delCache('top_pros_list');
    triggerDashboardUpdate();

    logAdminActivity(
        'DELETE', 'CATEGORY', req.params.id,
        'Category Deleted',
        `Category "${category.name}" deleted with ${category.subcategories.length} subcategories`,
        req.user?._id
    ).catch(e => logger.error('Activity log failed:', e.message));

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

    const subData = { ...req.body };
    if (req.file) {
        const { url } = await uploadImage(req.file.buffer, 'kwickly/subcategories');
        subData.imageUrl = url;
    }

    category.subcategories.push(subData);
    await category.save();

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    await delCache('top_pros_list');
    triggerDashboardUpdate();

    logAdminActivity(
        'CREATE', 'CATEGORY', category._id,
        'Subcategory Added',
        `Subcategory "${req.body.name}" added to "${category.name}"`,
        req.user?._id
    ).catch(e => logger.error('Activity log failed:', e.message));

    return successResponse(res, category, 'Subcategory added successfully');
});

exports.updateSubcategory = catchAsync(async (req, res) => {
    const { id, subId } = req.params;
    const category = await Category.findById(id);
    if (!category) {
        return errorResponse(res, 'Category not found', StatusCodes.NOT_FOUND);
    }

    const subcategory = category.subcategories.id(subId);
    if (!subcategory) {
        return errorResponse(res, 'Subcategory not found', StatusCodes.NOT_FOUND);
    }

    if (req.body.name) {
        const subName = req.body.name.trim();
        const duplicate = category.subcategories.find(
            s => s.name.toLowerCase() === subName.toLowerCase() && s._id.toString() !== subId
        );
        if (duplicate) {
            return errorResponse(res, `Subcategory "${duplicate.name}" already exists in "${category.name}"`, StatusCodes.CONFLICT);
        }
        subcategory.name = subName;
    }

    if (req.body.active !== undefined) {
        // body-parser handles string to boolean or we can parse it
        subcategory.active = req.body.active === 'true' || req.body.active === true;
    }

    if (req.file) {
        const { url } = await uploadImage(req.file.buffer, 'kwickly/subcategories');
        if (subcategory.imageUrl && subcategory.imageUrl !== url) {
            cleanupImage(subcategory.imageUrl);
        }
        subcategory.imageUrl = url;
    }

    await category.save();

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    await delCache('top_pros_list');
    triggerDashboardUpdate();

    logAdminActivity(
        'UPDATE', 'CATEGORY', category._id,
        'Subcategory Updated',
        `Subcategory updated in "${category.name}"`,
        req.user?._id
    ).catch(e => logger.error('Activity log failed:', e.message));

    return successResponse(res, category, 'Subcategory updated successfully');
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
    if (sub.imageUrl) {
        cleanupImage(sub.imageUrl);
    }
    category.subcategories.pull(subId);
    await category.save();

    await delCache(CACHE_KEY);
    await delCache('admin_dashboard_stats');
    await delCache('top_pros_list');
    triggerDashboardUpdate();

    logAdminActivity(
        'DELETE', 'CATEGORY', category._id,
        'Subcategory Deleted',
        `Subcategory "${subName}" removed from "${category.name}"`,
        req.user?._id
    ).catch(e => logger.error('Activity log failed:', e.message));

    return successResponse(res, category, 'Subcategory deleted successfully');
});

exports.getSuggestions = catchAsync(async (req, res) => {
    const Suggestion = require('../suggestion/suggestion.model');
    const suggestions = await Suggestion.find().populate('workerId', 'name email phone').sort('-createdAt').lean();
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

    suggestion.status = status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    if (adminFeedback) suggestion.approveReason = adminFeedback;
    await suggestion.save();

    if (status === 'APPROVED') {
        if (suggestion.type === 'new_category') {
            const existingCat = await Category.findOne({ name: { $regex: new RegExp(`^${escapeRegex(suggestion.payload?.name || suggestion.name)}$`, 'i') } }).lean();
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
        await delCache('top_pros_list');
        triggerDashboardUpdate();
    }

    return successResponse(res, suggestion, 'Suggestion processed successfully');
});

exports.clearCache = catchAsync(async (req, res) => {
    await delCache(CACHE_KEY);
    await delCache('top_pros_list');
    await delCache('admin_dashboard_stats');
    triggerDashboardUpdate();
    return successResponse(res, null, 'Category and top pros cache cleared successfully');
});
