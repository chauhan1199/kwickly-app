const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../../middleware/auth.middleware');
const jobController = require('../job/job.controller');
const customerController = require('./customer.controller');
const workerController = require('../worker/worker.controller');
const disputeController = require('../dispute/dispute.controller');
const validate = require('../../middleware/validate.middleware');
const { openDisputeSchema } = require('../../validators/dispute.validator');
const upload = require('../../middleware/upload.middleware');

router.post('/jobs', authMiddleware, jobController.createJob);
router.get('/top-pros', customerController.getTopPros);

// Disputes
router.post('/disputes', authMiddleware, validate(openDisputeSchema), disputeController.openDispute);

// Shared Profile & Address Management (Accessible to Customers)
router.patch('/me/profile', authMiddleware, upload.single('profileImage'), workerController.updateProfile);
router.post('/me/addresses', authMiddleware, workerController.addAddress);
router.put('/me/addresses/:addressId', authMiddleware, workerController.updateAddress);
router.delete('/me/addresses/:addressId', authMiddleware, workerController.deleteAddress);
router.patch('/me/addresses/:addressId/primary', authMiddleware, workerController.setPrimaryAddress);

router.get('/', (req, res) => {
    res.json({ message: 'Customer routes working' });
});

module.exports = router;
