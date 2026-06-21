const express = require('express');
const router = express.Router();
const ctrl = require('./deliveryStaff.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');

router.use(authMiddleware);
router.use(authorize('SHOP'));

router.get('/',            ctrl.getStaff);
router.post('/',           ctrl.addStaff);
router.patch('/:staffId',  ctrl.updateStaff);
router.delete('/:staffId', ctrl.removeStaff);

module.exports = router;
