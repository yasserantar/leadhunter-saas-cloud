const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// مسار الداتا بيس
const DB_PATH = process.env.VERCEL 
    ? '/tmp/leadhunter_v3.db' 
    : path.join(__dirname, '..', '..', 'data', 'leadhunter_v3.db');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function backupDatabase() {
    console.log('🔄 Starting automated database backup...');
    try {
        if (!fs.existsSync(DB_PATH)) {
            console.log('❌ Database file not found, skipping backup.');
            return;
        }

        const date = new Date();
        const timestamp = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}`;
        const backupFile = path.join(BACKUP_DIR, `leadhunter_backup_${timestamp}.db`);

        // نسخ الملف
        fs.copyFileSync(DB_PATH, backupFile);
        console.log(`✅ Backup successful! Saved to ${backupFile}`);

        // مسح النسخ القديمة (الاحتفاظ بآخر 10 نسخ فقط)
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('leadhunter_backup_'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (backups.length > 10) {
            for (let i = 10; i < backups.length; i++) {
                fs.unlinkSync(path.join(BACKUP_DIR, backups[i].name));
                console.log(`🗑️ Deleted old backup: ${backups[i].name}`);
            }
        }

    } catch (error) {
        console.error('❌ Backup failed:', error);
    }
}

// جدولة النسخ الاحتياطي التلقائي (كل ساعة)
cron.schedule('0 * * * *', () => {
    backupDatabase();
});

// إجراء نسخة احتياطية فورية عند بدء التشغيل
setTimeout(backupDatabase, 5000);

module.exports = { backupDatabase };
