const { StatusCodes } = require('http-status-codes');
const Customer = require('../customer/customer.model');
const CategorySuggestion = require('../category/suggestion.model');
const catchAsync = require('../../helpers/async.helper');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { COMMON } = require('../../constants/messages');

exports.updateKyc = catchAsync(async (req, res) => {
    const { documentType } = req.body;
    const user = await Customer.findById(req.user.id);
    
    if (req.file) {
        user.kyc.documents.push({
            type: documentType || 'OTHER',
            url: '/uploads/' + req.file.filename
        });
        user.kyc.status = 'PENDING';
        await user.save();
    }
    return successResponse(res, user.kyc, 'KYC document uploaded successfully');
});

exports.updateProfile = catchAsync(async (req, res) => {
    const { name } = req.body;
    const updateData = {};
    if (req.file) {
        updateData.profileImage = '/uploads/' + req.file.filename;
    } else if (req.body.profileImage !== undefined) {
        updateData.profileImage = req.body.profileImage;
    }
    if (name !== undefined) updateData.name = name;
    
    if (Object.keys(updateData).length === 0) {
        return errorResponse(res, 'No data provided', StatusCodes.BAD_REQUEST);
    }

    const user = await Customer.findByIdAndUpdate(
        req.user.id,
        { $set: updateData },
        { new: true }
    );
    return successResponse(res, user, 'Profile updated successfully');
});

exports.updateBank = catchAsync(async (req, res) => {
    const { bankDetails, upiId } = req.body;
    const updateData = {};
    if (bankDetails) updateData['wallet.bankDetails'] = bankDetails;
    if (upiId) updateData['wallet.upiId'] = upiId;
    
    const user = await Customer.findByIdAndUpdate(
        req.user.id,
        { $set: updateData },
        { new: true }
    );
    return successResponse(res, user.wallet, 'Bank details updated successfully');
});

exports.updateServices = catchAsync(async (req, res) => {
    const { services } = req.body;
    const user = await Customer.findByIdAndUpdate(
        req.user.id,
        { $set: { services } },
        { new: true }
    );
    return successResponse(res, user.services, 'Services updated successfully');
});

exports.updateLocation = catchAsync(async (req, res) => {
    const { city, pincode, area, radius, coordinates } = req.body;
    const updateData = {};
    if (radius !== undefined) updateData.serviceRadius = radius;
    if (city || pincode || area) {
        updateData['activeLocation.addressDetails'] = { city, pincode, area };
    }
    if (coordinates) {
        updateData['activeLocation.type'] = 'Point';
        updateData['activeLocation.coordinates'] = coordinates;
    }
    
    const user = await Customer.findByIdAndUpdate(
        req.user.id,
        { $set: updateData },
        { new: true }
    );
    return successResponse(res, { 
        serviceRadius: user.serviceRadius, 
        activeLocation: user.activeLocation 
    }, 'Location updated successfully');
});

exports.submitCategorySuggestion = catchAsync(async (req, res) => {
    const { name, type, parentCategory } = req.body;
    
    if (!name || !type) {
        return errorResponse(res, 'Name and type are required', StatusCodes.BAD_REQUEST);
    }
    
    if (type === 'SUBCATEGORY' && !parentCategory) {
        return errorResponse(res, 'Parent category is required for a subcategory', StatusCodes.BAD_REQUEST);
    }
    
    const suggestion = await CategorySuggestion.create({
        name,
        type,
        parentCategory: type === 'SUBCATEGORY' ? parentCategory : undefined,
        suggestedBy: req.user.id
    });
    
    return successResponse(res, suggestion, 'Suggestion submitted successfully', StatusCodes.CREATED);
});

// -- Address Management --

exports.addAddress = catchAsync(async (req, res) => {
    const { label, street, city, area, pincode, isPrimary, location } = req.body;
    const user = await Customer.findById(req.user.id);
    if (!user) return errorResponse(res, 'User not found', StatusCodes.NOT_FOUND);

    const newAddress = { label, street, city, area, pincode, isPrimary: !!isPrimary };
    if (location && location.coordinates) {
        newAddress.location = { type: 'Point', coordinates: location.coordinates };
    }

    // If this is the first address, or isPrimary is true, unset others and set activeLocation
    if (newAddress.isPrimary || user.addresses.length === 0) {
        newAddress.isPrimary = true;
        user.addresses.forEach(a => a.isPrimary = false);
        user.activeLocation.addressDetails = { city, area, pincode };
        if (newAddress.location) {
            user.activeLocation.type = 'Point';
            user.activeLocation.coordinates = newAddress.location.coordinates;
        }
    }

    user.addresses.push(newAddress);
    await user.save();
    return successResponse(res, user.addresses, 'Address added successfully');
});

exports.updateAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const { label, street, city, area, pincode, location } = req.body;
    
    const user = await Customer.findById(req.user.id);
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    if (label) address.label = label;
    if (street) address.street = street;
    if (city) address.city = city;
    if (area) address.area = area;
    if (pincode) address.pincode = pincode;
    if (location && location.coordinates) {
        address.location = { type: 'Point', coordinates: location.coordinates };
    }

    if (address.isPrimary) {
        user.activeLocation.addressDetails = { city: address.city, area: address.area, pincode: address.pincode };
        if (address.location) {
            user.activeLocation.coordinates = address.location.coordinates;
        }
    }

    await user.save();
    return successResponse(res, user.addresses, 'Address updated successfully');
});

exports.deleteAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const user = await Customer.findById(req.user.id);
    
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    user.addresses.pull(addressId);
    
    // If we deleted the primary address and there are others left, make the first one primary
    if (address.isPrimary && user.addresses.length > 0) {
        user.addresses[0].isPrimary = true;
        const newPrim = user.addresses[0];
        user.activeLocation.addressDetails = { city: newPrim.city, area: newPrim.area, pincode: newPrim.pincode };
        if (newPrim.location) {
            user.activeLocation.coordinates = newPrim.location.coordinates;
        }
    }
    
    await user.save();
    return successResponse(res, user.addresses, 'Address deleted successfully');
});

exports.setPrimaryAddress = catchAsync(async (req, res) => {
    const { addressId } = req.params;
    const user = await Customer.findById(req.user.id);
    
    const address = user.addresses.id(addressId);
    if (!address) return errorResponse(res, 'Address not found', StatusCodes.NOT_FOUND);

    user.addresses.forEach(a => a.isPrimary = false);
    address.isPrimary = true;
    
    user.activeLocation.addressDetails = { city: address.city, area: address.area, pincode: address.pincode };
    if (address.location) {
        user.activeLocation.type = 'Point';
        user.activeLocation.coordinates = address.location.coordinates;
    }

    await user.save();
    return successResponse(res, user.addresses, 'Primary address updated successfully');
});
