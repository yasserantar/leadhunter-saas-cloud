const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

async function build() {
    console.log('Starting build process for G Drive...');
    
    const targetDir = 'G:\\My Drive\\💻 5. Antigravity_Projects (مشاريع انتي جرافيتي)\\Active_Working_Projects\\leadhunter-pro';

    // 4. Modify search.js BEFORE minifying
    const publicJsDir = path.join(targetDir, 'public', 'js');
    const searchJsPath = path.join(publicJsDir, 'search.js');
    if (fs.existsSync(searchJsPath)) {
        let searchCode = fs.readFileSync(searchJsPath, 'utf8');
        searchCode = searchCode.replace(/النسخة الحالية تستخدم بيانات تجريبية \(Demo\) للتجربة السريعة على سيرفر Vercel./g, "النسخة الحالية تسحب البيانات الحية مباشرة من خرائط جوجل عبر المتصفح.");
        fs.writeFileSync(searchJsPath, searchCode);
        console.log('Updated Demo text in search.js');
    }

    // 1. Minify JS
    if (fs.existsSync(publicJsDir)) {
        const files = fs.readdirSync(publicJsDir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const filePath = path.join(publicJsDir, file);
            const code = fs.readFileSync(filePath, 'utf8');
            try {
                const result = await minify(code, {
                    compress: { drop_console: true },
                    mangle: true
                });
                fs.writeFileSync(filePath, result.code);
                console.log(`Minified ${file}`);
            } catch (err) {
                console.error(`Error minifying ${file}:`, err);
            }
        }
    }

    // 2. Add SEO to index.html
    const indexPath = path.join(targetDir, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        let indexHtml = fs.readFileSync(indexPath, 'utf8');
        
        if (!indexHtml.includes('name="description"')) {
            const seoTags = `
    <meta name="description" content="LeadHunter Pro - المنصة الأقوى والأذكى لسحب الداتا والعملاء المحتملين من خرائط جوجل والمواقع، وإرسال حملات بريدية تلقائية بضغطة زر.">
    <meta name="keywords" content="Lead Generation, Google Maps Scraper, Email Marketing, سحب داتا، عملاء محتملين، تسويق عبر البريد">
    <meta property="og:title" content="LeadHunter Pro - صائد العملاء المحتملين">
    <meta property="og:description" content="منصتك الشاملة لجمع العملاء المحتملين من خرائط جوجل وإرسال إيميلات تسويقية مستمرة بشكل آمن.">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">`;
            
            indexHtml = indexHtml.replace('<head>', `<head>${seoTags}`);
            fs.writeFileSync(indexPath, indexHtml);
            console.log('Added SEO tags to index.html');
        }
    }

    // 3. Remove Demo Mode from Google Maps Scraper
    const scraperPath = path.join(targetDir, 'server', 'services', 'google-maps-scraper.js');
    if (fs.existsSync(scraperPath)) {
        let scraperCode = fs.readFileSync(scraperPath, 'utf8');
        
        // Remove generateDemoData fallback entirely in searchBusinesses
        scraperCode = scraperCode.replace(
            /return generateDemoData\(query, location, limit\);/g,
            "throw new Error('فشل السحب الحقيقي، ولا يوجد وضع تجريبي متاح.');"
        );
        fs.writeFileSync(scraperPath, scraperCode);
        console.log('Removed Demo Mode fallback from Scraper');
    }

    console.log('Build completed successfully!');
}

build();
