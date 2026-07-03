const axios = require('axios');
require('dotenv').config();
const jwt = require('jsonwebtoken');

async function test() {
    try {
        const workerId = '6a3d1d6f0ec16c13a9453e03'; 
        const token = jwt.sign({ id: workerId, role: 'WORKER' }, process.env.JWT_SECRET || 'kwickly_super_secret_jwt_key_2026', { expiresIn: '30d' });

        const profileRes = await axios.get('http://127.0.0.1:5000/api/v1/workers/me', { headers: { Authorization: 'Bearer ' + token } });
        console.log("PROFILE IMAGE:", profileRes.data.data.profileImage);
        console.log("KYC DOCUMENTS:", JSON.stringify(profileRes.data.data.kyc.documents, null, 2));
    } catch (e) {
        console.log(e.response ? e.response.data : e.message);
    }
}
test();
