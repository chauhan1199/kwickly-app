const Joi = require('joi');

// Update customer profile schema
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  profileImage: Joi.string().uri().optional(),
  city: Joi.string().optional(),
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

// Notification preferences schema
const notificationPreferencesSchema = Joi.object({
  pushEnabled: Joi.boolean().optional(),
  emailEnabled: Joi.boolean().optional(),
  smsEnabled: Joi.boolean().optional(),
  orderUpdates: Joi.boolean().optional(),
  jobUpdates: Joi.boolean().optional(),
  promotionalUpdates: Joi.boolean().optional(),
});

// Dispute schema
const openDisputeSchema = Joi.object({
  jobId: Joi.string().required(),
  issue: Joi.string().min(10).max(200).required(),
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
