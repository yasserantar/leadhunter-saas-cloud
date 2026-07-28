const axios = require('axios');

const searchRedditForPainPoints = async (keyword, limit = 10) => {
  console.log(`[Reddit Scraper] Searching for pain points related to: ${keyword}`);
  const results = [];

  try {
    // We use the JSON API of Reddit which doesn't require Auth for simple searches
    const response = await axios.get(`https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&limit=${limit}&sort=new`);
    
    const posts = response.data.data.children;

    for (const post of posts) {
      const data = post.data;
      if (data.selftext && data.selftext.length > 50) {
        
        results.push({
          id: require('uuid').v4(),
          name: `Reddit User: ${data.author}`,
          address: `Subreddit: r/${data.subreddit}`,
          category: 'Pain Point / Complaint',
          website: `https://reddit.com${data.permalink}`,
          source: 'Reddit',
          notes: data.title + " - " + data.selftext.substring(0, 100) + '...'
        });
        
        if (global.io) {
             global.io.emit('scrape_progress', { message: `Reddit Pain Point Found: r/${data.subreddit}` });
        }
      }
    }
  } catch (error) {
    console.error('[Reddit Scraper] Error:', error.message);
  }

  return results;
};

module.exports = { searchRedditForPainPoints };
