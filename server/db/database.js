// ======================================================
// قاعدة البيانات V3.0 - LeadHunter Pro SaaS
// ======================================================

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// مسار ملف قاعدة البيانات
const DB_PATH = process.env.VERCEL 
    ? '/tmp/leadhunter_v3.db' 
    : path.join(__dirname, '..', '..', 'data', 'leadhunter_v3.db');

let db = null;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const database = getDb();

  // ========== جدول المستخدمين (Users) ==========
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user', -- 'admin', 'user'
      status TEXT DEFAULT 'active', -- 'active', 'suspended'
      subscription_plan TEXT DEFAULT 'free',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========== جدول العملاء المحتملين (Leads) ==========
  database.exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Add columns if missing (migration for existing DBs)
  const existingCols = database.prepare(`PRAGMA table_info(leads)`).all().map(c => c.name);
  const newCols = [
    ['facebook', 'TEXT DEFAULT ""'],
    ['instagram', 'TEXT DEFAULT ""'],
    ['twitter', 'TEXT DEFAULT ""'],
    ['linkedin', 'TEXT DEFAULT ""'],
    ['youtube', 'TEXT DEFAULT ""'],
    ['tiktok', 'TEXT DEFAULT ""'],
    ['rating', 'REAL'],
    ['sourceUrl', 'TEXT DEFAULT ""'],
    ['notes', 'TEXT DEFAULT ""'],
    ['whatsapp', 'TEXT DEFAULT ""'],
    ['phone', 'TEXT DEFAULT ""'],
  ];
  for (const [col, def] of newCols) {
    if (!existingCols.includes(col)) {
      try { database.exec(`ALTER TABLE leads ADD COLUMN ${col} ${def}`); } catch(e) {}
    }
  }

  // ========== جدول الحملات (Campaigns) ==========
  database.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'email', -- 'email', 'whatsapp'
      template_id TEXT,
      status TEXT DEFAULT 'draft',
      total_leads INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      open_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      scheduled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ========== جدول القوالب (Templates) ==========
  database.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT, -- إذا كان NULL فهو قالب عام من الآدمن
      name TEXT NOT NULL,
      subject TEXT,
      body_text TEXT NOT NULL,
      type TEXT DEFAULT 'email', -- 'email', 'whatsapp'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ========== جدول سجلات الإرسال (Logs) ==========
  database.exec(`
    CREATE TABLE IF NOT EXISTS campaign_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      type TEXT, -- 'email', 'whatsapp'
      status TEXT DEFAULT 'pending',
      error TEXT,
      sent_at DATETIME,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )
  `);

  // Indexes for performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  console.log('✅ قاعدة البيانات V3 (نظام SaaS) اتعملت بنجاح');
  return database;
}

module.exports = {
  getDb,
  initDb
};
