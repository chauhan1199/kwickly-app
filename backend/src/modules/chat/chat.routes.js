const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');

router.use(authMiddleware);

router.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    res.status(200).json({ status: 'success', data: { url } });
});

// Base64 upload - most reliable for React Native
router.post('/upload-base64', async (req, res) => {
    try {
        const { base64, mimeType = 'image/jpeg', fileName = 'chat_image.jpg' } = req.body;
        if (!base64) return res.status(400).json({ status: 'error', message: 'No base64 data provided' });

        const path = require('path');
        const fs = require('fs');
        const uploadDir = path.join(__dirname, '../../../public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const ext = mimeType.split('/')[1] || 'jpg';
        const uniqueName = `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const filePath = path.join(uploadDir, uniqueName);

        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const url = `/uploads/${uniqueName}`;
        res.status(200).json({ status: 'success', data: { url } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

router.get('/history', chatController.getChatHistory);
router.post('/send', chatController.sendMessage);
router.post('/mark-read', chatController.markAsRead);
router.get('/support/threads', chatController.getSupportThreads);

module.exports = router;
