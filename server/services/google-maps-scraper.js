// ================================================================
// Google Maps Mega Scraper - يسحب حتى 500 عميل بداتا كاملة فورا
// ================================================================
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const searchBusinesses = async (query, location, limit = 100) => {
  const searchQuery = `${query} in ${location}`;
  console.log(`[Google Maps] Starting MEGA search: "${searchQuery}" (limit: ${limit})`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const allPlaces = new Map();

  try {
    const encodedQuery = encodeURIComponent(searchQuery);
    await page.goto(`https://www.google.com/maps/search/${encodedQuery}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    try {
      // Check for Google Cookie Consent (often appears on cloud servers in EU)
      const consentBtn = await page.$('button[aria-label="Accept all"], button[aria-label="موافق"], form[action*="consent"] button');
      if (consentBtn) {
        console.log('[Google Maps] Found consent dialog, accepting...');
        await consentBtn.click();
        await sleep(2000);
      }
    } catch (e) {
      // ignore
    }

    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
    } catch (e) {
      console.log('[Google Maps] Selector not found, checking if we are on a direct place page or blocked...');
      const url = page.url();
      if (!url.includes('/maps/search')) {
         console.log('[Google Maps] URL changed, might be a direct place or error.');
      }
      throw e;
    }
    
    let lastCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 150; // زيادة عدد محاولات التمرير لتحميل حتى 500 نتيجة
    
    // دالة استخراج البيانات التراكمية أثناء التمرير مباشرة
    const extractVisiblePlaces = () => {
      const links = document.querySelectorAll('a[href*="/maps/place/"]');
      const results = [];
      
      links.forEach(link => {
        try {
          const url = link.href;
          if (!url) return;

          // البحث عن الحاوية الخاصة بكل شركة في القائمة
          const card = link.closest('.Nv2y1d') || 
                       link.closest('.UaetDe') || 
                       link.closest('[role="feed"] > div') || 
                       link.parentElement.parentElement;
          if (!card) return;

          // استخراج الاسم
          let name = '';
          const nameEl = card.querySelector('.qbf1U') || card.querySelector('.fontHeadlineSmall');
          if (nameEl) {
            name = nameEl.innerText.trim();
          } else {
            name = link.getAttribute('aria-label') || link.innerText.trim();
          }
          if (name && name.includes('·')) {
            name = name.split('·')[0].trim();
          }
          if (!name) return;

          // استخراج التقييم وعدد التقييمات
          let rating = null;
          let reviews = '0';
          const ratingEl = card.querySelector('.MW4etd');
          const reviewsEl = card.querySelector('.UY7F9');
          if (ratingEl) {
            rating = parseFloat(ratingEl.innerText.trim());
          }
          if (reviewsEl) {
            reviews = reviewsEl.innerText.replace(/[^0-9]/g, '');
          }

          // استخراج التصنيف
          let category = '';
          const catEl = card.querySelector('.W4EwD') || card.querySelector('.bfNzCc');
          if (catEl) {
            category = catEl.innerText.trim();
          }

          // استخراج الهاتف والعنوان من النصوص المعروضة
          let phone = '';
          let address = '';
          const text = card.innerText || '';
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

          for (const line of lines) {
            // محاولة جلب التقييم والتصنيف من السطر
            const ratingMatch = line.match(/^([3-5]\.[0-9])\s*\((\d+[\d\.,K]*)\)/);
            if (ratingMatch) {
              if (!rating) rating = parseFloat(ratingMatch[1]);
              if (reviews === '0') reviews = ratingMatch[2];
              if (line.includes('·') && !category) {
                category = line.split('·')[1].trim();
              }
            }

            // البحث عن نمط رقم الهاتف الخليجي والدولي
            const phoneMatch = line.match(/(?:\+?[\d\s\-()]{7,20})/g);
            if (phoneMatch) {
              for (const p of phoneMatch) {
                const cleaned = p.replace(/[\s\-()]/g, '');
                if (cleaned.length >= 7 && cleaned.length <= 15 && /^\+?\d+$/.test(cleaned)) {
                  if (!cleaned.startsWith('202') && !cleaned.startsWith('201') && !cleaned.startsWith('19') && !cleaned.includes(reviews)) {
                    phone = p.trim();
                  }
                }
              }
            }
          }

          // إذا لم يظهر الرقم، نبحث عن زر الاتصال التلقائي
          if (!phone) {
            const phoneEl = card.querySelector('button[data-item-id*="phone:tel:"]');
            if (phoneEl) {
              phone = phoneEl.getAttribute('data-item-id').replace('phone:tel:', '').trim();
            }
          }

          // استخراج رابط الموقع الإلكتروني
          let website = '';
          const websiteEl = card.querySelector('a[data-value="Website"]') || 
                            card.querySelector('a[aria-label*="Website"]') || 
                            card.querySelector('a[aria-label*="الموقع الإلكتروني"]') ||
                            card.querySelector('a[aria-label*="الموقع"]') ||
                            Array.from(card.querySelectorAll('a')).find(a => {
                              const href = a.href || '';
                              return href && !href.includes('google.com/maps') && !href.includes('google.com/url');
                            });
          if (websiteEl) {
            website = websiteEl.href || '';
          }

          // استخراج العنوان الفعلي
          const addressLines = lines.filter(line => {
            if (line === name) return false;
            if (line.includes('Website') || line.includes('الموقع') || line.includes('Directions') || line.includes('الاتجاهات')) return false;
            if (/^[3-5]\.[0-9]\s*\(/.test(line)) return false;
            if (line.includes('Open') || line.includes('Closes') || line.includes('مفتوح') || line.includes('يغلق')) return false;
            if (line.includes('Closed') || line.includes('مغلق')) return false;
            if (line === phone) return false;
            return true;
          });
          if (addressLines.length > 0) {
            address = addressLines[0];
          }

          // استخراج وسائل التواصل الاجتماعي لو متوفرة في كارد الخرائط مباشرة
          const allLinks = Array.from(card.querySelectorAll('a[href]')).map(a => a.href);
          const facebook = allLinks.find(l => l.includes('facebook.com')) || '';
          const instagram = allLinks.find(l => l.includes('instagram.com')) || '';
          const twitter = allLinks.find(l => l.includes('twitter.com') || l.includes('x.com')) || '';
          const linkedin = allLinks.find(l => l.includes('linkedin.com')) || '';
          const tiktok = allLinks.find(l => l.includes('tiktok.com')) || '';
          const youtube = allLinks.find(l => l.includes('youtube.com')) || '';

          const waLink = allLinks.find(l => l.includes('wa.me') || l.includes('api.whatsapp.com'));
          const whatsapp = waLink ? waLink.replace(/.*wa\.me\//, '').replace(/.*phone=/, '') : phone;

          results.push({
            name,
            url,
            phone,
            whatsapp,
            website,
            category,
            rating,
            reviews,
            address,
            facebook,
            instagram,
            twitter,
            linkedin,
            tiktok,
            youtube
          });
        } catch (e) {
          // ignore card parse error
        }
      });

      return results;
    };

    while (scrollAttempts < maxScrollAttempts) {
      // سحب العناصر المرئية وتحديثها تراكمياً
      const visible = await page.evaluate(extractVisiblePlaces);
      visible.forEach(p => {
        if (!allPlaces.has(p.url)) {
          allPlaces.set(p.url, p);
        }
      });

      if (allPlaces.size >= limit) {
        console.log(`[Google Maps] Gathered requested limit: ${allPlaces.size} >= ${limit}`);
        break;
      }

      // تمرير القائمة الجانبية للأسفل
      const scrolled = await page.evaluate(() => {
        const panel = document.querySelector('div[role="feed"]');
        if (!panel) return false;
        const before = panel.scrollTop;
        panel.scrollBy(0, 1000);
        return panel.scrollTop !== before;
      });

      // التحقق من نهاية النتائج
      const endReached = await page.evaluate(() => {
        const end = document.querySelector('.HlvSq');
        return !!end;
      });

      if (endReached) {
        console.log('[Google Maps] Reached end of results list.');
        break;
      }

      if (allPlaces.size === lastCount && !scrolled) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
      }
      lastCount = allPlaces.size;

      await sleep(600); // مهلة للتحميل
      
      if (global.io) {
        global.io.emit('scrape_progress', { 
          message: `جاري التمرير وسحب البيانات مباشرة... وجدنا ${allPlaces.size} مكان حتى الآن`,
          count: allPlaces.size,
          stage: 'scrolling'
        });
      }
    }

    console.log(`[Google Maps] Done scrolling. Extracted ${allPlaces.size} places directly.`);

  } catch (err) {
    console.error('[Google Maps] Extraction error:', err.message);
  } finally {
    await page.close();
    await browser.close();
  }

  // التنسيق النهائي لجدول العملاء
  const results = [...allPlaces.values()].slice(0, limit).map(p => ({
    id: require('uuid').v4(),
    ...p,
    source: 'Google Maps',
    sourceUrl: p.url
  }));

  if (global.io) {
    global.io.emit('scrape_progress', {
      message: `✅ تم استخراج ${results.length} عميل بنجاح!`,
      count: results.length,
      total: results.length,
      stage: 'extracting',
      latest: results.slice(0, 5).map(r => r.name)
    });
  }

  return results;
};

module.exports = { searchBusinesses };
