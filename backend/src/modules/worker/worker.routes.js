const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const upload = require('../../middleware/upload.middleware');

router.use(authMiddleware);

// -- Worker Profile & Settings --
router.get('/me', authorize('WORKER'), workerController.getProfile);
router.get('/me/stats', authorize('WORKER'), workerController.getStats);
router.patch('/me/profile', authorize('WORKER'), upload.single('profileImage'), workerController.updateProfile);
router.put('/me/profile', authorize('WORKER'), upload.single('profileImage'), workerController.updateFullProfile);
router.patch('/me/kyc', authorize('WORKER'), upload.single('document'), workerController.updateKyc);
router.delete('/me/kyc/:docIndex', authorize('WORKER'), workerController.removeKycDocument);
router.patch('/me/bank', authorize('WORKER'), workerController.updateBank);
router.patch('/me/services', authorize('WORKER'), workerController.updateServices);
router.patch('/me/location', authorize('WORKER'), workerController.updateLocation);
router.patch('/me/online', authorize('WORKER'), workerController.toggleOnlineStatus);

// -- Worker Earnings --
router.get('/earnings/summary', authorize('WORKER'), workerController.getEarningsSummary);
router.get('/earnings/chart', authorize('WORKER'), workerController.getEarningsChart);
router.get('/earnings/transactions', authorize('WORKER'), workerController.getEarningsTransactions);
router.post('/earnings/withdraw', authorize('WORKER'), workerController.requestEarningsWithdrawal);

// -- Worker Category Suggestions --
router.post('/category-suggestions', authorize('WORKER'), workerController.submitCategorySuggestion);
router.get('/category-suggestions', authorize('WORKER'), workerController.getSuggestions);

// -- Worker Addresses --
router.post('/me/addresses', authorize('WORKER'), workerController.addAddress);
router.put('/me/addresses/:addressId', authorize('WORKER'), workerController.updateAddress);
router.delete('/me/addresses/:addressId', authorize('WORKER'), workerController.deleteAddress);
router.patch('/me/addresses/:addressId/primary', authorize('WORKER'), workerController.setPrimaryAddress);

module.exports = router;
