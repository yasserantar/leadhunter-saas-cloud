// ======================================================
// جدولة الحملات - LeadHunter Pro
// بنتحكم في إرسال الإيميلات بشكل ذكي ومنظم
// ======================================================

const cron = require('node-cron');
const { getDb } = require('../db/database');
const { sendEmail } = require('./email-sender');

// ========== مخزن الحملات النشطة ==========
// بنتتبع حالة كل حملة شغالة
const activeCampaigns = new Map();

/**
 * بنولد وقت delay عشوائي بين الإيميلات
 * بنستخدم قيم من الـ .env عشان المستخدم يقدر يتحكم
 *
 * @returns {number} - وقت الانتظار بالمللي ثانية
 */
function getRandomDelay() {
  const minMinutes = parseInt(process.env.MIN_DELAY_MINUTES) || 3;
  const maxMinutes = parseInt(process.env.MAX_DELAY_MINUTES) || 8;

  // بنحسب الـ delay بالمللي ثانية
  const minMs = minMinutes * 60 * 1000;
  const maxMs = maxMinutes * 60 * 1000;

  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * بنشيك لو الوقت الحالي ده في ساعات العمل
 * بنبعت بس من 9 الصبح لـ 6 المسا
 *
 * @returns {boolean} - هل إحنا في ساعات العمل ولا لا
 */
function isBusinessHours() {
  const now = new Date();
  const hour = now.getHours();

  // ساعات العمل: 9 صباحاً - 6 مساءً
  return hour >= 9 && hour < 18;
}

/**
 * بنشيك لو اليوم ده يوم عمل (مش جمعة أو سبت)
 * في المنطقة العربية، الإجازة جمعة وسبت عادة
 *
 * @returns {boolean} - هل اليوم يوم عمل ولا لا
 */
function isWorkDay() {
  const now = new Date();
  const day = now.getDay();

  // 5 = الجمعة، 6 = السبت
  return day !== 5 && day !== 6;
}

/**
 * بنجيب قائمة العملاء المحتملين المرتبطين بالحملة
 * اللي لسه ما اتبعتلهمش إيميل
 *
 * @param {string} campaignId - رقم الحملة
 * @returns {Array} - قائمة العملاء
 */
function getPendingLeads(campaignId) {
  const db = getDb();

  // بنجيب العملاء اللي لسه مش اتبعتلهم إيميل
  const leads = db.prepare(`
    SELECT l.*, cl.status as campaign_status
    FROM campaign_leads cl
    JOIN leads l ON cl.lead_id = l.id
    WHERE cl.campaign_id = ?
    AND cl.status = 'pending'
    AND l.email IS NOT NULL
    AND l.email != ''
    ORDER BY l.created_at ASC
  `).all(campaignId);

  return leads;
}

/**
 * بنعالج إيميل واحد من الحملة
 * بنبعته ونحدث الحالة
 *
 * @param {string} campaignId - رقم الحملة
 * @param {Object} lead - بيانات العميل
 * @param {Object} template - قالب الإيميل
 * @returns {Object} - نتيجة الإرسال
 */
async function processOneEmail(campaignId, lead, template) {
  const db = getDb();

  try {
    // بنجهز المتغيرات للتعويض في القالب
    const variables = {
      name: lead.name || 'عزيزي العميل',
      company_name: lead.company || lead.name || '',
      email: lead.email,
      phone: lead.phone || '',
      website: lead.website || '',
      sender_name: process.env.SMTP_FROM_NAME || 'LeadHunter Pro',
      sender_email: process.env.SMTP_USER || ''
    };

    // بنبعت الإيميل
    const result = await sendEmail(
      lead.email,
      template.subject,
      template.body_html,
      campaignId,
      lead.id,
      variables
    );

    // بنحدث حالة العميل في الحملة
    const newStatus = result.success ? 'sent' : 'failed';
    db.prepare(`
      UPDATE campaign_leads
      SET status = ?
      WHERE campaign_id = ? AND lead_id = ?
    `).run(newStatus, campaignId, lead.id);

    return result;
  } catch (error) {
    console.error(`❌ خطأ في معالجة إيميل ${lead.email}:`, error.message);

    // بنسجل الفشل
    db.prepare(`
      UPDATE campaign_leads
      SET status = 'failed'
      WHERE campaign_id = ? AND lead_id = ?
    `).run(campaignId, lead.id);

    return { success: false, error: error.message };
  }
}

/**
 * بنعالج الحملة - الدالة الرئيسية اللي بتلف على كل العملاء
 * بتبعت إيميل واحد كل شوية مع delays عشوائية
 *
 * @param {string} campaignId - رقم الحملة
 */
async function processCampaign(campaignId) {
  const db = getDb();
  const campaignState = activeCampaigns.get(campaignId);

  if (!campaignState || campaignState.status !== 'running') {
    console.log(`⏸️ الحملة ${campaignId} مش شغالة`);
    return;
  }

  // بنجيب بيانات الحملة والقالب
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    console.error(`❌ الحملة ${campaignId} مش موجودة`);
    activeCampaigns.delete(campaignId);
    return;
  }

  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(campaign.template_id);
  if (!template) {
    console.error(`❌ القالب ${campaign.template_id} مش موجود`);
    db.prepare("UPDATE campaigns SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
    activeCampaigns.delete(campaignId);
    return;
  }

  // بنجيب العملاء اللي لسه مش اتبعتلهم
  const pendingLeads = getPendingLeads(campaignId);

  if (pendingLeads.length === 0) {
    console.log(`✅ الحملة "${campaign.name}" خلصت - كل الإيميلات اتبعتت`);
    db.prepare("UPDATE campaigns SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
    activeCampaigns.delete(campaignId);
    return;
  }

  console.log(`📧 بنعالج الحملة "${campaign.name}" - باقي ${pendingLeads.length} إيميل`);

  // بنلف على كل عميل
  for (const lead of pendingLeads) {
    // بنشيك لو الحملة اتوقفت أو اتعملها pause
    const currentState = activeCampaigns.get(campaignId);
    if (!currentState || currentState.status !== 'running') {
      console.log(`⏸️ الحملة "${campaign.name}" اتوقفت`);
      return;
    }

    // بنشيك لو إحنا في ساعات العمل
    if (!isBusinessHours()) {
      console.log(`🕐 مش في ساعات العمل - الحملة هتكمل بكره الساعة 9`);
      return;
    }

    // بنشيك لو اليوم يوم عمل
    if (!isWorkDay()) {
      console.log(`📅 النهارده إجازة - الحملة هتكمل أول يوم عمل`);
      return;
    }

    // بنبعت الإيميل
    const result = await processOneEmail(campaignId, lead, template);

    if (result.success) {
      console.log(`  ✉️ اتبعت لـ ${lead.email}`);
    } else {
      console.log(`  ❌ فشل لـ ${lead.email}: ${result.error}`);
    }

    // بنستنى شوية قبل الإيميل اللي بعده
    const delay = getRandomDelay();
    const delayMinutes = (delay / 60000).toFixed(1);
    console.log(`  ⏳ بنستنى ${delayMinutes} دقيقة قبل الإيميل الجاي...`);

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // لو وصلنا هنا يبقى الحملة خلصت
  const remaining = getPendingLeads(campaignId);
  if (remaining.length === 0) {
    console.log(`🎉 الحملة "${campaign.name}" خلصت بنجاح!`);
    db.prepare("UPDATE campaigns SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
    activeCampaigns.delete(campaignId);
  }
}

/**
 * بنبدأ حملة جديدة
 * بنجهز كل حاجة ونبدأ الإرسال
 *
 * @param {string} campaignId - رقم الحملة
 * @returns {Object} - { success, message }
 */
async function startCampaign(campaignId) {
  const db = getDb();

  // بنجيب بيانات الحملة
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    return { success: false, message: 'الحملة مش موجودة' };
  }

  // بنشيك لو الحملة شغالة بالفعل
  if (activeCampaigns.has(campaignId) && activeCampaigns.get(campaignId).status === 'running') {
    return { success: false, message: 'الحملة شغالة بالفعل' };
  }

  // بنتأكد إن فيه قالب
  if (!campaign.template_id) {
    return { success: false, message: 'الحملة مفيهاش قالب إيميل' };
  }

  // بنشيك على العملاء المرتبطين بالحملة
  const leadsCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM campaign_leads
    WHERE campaign_id = ?
  `).get(campaignId).count;

  if (leadsCount === 0) {
    return { success: false, message: 'مفيش عملاء مرتبطين بالحملة' };
  }

  // بنحدث حالة الحملة
  db.prepare("UPDATE campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);

  // بنسجل الحملة في القائمة النشطة
  activeCampaigns.set(campaignId, {
    status: 'running',
    startedAt: new Date(),
    campaignName: campaign.name
  });

  console.log(`🚀 الحملة "${campaign.name}" بدأت!`);

  // بنبدأ المعالجة في الخلفية (مش بنستنى)
  processCampaign(campaignId).catch(error => {
    console.error(`❌ خطأ في الحملة "${campaign.name}":`, error.message);
    db.prepare("UPDATE campaigns SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
    activeCampaigns.delete(campaignId);
  });

  return {
    success: true,
    message: `الحملة "${campaign.name}" بدأت - ${leadsCount} عميل في الانتظار`
  };
}

/**
 * بنعمل pause للحملة
 * الحملة بتتوقف مؤقتاً وممكن تكمل تاني
 *
 * @param {string} campaignId - رقم الحملة
 * @returns {Object} - { success, message }
 */
async function pauseCampaign(campaignId) {
  const db = getDb();

  const state = activeCampaigns.get(campaignId);
  if (!state || state.status !== 'running') {
    return { success: false, message: 'الحملة مش شغالة' };
  }

  // بنحدث الحالة
  state.status = 'paused';
  activeCampaigns.set(campaignId, state);

  db.prepare("UPDATE campaigns SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);

  console.log(`⏸️ الحملة اتعملها pause`);

  return { success: true, message: 'الحملة اتوقفت مؤقتاً' };
}

/**
 * بنوقف الحملة نهائياً
 *
 * @param {string} campaignId - رقم الحملة
 * @returns {Object} - { success, message }
 */
async function stopCampaign(campaignId) {
  const db = getDb();

  // بنشيل الحملة من القائمة النشطة
  activeCampaigns.delete(campaignId);

  db.prepare("UPDATE campaigns SET status = 'stopped', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);

  console.log(`🛑 الحملة اتوقفت نهائياً`);

  return { success: true, message: 'الحملة اتوقفت نهائياً' };
}

/**
 * بنجيب حالة الحملة الحالية
 *
 * @param {string} campaignId - رقم الحملة
 * @returns {Object} - حالة الحملة بالتفاصيل
 */
function getCampaignStatus(campaignId) {
  const db = getDb();

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    return { found: false, message: 'الحملة مش موجودة' };
  }

  // بنجيب إحصائيات مفصلة
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM campaign_leads
    WHERE campaign_id = ?
  `).get(campaignId);

  const activeState = activeCampaigns.get(campaignId);

  return {
    found: true,
    campaign: {
      ...campaign,
      is_active: !!activeState,
      runtime_status: activeState ? activeState.status : campaign.status,
      started_at: activeState ? activeState.startedAt : null
    },
    leads_stats: stats
  };
}

// ========== Cron Job - بنشيك على الحملات كل 5 دقايق ==========
// لو فيه حملات متوقفة عشان ساعات العمل، بنكملها لما تيجي ساعات العمل
const campaignChecker = cron.schedule('*/5 9-17 * * 0-4', () => {
  // بنشيك في ساعات العمل فقط (9-17 من الأحد للخميس)
  if (!isBusinessHours() || !isWorkDay()) return;

  const db = getDb();

  // بنجيب الحملات اللي حالتها running بس مش في القائمة النشطة
  // ده معناه إنها اتوقفت عشان ساعات العمل خلصت
  const runningCampaigns = db.prepare(`
    SELECT id FROM campaigns WHERE status = 'running'
  `).all();

  for (const campaign of runningCampaigns) {
    if (!activeCampaigns.has(campaign.id)) {
      console.log(`🔄 بنكمل حملة متوقفة: ${campaign.id}`);
      activeCampaigns.set(campaign.id, { status: 'running', startedAt: new Date() });
      processCampaign(campaign.id).catch(err => {
        console.error('❌ خطأ في استئناف الحملة:', err.message);
      });
    }
  }
}, { scheduled: false });

// بنبدأ الـ cron job
campaignChecker.start();
console.log('⏰ جدولة الحملات شغالة');

module.exports = {
  startCampaign,
  pauseCampaign,
  stopCampaign,
  getCampaignStatus,
  isBusinessHours,
  isWorkDay
};
