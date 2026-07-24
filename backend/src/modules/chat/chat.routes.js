const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');
const logger = require('../../helpers/logger.helper');

router.use(authMiddleware);

const { uploadImage, uploadBase64 } = require('../../services/cloudinary.service');

router.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        
        // Upload to Cloudinary
        const result = await uploadImage(req.file.buffer, 'kwickly/chat');
        
        res.status(200).json({ status: 'success', data: { url: result.url } });
    } catch (err) {
        logger.error('Chat upload error:', err);
        res.status(500).json({ status: 'error', message: 'Image upload failed' });
    }
});

// Base64 upload - most reliable for React Native
router.post('/upload-base64', async (req, res) => {
    try {
        const { base64 } = req.body;
        if (!base64) return res.status(400).json({ status: 'error', message: 'No base64 data provided' });

        // Let cloudinary service handle base64
        const result = await uploadBase64(base64, 'kwickly/chat');
        
        res.status(200).json({ status: 'success', data: { url: result.url } });
    } catch (err) {
        logger.error('Chat base64 upload error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

router.get('/history', chatController.getChatHistory);
router.post('/send', chatController.sendMessage);
router.post('/mark-read', chatController.markAsRead);

// Support threads — admin only
const authorize = require('../../middleware/role.middleware');
router.get('/support/threads', authorize('ADMIN'), chatController.getSupportThreads);

module.exports = router;
