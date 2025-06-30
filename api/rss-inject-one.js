const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { parseXMLFeed, loadRSSFeeds } = require('../generate-from-rss');

module.exports = async (req, res) => {
  const feeds = loadRSSFeeds().feeds;
  const feed = feeds[Math.floor(Math.random() * feeds.length)];

  try {
    const response = await axios.get(feed.url);
    const items = parseXMLFeed(response.data);

    if (!items.length) return res.status(204).send('No items found');

    const item = items[0]; // Pick first article
    const now = new Date();
    const slug = item.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const filename = `rss-post-${slug}-${now.getTime()}.html`;

    const html = `
      <html><head><title>${item.title}</title></head>
      <body>
        <h1>${item.title}</h1>
        <p><em>${item.publishedDate || 'Unknown date'}</em></p>
        <p>${item.description || item.snippet || ''}</p>
        <a href="${item.url}" target="_blank">Read full article</a>
      </body></html>
    `;

    fs.writeFileSync(path.join(__dirname, '../htdocs/rsscontent', filename), html);
    res.send(`✅ Generated new RSS post: ${filename}`);
  } catch (err) {
    console.error('❌ RSS inject error:', err.message);
    res.status(500).send('Failed to inject RSS content.');
  }
};