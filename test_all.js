const axios = require('axios');
const fs = require('fs');

async function testAll() {
  try {
    console.log('--- STARTING COMPREHENSIVE TESTS ---');
    
    // 1. Auth (Login)
    console.log('[1] Logging in...');
    const loginRes = await axios.post('http://localhost:3005/api/auth/login', {
      email: 'yasser.antar.adv@gmail.com',
      password: 'admin'
    });
    const token = loginRes.data.token;
    console.log('✅ Login successful!');
    
    const headers = { 'Authorization': `Bearer ${token}` };

    // 2. Fetch Dashboard
    console.log('[2] Fetching Dashboard...');
    try {
        const dashRes = await axios.get('http://localhost:3005/api/dashboard', { headers });
        console.log('✅ Dashboard OK');
    } catch(e) { console.error('❌ Dashboard Failed:', e.response?.data || e.message); }

    // 3. Fetch Leads
    console.log('[3] Fetching Leads (CRM)...');
    try {
        const leadsRes = await axios.get('http://localhost:3005/api/leads?page=1&limit=50', { headers });
        console.log('✅ Leads OK, count:', leadsRes.data.data ? leadsRes.data.data.length : 'undefined');
    } catch(e) { console.error('❌ Leads Failed:', e.response?.data || e.message); }

    // 4. Fetch Campaigns
    console.log('[4] Fetching Campaigns...');
    try {
        const campRes = await axios.get('http://localhost:3005/api/campaigns', { headers });
        console.log('✅ Campaigns OK, count:', campRes.data.campaigns ? campRes.data.campaigns.length : 'undefined');
    } catch(e) { console.error('❌ Campaigns Failed:', e.response?.data || e.message); }

    // 5. Fetch Templates
    console.log('[5] Fetching Templates...');
    try {
        const tempRes = await axios.get('http://localhost:3005/api/templates', { headers });
        console.log('✅ Templates OK, count:', tempRes.data.templates ? tempRes.data.templates.length : 'undefined');
    } catch(e) { console.error('❌ Templates Failed:', e.response?.data || e.message); }

  } catch (err) {
    console.error('Fatal Error:', err.message);
  }
}

testAll();
