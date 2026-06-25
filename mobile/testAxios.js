const axios = require('axios');

const BASE_URL = 'http://10.0.2.2:5000/api/v1'; // I should use localhost:5000 locally
const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
  timeout: 10000,
});

async function test() {
  try {
    const data = { name: 'mohul' };
    const res = await api.put('/customers/me/profile', data);
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
  }
}

test();
