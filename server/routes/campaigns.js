const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { verifyToken } = require('../middlewares/authMiddleware');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// POST /api/campaigns/send-email - إرسال إيميل جماعي
// ============================================================
router.post('/send-email', verifyToken, async (req, res) => {
  try {
    const { subject, body, lead_ids, send_to_all } = req.body;
    
    if (!subject || !body) {
      return res.status(400).json({ success: false, error: 'Subject and body are required' });
    }

    const db = getDb();
    
    // Get leads to send to
    let leads;
    if (send_to_all) {
      leads = await db.prepare(`
        SELECT * FROM leads WHERE user_id = ? AND email != '' AND email IS NOT NULL
      `).all(req.userId);
    } else if (lead_ids && lead_ids.length) {
      const placeholders = lead_ids.map(() => '?').join(',');
      leads = await db.prepare(`
        SELECT * FROM leads WHERE id IN (${placeholders}) AND user_id = ? AND email != ''
      `).all(...lead_ids, req.userId);
    } else {
      return res.status(400).json({ success: false, error: 'No leads specified' });
    }

    if (!leads.length) {
      return res.status(400).json({ success: false, error: 'No leads with email found' });
    }

    // SMTP Config from env
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      return res.status(400).json({ 
        success: false, 
        error: 'يرجى إضافة بيانات الإيميل (SMTP_USER, SMTP_PASS) في ملف .env' 
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });

    // Create campaign record
    const campaignId = uuidv4();
    await db.prepare(`
      INSERT INTO campaigns (id, user_id, name, type, status, total_leads)
      VALUES (?, ?, ?, 'email', 'running', ?)
    `).run(campaignId, req.userId, subject, leads.length);

    // Send immediately (respond to client, send in background)
    res.json({ 
      success: true, 
      campaign_id: campaignId,
      message: `بدأ إرسال ${leads.length} إيميل في الخلفية...`,
      total: leads.length
    });

    // Background sending
    let sentCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      try {
        // Personalize the body
        const personalBody = body
          .replace(/\{name\}/g, lead.name || '')
          .replace(/\{company\}/g, lead.company || lead.name || '')
          .replace(/\{phone\}/g, lead.phone || '')
          .replace(/\{address\}/g, lead.address || '');

        await transporter.sendMail({
          from: `"${process.env.SENDER_NAME || 'LeadHunter Pro'}" <${smtpUser}>`,
          to: lead.email,
          subject: subject,
          html: `<div dir="rtl">${personalBody.replace(/\n/g, '<br>')}</div>`,
          text: personalBody
        });

        // Update lead status
        await db.prepare(`UPDATE leads SET status = 'emailed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(lead.id);
        sentCount++;

        if (global.io) {
          global.io.emit('campaign_progress', {
            campaign_id: campaignId,
            sent: sentCount,
            failed: failedCount,
            total: leads.length,
            message: `📧 أُرسل لـ: ${lead.name} (${lead.email})`
          });
        }

        // Delay between sends to avoid spam filters
        await new Promise(r => setTimeout(r, 1500));

      } catch (err) {
        failedCount++;
        console.error(`[Email] Failed for ${lead.email}: ${err.message}`);
        
        await db.prepare(`
          INSERT INTO campaign_logs (id, campaign_id, lead_id, type, status, error, sent_at)
          VALUES (?, ?, ?, 'email', 'failed', ?, CURRENT_TIMESTAMP)
        `).run(uuidv4(), campaignId, lead.id, err.message);
      }
    }

    // Update campaign status
    await db.prepare(`
      UPDATE campaigns SET status = 'completed', sent_count = ? WHERE id = ?
    `).run(sentCount, campaignId);

    if (global.io) {
      global.io.emit('campaign_progress', {
        campaign_id: campaignId,
        sent: sentCount,
        failed: failedCount,
        total: leads.length,
        message: `✅ اكتمل! أُرسل ${sentCount} إيميل، فشل ${failedCount}`,
        status: 'completed'
      });
    }

  } catch (err) {
    console.error('Campaign Send Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// ============================================================
// POST /api/campaigns/send-whatsapp - إرسال واتساب جماعي
// ============================================================
router.post('/send-whatsapp', verifyToken, async (req, res) => {
  try {
    const { message, lead_ids, send_to_all } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const db = getDb();
    
    let leads;
    if (send_to_all) {
      leads = await db.prepare(`
        SELECT * FROM leads WHERE user_id = ? AND (phone != '' OR whatsapp != '')
      `).all(req.userId);
    } else if (lead_ids && lead_ids.length) {
      const placeholders = lead_ids.map(() => '?').join(',');
      leads = await db.prepare(`
        SELECT * FROM leads WHERE id IN (${placeholders}) AND user_id = ?
      `).all(...lead_ids, req.userId);
    } else {
      return res.status(400).json({ success: false, error: 'No leads specified' });
    }

    if (!leads.length) {
      return res.status(400).json({ success: false, error: 'No leads with phone found' });
    }

    // Check if WhatsApp client is connected
    const waClient = global.whatsappClient;
    if (!waClient || !global.whatsappReady) {
      return res.status(400).json({
        success: false,
        error: 'واتساب غير متصل. افتح صفحة الواتساب وامسح الـ QR Code أولاً',
        needsQR: true
      });
    }

    const campaignId = uuidv4();
    await db.prepare(`
      INSERT INTO campaigns (id, user_id, name, type, status, total_leads)
      VALUES (?, ?, ?, 'whatsapp', 'running', ?)
    `).run(campaignId, req.userId, `WhatsApp - ${new Date().toLocaleDateString('ar')}`, leads.length);

    res.json({
      success: true,
      campaign_id: campaignId,
      message: `بدأ إرسال ${leads.length} رسالة واتساب في الخلفية...`,
      total: leads.length
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      try {
        const phone = (lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '');
        if (!phone) { failedCount++; continue; }

        const personalMsg = message
          .replace(/\{name\}/g, lead.name || '')
          .replace(/\{company\}/g, lead.company || lead.name || '')
          .replace(/\{phone\}/g, lead.phone || '');

        const chatId = `${phone}@c.us`;
        await waClient.sendMessage(chatId, personalMsg);

        await db.prepare(`UPDATE leads SET status = 'whatsapped', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(lead.id);
        sentCount++;

        if (global.io) {
          global.io.emit('campaign_progress', {
            campaign_id: campaignId,
            sent: sentCount,
            failed: failedCount,
            total: leads.length,
            message: `💬 أُرسل واتساب لـ: ${lead.name} (+${phone})`
          });
        }

        // Delay to avoid WhatsApp ban
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

      } catch (err) {
        failedCount++;
        console.error(`[WhatsApp] Failed for ${lead.name}: ${err.message}`);
      }
    }

    await db.prepare(`UPDATE campaigns SET status = 'completed', sent_count = ? WHERE id = ?`).run(sentCount, campaignId);

    if (global.io) {
      global.io.emit('campaign_progress', {
        campaign_id: campaignId,
        sent: sentCount,
        failed: failedCount,
        total: leads.length,
        message: `✅ اكتمل! أُرسل ${sentCount} واتساب، فشل ${failedCount}`,
        status: 'completed'
      });
    }

  } catch (err) {
    console.error('WhatsApp Campaign Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// GET /api/campaigns - قائمة الحملات
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const campaigns = await db.prepare(`
      SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(req.userId);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
