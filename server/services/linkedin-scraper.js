const puppeteer = require('puppeteer');

async function scrapeLinkedIn(keyword, location, limit = 20) {
    console.log(`🔍 بدء سحب بيانات LinkedIn عن طريق محرك البحث لـ: ${keyword} في ${location}`);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // استخدام Google Dorks للبحث عن حسابات LinkedIn لتجنب حظر تسجيل الدخول
        const query = `site:linkedin.com/in "${keyword}" "${location}"`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${limit}`;
        
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        const results = await page.evaluate(() => {
            const leads = [];
            const elements = document.querySelectorAll('div.g');
            
            elements.forEach(el => {
                const titleEl = el.querySelector('h3');
                const linkEl = el.querySelector('a');
                const snippetEl = el.querySelector('div.VwiC3b');
                
                if (titleEl && linkEl) {
                    let title = titleEl.innerText;
                    // تنظيف الاسم من كلمة LinkedIn
                    title = title.split('-')[0].replace(' | LinkedIn', '').trim();
                    
                    const url = linkEl.href;
                    if (url.includes('linkedin.com/in/')) {
                        leads.push({
                            name: title,
                            company: 'LinkedIn Profile',
                            linkedin: url,
                            source: 'linkedin',
                            notes: snippetEl ? snippetEl.innerText : ''
                        });
                    }
                }
            });
            return leads;
        });

        console.log(`✅ تم سحب ${results.length} حساب من LinkedIn بنجاح`);
        return results;
    } catch (error) {
        console.error('❌ خطأ في سحب بيانات LinkedIn:', error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { scrapeLinkedIn };
