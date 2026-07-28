const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/dashboard/stats - Get overall stats
router.get('/dashboard/stats', (req, res) => {
    try {
        const db = getDb();
        
        // Leads stats
        const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
        const leadsByStatusRows = db.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all();
        const leadsByStatus = {};
        leadsByStatusRows.forEach(row => { leadsByStatus[row.status] = row.count; });
        
        // Campaign stats
        const activeCampaigns = db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE status = 'running'").get().count;
        
        // Email stats
        const totalSentEmails = db.prepare('SELECT COUNT(*) as count FROM email_logs WHERE sent_at IS NOT NULL').get().count;
        const totalOpenedEmails = db.prepare('SELECT COUNT(*) as count FROM email_logs WHERE opened_at IS NOT NULL').get().count;
        const totalClickedEmails = db.prepare('SELECT COUNT(*) as count FROM email_logs WHERE clicked_at IS NOT NULL').get().count;
        const totalRepliedEmails = db.prepare("SELECT COUNT(*) as count FROM email_logs WHERE status = 'replied'").get().count;
        
        // Open Rate
        const openRate = totalSentEmails > 0 ? ((totalOpenedEmails / totalSentEmails) * 100).toFixed(1) : 0;

        res.json({
            success: true,
            data: {
                totalLeads,
                leadsByStatus,
                activeCampaigns,
                totalSentEmails,
                totalOpenedEmails,
                totalClickedEmails,
                totalRepliedEmails,
                openRate
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب الإحصائيات' });
    }
});

// Settings Endpoints
router.get('/settings', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM settings').all();
        const settings = {};
        rows.forEach(row => { settings[row.key] = row.value; });
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
});

router.post('/settings', (req, res) => {
    try {
        const db = getDb();
        const { settings } = req.body;
        
        db.transaction(() => {
            const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            for (const [key, value] of Object.entries(settings)) {
                stmt.run(key, value);
            }
        })();
        res.json({ success: true, message: 'تم حفظ الإعدادات' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
});

module.exports = router;
