const Joi = require('joi');

// Update customer profile schema — wallet (object or JSON string) and
// profileImageBase64 are read by the controller and used by the mobile app
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  profileImage: Joi.string().uri().optional(),
  city: Joi.string().optional(),
  profileImageBase64: Joi.string().min(20).optional(),
  wallet: Joi.alternatives().try(
    Joi.string(),
    Joi.object({
      bankDetails: Joi.object({
        accountNumber: Joi.string().min(9).max(18).optional(),
        ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional(),
        bankName: Joi.string().min(2).max(100).optional(),
      }).optional(),
      upiId: Joi.string().allow('').optional(),
    }).optional()
  ).optional(),
});

// Address GeoJSON shape used by the app
const geoPointSchema = Joi.object({
  type: Joi.string().valid('Point').default('Point'),
  coordinates: Joi.array().items(Joi.number()).length(2).required(),
});

// Add address schema (matches controller + mobile app contract: label/street/city/pincode/location)
const addAddressSchema = Joi.object({
  label: Joi.string().min(2).max(50).required(),
  street: Joi.string().min(3).required(),
  city: Joi.string().min(2).required(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
  location: geoPointSchema.optional(),
  isPrimary: Joi.boolean().optional(),
});

// Update address schema
const updateAddressSchema = Joi.object({
  label: Joi.string().min(2).max(50).optional(),
  street: Joi.string().min(3).optional(),
  city: Joi.string().min(2).optional(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).optional(),
  location: geoPointSchema.optional(),
  isPrimary: Joi.boolean().optional(),
}).min(1);

// Notification preferences schema — matches controller + model keys
const notificationPreferencesSchema = Joi.object({
  jobUpdates: Joi.boolean().optional(),
  promotions: Joi.boolean().optional(),
});

// Dispute schema
const openDisputeSchema = Joi.object({
  jobId: Joi.string().required(),
  reason: Joi.string().min(2).max(200).optional(),
  issue: Joi.string().min(10).max(200).optional(),
  description: Joi.string().min(20).max(1000).required(),
  images: Joi.array().items(Joi.string().uri()).optional(),
});

module.exports = {
  updateProfileSchema,
  addAddressSchema,
  updateAddressSchema,
  notificationPreferencesSchema,
  openDisputeSchema,
};
