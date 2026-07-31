const Joi = require('joi');

// Update worker profile schema
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  profileImage: Joi.string().uri().optional(),
  city: Joi.string().optional(),
});

// Update KYC schema
const updateKycSchema = Joi.object({
  documentType: Joi.string().valid('PAN', 'AADHAR', 'VOTER_ID', 'DRIVING_LICENSE', 'OTHER').required(),
  documentUrl: Joi.string().uri().required(),
});

// Update bank details schema
const updateBankSchema = Joi.object({
  accountNumber: Joi.string().min(9).max(18).required(),
  ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
  accountHolderName: Joi.string().min(3).max(100).required(),
  bankName: Joi.string().min(2).max(100).optional(),
  branch: Joi.string().optional(),
});

// Update services schema
const updateServicesSchema = Joi.object({
  services: Joi.array().items(
    Joi.object({
      categoryId: Joi.string().required(),
      subcategoryId: Joi.string().required(),
      minPrice: Joi.number().min(0).required(),
      maxPrice: Joi.number().min(0).required(),
    })
  ).required(),
});

// Update location schema
const updateLocationSchema = Joi.object({
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }).required(),
  address: Joi.string().min(5).optional(),
});

// Toggle online status schema
const toggleOnlineStatusSchema = Joi.object({
  isOnline: Joi.boolean().required(),
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

module.exports = {
  updateProfileSchema,
  updateKycSchema,
  updateBankSchema,
  updateServicesSchema,
  updateLocationSchema,
  toggleOnlineStatusSchema,
  addAddressSchema,
  updateAddressSchema,
};
