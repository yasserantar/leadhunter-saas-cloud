const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

// 1. Replace in index.html
let indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
indexHtml = indexHtml.replace(/LeadHunter Pro - Dashboard/g, 'لوحة الدخول - النظام');
indexHtml = indexHtml.replace(/استخدم بيانات اعتماد LeadHunter الخاصة بك/g, 'استخدم بيانات الاعتماد الخاصة بك للدخول.');
indexHtml = indexHtml.replace(/<form id="login-form" class="space-y-5">/, '<form id="login-form" class="space-y-5">\n            <div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm text-center mb-4">\n                <strong>حساب تجريبي:</strong><br>admin@admin.com<br>123456\n            </div>');
// Add footer before closing body
indexHtml = indexHtml.replace(/<\/body>/, '    <div class="absolute bottom-4 w-full text-center">\n        <p class="text-sm text-apple-subtext font-medium">Yasser Antar &copy; 2026</p>\n    </div>\n</body>');
fs.writeFileSync(path.join(publicDir, 'index.html'), indexHtml);

// 2. Replace in app.html
let appHtml = fs.readFileSync(path.join(publicDir, 'app.html'), 'utf8');
appHtml = appHtml.replace(/LeadHunter Pro - Dashboard/g, 'لوحة التحكم - النظام');
appHtml = appHtml.replace(/LeadHunter Pro/g, 'لوحة التحكم');
appHtml = appHtml.replace(/LeadHunter Core OS/g, 'النظام الأساسي');
appHtml = appHtml.replace(/LeadHunter/g, 'النظام');
// Add footer to sidebar or main content
appHtml = appHtml.replace(/<\/div>\s*<\/aside>/, '    <div class="mt-auto pt-4 border-t border-apple-border/50 text-center">\n        <p class="text-[11px] text-apple-subtext font-medium mt-2 mb-2">Yasser Antar &copy; 2026</p>\n    </div>\n    </div>\n</aside>');
fs.writeFileSync(path.join(publicDir, 'app.html'), appHtml);

// 3. Replace in admin.html
let adminHtml = fs.readFileSync(path.join(publicDir, 'admin.html'), 'utf8');
adminHtml = adminHtml.replace(/LeadHunter Pro - لوحة الإدارة/g, 'لوحة الإدارة الرئيسية');
adminHtml = adminHtml.replace(/LeadHunter Pro/g, 'لوحة الإدارة');
adminHtml = adminHtml.replace(/LeadHunter Core OS/g, 'النظام الأساسي');
adminHtml = adminHtml.replace(/LeadHunter/g, 'النظام');
adminHtml = adminHtml.replace(/<\/div>\s*<\/aside>/, '    <div class="mt-auto pt-4 border-t border-apple-border/50 text-center">\n        <p class="text-[11px] text-apple-subtext font-medium mt-2 mb-2">Yasser Antar &copy; 2026</p>\n    </div>\n    </div>\n</aside>');
fs.writeFileSync(path.join(publicDir, 'admin.html'), adminHtml);

console.log('✅ Branding replaced successfully!');
