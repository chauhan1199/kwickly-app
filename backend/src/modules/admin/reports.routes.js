const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');

router.get('/:tab', reportsController.getReportData);

module.exports = router;
