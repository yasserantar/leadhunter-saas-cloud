const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/dashboard/stats - Get overall stats
router.get('/dashboard/stats',  async (req, res) => {
    try {
        const db = getDb();
        
        // Leads stats
        const totalLeads = await db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
        const leadsByStatusRows = await db.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all();
        const leadsByStatus = {};
        leadsByStatusRows.forEach(row => { leadsByStatus[row.status] = row.count; });
        
        // Campaign stats
        const activeCampaigns = await db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE status = 'running'").get().count;
        
        // Email stats
        const totalSentEmails = await db.prepare('SELECT COUNT(*) as count FROM email_logs WHERE sent_at IS NOT NULL').get().count;
        const totalOpenedEmails = await db.prepare('SELECT COUNT(*) as count FROM email_logs WHERE opened_at IS NOT NULL').get().count;
        const totalClickedEmails = await db.prepare('SELECT COUNT(*) as count FROM email_logs WHERE clicked_at IS NOT NULL').get().count;
        const totalRepliedEmails = await db.prepare("SELECT COUNT(*) as count FROM email_logs WHERE status = 'replied'").get().count;
        
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
router.get('/settings',  async (req, res) => {
    try {
        const db = getDb();
        const rows = await db.prepare('SELECT * FROM settings').all();
        const settings = {};
        rows.forEach(row => { settings[row.key] = row.value; });
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
});

router.post('/settings', async (req, res) => {
    try {
        const db = getDb();
        const { settings } = req.body;
        
        const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value');
        for (const [key, value] of Object.entries(settings)) {
            await stmt.run(key, value);
        }
        res.json({ success: true, message: 'تم حفظ الإعدادات' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
});

module.exports = router;
