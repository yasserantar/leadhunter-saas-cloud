const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { verifyToken } = require('../middlewares/authMiddleware');

// ============================================================
// GET /api/leads - جلب كل العملاء المحفوظين للمستخدم
// ============================================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let whereClause = 'WHERE l.user_id = ?';
    const params = [req.userId];

    if (search) {
      whereClause += ` AND (l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.address LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ` AND l.status = ?`;
      params.push(status);
    }

    const countRow = await db.prepare(`SELECT COUNT(*) as total FROM leads l ${whereClause}`).get(...params);
    const total = countRow.total;

    const leads = await db.prepare(`
      SELECT l.*, 
        CASE WHEN l.email != '' AND l.email IS NOT NULL THEN 1 ELSE 0 END as has_email,
        CASE WHEN l.phone != '' AND l.phone IS NOT NULL THEN 1 ELSE 0 END as has_phone
      FROM leads l
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Leads GET Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/leads/stats - إحصائيات شاملة
// ============================================================
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const uid = req.userId;

    const total = await db.prepare(`SELECT COUNT(*) as n FROM leads WHERE user_id = ?`).get(uid).n;
    const withEmail = await db.prepare(`SELECT COUNT(*) as n FROM leads WHERE user_id = ? AND email != '' AND email IS NOT NULL`).get(uid).n;
    const withPhone = await db.prepare(`SELECT COUNT(*) as n FROM leads WHERE user_id = ? AND phone != '' AND phone IS NOT NULL`).get(uid).n;
    const withWebsite = await db.prepare(`SELECT COUNT(*) as n FROM leads WHERE user_id = ? AND website != '' AND website IS NOT NULL`).get(uid).n;
    const sentEmail = await db.prepare(`SELECT COUNT(*) as n FROM leads WHERE user_id = ? AND status = 'emailed'`).get(uid).n;
    const sentWhatsapp = await db.prepare(`SELECT COUNT(*) as n FROM leads WHERE user_id = ? AND status = 'whatsapped'`).get(uid).n;

    // By source
    const bySource = await db.prepare(`
      SELECT source, COUNT(*) as count FROM leads WHERE user_id = ? GROUP BY source
    `).all(uid);

    res.json({
      success: true,
      stats: { total, withEmail, withPhone, withWebsite, sentEmail, sentWhatsapp },
      bySource
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/leads/:id - حذف عميل
// ============================================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    await db.prepare(`DELETE FROM leads WHERE id = ? AND user_id = ?`).run(req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/leads/bulk - حذف متعدد
// ============================================================
router.post('/delete-bulk', verifyToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ success: false, error: 'No IDs provided' });
    
    const db = getDb();
    const del = await db.prepare(`DELETE FROM leads WHERE id = ? AND user_id = ?`);
    for (const id of ids) { await del.run(id, req.userId); }
    
    res.json({ success: true, deleted: ids.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PUT /api/leads/:id - تحديث بيانات عميل
// ============================================================
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const { name, email, phone, whatsapp, website, address, status, notes } = req.body;
    
    await db.prepare(`
      UPDATE leads 
      SET name = ?, email = ?, phone = ?, whatsapp = ?, website = ?, address = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(name, email, phone, whatsapp, website, address, status, req.params.id, req.userId);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
