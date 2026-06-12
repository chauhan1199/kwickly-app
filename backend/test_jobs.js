const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kwickly').then(async () => {
    require('./src/modules/category/category.model');
    const jobController = require('./src/modules/job/job.controller');
    const Customer = require('./src/modules/customer/customer.model');
    const Job = require('./src/modules/job/job.model');
    
    const worker = await Customer.findOne({ phone: '9274344141', role: 'WORKER' });
    if (!worker) {
        console.log("Worker not found");
        process.exit(1);
    }
    
    console.log("Worker found:", worker._id);
    
    // Check what jobs exist
    const activeJobs = await Job.find({ status: 'BROADCASTING' });
    console.log("Total Broadcasting Jobs in DB:", activeJobs.length);
    
    const req = {
        method: 'GET',
        url: '/api/v1/jobs/available',
        user: { _id: worker._id, role: 'WORKER' }
    };
    
    const res = {
        status: function(s) { this.statusCode = s; return this; },
        json: function(d) { console.log("Response:", JSON.stringify({ statusCode: this.statusCode, ...d }, null, 2)); },
        send: function(d) { console.log("Response Send:", d); }
    };
    
    await jobController.getAvailableJobs(req, res, (err) => {
        if(err) console.error("Next called with error:", err);
    });
    
    setTimeout(() => {
        mongoose.disconnect();
    }, 1000);
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
