const Joi = require('joi');

// Update worker profile schema
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().allow('', null).optional(),
  profileImage: Joi.string().allow('', null).optional(),
  profileImageBase64: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),
  bio: Joi.string().allow('', null).optional(),
});

// Update KYC schema — matches the controller contract:
// documentType + (multipart file | documentBase64 | documentUrl)
const updateKycSchema = Joi.object({
  documentType: Joi.string().valid('PAN', 'AADHAR', 'VOTER_ID', 'DRIVING_LICENSE', 'LICENSE', 'OTHER').required(),
  documentBase64: Joi.string().min(10).optional(),
  documentUrl: Joi.string().uri().optional(),
});

// Update bank details schema — matches controller + mobile contract ({ bankDetails, upiId })
const updateBankSchema = Joi.object({
  bankDetails: Joi.object({
    accountNumber: Joi.string().min(9).max(18).optional(),
    ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional(),
    bankName: Joi.string().min(2).max(100).optional(),
  }).optional(),
  upiId: Joi.string().pattern(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/).optional(),
}).or('bankDetails', 'upiId');

// Update services schema (matches model + mobile contract: { category, categoryName, subcategories, isActive })
const updateServicesSchema = Joi.object({
  services: Joi.array().items(
    Joi.object({
      category: Joi.string().required(),
      categoryName: Joi.string().allow('', null).optional(),
      subcategories: Joi.array().items(Joi.string()).optional(),
      isActive: Joi.boolean().optional(),
    })
  ).min(0).max(20).required(),
});

// Update location schema (matches controller contract: coordinates as [lng, lat] array)
const updateLocationSchema = Joi.object({
  coordinates: Joi.array().items(Joi.number()).length(2).optional(),
  city: Joi.string().optional(),
  pincode: Joi.string().optional(),
  area: Joi.string().optional(),
  radius: Joi.number().min(1).max(100).optional(),
}).min(1);

// Toggle online status schema
const toggleOnlineStatusSchema = Joi.object({
  isOnline: Joi.boolean().required(),
});

// Add address schema
// Address schemas — match the model + controller + mobile contract:
// { label, street, area, city, pincode, isPrimary?, location? } with
// location.coordinates as [lng, lat]
const addAddressSchema = Joi.object({
  label: Joi.string().min(1).max(50).required(),
  street: Joi.string().min(2).required(),
  city: Joi.string().min(2).required(),
  area: Joi.string().optional(),
  pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).required(),
  isPrimary: Joi.boolean().optional(),
  location: Joi.object({
    type: Joi.string().optional(),
    coordinates: Joi.array().items(Joi.number()).length(2).optional(),
  }).optional(),
});

const updateAddressSchema = Joi.object({
  label: Joi.string().min(1).max(50).optional(),
  street: Joi.string().min(2).optional(),
  city: Joi.string().min(2).optional(),
  area: Joi.string().optional(),
  pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).optional(),
  isPrimary: Joi.boolean().optional(),
  location: Joi.object({
    type: Joi.string().optional(),
    coordinates: Joi.array().items(Joi.number()).length(2).optional(),
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
