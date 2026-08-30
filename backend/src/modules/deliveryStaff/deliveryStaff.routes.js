const express = require('express');
const router = express.Router();
const ctrl = require('./deliveryStaff.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { addStaffSchema, updateStaffSchema } = require('../../validators/deliveryStaff.validator');

router.use(authMiddleware);
router.use(authorize('SHOP'));

router.get('/',            ctrl.getStaff);
router.post('/',           validate(addStaffSchema), ctrl.addStaff);
router.patch('/:staffId',  validate(updateStaffSchema), ctrl.updateStaff);
router.delete('/:staffId', ctrl.removeStaff);

module.exports = router;
