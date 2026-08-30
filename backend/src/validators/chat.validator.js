const Joi = require('joi');

// POST /send — text or mediaUrl required (controller enforces this too)
const sendMessageSchema = Joi.object({
    receiverId: Joi.string().max(100).allow('', null),
    jobId: Joi.string().max(100).allow('', null),
    text: Joi.string().max(4000).allow('', null),
    mediaUrl: Joi.string().max(2048).allow('', null)
}).or('text', 'mediaUrl');

// POST /mark-read
const markReadSchema = Joi.object({
    partnerId: Joi.string().max(100).allow('', null)
});

// POST /upload-base64
const uploadBase64Schema = Joi.object({
    base64: Joi.string().min(1).required().messages({
        'any.required': 'No base64 data provided',
        'string.empty': 'No base64 data provided',
        'string.base': 'No base64 data provided'
    })
});

module.exports = {
    sendMessageSchema,
    markReadSchema,
    uploadBase64Schema
};
