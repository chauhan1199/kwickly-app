const express = require('express');
const router = express.Router();
const jobController = require('./job.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

// All job management routes are protected
router.use(authMiddleware);

const validate = require('../../middleware/validate.middleware');
const { createJobSchema } = require('../../validators/job.validator');
const upload = require('../../middleware/upload.middleware');

// -- CUSTOMER ROUTES --
router.post('/', authorize('CUSTOMER'), validate(createJobSchema), jobController.createJob);
router.get('/', authorize('CUSTOMER'), jobController.getMyJobs);
router.get('/my', authorize('CUSTOMER'), jobController.getMyJobs);
router.post('/:id/pay', authorize('CUSTOMER'), jobController.payJob);
router.post('/:id/rate', authorize('CUSTOMER'), jobController.rateJob);

// -- WORKER ROUTES --
router.get('/available', authorize('WORKER'), jobController.getAvailableJobs);
router.get('/worker', authorize('WORKER'), jobController.getWorkerJobs);
// B1 FIX: ALLOCATED → ARRIVING transition
router.post('/:id/arrive', authorize('WORKER'), jobController.arriveJob);
router.post('/:id/start', authorize('WORKER'), jobController.startJob);
router.post('/:id/complete', authorize('WORKER'), jobController.completeJob);
// M2 FIX: Worker can rate the customer after job completion
router.post('/:id/rate-customer', authorize('WORKER'), jobController.rateCustomer);

// -- WORKER ROUTE: Report Partial Payment (Loophole #9 Fix) --
router.post('/:id/report-partial-payment', authorize('WORKER'), jobController.reportPartialPayment);

// -- ADMIN ROUTES --
router.get('/all', authorize('ADMIN'), jobController.getJobs);
router.get('/disputes', authorize('ADMIN'), jobController.getDisputes);
router.patch('/:id/cancel', authorize('ADMIN', 'CUSTOMER'), jobController.cancelJob);
router.patch('/:id/reassign', authorize('ADMIN'), jobController.reassignWorker);
// Admin dispute resolution
router.patch('/:id/resolve-dispute', authorize('ADMIN'), jobController.resolveDispute);

// -- SHARED ROUTES --
router.get('/:id/receipt', authorize('CUSTOMER', 'WORKER', 'ADMIN'), jobController.getJobReceipt);
router.get('/:id', authorize('CUSTOMER', 'WORKER', 'ADMIN'), jobController.getJobById);
router.post('/upload-media', authorize('CUSTOMER', 'WORKER', 'ADMIN'), upload.single('media'), jobController.uploadMedia);

module.exports = router;
