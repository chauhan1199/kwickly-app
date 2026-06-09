const express = require('express');
const router = express.Router();
const quoteController = require('./quote.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

// All quote routes are protected
router.use(authMiddleware);

// -- WORKER ROUTES --
router.post('/', authorize('WORKER'), quoteController.placeQuote);
router.get('/worker', authorize('WORKER'), quoteController.getWorkerQuotes);
router.patch('/:id/withdraw', authorize('WORKER'), quoteController.withdrawQuote);

// -- CUSTOMER ROUTES --
router.get('/job/:jobId', authorize('CUSTOMER'), quoteController.getQuotesForJob);
router.patch('/:id/accept', authorize('CUSTOMER'), quoteController.acceptQuote);

module.exports = router;
