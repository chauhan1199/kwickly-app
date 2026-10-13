const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const customerController = require('./customer.controller');
const disputeController = require('../dispute/dispute.controller');
const validate = require('../../middleware/validate.middleware');
const { openDisputeSchema } = require('../../validators/dispute.validator');
const { updateProfileSchema, addAddressSchema, updateAddressSchema, notificationPreferencesSchema } = require('../../validators/customer.validator');
const upload = require('../../middleware/upload.middleware');

// -- Public Browse Endpoints (Accessible for both guests & logged-in customers) --
router.get('/top-pros', customerController.getTopPros);
router.get('/workers/:id/profile', customerController.getWorkerProfile);

// -- Protected Routes --
router.use(authMiddleware);

// -- Customer Profile --
router.get('/me/profile', authorize('CUSTOMER'), customerController.getProfile);
router.put('/me/profile', authorize('CUSTOMER'), upload.single('profileImage'), validate(updateProfileSchema), customerController.updateProfile);
router.delete('/me/account', authorize('CUSTOMER'), customerController.deleteAccount);

// -- Customer Addresses --
router.post('/me/addresses', authorize('CUSTOMER'), validate(addAddressSchema), customerController.addAddress);
router.put('/me/addresses/:addressId', authorize('CUSTOMER'), validate(updateAddressSchema), customerController.updateAddress);
router.delete('/me/addresses/:addressId', authorize('CUSTOMER'), customerController.deleteAddress);
router.patch('/me/addresses/:addressId/primary', authorize('CUSTOMER'), customerController.setPrimaryAddress);

// -- Customer Jobs --
router.get('/jobs/active', authorize('CUSTOMER'), customerController.getActiveJob);
router.get('/jobs/:id/receipt', authorize('CUSTOMER'), customerController.getJobReceipt);

// -- Customer Disputes --
router.post('/disputes', authorize('CUSTOMER'), validate(openDisputeSchema), disputeController.openDispute);

// -- Notifications --
router.put('/me/notifications', authorize('CUSTOMER'), validate(notificationPreferencesSchema), customerController.updateNotificationPreferences);
router.post('/me/notifications/trigger', authorize('CUSTOMER'), customerController.triggerNotification);

// -- Suggestions --
router.post('/category-suggestions', authorize('CUSTOMER'), customerController.submitCategorySuggestion);

module.exports = router;
