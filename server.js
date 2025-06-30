const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

const opensearch = require('./api/opensearch');
const rssInjectOne = require('./api/rss-inject-one');
const buildRss = require('./api/build-rss');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API Routes
app.get('/api/opensearch', opensearch);
app.post('/api/opensearch', opensearch);
app.get('/api/rss-inject-one', rssInjectOne);
app.post('/api/build-rss', buildRss);

// Serve app.js from root directory
app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

// Static files from htdocs
app.use(express.static(path.join(__dirname, 'htdocs')));

// Fallback: serve index.html for any other route (optional, for SPA-like behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚢 Opulent Shipyard running locally at http://localhost:${PORT}`);
});
