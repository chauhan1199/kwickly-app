const multer = require('multer');

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type '${file.mimetype}' not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
        }
    }
});

const upload = {
    single: (fieldName) => {
        // Just return the multer middleware, no inline processing
        return [memoryUpload.single(fieldName)];
    }
};

module.exports = upload;
