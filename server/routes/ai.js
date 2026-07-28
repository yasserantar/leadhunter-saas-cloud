const express = require('express');
const router = express.Router();
const aiService = require('../services/ai-service');
const { verifyToken } = require('../middlewares/authMiddleware');
const { getDb } = require('../db/database');

// دراسة السوق
router.post('/market-research', verifyToken, async (req, res) => {
    try {
        const { keyword, location } = req.body;
        if (!keyword || !location) return res.status(400).json({ error: 'الكلمة المفتاحية والموقع مطلوبان' });
        
        const research = await aiService.generateMarketResearch(keyword, location);
        res.json({ success: true, data: research });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// رسالة مخصصة
router.post('/personalized-message', verifyToken, async (req, res) => {
    try {
        const { leadId, productDetails } = req.body;
        if (!productDetails) return res.status(400).json({ error: 'تفاصيل المنتج مطلوبة' });

        const db = getDb();
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
        if (!lead) return res.status(404).json({ error: 'العميل غير موجود' });

        const message = await aiService.generatePersonalizedMessage(lead, productDetails);
        res.json({ success: true, data: message });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
