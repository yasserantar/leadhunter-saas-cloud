const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    console.log('Navigating...');
    await page.goto('https://www.google.com/maps/search/مطاعم+في+الرياض', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:\\Users\\y.antar\\.gemini\\antigravity\\brain\\02627c77-a8a1-4f8c-b115-af82ec1b7695\\scratch\\scraper_debug.png' });
    console.log('Screenshot saved to scratch folder');
    
    // Check if there's a consent button
    const html = await page.content();
    console.log('HTML length:', html.length);
    if (html.includes('consent.google.com') || html.includes('موافق')) {
        console.log('Consent dialog detected!');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}
run();
