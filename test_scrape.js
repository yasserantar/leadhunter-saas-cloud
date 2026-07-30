const axios = require('axios');

async function test() {
  try {
    // 1. Login
    const loginRes = await axios.post('http://localhost:3005/api/auth/login', {
      email: 'yasser.antar.adv@gmail.com',
      password: 'admin'
    });
    const token = loginRes.data.token;
    console.log('Logged in successfully!');

    // 2. Scrape
    const scrapeRes = await axios.post('http://localhost:3005/api/search/live-scrape', {
      source: 'google',
      query: 'شركات عقارات',
      location: 'جدة',
      limit: 10
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Scrape Success:', scrapeRes.data);

  } catch (err) {
    if (err.response) {
      console.error('Scrape Failed with status:', err.response.status);
      console.error('Response body:', err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

test();
