const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/history', chatController.getChatHistory);
router.post('/send', chatController.sendMessage);

module.exports = router;
