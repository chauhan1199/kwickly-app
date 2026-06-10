const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { updateKYCSchema } = require('../../validators/admin.validator');
const suggestionController = require('../suggestion/suggestion.controller');
const disputeController = require('../dispute/dispute.controller');
const settingsController = require('../settings/settings.controller');

// Public routes
router.get('/settings/branding', settingsController.getBranding);

const upload = require('../../middleware/upload.middleware');

// All other admin routes are protected
router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(200).json({ status: 'success', data: { url } });
});

router.get('/stats', adminController.getStats);
router.get('/badges', adminController.getBadgeCounts);
router.get('/customers', adminController.getCustomers);
router.get('/workers', adminController.getWorkers);
router.get('/pending-kyc', adminController.getPendingKYC);
router.get('/health', adminController.getPlatformHealth);
router.get('/ledger', adminController.getLedger);

// Use validation for KYC update
router.patch('/workers/:id/kyc', validate(updateKYCSchema), adminController.updateKYC);

// Consistent naming for toggle and delete
router.post('/users', adminController.createUser);
router.patch('/users/:id/toggle-status', adminController.toggleUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// Suggestions
router.get('/suggestions', suggestionController.getSuggestions);
router.patch('/suggestions/:id/approve', suggestionController.approveSuggestion);
router.patch('/suggestions/:id/reject', suggestionController.rejectSuggestion);

// Disputes
router.get('/disputes', disputeController.getDisputes);
router.patch('/disputes/:id/status', disputeController.updateDisputeStatus);

// Sub-module routes
router.use('/reports', require('./reports.routes'));
router.use('/categories', require('../category/category.routes'));
router.use('/jobs', require('../job/job.routes'));
router.use('/notifications', require('../notification/notification.routes'));
router.use('/payouts', require('../payout/payout.routes'));
router.use('/settings', require('../settings/settings.routes'));

module.exports = router;
