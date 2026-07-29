const { getDb } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

/**
 * The Ultimate Auto-Pipeline
 * 1. Fetch target leads
 * 2. Send Emails (with delays)
 * 3. Send WhatsApp messages (with random delays to prevent bans)
 */
async function sendAutoCampaign(leadIds, userId) {
    const db = getDb();

    if (!leadIds || !leadIds.length) return;
    
    // Fetch leads
    const placeholders = leadIds.map(() => '?').join(',');
    const leads = await db.prepare(`
      SELECT * FROM leads WHERE id IN (${placeholders}) AND user_id = ?
    `).all(...leadIds, userId);

    if (!leads.length) return;

    if (global.io) {
        global.io.emit('campaign_progress', {
            message: `🤖 [الأتمتة الذكية] بدأنا استهداف ${leads.length} عميل جديد بالإيميل والواتساب...`,
            total: leads.length,
            sent: 0,
            failed: 0
        });
    }

    // --- 1. EMAIL PHASE ---
    const leadsWithEmail = leads.filter(l => l.email);
    if (leadsWithEmail.length > 0) {
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        
        if (smtpUser && smtpPass) {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: parseInt(process.env.SMTP_PORT) === 465,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { rejectUnauthorized: false }
            });

            const emailSubject = "عزز تواجدك الرقمي وزد مبيعاتك - عرض خاص";
            const emailBody = `
                أهلاً {name}،
                
                لاحظنا نشاطكم المميز لـ "{company}" وأردنا التواصل معكم.
                نحن في LeadHunter Pro نقدم حلولاً برمجية وتسويقية متكاملة تساعد الشركات على مضاعفة مبيعاتها من خلال استهداف دقيق للعملاء المحتملين وبناء هويات بصرية جذابة.
                
                هل أنتم مهتمون بمعرفة كيف يمكننا مساعدة {company} على التوسع؟
                
                يسعدنا تواصلكم معنا.
                
                مع التحية،
                فريق المبيعات
            `;

            const campaignId = uuidv4();
            await db.prepare(`
                INSERT INTO campaigns (id, user_id, name, type, status, total_leads)
                VALUES (?, ?, ?, 'email', 'running', ?)
            `).run(campaignId, userId, "Auto Email Campaign", leadsWithEmail.length);

            let emailSentCount = 0;
            let emailFailedCount = 0;

            for (const lead of leadsWithEmail) {
                try {
                    const personalBody = emailBody
                        .replace(/\{name\}/g, lead.name || 'عزيزي العميل')
                        .replace(/\{company\}/g, lead.company || lead.name || '');

                    await transporter.sendMail({
                        from: `"${process.env.SENDER_NAME || 'LeadHunter Pro'}" <${smtpUser}>`,
                        to: lead.email,
                        subject: emailSubject,
                        html: `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">${personalBody.replace(/\n/g, '<br>')}</div>`
                    });

                    await db.prepare(`UPDATE leads SET status = 'emailed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(lead.id);
                    emailSentCount++;

                    if (global.io) {
                        global.io.emit('campaign_progress', {
                            message: `📧 [أتمتة الإيميل] أُرسل بنجاح إلى: ${lead.name}`,
                            total: leadsWithEmail.length,
                            sent: emailSentCount,
                            failed: emailFailedCount
                        });
                    }

                    // Delay 2-4 seconds between emails
                    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                } catch(err) {
                    emailFailedCount++;
                    console.error('[Auto-Pipeline Email Error]', err.message);
                }
            }
            await db.prepare(`UPDATE campaigns SET status = 'completed', sent_count = ? WHERE id = ?`).run(emailSentCount, campaignId);
        } else {
            console.log('[Auto-Pipeline] No SMTP credentials provided, skipping email phase.');
        }
    }

    // --- 2. WHATSAPP PHASE ---
    const leadsWithPhone = leads.filter(l => l.whatsapp || l.phone);
    const waClient = global.whatsappClient;
    
    if (leadsWithPhone.length > 0 && waClient && global.whatsappReady) {
        const waMessage = `أهلاً {name} 👋\n\nنحن فريق التسويق، لاحظنا نشاط "{company}" ونرغب بتقديم حلولنا التقنية لمساعدتكم في زيادة مبيعاتكم بشكل ملحوظ.\nهل الوقت مناسب للتحدث؟`;

        const waCampaignId = uuidv4();
        await db.prepare(`
            INSERT INTO campaigns (id, user_id, name, type, status, total_leads)
            VALUES (?, ?, ?, 'whatsapp', 'running', ?)
        `).run(waCampaignId, userId, "Auto WhatsApp Campaign", leadsWithPhone.length);

        let waSentCount = 0;
        let waFailedCount = 0;

        if (global.io) {
            global.io.emit('campaign_progress', {
                message: `💬 [أتمتة الواتساب] جاري بدء إرسال رسائل الواتساب...`,
                total: leadsWithPhone.length,
                sent: 0,
                failed: 0
            });
        }

        for (const lead of leadsWithPhone) {
            try {
                const phone = (lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '');
                if (!phone) { waFailedCount++; continue; }

                const personalMsg = waMessage
                    .replace(/\{name\}/g, lead.name || 'عزيزي العميل')
                    .replace(/\{company\}/g, lead.company || lead.name || '');

                const chatId = `${phone}@c.us`;
                await waClient.sendMessage(chatId, personalMsg);

                await db.prepare(`UPDATE leads SET status = 'whatsapped', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(lead.id);
                waSentCount++;

                if (global.io) {
                    global.io.emit('campaign_progress', {
                        message: `💬 [أتمتة الواتساب] أُرسل بنجاح إلى: ${lead.name} (+${phone})`,
                        total: leadsWithPhone.length,
                        sent: waSentCount,
                        failed: waFailedCount
                    });
                }

                // Random delay between 4 to 9 seconds (Anti-ban logic)
                const delayMs = 4000 + Math.random() * 5000;
                await new Promise(r => setTimeout(r, delayMs));

            } catch(err) {
                waFailedCount++;
                console.error('[Auto-Pipeline WA Error]', err.message);
            }
        }
        await db.prepare(`UPDATE campaigns SET status = 'completed', sent_count = ? WHERE id = ?`).run(waSentCount, waCampaignId);
        
        if (global.io) {
            global.io.emit('campaign_progress', {
                message: `🎉 [الأتمتة الذكية] اكتملت الدورة! أرسلنا ${waSentCount} واتساب.`,
                status: 'completed'
            });
        }
    } else {
        if (!global.whatsappReady) {
            console.log('[Auto-Pipeline] WhatsApp not ready/connected, skipping WA phase.');
        }
        if (global.io) {
            global.io.emit('campaign_progress', {
                message: `🎉 [الأتمتة الذكية] اكتملت دورة الإيميلات (الواتساب غير متصل).`,
                status: 'completed'
            });
        }
    }
}

module.exports = {
    sendAutoCampaign
};
