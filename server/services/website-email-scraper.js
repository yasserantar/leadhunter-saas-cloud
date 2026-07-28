// ================================================================
// Website Email & Social Media Extractor - Hybrid Edition
// يزور موقع كل عميل ويستخرج إيميل + وسائل تواصل بشكل سريع جدا
// ================================================================
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const axios = require('axios');
const cheerio = require('cheerio');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const EXCLUDE_EMAILS = [
  'example.com', 'test.com', 'sentry.io', 'wixpress.com',
  'google.com', 'facebook.com', 'schema.org', 'jquery.com',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'js', 'bootstrap'
];

function cleanEmail(email) {
  return email.toLowerCase().trim();
}

function isValidEmail(email) {
  if (!email || email.length > 100) return false;
  return !EXCLUDE_EMAILS.some(ex => email.includes(ex));
}

// 1️⃣ FAST METHOD: Axios + Cheerio Scraper
async function extractEmailsWithAxios(website) {
  try {
    if (!website.startsWith('http')) {
      website = 'http://' + website;
    }

    const response = await axios.get(website, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      validateStatus: () => true
    });

    const html = response.data;
    if (typeof html !== 'string') return null;

    const $ = cheerio.load(html);
    
    // استخراج الإيميلات بالـ regex من السورس
    const rawEmails = (html.match(EMAIL_REGEX) || [])
      .map(cleanEmail)
      .filter(isValidEmail);

    // استخراج الإيميلات من روابط mailto
    const mailtoEmails = [];
    $('a[href^="mailto:"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const email = href.replace('mailto:', '').split('?')[0].trim();
      if (isValidEmail(email)) {
        mailtoEmails.push(cleanEmail(email));
      }
    });

    const allEmails = [...new Set([...mailtoEmails, ...rawEmails])].slice(0, 3);

    // استخراج وسائل التواصل الاجتماعي
    const social = {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: '',
      whatsapp: '',
      tiktok: ''
    };

    $('a[href]').each((i, el) => {
      const href = $(el).attr('href') || '';
      if (/facebook\.com\/[^/]+/.test(href) && !href.includes('sharer') && !social.facebook) {
        social.facebook = href;
      }
      if (/instagram\.com\/[^/]+/.test(href) && !social.instagram) {
        social.instagram = href;
      }
      if ((/twitter\.com\/[^/]+/.test(href) || /x\.com\/[^/]+/.test(href)) && !social.twitter) {
        social.twitter = href;
      }
      if (/linkedin\.com\/(company|in)\/[^/]+/.test(href) && !social.linkedin) {
        social.linkedin = href;
      }
      if (/youtube\.com\/(channel|c|user)/.test(href) && !social.youtube) {
        social.youtube = href;
      }
      if ((href.includes('wa.me') || href.includes('api.whatsapp.com')) && !social.whatsapp) {
        social.whatsapp = href;
      }
      if (/tiktok\.com\/@/.test(href) && !social.tiktok) {
        social.tiktok = href;
      }
    });

    // التحقق من صفحة "اتصل بنا" لو لم نجد إيميل في الرئيسية
    if (allEmails.length === 0) {
      let contactHref = '';
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        if (
          href.includes('/contact') || 
          href.includes('/about') || 
          text.includes('contact') || 
          text.includes('تواصل') || 
          text.includes('اتصل')
        ) {
          contactHref = href;
        }
      });

      if (contactHref) {
        let contactUrl = contactHref;
        if (!contactHref.startsWith('http')) {
          const base = new URL(website).origin;
          contactUrl = base + (contactHref.startsWith('/') ? '' : '/') + contactHref;
        }
        
        try {
          const contactRes = await axios.get(contactUrl, {
            timeout: 4000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          const contactHtml = contactRes.data;
          if (typeof contactHtml === 'string') {
            const cEmails = (contactHtml.match(EMAIL_REGEX) || [])
              .map(cleanEmail)
              .filter(isValidEmail);
            allEmails.push(...cEmails);
          }
        } catch (e) {}
      }
    }

    return {
      emails: [...new Set(allEmails)].slice(0, 3),
      social
    };
  } catch (error) {
    return null; // إشارة للفشل، لنقوم بالتحويل إلى Puppeteer
  }
}

// 2️⃣ FALLBACK METHOD: Puppeteer Scraper
async function extractEmailsWithPuppeteer(website, browser) {
  if (!website.startsWith('http')) {
    website = 'http://' + website;
  }

  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setRequestInterception(true);
    
    // تعطيل الميديا والخطوط والستايل لتسريع التحميل
    page.on('request', (req) => {
      if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await sleep(1000);

    const pageData = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const text = document.body ? document.body.innerText : '';
      
      const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
        href: a.href,
        text: a.innerText
      }));

      return { html, text, links };
    });

    const rawEmails = (pageData.html.match(EMAIL_REGEX) || [])
      .concat(pageData.text.match(EMAIL_REGEX) || [])
      .map(cleanEmail)
      .filter(isValidEmail);

    const mailtoEmails = pageData.links
      .filter(l => l.href.startsWith('mailto:'))
      .map(l => l.href.replace('mailto:', '').split('?')[0].trim())
      .filter(isValidEmail);

    const allEmails = [...new Set([...mailtoEmails, ...rawEmails])].slice(0, 3);

    const allLinks = pageData.links.map(l => l.href);
    const social = {
      facebook: allLinks.find(l => /facebook\.com\/[^/]+/.test(l) && !l.includes('sharer')) || '',
      instagram: allLinks.find(l => /instagram\.com\/[^/]+/.test(l)) || '',
      twitter: allLinks.find(l => /twitter\.com\/[^/]+/.test(l) || /x\.com\/[^/]+/.test(l)) || '',
      linkedin: allLinks.find(l => /linkedin\.com\/(company|in)\/[^/]+/.test(l)) || '',
      youtube: allLinks.find(l => /youtube\.com\/(channel|c|user)/.test(l)) || '',
      whatsapp: allLinks.find(l => l.includes('wa.me') || l.includes('api.whatsapp.com')) || '',
      tiktok: allLinks.find(l => /tiktok\.com\/@/.test(l)) || '',
    };

    // تجربة صفحة اتصل بنا لو إيميلات فارغة
    const contactLink = pageData.links.find(l => 
      l.href.includes('/contact') || 
      l.href.includes('/about') || 
      l.text.toLowerCase().includes('contact') ||
      l.text.includes('تواصل') || 
      l.text.includes('اتصل')
    );

    if (contactLink && allEmails.length === 0) {
      try {
        await page.goto(contactLink.href, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await sleep(800);
        const contactHtml = await page.evaluate(() => document.documentElement.outerHTML);
        const contactEmails = (contactHtml.match(EMAIL_REGEX) || [])
          .map(cleanEmail)
          .filter(isValidEmail);
        allEmails.push(...contactEmails.slice(0, 2));
      } catch(e) {}
    }

    return { emails: [...new Set(allEmails)].slice(0, 3), social };

  } catch (err) {
    return { emails: [], social: {} };
  } finally {
    if (page) await page.close();
  }
}

// 3️⃣ MAIN ENTRANCE: Hybrid extraction wrapper
async function extractEmailsFromWebsite(website, browser) {
  if (!website || website === '') return { emails: [], social: {} };
  
  // 1. تجربة الطريقة السريعة بالـ Axios
  const axiosResult = await extractEmailsWithAxios(website);
  if (axiosResult) {
    console.log(`[Email Extractor] Axios success for ${website}. Found: ${axiosResult.emails.length} emails`);
    return axiosResult;
  }
  
  // 2. التحويل التلقائي لـ Puppeteer لو فشل الأكسيوس
  console.log(`[Email Extractor] Axios failed/blocked. Falling back to Puppeteer for: ${website}`);
  return await extractEmailsWithPuppeteer(website, browser);
}

// Main function: enriches an array of leads with emails + social media
async function enrichLeadsWithEmails(leads) {
  if (!leads || leads.length === 0) return leads;
  
  console.log(`[Email Extractor] Starting hybrid enrichment for ${leads.length} leads...`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const enriched = [];
  const BATCH_SIZE = 10; // رفع حجم الدفعة من 3 لـ 10 بسبب خفة الأكسيوس وسرعته!

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(batch.map(async (lead) => {
      if (!lead.website) return { ...lead, emails: [], social: {} };
      
      const { emails, social } = await extractEmailsFromWebsite(lead.website, browser);
      
      return {
        ...lead,
        email: emails[0] || lead.email || '',
        emails: emails,
        facebook: social.facebook || lead.facebook || '',
        instagram: social.instagram || lead.instagram || '',
        twitter: social.twitter || lead.twitter || '',
        linkedin: social.linkedin || lead.linkedin || '',
        youtube: social.youtube || lead.youtube || '',
        tiktok: social.tiktok || lead.tiktok || '',
        whatsapp: social.whatsapp || lead.whatsapp || lead.phone || '',
      };
    }));

    enriched.push(...results);

    const withEmail = results.filter(r => r.email).length;
    console.log(`[Email Extractor] Batch ${Math.ceil(i/BATCH_SIZE)+1}: ${withEmail}/${batch.length} emails found`);
    
    if (global.io) {
      global.io.emit('scrape_progress', {
        message: `📧 استخراج إيميلات وتواصل: ${enriched.length}/${leads.length} (وجدنا ${enriched.filter(r=>r.email).length} إيميل)`,
        count: enriched.length,
        total: leads.length,
        stage: 'enriching'
      });
    }
  }

  await browser.close();
  
  const emailCount = enriched.filter(r => r.email).length;
  console.log(`[Email Extractor] Done. ${emailCount}/${leads.length} leads have emails.`);
  
  return enriched;
}

module.exports = { enrichLeadsWithEmails, extractEmailsFromWebsite };
