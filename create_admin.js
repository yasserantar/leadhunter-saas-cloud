const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { Client } = require('pg');

const dbUrl = 'postgresql://postgres.kdhdxydqmkbuztsumcfk:FCsc6CQpklug58BJ@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function createAdmin() {
  try {
    await client.connect();
    
    const email = 'yasser.antar.adv@gmail.com';
    const password = 'admin'; // simple password for testing
    
    // Check if exists
    const existing = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('Admin already exists! Updating password to admin');
      const hash = await bcrypt.hash(password, 10);
      await client.query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [hash, 'admin', email]);
      console.log('Password updated.');
    } else {
      const hash = await bcrypt.hash(password, 10);
      const id = uuidv4();
      await client.query('INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)', [id, 'Yasser Antar', email, hash, 'admin']);
      console.log('Admin created successfully.');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}

createAdmin();
