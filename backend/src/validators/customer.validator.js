const Joi = require('joi');

// Update customer profile schema
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  profileImage: Joi.string().uri().optional(),
  city: Joi.string().optional(),
});

// Add address schema
const addAddressSchema = Joi.object({
  type: Joi.string().valid('home', 'work', 'other').required(),
  street: Joi.string().min(5).required(),
  locality: Joi.string().min(2).required(),
  city: Joi.string().min(2).required(),
  state: Joi.string().min(2).required(),
  pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).required(),
  landmark: Joi.string().optional(),
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }).required(),
});

// Update address schema
const updateAddressSchema = Joi.object({
  type: Joi.string().valid('home', 'work', 'other').optional(),
  street: Joi.string().min(5).optional(),
  locality: Joi.string().min(2).optional(),
  city: Joi.string().min(2).optional(),
  state: Joi.string().min(2).optional(),
  pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).optional(),
  landmark: Joi.string().optional(),
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
  }).optional(),
});

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
