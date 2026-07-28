const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const { initWhatsApp, getStatus, disconnectWhatsApp } = require('../services/whatsapp-sender');

// GET /api/whatsapp/status
router.get('/status', verifyToken, (req, res) => {
  res.json({ success: true, ...getStatus() });
});

// POST /api/whatsapp/connect - ابدأ اتصال واتساب وجيب QR
router.post('/connect', verifyToken, (req, res) => {
  const { status } = getStatus();
  if (status === 'connected') {
    return res.json({ success: true, message: 'واتساب متصل بالفعل ✅' });
  }
  initWhatsApp();
  res.json({ success: true, message: 'جاري إنشاء كود QR... ترقب الشاشة' });
});

// POST /api/whatsapp/disconnect
router.post('/disconnect', verifyToken, (req, res) => {
  disconnectWhatsApp();
  res.json({ success: true, message: 'تم قطع الاتصال' });
});

module.exports = router;
