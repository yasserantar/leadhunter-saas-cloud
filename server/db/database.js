// ======================================================
// قاعدة البيانات V4.0 - LeadHunter Pro SaaS (PostgreSQL)
// ======================================================

const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase outside their network
});

// Wrapper to mimic better-sqlite3 API (async version)
const dbWrapper = {
  prepare: (sql) => {
    let count = 1;
    // Replace ? with $1, $2 etc. Note: this simple regex assumes ? is not inside strings.
    const pgSql = sql.replace(/\?/g, () => `$${count++}`);
    return {
      run: async (...params) => {
        // Handle case where params might be passed as an array e.g., run([a, b])
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        const res = await pool.query(pgSql, args);
        return { changes: res.rowCount, lastInsertRowid: null };
      },
      all: async (...params) => {
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        const res = await pool.query(pgSql, args);
        return res.rows;
      },
      get: async (...params) => {
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        const res = await pool.query(pgSql, args);
        return res.rows[0];
      }
    };
  },
  exec: async (sql) => {
    return await pool.query(sql);
  }
};

function getDb() {
  return dbWrapper;
}

async function initDb() {
  const database = getDb();

  // ========== جدول المستخدمين (Users) ==========
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      subscription_plan TEXT DEFAULT 'free',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========== جدول العملاء المحتملين (Leads) ==========
  await database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      email TEXT,
      company TEXT,
      phone TEXT,
      whatsapp TEXT,
      website TEXT,
      address TEXT,
      category TEXT,
      source TEXT DEFAULT 'google_maps',
      facebook TEXT DEFAULT '',
      instagram TEXT DEFAULT '',
      twitter TEXT DEFAULT '',
      linkedin TEXT DEFAULT '',
      youtube TEXT DEFAULT '',
      tiktok TEXT DEFAULT '',
      rating REAL,
      sourceUrl TEXT DEFAULT '',
      verified INTEGER DEFAULT 0,
      status TEXT DEFAULT 'new',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ========== جدول الحملات (Campaigns) ==========
  await database.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'email',
      template_id TEXT,
      status TEXT DEFAULT 'draft',
      total_leads INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      open_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      scheduled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ========== جدول القوالب (Templates) ==========
  await database.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      subject TEXT,
      body_text TEXT NOT NULL,
      type TEXT DEFAULT 'email',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ========== جدول سجلات الإرسال (Logs) ==========
  await database.exec(`
    CREATE TABLE IF NOT EXISTS campaign_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      type TEXT,
      status TEXT DEFAULT 'pending',
      error TEXT,
      sent_at TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )
  `);

  // Indexes for performance (Postgres syntax)
  await database.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  console.log('✅ قاعدة البيانات السحابية (PostgreSQL) متصلة وجاهزة!');
  return database;
}

module.exports = {
  getDb,
  initDb,
  pool
};
