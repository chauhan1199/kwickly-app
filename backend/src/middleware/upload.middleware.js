const multer = require('multer');

const allowedMimePatterns = [
    'image/',
    'video/',
    'application/pdf'
];

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (allowedMimePatterns.some(pattern => mime.startsWith(pattern)) || mime === 'application/octet-stream') {
            cb(null, true);
        } else {
            cb(new Error(`File type '${file.mimetype}' not allowed. Only photos and videos are allowed.`), false);
        }
    }
});

const upload = {
    single: (fieldName) => {
        return [memoryUpload.single(fieldName)];
    }
};

module.exports = upload;
