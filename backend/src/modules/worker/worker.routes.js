const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const upload = require('../../middleware/upload.middleware');
const validate = require('../../middleware/validate.middleware');
const {
  updateProfileSchema,
  updateKycSchema,
  updateBankSchema,
  updateServicesSchema,
  updateLocationSchema,
  toggleOnlineStatusSchema,
  addAddressSchema,
  updateAddressSchema,
} = require('../../validators/worker.validator');

router.use(authMiddleware);

// -- Worker Profile & Settings --
router.get('/me', authorize('WORKER'), workerController.getProfile);
router.get('/me/stats', authorize('WORKER'), workerController.getStats);
router.patch('/me/profile', authorize('WORKER'), upload.single('profileImage'), validate(updateProfileSchema), workerController.updateProfile);
router.put('/me/profile', authorize('WORKER'), upload.single('profileImage'), validate(updateProfileSchema), workerController.updateFullProfile);
router.patch('/me/kyc', authorize('WORKER'), upload.single('document'), validate(updateKycSchema), workerController.updateKyc);
router.delete('/me/kyc/:docIndex', authorize('WORKER'), workerController.removeKycDocument);
router.patch('/me/bank', authorize('WORKER'), validate(updateBankSchema), workerController.updateBank);
router.patch('/me/services', authorize('WORKER'), validate(updateServicesSchema), workerController.updateServices);
router.patch('/me/location', authorize('WORKER'), validate(updateLocationSchema), workerController.updateLocation);
router.patch('/me/online', authorize('WORKER'), validate(toggleOnlineStatusSchema), workerController.toggleOnlineStatus);

// -- Worker Earnings --
router.get('/earnings/summary', authorize('WORKER'), workerController.getEarningsSummary);
router.get('/earnings/chart', authorize('WORKER'), workerController.getEarningsChart);
router.get('/earnings/transactions', authorize('WORKER'), workerController.getEarningsTransactions);
router.post('/earnings/withdraw', authorize('WORKER'), workerController.requestEarningsWithdrawal);

// -- Worker Category Suggestions --
router.post('/category-suggestions', authorize('WORKER'), workerController.submitCategorySuggestion);
router.get('/category-suggestions', authorize('WORKER'), workerController.getSuggestions);

// -- Worker Addresses --
router.post('/me/addresses', authorize('WORKER'), validate(addAddressSchema), workerController.addAddress);
router.put('/me/addresses/:addressId', authorize('WORKER'), validate(updateAddressSchema), workerController.updateAddress);
router.delete('/me/addresses/:addressId', authorize('WORKER'), workerController.deleteAddress);
router.patch('/me/addresses/:addressId/primary', authorize('WORKER'), workerController.setPrimaryAddress);

module.exports = router;
