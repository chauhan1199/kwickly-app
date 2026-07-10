const multer = require('multer');

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const upload = {
    single: (fieldName) => {
        // Just return the multer middleware, no inline processing
        return [memoryUpload.single(fieldName)];
    }
};

module.exports = upload;
