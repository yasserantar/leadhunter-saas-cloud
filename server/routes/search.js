const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { searchBusinesses } = require('../services/google-maps-scraper');
const { searchLinkedInViaGoogle, scrapeLinkedIn } = require('../services/linkedin-scraper');
const { searchRedditForPainPoints } = require('../services/reddit-scraper');
const { searchYellowPages } = require('../services/yellowpages-scraper');
const { enrichLeadsWithEmails } = require('../services/website-email-scraper');
const { sendCompletionEmail } = require('../services/notifier');
const { verifyToken } = require('../middlewares/authMiddleware');
const { v4: uuidv4 } = require('uuid');

router.post('/live-scrape', verifyToken, async (req, res) => {
  try {
    const { source, query, location, limit: reqLimit } = req.body;
    const limit = Math.min(parseInt(reqLimit) || 100, 500); // الحد الأقصى 500 عميل
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    let results = [];
    
    if (source === 'google') {
      results = await searchBusinesses(query, location || 'Saudi Arabia', limit);
    } else if (source === 'linkedin') {
      results = await searchLinkedInViaGoogle(query, location || 'Saudi Arabia', limit);
    } else if (source === 'reddit') {
      results = await searchRedditForPainPoints(query, Math.min(limit, 200));
    } else if (source === 'yellowpages') {
      results = await searchYellowPages(query, location || 'Saudi Arabia', limit);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid source' });
    }

    if (global.io) {
      global.io.emit('scrape_progress', {
        message: `🔍 تم سحب ${results.length} عميل من ${source}. الآن جاري استخراج الإيميلات وروابط تواصل...`,
        stage: 'enriching'
      });
    }

    // استخراج الإيميلات ووسائل التواصل الاجتماعي من المواقع
    const enriched = await enrichLeadsWithEmails(results);

    // الحفظ التلقائي لقاعدة البيانات
    const db = getDb();
    let savedCount = 0;
    
    const insertLead = await db.prepare(`
      INSERT OR IGNORE INTO leads 
        (id, user_id, name, email, company, phone, whatsapp, website, address, category, source, 
         facebook, instagram, twitter, linkedin, youtube, tiktok, rating, status)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `);

    const saveAll = db.transaction((leads) => {
      for (const lead of leads) {
        try {
          insertLead.run(
            lead.id || uuidv4(),
            req.userId,
            lead.name || 'Unknown',
            lead.email || '',
            lead.company || lead.name || '',
            lead.phone || '',
            lead.whatsapp || lead.phone || '',
            lead.website || '',
            lead.address || '',
            lead.category || query,
            lead.source || source,
            lead.facebook || '',
            lead.instagram || '',
            lead.twitter || '',
            lead.linkedin || '',
            lead.youtube || '',
            lead.tiktok || '',
            lead.rating || null
          );
          savedCount++;
        } catch(e) { /* duplicate - skip */ }
      }
    });

    saveAll(enriched);

    const emailCount = enriched.filter(l => l.email).length;
    const phoneCount = enriched.filter(l => l.phone).length;
    
    // إرسال تنبيه بالبريد الإلكتروني للآدمن
    try {
      await sendCompletionEmail(`سحب: ${query} من ${source}`, savedCount);
    } catch(e) { /* ignored */ }

    if (global.io) {
      global.io.emit('scrape_progress', {
        message: `✅ اكتملت العملية بالكامل! تم حفظ ${savedCount} عميل جديد | وجدنا ${emailCount} إيميل | ${phoneCount} رقم/واتساب`,
        stage: 'done',
        count: savedCount
      });
    }

    res.json({ 
      success: true, 
      count: enriched.length, 
      saved: savedCount,
      emails: emailCount,
      phones: phoneCount,
      data: enriched 
    });

    // ==========================================
    // THE ULTIMATE PIPELINE: AUTO-EMAIL & WA
    // ==========================================
    setTimeout(async () => {
      try {
        if (!savedCount) return;
        const newLeadIds = enriched.map(l => l.id).filter(Boolean);
        if (!newLeadIds.length) return;

        console.log(`[Auto-Pipeline] Starting auto-outreach for ${newLeadIds.length} new leads...`);
        const { sendAutoCampaign } = require('../services/auto-pipeline');
        await sendAutoCampaign(newLeadIds, req.userId);
      } catch(err) {
        console.error('[Auto-Pipeline] Error:', err);
      }
    }, 2000); // 2s delay after response
    
  } catch (error) {
    console.error('Live Scrape Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal Server Error: ' + error.message });
    }
  }
});

module.exports = router;
