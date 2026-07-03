const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function test() {
    try {
        // Login as admin
        const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
            phone: '9999999999',
            password: 'password123',
            role: 'ADMIN'
        });
        const token = loginRes.data.data.token;

        // Get sagardev ID
        const workersRes = await axios.get('http://127.0.0.1:5000/api/v1/admin/workers?search=8888888888', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const workerId = workersRes.data.data.workers[0]._id;

        // Upload dummy KYC
        fs.writeFileSync('dummy.jpg', 'fake image data');
        const fd = new FormData();
        fd.append('document', fs.createReadStream('dummy.jpg'));
        fd.append('docType', 'PAN');

        const uploadRes = await axios.post(`http://127.0.0.1:5000/api/v1/admin/workers/${workerId}/kyc-documents`, fd, {
            headers: { ...fd.getHeaders(), Authorization: `Bearer ${token}` }
        });

        console.log('Upload Result:', uploadRes.data);
    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}
test();
