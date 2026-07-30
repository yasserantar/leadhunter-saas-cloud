const { Client } = require('pg');

const dbUrl = 'postgresql://postgres.kdhdxydqmkbuztsumcfk:FCsc6CQpklug58BJ@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function check() {
  await client.connect();
  const res = await client.query('SELECT * FROM users');
  console.log('USERS:', res.rows);
  
  // Also check if the table has the right schema
  const res2 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
  `);
  console.log('SCHEMA:', res2.rows);

  await client.end();
}

check();
