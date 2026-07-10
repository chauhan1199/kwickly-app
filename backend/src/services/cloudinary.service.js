const { v2: cloudinary } = require('cloudinary');
const sharp = require('sharp');
const logger = require('../helpers/logger.helper');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Compresses a buffer to WEBP and uploads it to Cloudinary via stream.
 * @param {Buffer} fileBuffer - The original file buffer from Multer.
 * @param {String} folderPath - The folder path in Cloudinary (e.g., 'kwickly/customers').
 * @returns {Promise<Object>} - Resolves with { url, public_id }
 */
const uploadImage = async (fileBuffer, folderPath = 'kwickly/misc') => {
    try {
        // Compress and convert to WEBP
        const webpBuffer = await sharp(fileBuffer)
            .resize({ width: 1024, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        // Upload to Cloudinary using upload_stream
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: folderPath, format: 'webp' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(webpBuffer);
        });

        return {
            url: uploadResult.secure_url,
            public_id: uploadResult.public_id
        };
    } catch (error) {
        logger.error(`[Cloudinary Service] Upload failed: ${error.message}`);
        throw new Error('Image upload failed');
    }
};

/**
 * Deletes an image from Cloudinary using its public_id.
 * @param {String} publicId - The public_id of the image in Cloudinary.
 * @returns {Promise<void>}
 */
const deleteImage = async (publicId) => {
    try {
        if (!publicId) return;
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        logger.error(`[Cloudinary Service] Delete failed for ${publicId}: ${error.message}`);
        // Do not throw, deletion failures shouldn't break the main flow usually
    }
};

/**
 * Converts Base64 to Buffer and uploads it.
 * @param {String} base64String 
 * @param {String} folderPath 
 */
const uploadBase64 = async (base64String, folderPath) => {
    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    return uploadImage(buffer, folderPath);
};

module.exports = {
    uploadImage,
    uploadBase64,
    deleteImage
};
