const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const upload = require('../../middleware/upload.middleware');

router.use(authMiddleware);

// -- Worker Profile & Settings --
router.patch('/me/profile', authorize('WORKER'), upload.single('profileImage'), workerController.updateProfile);
router.patch('/me/kyc', authorize('WORKER'), upload.single('document'), workerController.updateKyc);
router.patch('/me/bank', workerController.updateBank);
router.patch('/me/services', workerController.updateServices);
router.patch('/me/location', workerController.updateLocation);
router.patch('/me/online', authorize('WORKER'), workerController.toggleOnlineStatus);
router.post('/me/category-suggestions', workerController.submitCategorySuggestion);

// -- Worker Addresses --
router.post('/me/addresses', authorize('WORKER'), workerController.addAddress);
router.put('/me/addresses/:addressId', authorize('WORKER'), workerController.updateAddress);
router.delete('/me/addresses/:addressId', authorize('WORKER'), workerController.deleteAddress);
router.patch('/me/addresses/:addressId/primary', authorize('WORKER'), workerController.setPrimaryAddress);

module.exports = router;
