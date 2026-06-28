const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { updateKYCSchema, createUserSchema, updateUserSchema, adminCreateJobSchema, adminUpdateJobSchema, adminCreateOrderSchema } = require('../../validators/admin.validator');
const { createShopAdminSchema, updateShopAdminSchema, shopWalletSchema } = require('../../validators/shop.validator');
const suggestionController = require('../suggestion/suggestion.controller');
const disputeController = require('../dispute/dispute.controller');
const settingsController = require('../settings/settings.controller');

// Middleware to parse stringified JSON from FormData before Joi validation
const parseShopFormData = (req, res, next) => {
    const fields = ['location', 'delivery', 'businessHours', 'subscription'];
    fields.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
            try {
                req.body[field] = JSON.parse(req.body[field]);
            } catch (e) {}
        }
    });
    next();
};
const upload = require('../../middleware/upload.middleware');

// ─── Public Routes (no auth required) ────────────────────────────────────────
router.get('/settings/branding', settingsController.getBranding);

// ─── All Other Admin Routes (ADMIN role required) ─────────────────────────────
router.use(authMiddleware);
router.use(authorize('ADMIN'));

// Image upload
router.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(200).json({ status: 'success', data: { url } });
});

// Dashboard
router.get('/stats',    adminController.getStats);
router.get('/badges',   adminController.getBadgeCounts);
router.get('/health',   adminController.getPlatformHealth);
router.get('/ledger',   adminController.getLedger);

// User management
router.get('/customers',               adminController.getCustomers);
router.get('/customers/export',        adminController.exportCustomers);
router.get('/customers/:id',           adminController.getUserDetail);
router.get('/workers',                 adminController.getWorkers);
router.get('/workers/export',          adminController.exportWorkers);
router.get('/workers/:id',             adminController.getWorkerDetail);
router.get('/pending-kyc',             adminController.getPendingKYC);
router.post('/users',                  validate(createUserSchema), adminController.createUser);
router.patch('/users/:id',             validate(updateUserSchema), adminController.updateUser);
router.patch('/users/:id/toggle-status', adminController.toggleUserStatus);
router.delete('/users/:id',            adminController.deleteUser);
router.post('/users/:id/impersonate',  adminController.impersonateUser);
router.get('/customers/:id/jobs',          adminController.getCustomerJobs);
router.get('/customers/:id/orders',        adminController.getCustomerOrders);
router.post('/customers/:id/jobs',         validate(adminCreateJobSchema), adminController.adminCreateJob);
router.patch('/jobs/:id/details',          validate(adminUpdateJobSchema), adminController.adminUpdateJob);
router.post('/customers/:id/orders',       validate(adminCreateOrderSchema), adminController.adminCreateOrder);
router.patch('/workers/:id/kyc', validate(updateKYCSchema), adminController.updateKYC);
router.post('/workers/:id/kyc-documents', upload.single('document'), adminController.addKycDocument);
router.delete('/workers/:id/kyc-documents/:docIndex', adminController.removeKycDocument);

// Shop management (P1: Previously missing)
router.get('/shops',                   adminController.getShops);
router.get('/shops/:id',               adminController.getShopDetailAdmin);
router.post('/shops',                  validate(createShopAdminSchema), adminController.createShopAdmin);
router.patch('/shops/:id',             upload.single('logo'), parseShopFormData, validate(updateShopAdminSchema), adminController.updateShopAdminFull);
router.delete('/shops/:id',            adminController.deleteShopAdmin);
router.patch('/shops/:id/kyc',         adminController.updateShopKYC);
router.patch('/shops/:id/toggle',      adminController.toggleShopStatus);
router.post('/shops/:id/wallet/credit', validate(shopWalletSchema), adminController.creditShopWallet);
router.post('/shops/:id/wallet/debit',  validate(shopWalletSchema), adminController.debitShopWallet);
router.post('/shops/:id/kyc-doc',      upload.single('document'), adminController.uploadShopKycDoc);
router.delete('/shops/:id/kyc-doc/:docIndex', adminController.deleteShopKycDoc);
router.post('/shops/:id/payout-methods',           adminController.addShopPayoutMethod);
router.patch('/shops/:id/payout-methods/:methodId', adminController.editShopPayoutMethod);
router.delete('/shops/:id/payout-methods/:methodId', adminController.deleteShopPayoutMethod);
router.patch('/shops/:id/payout-methods/:methodId/primary', adminController.setShopPrimaryPayout);
router.patch('/shops/:id/kyc-doc/:docIndex', upload.single('document'), adminController.editShopKycDoc);
router.patch('/shops/:id/owner',                   adminController.updateShopOwner);

// Sub-module routes (mount before specific /:id params to avoid conflicts)
router.use('/jobs',         require('../job/job.routes'));
router.use('/reports',      require('./reports.routes'));
router.use('/categories',   require('../category/category.routes'));
router.use('/notifications',require('../notification/notification.routes'));
router.use('/settings',     require('../settings/settings.routes'));
router.use('/wallet',       require('../wallet/wallet.routes'));
router.use('/shoporders',   require('../shoporder/shoporder.routes'));
router.use('/settlements',  require('../settlement/settlement.routes'));
router.use('/promotions',   require('../promotion/promotion.routes'));

// Jobs (specific params — after sub-module mounts)
router.get('/jobs/export',             adminController.exportJobs);
router.get('/jobs/:id',                adminController.getJobDetail);

// Payments
router.get('/payments/export',         adminController.exportPayments);

// Payout management
router.get('/payouts',                 adminController.getPayouts);
router.patch('/payouts/:id/status',    adminController.updatePayoutStatus);

// Suggestions
router.get('/suggestions',             suggestionController.getSuggestions);
router.patch('/suggestions/:id/approve', suggestionController.approveSuggestion);
router.patch('/suggestions/:id/reject',  suggestionController.rejectSuggestion);

// Disputes
router.get('/disputes',                disputeController.getDisputes);
router.patch('/disputes/:id/status',   disputeController.updateDisputeStatus);

module.exports = router;
