// ======================================================
// خدمة إرسال الإيميلات - LeadHunter Pro
// بنبعت إيميلات عن طريق SMTP مع تتبع الفتح والضغط
// ======================================================

const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

// ========== متغيرات الإعدادات ==========
let transporter = null;

/**
 * بنعمل initialize للـ transporter لو مش موجود
 * بنستخدم إعدادات الـ SMTP من الـ .env
 */
function getTransporter() {
  if (!transporter) {
    const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      // إعدادات إضافية للأمان والأداء
      pool: true, // بنستخدم connection pool
      maxConnections: 3, // أقصى عدد connections
      maxMessages: 50, // أقصى عدد رسائل لكل connection
      rateDelta: 2000, // وقت الانتظار بين الرسائل بالمللي ثانية
      rateLimit: 5 // عدد الرسائل في المرة الواحدة
    });
  }
  return transporter;
}

/**
 * بنتحقق إن إعدادات الـ SMTP شغالة
 * @returns {Object} - { success, message }
 */
async function verifySmtpConnection() {
  try {
    const transport = getTransporter();
    await transport.verify();
    return { success: true, message: 'الاتصال بسيرفر SMTP شغال 🟢' };
  } catch (error) {
    return { success: false, message: `فشل الاتصال: ${error.message}` };
  }
}

/**
 * بنجيب عدد الإيميلات اللي اتبعتت النهارده
 * عشان نتأكد إننا مش هنتعدى الحد اليومي
 *
 * @returns {number} - عدد الإيميلات اللي اتبعتت
 */
function getSentTodayCount() {
  const db = getDb();

  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM email_logs
    WHERE status = 'sent'
    AND DATE(sent_at) = DATE('now')
  `).get();

  return result.count;
}

/**
 * بنشيك لو الإيميل ده عمل unsubscribe
 * @param {string} email - الإيميل
 * @returns {boolean} - هل عمل unsubscribe ولا لا
 */
function isUnsubscribed(email) {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM unsubscribes WHERE email = ?').get(email);
  return result.count > 0;
}

/**
 * بنعوض المتغيرات في القالب
 * مثلاً: {name} بتتحول للاسم الحقيقي
 *
 * @param {string} template - القالب
 * @param {Object} variables - المتغيرات وقيمها
 * @returns {string} - القالب بعد التعويض
 */
function replaceTemplateVariables(template, variables) {
  if (!template) return '';

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // بنعوض كل الأنماط: {key}, {{key}}, {KEY}
    const patterns = [
      new RegExp(`\\{${key}\\}`, 'gi'),
      new RegExp(`\\{\\{${key}\\}\\}`, 'gi')
    ];

    for (const pattern of patterns) {
      result = result.replace(pattern, value || '');
    }
  }

  return result;
}

/**
 * بنضيف tracking pixel في الإيميل عشان نعرف لما حد يفتحه
 * بيبقى صورة 1x1 شفافة بترجع من السيرفر بتاعنا
 *
 * @param {string} html - محتوى الإيميل
 * @param {string} logId - رقم السجل
 * @returns {string} - الإيميل بالـ tracking pixel
 */
function addTrackingPixel(html, logId) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const trackingUrl = `${baseUrl}/api/track/open/${logId}`;

  // بنضيف الصورة الشفافة قبل إغلاق الـ body
  const pixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }

  // لو مفيش body tag، بنضيفه في الآخر
  return html + pixel;
}

/**
 * بنضيف رابط إلغاء الاشتراك في كل إيميل
 * مطلوب قانونياً في كل إيميل تسويقي
 *
 * @param {string} html - محتوى الإيميل
 * @param {string} email - إيميل المستقبل
 * @returns {string} - الإيميل مع رابط إلغاء الاشتراك
 */
function addUnsubscribeLink(html, email) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${encodeURIComponent(email)}`;

  // بنعوض متغير الـ unsubscribe_url لو موجود
  html = html.replace(/\{unsubscribe_url\}/gi, unsubscribeUrl);

  return html;
}

/**
 * الدالة الرئيسية لإرسال الإيميل
 * بتعمل كل حاجة: تحقق، تعويض متغيرات، تتبع، إرسال، تسجيل
 *
 * @param {string} to - إيميل المستقبل
 * @param {string} subject - موضوع الإيميل
 * @param {string} htmlBody - محتوى الإيميل (HTML)
 * @param {string|null} campaignId - رقم الحملة (اختياري)
 * @param {string|null} leadId - رقم العميل المحتمل (اختياري)
 * @param {Object} variables - المتغيرات للتعويض (اختياري)
 * @returns {Object} - { success, logId, messageId, error }
 */
async function sendEmail(to, subject, htmlBody, campaignId = null, leadId = null, variables = {}) {
  const db = getDb();
  const logId = uuidv4();

  try {
    // ===== فحص 1: الحد اليومي =====
    const dailyLimit = parseInt(process.env.DAILY_EMAIL_LIMIT) || 50;
    const sentToday = getSentTodayCount();

    if (sentToday >= dailyLimit) {
      const error = `وصلنا للحد اليومي (${dailyLimit} إيميل). حاول بكره.`;
      console.warn(`⚠️ ${error}`);

      // بنسجل المحاولة الفاشلة
      db.prepare(`
        INSERT INTO email_logs (id, campaign_id, lead_id, to_email, subject, status, error, created_at)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP)
      `).run(logId, campaignId, leadId, to, subject, error);

      return { success: false, logId, messageId: null, error };
    }

    // ===== فحص 2: إلغاء الاشتراك =====
    if (isUnsubscribed(to)) {
      const error = 'الإيميل ده عمل إلغاء اشتراك';
      console.log(`🚫 ${error}: ${to}`);

      db.prepare(`
        INSERT INTO email_logs (id, campaign_id, lead_id, to_email, subject, status, error, created_at)
        VALUES (?, ?, ?, ?, ?, 'skipped', ?, CURRENT_TIMESTAMP)
      `).run(logId, campaignId, leadId, to, subject, error);

      return { success: false, logId, messageId: null, error };
    }

    // ===== تجهيز الإيميل =====
    // بنعوض المتغيرات
    let processedSubject = replaceTemplateVariables(subject, variables);
    let processedBody = replaceTemplateVariables(htmlBody, variables);

    // بنضيف رابط إلغاء الاشتراك
    processedBody = addUnsubscribeLink(processedBody, to);

    // بنضيف الـ tracking pixel
    processedBody = addTrackingPixel(processedBody, logId);

    // بنسجل الإيميل قبل الإرسال (status: pending)
    db.prepare(`
      INSERT INTO email_logs (id, campaign_id, lead_id, to_email, subject, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `).run(logId, campaignId, leadId, to, processedSubject);

    // ===== الإرسال =====
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${encodeURIComponent(to)}`;
    const fromName = process.env.SMTP_FROM_NAME || 'LeadHunter Pro';
    const fromEmail = process.env.SMTP_USER;

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: to,
      subject: processedSubject,
      html: processedBody,
      // headers مهمة للـ deliverability
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'LeadHunter Pro v1.0',
        'X-Campaign-Id': campaignId || '',
        'Precedence': 'bulk'
      }
    };

    const transport = getTransporter();
    const info = await transport.sendMail(mailOptions);

    // بنحدث السجل بعد الإرسال الناجح
    db.prepare(`
      UPDATE email_logs
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(logId);

    // لو فيه campaign، بنحدث العداد
    if (campaignId) {
      db.prepare(`
        UPDATE campaigns
        SET sent_count = sent_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(campaignId);
    }

    console.log(`✅ إيميل اتبعت لـ ${to} (ID: ${info.messageId})`);

    return {
      success: true,
      logId,
      messageId: info.messageId,
      error: null
    };
  } catch (error) {
    console.error(`❌ فشل إرسال إيميل لـ ${to}:`, error.message);

    // بنحدث السجل بالخطأ
    db.prepare(`
      UPDATE email_logs
      SET status = 'failed', error = ?
      WHERE id = ?
    `).run(error.message, logId);

    // لو فيه campaign، بنزود عداد الـ bounce
    if (campaignId) {
      db.prepare(`
        UPDATE campaigns
        SET bounce_count = bounce_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(campaignId);
    }

    return {
      success: false,
      logId,
      messageId: null,
      error: error.message
    };
  }
}

module.exports = {
  sendEmail,
  getSentTodayCount,
  verifySmtpConnection,
  replaceTemplateVariables,
  isUnsubscribed
};
