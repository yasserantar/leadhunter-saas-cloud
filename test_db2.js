const { pool } = require('C:\\LeadHunter-SaaS-Cloud\\dist\\server\\db\\database.js');
const uuidv4 = require('uuid').v4;

async function test() {
    try {
        console.log('Testing exact query from search.js...');
        
        let count = 1;
        const sql = `
          INSERT INTO leads 
            (id, user_id, name, email, company, phone, whatsapp, website, address, category, source, 
             facebook, instagram, twitter, linkedin, youtube, tiktok, rating, status)
          VALUES 
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
          ON CONFLICT (id) DO NOTHING
        `;
        const pgSql = sql.replace(/\?/g, () => `$${count++}`);
        
        const args = [
          uuidv4(),
          '7a2ec616-207d-4664-91f4-c111c03365b9', // Yasser's ID
          'Unknown',
          '',
          '',
          '',
          '',
          '',
          '',
          'query',
          'source',
          '',
          '',
          '',
          '',
          '',
          '',
          null
        ];

        console.log('Executing:', pgSql);
        console.log('Args length:', args.length);
        
        const res = await pool.query(pgSql, args);
        console.log('Param insert res:', res.rowCount);
        
    } catch (e) {
        console.error('ERROR:', e.message, e.position);
    } finally {
        pool.end();
    }
}
test();
