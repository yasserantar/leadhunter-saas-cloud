const nodemailer = require('nodemailer');

// إعداد خدمة الإرسال
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS 
    }
});

const sendCompletionEmail = async (jobName, resultsCount) => {
    // إذا لم يتم إعداد الإيميل في .env، نتجاهل الإرسال الفعلي ونطبع في الكونسول فقط
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(`[🔔 تنبيه النظام] اكتملت المهمة: ${jobName}. عدد العملاء: ${resultsCount}. (قم بإعداد SMTP_USER و SMTP_PASS في ملف .env لتفعيل الإرسال الحقيقي)`);
        return;
    }

    try {
        const mailOptions = {
            from: `"LeadHunter Pro" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER, // إرسال التنبيه لنفس إيميل الآدمن
            subject: `✅ اكتملت مهمة السحب: ${jobName}`,
            html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f5; border-radius: 10px;">
                    <h2 style="color: #0066cc;">إشعار نظام LeadHunter Pro</h2>
                    <p>لقد انتهى النظام من عملية السحب التي طلبتها بنجاح تام.</p>
                    <div style="background-color: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <p>🎯 <strong>المهمة:</strong> ${jobName}</p>
                        <p>👥 <strong>عدد العملاء المستخرجين:</strong> ${resultsCount} عميل</p>
                    </div>
                    <p style="margin-top: 20px; color: #666;">يمكنك الآن الدخول للوحة التحكم لرؤية النتائج وإطلاق حملاتك.</p>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`[Notifier] Email sent successfully for job: ${jobName}`);
    } catch (error) {
        console.error('[Notifier] Error sending email:', error.message);
    }
};

module.exports = { sendCompletionEmail };
