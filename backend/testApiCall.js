const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://127.0.0.1:5000/api/v1/shops');
    console.log("Status:", res.status);
    console.log("Data keys:", Object.keys(res.data));
    console.log("Data type of res.data.data:", typeof res.data.data);
    console.log("Is array?", Array.isArray(res.data.data));
    if (!Array.isArray(res.data.data)) {
       console.log("res.data.data keys:", Object.keys(res.data.data));
    }
  } catch (err) {
    console.log("Error:", err.response ? err.response.data : err.message);
  }
}
test();
