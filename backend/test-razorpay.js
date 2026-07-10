
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/kwickly');
    const Customer = require('./src/modules/customer/customer.model');
    const user = await Customer.findOne({ role: 'WORKER' });
    if (!user) {
        console.log('No worker found');
        process.exit();
    }

    const token = jwt.sign({ id: user._id, role: 'WORKER' }, 'kwickly_super_secret_jwt_key_2026', { expiresIn: '1d' });
    
    console.log('1. Generating Razorpay Order...');
    const orderRes = await axios.post('http://127.0.0.1:5000/api/v1/payments/create-order', { amount: 100, purpose: 'wallet_topup' }, {
        headers: { 'Authorization': 'Bearer ' + token }
    });

    console.log(orderRes.data);
    const orderId = orderRes.data.data.razorpayOrderId;

    console.log('\n2. Simulating successful Razorpay payment with FAKE paymentId but CORRECT signature format...');
    const crypto = require('crypto');
    const fakePaymentId = 'pay_fake1234567890';
    const secret = 'XcJD3jIo8zICC1tcVRkvP7rF';
    const signature = crypto.createHmac('sha256', secret).update(orderId + '|' + fakePaymentId).digest('hex');

    try {
        const verifyRes = await axios.post('http://127.0.0.1:5000/api/v1/wallet/topup', {
            amount: 100,
            paymentDetails: { method: 'RAZORPAY', txnId: fakePaymentId },
            razorpayOrderId: orderId,
            razorpayPaymentId: fakePaymentId,
            razorpaySignature: signature
        }, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        console.log(verifyRes.data);
    } catch (e) {
        console.log('Topup response with fake payment ID (Should fail securely):');
        console.log(e.response.data);
    }

    process.exit();
}

run();

