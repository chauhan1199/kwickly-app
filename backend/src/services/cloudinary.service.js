const { v2: cloudinary } = require('cloudinary');
const sharp = require('sharp');
const logger = require('../helpers/logger.helper');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Extracts Cloudinary public_id from a URL or returns as-is if already a public_id.
 * @param {String} urlOrPublicId
 * @returns {String|null}
 */
const extractPublicId = (urlOrPublicId) => {
    if (!urlOrPublicId) return null;
    // Already a public_id (no http)
    if (!urlOrPublicId.startsWith('http')) return urlOrPublicId;
    // Parse from URL: ...upload/v1234/folder/filename.webp -> folder/filename
    const parts = urlOrPublicId.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    const folderAndFile = parts.slice(uploadIdx + 1).join('/');
    // Remove version prefix if present (v1234567890/)
    const withoutVersion = folderAndFile.replace(/^v\d+\//, '');
    // Remove file extension
    return withoutVersion.replace(/\.[^.]+$/, '');
};

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
 * Cleans up an old image from Cloudinary. Accepts a URL, public_id, or doc object.
 * @param {String|Object} imageRef - URL string, public_id string, or doc with .url/.public_id
 * @returns {Promise<void>}
 */
const cleanupImage = async (imageRef) => {
    if (!imageRef) return;
    if (typeof imageRef === 'object') {
        // Doc object with .url or .public_id
        if (imageRef.public_id) {
            await deleteImage(imageRef.public_id);
        } else if (imageRef.url) {
            await deleteImage(extractPublicId(imageRef.url));
        }
    } else if (typeof imageRef === 'string') {
        await deleteImage(extractPublicId(imageRef));
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
    deleteImage,
    extractPublicId,
    cleanupImage
};
