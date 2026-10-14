const Joi = require('joi');

// Body of POST /jobs/:id/start. The controller compares currentCoordinates against the
// 200 m geofence; a non-numeric value would make that distance NaN and slip past the check.
const startJobSchema = Joi.object({
    arrivalOtp: Joi.alternatives().try(Joi.string().max(10), Joi.number()).optional(),
    currentCoordinates: Joi.array().ordered(
        Joi.number().min(-180).max(180).required(), // longitude
        Joi.number().min(-90).max(90).required()    // latitude
    ).length(2).required()
        .messages({ 'any.required': 'Current location coordinates are required to start the job. Please enable GPS.' }),
    accuracy: Joi.number().min(0).optional()
});

module.exports = { startJobSchema };
