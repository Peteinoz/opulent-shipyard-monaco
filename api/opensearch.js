const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { generateRSSStaticPage } = require('../rss-static-generator');

// Track search count for RSS trigger
let searchCount = 0;

module.exports = async (req, res) => {
  const { query } = req.method === 'POST' ? req.body : req.query;

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  // Increment search count
  searchCount++;
  
  // Get RSS trigger setting from environment (default to 2)
  const rssTriggerSearches = parseInt(process.env.RSS_TRIGGER_SEARCHES) || 2;
  
  // Check if this search should trigger RSS content
  const shouldShowRSS = searchCount % rssTriggerSearches === 0;
  
  res.setHeader('Content-Type', 'application/json');
  
  if (shouldShowRSS) {
    console.log(`🚀 RSS trigger activated on search ${searchCount} (every ${rssTriggerSearches} searches)`);
    
    // Generate new RSS content in background
    generateRSSStaticPage('random').then(() => {
      console.log('✅ New RSS content generated successfully');
    }).catch(error => {
      console.error('❌ RSS generation failed:', error);
    });
    
    // Return actual RSS content
    const rssResults = getRSSContent(query);
    res.status(200).json({
      results: rssResults,
      isRSSContent: true
    });
  } else {
    // Generate regular search results with unique images
    const baseResults = [
      {
        title: `Luxury ${query} - Monaco Collection`,
        url: `/rsscontent/${encodeURIComponent(query)}-monaco.html`,
        description: `Discover our exclusive collection of ${query} available in Monaco. Premium vessels with world-class amenities.`,
        searchTerm: `luxury ${query} yacht Monaco`
      },
      {
        title: `Premium ${query} Charter`,
        url: `/rsscontent/${encodeURIComponent(query)}-charter.html`,
        description: `Charter the finest ${query} for your Monaco experience. Professional crew and luxury accommodations included.`,
        searchTerm: `premium ${query} yacht charter`
      },
      {
        title: `Bespoke ${query} Design`,
        url: `/rsscontent/${encodeURIComponent(query)}-design.html`,
        description: `Custom ${query} design services in Monaco. Work with our expert naval architects to create your dream vessel.`,
        searchTerm: `bespoke ${query} yacht design`
      },
      {
        title: `${query} Sales & Brokerage`,
        url: `/rsscontent/${encodeURIComponent(query)}-sales.html`,
        description: `Buy or sell ${query} through our Monaco brokerage. Expert valuation and worldwide marketing services.`,
        searchTerm: `${query} yacht sales brokerage`
      },
      {
        title: `${query} Maintenance Services`,
        url: `/rsscontent/${encodeURIComponent(query)}-maintenance.html`,
        description: `Professional ${query} maintenance and refit services in Monaco. Keep your vessel in pristine condition.`,
        searchTerm: `${query} yacht maintenance services`
      },
      {
        title: `${query} Insurance & Documentation`,
        url: `/rsscontent/${encodeURIComponent(query)}-insurance.html`,
        description: `Comprehensive ${query} insurance and documentation services. Navigate regulations with confidence.`,
        searchTerm: `${query} yacht insurance documentation`
      }
    ];

    // Fetch images for each result
    try {
      const resultsWithImages = await Promise.all(
        baseResults.map(async (result, index) => {
          const image = await fetchYachtImage(result.searchTerm, index);
          return {
            title: result.title,
            url: result.url,
            description: result.description,
            image: image
          };
        })
      );

      res.status(200).json({
        results: resultsWithImages,
        isRSSContent: false
      });
    } catch (error) {
      console.error('Error fetching yacht images:', error);
      // Fallback to results without images
      const fallbackResults = baseResults.map(result => ({
        title: result.title,
        url: result.url,
        description: result.description,
        image: '/images/banner.png'
      }));
      
      res.status(200).json({
        results: fallbackResults,
        isRSSContent: false
      });
    }
  }
};

// Function to get actual RSS content from the rsscontent directory
function getRSSContent(query) {
  try {
    const rssContentDir = path.join(__dirname, '..', 'htdocs', 'rsscontent');
    
    if (!fs.existsSync(rssContentDir)) {
      return getDefaultRSSResults(query);
    }
    
    // Get all RSS HTML files (exclude index.html and rss.xml)
    const files = fs.readdirSync(rssContentDir)
      .filter(file => file.endsWith('.html') && file !== 'index.html')
      .sort((a, b) => {
        // Sort by modification time, newest first
        const statA = fs.statSync(path.join(rssContentDir, a));
        const statB = fs.statSync(path.join(rssContentDir, b));
        return statB.mtime - statA.mtime;
      })
      .slice(0, 6); // Get latest 6 files
    
    if (files.length === 0) {
      return getDefaultRSSResults(query);
    }
    
    // Extract titles and create results
    const results = files.map(file => {
      const title = extractTitleFromFilename(file);
      return {
        title: title,
        url: `/rsscontent/${file}`,
        description: `Latest maritime news and yacht industry insights. Click to read the full article about ${title.toLowerCase()}.`
      };
    });
    
    return results;
    
  } catch (error) {
    console.error('Error reading RSS content:', error);
    return getDefaultRSSResults(query);
  }
}

// Extract human-readable title from RSS filename
function extractTitleFromFilename(filename) {
  // Remove 'rss-post-' prefix and timestamp suffix
  let title = filename.replace(/^rss-post-/, '').replace(/-\d{8}-\d{4}\.html$/, '.html');
  
  // Handle special cases and clean up
  title = title
    .replace(/-8211-/g, '-') // Replace HTML entity for em dash
    .replace(/--/g, '-') // Replace double hyphens
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .replace(/\.html$/, '') // Remove .html extension
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
    .join(' ');
  
  return title;
}

// Fallback RSS results if no actual RSS content is available
function getDefaultRSSResults(query) {
  return [
    {
      title: "Latest Maritime News - Yacht Industry Updates",
      url: "/rsscontent/",
      description: "Stay updated with the latest yacht industry news, maritime trends, and luxury vessel insights from around the world."
    },
    {
      title: "Superyacht Charter Trends 2025",
      url: "/rsscontent/",
      description: "Discover the latest trends in superyacht charters, popular destinations, and luxury amenities for the discerning traveler."
    },
    {
      title: "Monaco Yacht Show Highlights",
      url: "/rsscontent/",
      description: "Exclusive coverage from the Monaco Yacht Show featuring the latest superyacht launches and industry innovations."
    }
  ];
}

// Fetch yacht image using Google Custom Search API
async function fetchYachtImage(searchTerm, index = 0) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (!apiKey || !searchEngineId) {
      console.log('Google API credentials not configured, using default image');
      return '/images/banner.png';
    }

    // Add variety to search terms to get different images
    const searchVariations = [
      `${searchTerm} yacht Monaco harbor`,
      `${searchTerm} superyacht Mediterranean`,
      `${searchTerm} luxury yacht marina`,
      `${searchTerm} yacht Monaco port`,
      `${searchTerm} superyacht charter`,
      `${searchTerm} yacht Monaco bay`
    ];
    
    const finalSearchTerm = searchVariations[index % searchVariations.length];
    
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(finalSearchTerm)}&searchType=image&num=1&imgSize=large&imgType=photo`;
    
    console.log(`Fetching image for: "${finalSearchTerm}"`);
    
    const response = await axios.get(url, { timeout: 5000 });
    
    if (response.data && response.data.items && response.data.items.length > 0) {
      const imageUrl = response.data.items[0].link;
      console.log(`Found image: ${imageUrl}`);
      return imageUrl;
    } else {
      console.log('No images found, using default');
      return '/images/banner.png';
    }
    
  } catch (error) {
    console.error(`Error fetching image for "${searchTerm}":`, error.message);
    return '/images/banner.png';
  }
}
