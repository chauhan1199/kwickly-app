const express = require('express');
const router = express.Router();
const jobController = require('./job.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

// All job management routes are protected
router.use(authMiddleware);

const validate = require('../../middleware/validate.middleware');
const { createJobSchema } = require('../../validators/job.validator');

// -- CUSTOMER ROUTES --
router.post('/', authorize('CUSTOMER'), validate(createJobSchema), jobController.createJob);
router.get('/my', authorize('CUSTOMER'), jobController.getMyJobs);
router.post('/:id/pay', authorize('CUSTOMER'), jobController.payJob);
router.post('/:id/rate', authorize('CUSTOMER'), jobController.rateJob);

// -- WORKER ROUTES --
router.get('/available', authorize('WORKER'), jobController.getAvailableJobs);
router.get('/worker', authorize('WORKER'), jobController.getWorkerJobs);
router.post('/:id/start', authorize('WORKER'), jobController.startJob);
router.post('/:id/complete', authorize('WORKER'), jobController.completeJob);

// -- ADMIN ROUTES --
router.get('/all', authorize('ADMIN'), jobController.getJobs);
router.get('/disputes', authorize('ADMIN'), jobController.getDisputes);
router.patch('/:id/cancel', authorize('ADMIN', 'CUSTOMER'), jobController.cancelJob);
router.patch('/:id/reassign', authorize('ADMIN'), jobController.reassignWorker);

module.exports = router;
