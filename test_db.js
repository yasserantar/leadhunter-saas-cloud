const { Client } = require('pg');

const client = new Client('postgresql://postgres.kdhdxydqmkbuztsumcfk:FCsc6CQpklug58BJ@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres');

client.connect()
    .then(() => {
        console.log('DB CONNECTED SUCCESSFULLY');
        client.end();
    })
    .catch(e => {
        console.error('DB ERROR:', e.message);
        client.end();
    });
