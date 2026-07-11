const mongoose = require('mongoose');
const Job = require('./src/modules/job/job.model');
const Customer = require('./src/modules/customer/customer.model');

mongoose.connect('mongodb://127.0.0.1:27017/kwickly')
  .then(async () => {
    console.log('Connected to DB');
    
    // Find any customer
    const customer = await Customer.findOne();
    if (!customer) {
        console.log('No customer found to create job for.');
        process.exit(1);
    }
    
    const newJob = new Job({
        customerId: customer._id,
        category: 'Appliance Repair',
        subcategory: 'AC Service',
        description: 'AC is not cooling properly, makes a loud noise when starting. Test job created for admin panel verification.',
        media: [
            'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
            'https://res.cloudinary.com/demo/video/upload/dog.mp4'
        ],
        preferredDate: new Date(),
        timeSlot: 'afternoon',
        status: 'BROADCASTING',
        location: {
            type: 'Point',
            coordinates: [72.5714, 23.0225]
        },
        addressDetails: {
            city: 'Ahmedabad',
            fullAddress: '123 Test Street, Near Vastrapur Lake, Ahmedabad, 380015'
        },
        security: {
            arrivalOtp: '1234',
            completionOtp: '5678'
        },
        completionDetails: {
            media: ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'],
            report: 'Fixed the AC cooling coil. Gas was leaking, sealed and refilled.'
        }
    });
    
    await newJob.save();
    console.log('Test job created successfully with ID:', newJob._id);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
