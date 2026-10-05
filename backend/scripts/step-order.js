const axios = require('axios');

const RENDER_BASE = 'https://kwickly-backend-r6zb.onrender.com/api/v1';

async function main() {
    const action = process.argv[2]; // 'confirm', 'packing', 'out_for_delivery', 'deliver'
    const orderId = process.argv[3] || '6abb78fc994666dea8a564a2';
    const otp = process.argv[4] || '6708';

    console.log(`Logging in as Shop Owner 9000000002...`);
    const loginRes = await axios.post(`${RENDER_BASE}/auth/login`, {
        phone: '9000000002',
        password: '1234',
        role: 'SHOP'
    });

    const token = loginRes.data.data.token;
    console.log('Shop owner authenticated successfully!');

    let targetStatus;
    let payload = {};
    if (action === 'confirm') {
        targetStatus = 'CONFIRMED';
    } else if (action === 'packing') {
        targetStatus = 'PACKING';
    } else if (action === 'out') {
        targetStatus = 'OUT_FOR_DELIVERY';
    } else if (action === 'deliver') {
        targetStatus = 'DELIVERED';
        payload.otp = otp;
    } else {
        console.error('Usage: node step-order.js <confirm|packing|out|deliver> [orderId] [otp]');
        process.exit(1);
    }

    payload.status = targetStatus;
    console.log(`Sending PATCH /shoporders/${orderId}/status with:`, payload);
    const res = await axios.patch(`${RENDER_BASE}/shoporders/${orderId}/status`, payload, {
        headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Status updated successfully:', res.data.message || res.data);
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
});
