const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { backupDatabase } = require('../services/backup');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(verifyAdmin);

// Get all users
router.get('/users', (req, res) => {
    try {
        const db = getDb();
        const users = db.prepare('SELECT id, name, email, role, status, subscription_plan, created_at FROM users').all();
        res.json({ success: true, data: users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

// Update user status (active/suspended)
router.post('/users/:id/status', (req, res) => {
    try {
        const { status } = req.body;
        const db = getDb();
        db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
        res.json({ success: true, message: 'User status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

// Trigger manual backup
router.post('/backup', (req, res) => {
    try {
        backupDatabase();
        res.json({ success: true, message: 'Backup triggered successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

module.exports = router;
