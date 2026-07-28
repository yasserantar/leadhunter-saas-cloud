const axios = require('axios');
const cheerio = require('cheerio');

const searchYellowPages = async (query, location, limit = 50) => {
  console.log(`[YellowPages Scraper] Searching for: ${query} in ${location} (Limit: ${limit})`);
  const results = [];
  let pageNum = 1;
  const maxPages = 15; // لتفادي التكرار اللانهائي، حوالي 300-450 نتيجة

  try {
    while (results.length < limit && pageNum <= maxPages) {
      const url = pageNum === 1
        ? `https://yellowpages.com.eg/ar/search/${encodeURIComponent(query)}/${encodeURIComponent(location)}`
        : `https://yellowpages.com.eg/ar/search/${encodeURIComponent(query)}/${encodeURIComponent(location)}/p${pageNum}`;
      
      console.log(`[YellowPages Scraper] Fetching page ${pageNum}: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const rows = $('.item-row');
      
      if (!rows.length) {
        console.log('[YellowPages Scraper] No more results found.');
        break;
      }

      rows.each((i, el) => {
        if (results.length >= limit) return;

        const name = $(el).find('.item-title').text().trim();
        const phone = $(el).find('.call-us').attr('data-phone') || '';
        const address = $(el).find('.address-text').text().trim();
        const website = $(el).find('.website').attr('href') || '';

        if (name) {
          // تجنب تكرار الشركات
          if (!results.some(r => r.name === name)) {
            results.push({
              id: require('uuid').v4(),
              name,
              phone,
              address,
              website,
              category: query,
              source: 'Yellow Pages',
              status: 'new'
            });
            
            if (global.io) {
              global.io.emit('scrape_progress', { 
                message: `YellowPages Found: ${name}`,
                count: results.length,
                total: limit,
                stage: 'scrolling'
              });
            }
          }
        }
      });

      pageNum++;
      await new Promise(r => setTimeout(r, 1000)); // احترام الموقع والحدود
    }
  } catch (error) {
    console.error('[YellowPages Scraper] Error:', error.message);
  }

  return results;
};

module.exports = { searchYellowPages };
