const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * RSS Feed Parser for Yacht Content Testing
 * Supports RSS 2.0, Atom, and WordPress feeds
 */

// Load RSS feeds configuration
function loadRSSFeeds() {
    try {
        const feedsData = fs.readFileSync('rss-feeds.json', 'utf8');
        return JSON.parse(feedsData);
    } catch (error) {
        console.error('Error loading RSS feeds:', error);
        return { feeds: [] };
    }
}

// Parse XML content to extract feed items
function parseXMLFeed(xmlContent) {
    try {
        // Simple XML parsing for RSS/Atom feeds
        const items = [];
        
        // Check if it's an Atom feed
        if (xmlContent.includes('<feed') && xmlContent.includes('xmlns="http://www.w3.org/2005/Atom"')) {
            return parseAtomFeed(xmlContent);
        } else {
            // Assume RSS 2.0 or WordPress feed
            return parseRSSFeed(xmlContent);
        }
    } catch (error) {
        console.error('Error parsing XML feed:', error);
        return [];
    }
}

// Parse RSS 2.0 / WordPress feeds
function parseRSSFeed(xmlContent) {
    const items = [];
    
    // Extract items using regex (simple approach for testing)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    
    while ((match = itemRegex.exec(xmlContent)) !== null) {
        const itemContent = match[1];
        
        const item = {
            title: extractTag(itemContent, 'title'),
            description: extractTag(itemContent, 'description') || extractTag(itemContent, 'content:encoded'),
            url: extractTag(itemContent, 'link') || extractTag(itemContent, 'guid'),
            publishedDate: extractTag(itemContent, 'pubDate') || extractTag(itemContent, 'dc:date'),
            image: extractImage(itemContent)
        };
        
        // Clean up description (remove HTML tags for snippet)
        if (item.description) {
            item.snippet = item.description
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim()
                .substring(0, 200) + '...'; // Limit length
        }
        
        items.push(item);
    }
    
    return items;
}

// Parse Atom feeds
function parseAtomFeed(xmlContent) {
    const items = [];
    
    // Extract entries using regex
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let match;
    
    while ((match = entryRegex.exec(xmlContent)) !== null) {
        const entryContent = match[1];
        
        const item = {
            title: extractTag(entryContent, 'title'),
            description: extractTag(entryContent, 'summary') || extractTag(entryContent, 'content'),
            url: extractAtomLink(entryContent),
            publishedDate: extractTag(entryContent, 'published') || extractTag(entryContent, 'updated'),
            image: extractImage(entryContent)
        };
        
        // Clean up description
        if (item.description) {
            item.snippet = item.description
                .replace(/<[^>]*>/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 200) + '...';
        }
        
        items.push(item);
    }
    
    return items;
}

// Extract content from XML tags
function extractTag(content, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
}

// Extract Atom link
function extractAtomLink(content) {
    const linkRegex = /<link[^>]*href=["']([^"']*)["'][^>]*>/i;
    const match = content.match(linkRegex);
    return match ? match[1] : null;
}

// Extract image from various sources
function extractImage(content) {
    // Try media:content first
    let imageMatch = content.match(/<media:content[^>]*url=["']([^"']*\.(jpg|jpeg|png|gif|webp))["'][^>]*>/i);
    if (imageMatch) return imageMatch[1];
    
    // Try enclosure
    imageMatch = content.match(/<enclosure[^>]*url=["']([^"']*\.(jpg|jpeg|png|gif|webp))["'][^>]*>/i);
    if (imageMatch) return imageMatch[1];
    
    // Try to find images in content
    imageMatch = content.match(/<img[^>]*src=["']([^"']*\.(jpg|jpeg|png|gif|webp))["'][^>]*>/i);
    if (imageMatch) return imageMatch[1];
    
    // Try WordPress featured image
    imageMatch = content.match(/<wp:featuredImage[^>]*>([^<]*)<\/wp:featuredImage>/i);
    if (imageMatch) return imageMatch[1];
    
    return null;
}

// Generate HTML preview page for multiple items
function generatePreviewHTML(items, feedName, maxItems = 3) {
    const currentDate = new Date().toISOString();
    const displayItems = items.slice(0, maxItems);
    
    // Generate AVA summary based on RSS content
    const avaSummary = generateAVASummary(displayItems, feedName);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSS Feed Test - ${feedName} | Opulent Shipyard Monaco</title>
    
    <!-- Preconnect to Google Fonts for performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet">
    
    <!-- Load Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <style>
        body {
            font-family: 'Montserrat', sans-serif;
            background-color: #F8F8F8;
        }
        .yacht-card {
            background: linear-gradient(145deg, #ffffff, #f8f8f8);
            box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.1), -6px -6px 12px rgba(255, 255, 255, 0.5);
            border: 1px solid rgba(220, 220, 220, 0.3);
        }
    </style>
</head>
<body class="min-h-screen bg-gray-50">
    
    <!-- Header -->
    <header class="w-full py-4 px-6 flex justify-between items-center bg-white shadow-sm">
        <div class="flex items-center">
            <img src="https://placehold.co/40x40/000000/FFFFFF?text=OSM" alt="Opulent Shipyard Monaco Logo" class="h-10 w-10 mr-2 rounded-lg">
            <a href="/" class="text-xl font-bold text-gray-800">Opulent Shipyard Monaco</a>
        </div>
        <nav>
            <ul class="flex space-x-6">
                <li><a href="/about" class="text-gray-600 hover:text-gray-900 font-medium">About</a></li>
                <li><a href="/about-tech" class="text-gray-600 hover:text-gray-900 font-medium">About the Tech</a></li>
                <li><a href="/settings" class="text-gray-600 hover:text-gray-900 font-medium">Settings</a></li>
            </ul>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 py-8">
        
        <!-- Test Info -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">RSS Feed Test Preview</h1>
            <p class="text-gray-600">Testing RSS feed content from: <strong>${feedName}</strong></p>
            <p class="text-gray-500 text-sm">Showing ${displayItems.length} latest articles</p>
        </div>

        <!-- AVA Summary -->
        <div id="ava-summary" class="bg-white rounded-lg p-6 mb-8 shadow-sm border">
            <h2 class="text-xl font-semibold text-gray-800 mb-3">AVA Summary</h2>
            <p class="text-gray-700 leading-relaxed">${avaSummary}</p>
        </div>

        <!-- Multiple Yacht Cards Preview -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            ${displayItems.map((item, index) => `
            <div class="yacht-card rounded-lg overflow-hidden">
                <img src="${item.image || `https://placehold.co/400x250/E0E0E0/333333?text=Article%20${index + 1}`}"
                     alt="${item.title}"
                     class="w-full h-48 object-cover"
                     onerror="this.src='https://placehold.co/400x250/E0E0E0/333333?text=Article%20${index + 1}'">
                <div class="p-4">
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">${item.title}</h3>
                    <p class="text-gray-600 text-sm mb-3 line-clamp-3">${item.snippet || 'No description available.'}</p>
                    <div class="flex justify-between items-center">
                        <a href="${item.url}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition duration-200">
                            Read Article
                        </a>
                        <span class="text-xs text-gray-500">${item.publishedDate ? new Date(item.publishedDate).toLocaleDateString() : 'Unknown date'}</span>
                    </div>
                </div>
            </div>
            `).join('')}
        </div>

        <!-- Debug Info -->
        <div class="mt-8 p-4 bg-gray-100 rounded-lg">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">Debug Information</h3>
            <div class="text-sm text-gray-600 space-y-2">
                <p><strong>Feed:</strong> ${feedName}</p>
                <p><strong>Total Items Found:</strong> ${items.length}</p>
                <p><strong>Items Displayed:</strong> ${displayItems.length}</p>
                <div class="mt-3">
                    <p><strong>Latest Articles:</strong></p>
                    ${displayItems.map((item, index) => `
                    <div class="ml-4 mt-2 p-2 bg-white rounded border">
                        <p><strong>${index + 1}. ${item.title}</strong></p>
                        <p class="text-xs">URL: ${item.url}</p>
                        <p class="text-xs">Published: ${item.publishedDate || 'Unknown'}</p>
                        <p class="text-xs">Image: ${item.image ? 'Found' : 'Not found'}</p>
                        <p class="text-xs">Description: ${item.description ? item.description.length + ' chars' : 'None'}</p>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>

    </main>

    <!-- Footer -->
    <footer class="w-full py-8 px-6 bg-white border-t mt-12">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
            <span class="text-gray-500 text-sm font-light">RSS Feed Test Preview</span>
            <a href="/" class="text-gray-500 hover:text-gray-700 text-sm font-light">Back to Search</a>
        </div>
    </footer>

</body>
</html>`;
}

// Generate AVA summary based on RSS content
function generateAVASummary(items, feedName) {
    if (!items || items.length === 0) {
        return `Bonjour! I'm AVA, your Monaco yacht concierge. I couldn't find any recent articles from ${feedName} at the moment. Please check back later for the latest yacht and maritime news. —AVA`;
    }
    
    const latestTitle = items[0].title;
    const articleCount = items.length;
    const topics = extractTopics(items);
    
    return `Bonjour! I'm AVA, your Monaco yacht concierge. I've curated ${articleCount} latest articles from ${feedName}, featuring "${latestTitle}" and other maritime insights covering ${topics}. These articles provide valuable perspectives on yacht lifestyle, destinations, and industry trends for the discerning yacht enthusiast. —AVA`;
}

// Extract common topics from RSS items
function extractTopics(items) {
    const keywords = [];
    
    items.forEach(item => {
        const text = (item.title + ' ' + (item.description || '')).toLowerCase();
        
        // Common yacht/maritime keywords
        if (text.includes('yacht') || text.includes('boat')) keywords.push('yachting');
        if (text.includes('charter')) keywords.push('charter services');
        if (text.includes('marina') || text.includes('harbor') || text.includes('port')) keywords.push('marinas');
        if (text.includes('luxury') || text.includes('superyacht')) keywords.push('luxury vessels');
        if (text.includes('destination') || text.includes('travel')) keywords.push('destinations');
        if (text.includes('monaco') || text.includes('mediterranean')) keywords.push('Mediterranean');
        if (text.includes('anchor') || text.includes('sailing')) keywords.push('sailing');
        if (text.includes('florida') || text.includes('caribbean')) keywords.push('tropical waters');
    });
    
    // Remove duplicates and limit to 3 topics
    const uniqueKeywords = [...new Set(keywords)].slice(0, 3);
    
    if (uniqueKeywords.length === 0) {
        return 'maritime lifestyle and yacht industry news';
    } else if (uniqueKeywords.length === 1) {
        return uniqueKeywords[0];
    } else if (uniqueKeywords.length === 2) {
        return uniqueKeywords.join(' and ');
    } else {
        return uniqueKeywords.slice(0, -1).join(', ') + ', and ' + uniqueKeywords[uniqueKeywords.length - 1];
    }
}

// Main function to fetch and process RSS feed
async function generateRSSPreview(maxItems = 3) {
    try {
        console.log('Starting RSS feed preview generation...');
        
        // Load RSS feeds configuration
        const feedsConfig = loadRSSFeeds();
        
        if (!feedsConfig.feeds || feedsConfig.feeds.length === 0) {
            console.error('No RSS feeds configured');
            return;
        }
        
        // Get the first feed for testing
        const feed = feedsConfig.feeds[0];
        console.log(`Fetching RSS feed: ${feed.url}`);
        
        // Fetch RSS feed content
        const response = await axios.get(feed.url, {
            headers: {
                'User-Agent': 'OpulentShipyardMonaco/1.0 RSS Reader'
            },
            timeout: 10000
        });
        
        console.log('RSS feed fetched successfully');
        
        // Parse the feed
        const items = parseXMLFeed(response.data);
        
        if (items.length === 0) {
            console.error('No items found in RSS feed');
            return;
        }
        
        console.log(`Found ${items.length} items in feed`);
        console.log(`Displaying ${Math.min(maxItems, items.length)} items`);
        
        // Log the titles of items we'll display
        items.slice(0, maxItems).forEach((item, index) => {
            console.log(`${index + 1}. ${item.title}`);
        });
        
        // Generate preview HTML with multiple items
        const previewHTML = generatePreviewHTML(items, feed.name, maxItems);
        
        // Ensure previews directory exists
        const previewsDir = path.join(__dirname, 'htdocs', 'previews');
        if (!fs.existsSync(previewsDir)) {
            fs.mkdirSync(previewsDir, { recursive: true });
        }
        
        // Write preview file
        const previewPath = path.join(previewsDir, 'rss-test-1.html');
        fs.writeFileSync(previewPath, previewHTML);
        
        console.log(`RSS preview generated: ${previewPath}`);
        console.log('Preview available at: http://localhost:3000/previews/rss-test-1.html');
        
    } catch (error) {
        console.error('Error generating RSS preview:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data.substring(0, 200));
        }
    }
}

// Run the RSS preview generation
if (require.main === module) {
    // You can adjust the number of items to display here (default: 3)
    const maxItems = process.argv[2] ? parseInt(process.argv[2]) : 3;
    generateRSSPreview(maxItems);
}

module.exports = {
    generateRSSPreview,
    parseXMLFeed,
    loadRSSFeeds
};