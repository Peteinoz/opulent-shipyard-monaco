const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

/**
 * RSS Static Page Generator
 * Creates individual static HTML pages in /rsscontent/ folder
 * Each page contains AVA summary + 3 latest RSS articles
 */

// Import functions from existing RSS generator
const { parseXMLFeed, loadRSSFeeds } = require('./generate-from-rss.js');

// Generate SEO-friendly filename from article title
function generateFilename(items = []) {
    // Generate timestamp for unique filenames
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${year}${month}${day}-${hour}${minute}`;
    
    // Try to get the first article title for SEO slug
    if (items && items.length > 0 && items[0].title) {
        const title = items[0].title;
        
        // Create SEO-friendly slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
            .substring(0, 80); // Limit length to 80 characters
        
        if (slug.length > 0) {
            return `rss-post-${slug}-${timestamp}.html`;
        }
    }
    
    // Fallback to timestamp only if no title available
    return `rss-post-${timestamp}.html`;
}

// Generate AVA summary based on RSS content
function generateAVASummary(items, feedName) {
    if (!items || items.length === 0) {
        return `Bonjour! I'm AVA, your Monaco yacht concierge. I couldn't find any recent articles from ${feedName} at the moment. Please check back later for the latest yacht and maritime news. —AVA`;
    }
    
    const latestTitle = items[0].title;
    const articleCount = Math.min(items.length, 3);
    const topics = extractTopics(items);
    
    return `Bonjour! I'm AVA, your Monaco yacht concierge. I've curated ${articleCount} latest articles from ${feedName}, featuring "${latestTitle}" and other maritime insights covering ${topics}. These articles provide valuable perspectives on yacht lifestyle, destinations, and industry trends for the discerning yacht enthusiast. —AVA`;
}

// Extract common topics from RSS items
function extractTopics(items) {
    const keywords = [];
    
    items.slice(0, 3).forEach(item => {
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

// Generate static HTML page for RSS content
function generateStaticRSSPage(items, feedName, filename) {
    const displayItems = items.slice(0, 3);
    const avaSummary = generateAVASummary(displayItems, feedName);
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    const currentDateISO = new Date().toISOString();
    const pageTitle = `${feedName} - Latest Maritime News | Opulent Shipyard Monaco`;
    const pageDescription = `Latest maritime news and yacht industry articles from ${feedName}. ${avaSummary.substring(0, 150)}...`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDescription}">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:type" content="website">
    <meta property="og:image" content="https://placehold.co/1200x630/E0E0E0/333333?text=Maritime%20News">
    <meta property="og:url" content="https://opulentshipyardmonaco.com/rsscontent/${filename}">
    <meta property="og:description" content="${pageDescription}">
    <meta property="og:site_name" content="Opulent Shipyard Monaco">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${pageTitle}">
    <meta name="twitter:description" content="${pageDescription}">
    <meta name="twitter:image" content="https://placehold.co/1200x630/E0E0E0/333333?text=Maritime%20News">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": "${pageTitle}",
        "description": "${pageDescription}",
        "url": "https://opulentshipyardmonaco.com/rsscontent/${filename}",
        "datePublished": "${currentDateISO}",
        "publisher": {
            "@type": "Organization",
            "name": "Opulent Shipyard Monaco",
            "url": "https://opulentshipyardmonaco.com"
        },
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": ${displayItems.length},
            "itemListElement": [
                ${displayItems.map((item, index) => `{
                    "@type": "ListItem",
                    "position": ${index + 1},
                    "url": "${item.url}",
                    "name": "${item.title.replace(/"/g, '\\"')}"
                }`).join(',')}
            ]
        }
    }
    </script>
    
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
                <li><a href="/rsscontent/" class="text-gray-600 hover:text-gray-900 font-medium">RSS Content</a></li>
                <li><a href="/settings" class="text-gray-600 hover:text-gray-900 font-medium">Settings</a></li>
            </ul>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 py-8">
        
        <!-- Page Info -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Latest Maritime News</h1>
            <p class="text-gray-600">From: <strong>${feedName}</strong></p>
            <p class="text-gray-500 text-sm">Generated: ${currentDate} at ${currentTime}</p>
        </div>

        <!-- AVA Summary -->
        <div id="ava-summary" class="bg-white rounded-lg p-6 mb-8 shadow-sm border">
            <h2 class="text-xl font-semibold text-gray-800 mb-3">AVA Summary</h2>
            <p class="text-gray-700 leading-relaxed">${avaSummary}</p>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <p class="text-gray-500 text-sm italic">Editor's note: This curated list was generated by AVA, your Monaco yacht concierge, based on the latest public yacht listings and industry news as of ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
            </div>
        </div>

        <!-- Last Updated -->
        <div class="mb-6">
            <p class="text-gray-600 text-sm">Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <!-- Who, What, Where Context -->
        <div class="mb-8">
            <p class="text-gray-700 leading-relaxed">As of ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, according to industry sources and Monaco-based yacht brokers, these are currently considered the best yachts available in Monaco for viewing, charter or sale.</p>
        </div>

        <!-- RSS Articles Grid -->
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

        <!-- Sources Cited -->
        <div class="mb-8">
            <p class="text-gray-600 leading-relaxed"><strong>Sources:</strong> Yacht Buyer, Boat International, Robb Report, Megayacht News, Marine Link, and other public yacht listings.</p>
        </div>

        <!-- Navigation -->
        <div class="flex justify-between items-center mt-8">
            <a href="/rsscontent/" class="text-blue-600 hover:text-blue-800 font-medium">← Back to RSS Content Index</a>
            <a href="/" class="text-gray-500 hover:text-gray-700 font-medium">Home</a>
        </div>

    </main>

    <!-- Footer -->
    <footer class="w-full py-8 px-6 bg-white border-t mt-12">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
            <span class="text-gray-500 text-sm font-light">RSS Content - ${filename}</span>
            <a href="/rsscontent/" class="text-gray-500 hover:text-gray-700 text-sm font-light">RSS Content Index</a>
        </div>
    </footer>

</body>
</html>`;
}

// Generate RSS content index page with pagination
function generateRSSIndexPage(rssFiles, rssFilesWithTitles, currentPage = 1) {
    const itemsPerPage = 20;
    const totalPages = Math.ceil(rssFiles.length / itemsPerPage);
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageFiles = rssFiles.slice(startIndex, endIndex);
    
    // Generate page filename
    const pageFilename = currentPage === 1 ? 'index.html' : `index-page-${currentPage}.html`;
    
    // Generate previous/next page URLs
    const prevPageUrl = currentPage > 1 ? (currentPage === 2 ? '/rsscontent/' : `/rsscontent/index-page-${currentPage - 1}.html`) : null;
    const nextPageUrl = currentPage < totalPages ? `/rsscontent/index-page-${currentPage + 1}.html` : null;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Latest Maritime News and Yacht Industry Insights — Page ${currentPage}</title>
    <meta name="description" content="Latest maritime news and yacht industry articles from leading yacht RSS feeds. Page ${currentPage} of ${totalPages}.">
    
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
                <li><a href="/rsscontent/" class="text-blue-600 hover:text-blue-800 font-medium">RSS Content</a></li>
                <li><a href="/settings" class="text-gray-600 hover:text-gray-900 font-medium">Settings</a></li>
            </ul>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto px-4 py-8">
        
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">RSS Content Index — Page ${currentPage} of ${totalPages}</h1>
            <p class="text-gray-600">Latest maritime news and yacht industry articles</p>
            <p class="text-gray-500 text-sm mt-2">Total articles: ${rssFiles.length} | Page ${currentPage} of ${totalPages}</p>
        </div>

        <!-- RSS Articles List -->
        <div class="bg-white rounded-lg shadow-sm border">
            ${pageFiles.length > 0 ? pageFiles.map((file, index) => {
                const fileDate = extractDateFromFilename(file.name);
                const displayDate = fileDate ? fileDate.toLocaleDateString() : 'Unknown date';
                const displayTime = fileDate ? fileDate.toLocaleTimeString() : '';
                
                // Get the first article title for this file
                const fileWithTitle = rssFilesWithTitles.find(f => f.name === file.name);
                const firstArticleTitle = fileWithTitle && fileWithTitle.firstArticleTitle
                    ? fileWithTitle.firstArticleTitle
                    : null;
                
                // Create SEO-friendly anchor text
                const anchorText = firstArticleTitle
                    ? `${firstArticleTitle} | Maritime News`
                    : `Maritime News - ${displayDate}`;
                
                return `
                <div class="p-6 ${index < pageFiles.length - 1 ? 'border-b border-gray-100' : ''}">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-gray-800 mb-2">
                                <a href="/rsscontent/${file.name}" class="hover:text-blue-600 transition duration-200">
                                    ${anchorText}
                                </a>
                            </h3>
                            <p class="text-gray-600 text-sm mb-2">Latest yacht industry articles and maritime insights</p>
                            <p class="text-gray-500 text-xs">Generated: ${displayDate} ${displayTime}</p>
                        </div>
                        <div class="ml-4">
                            <a href="/rsscontent/${file.name}"
                               class="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition duration-200">
                                View Articles
                            </a>
                        </div>
                    </div>
                </div>
                `;
            }).join('') : `
                <div class="p-6 text-center">
                    <p class="text-gray-500">No RSS content generated yet.</p>
                    <p class="text-gray-400 text-sm mt-2">Use the "Run RSS Build" button on the homepage to generate content.</p>
                </div>
            `}
        </div>

        <!-- Pagination -->
        ${totalPages > 1 ? `
        <div class="flex justify-center mt-8">
            <div class="flex space-x-2">
                ${prevPageUrl ? `<a href="${prevPageUrl}" class="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition duration-200">Previous</a>` : '<span class="px-4 py-2 bg-gray-200 text-gray-400 rounded text-sm">Previous</span>'}
                <span class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">Page ${currentPage} of ${totalPages}</span>
                ${nextPageUrl ? `<a href="${nextPageUrl}" class="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition duration-200">Next</a>` : '<span class="px-4 py-2 bg-gray-200 text-gray-400 rounded text-sm">Next</span>'}
            </div>
        </div>
        ` : ''}

        <!-- Back to Home -->
        <div class="text-center mt-8">
            <a href="/" class="text-gray-500 hover:text-gray-700 font-medium">← Back to Home</a>
        </div>

    </main>

    <!-- Footer -->
    <footer class="w-full py-8 px-6 bg-white border-t mt-12">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
            <span class="text-gray-500 text-sm font-light">RSS Content Index</span>
            <div class="flex space-x-4">
                <a href="/rsscontent/rss.xml" class="text-blue-600 hover:text-blue-800 text-sm font-light">→ RSS Feed</a>
                <a href="/" class="text-gray-500 hover:text-gray-700 text-sm font-light">Home</a>
            </div>
        </div>
    </footer>

</body>
</html>`;
}

// Generate all paginated RSS index pages
function generateAllRSSIndexPages(rssFiles, rssFilesWithTitles) {
    const itemsPerPage = 20;
    const totalPages = Math.ceil(rssFiles.length / itemsPerPage);
    const rssContentDir = path.join(__dirname, 'htdocs', 'rsscontent');
    
    // Generate each page
    for (let page = 1; page <= totalPages; page++) {
        const pageHTML = generateRSSIndexPage(rssFiles, rssFilesWithTitles, page);
        const pageFilename = page === 1 ? 'index.html' : `index-page-${page}.html`;
        const pagePath = path.join(rssContentDir, pageFilename);
        
        fs.writeFileSync(pagePath, pageHTML);
        console.log(`RSS index page ${page} updated: ${pagePath}`);
    }
    
    // Clean up any extra page files that might exist
    const existingPageFiles = fs.readdirSync(rssContentDir)
        .filter(file => file.match(/^index-page-\d+\.html$/))
        .map(file => {
            const match = file.match(/^index-page-(\d+)\.html$/);
            return match ? parseInt(match[1]) : 0;
        })
        .filter(pageNum => pageNum > totalPages);
    
    existingPageFiles.forEach(pageNum => {
        const oldPagePath = path.join(rssContentDir, `index-page-${pageNum}.html`);
        if (fs.existsSync(oldPagePath)) {
            fs.unlinkSync(oldPagePath);
            console.log(`Removed old page file: index-page-${pageNum}.html`);
        }
    });
}

// Extract date from filename
function extractDateFromFilename(filename) {
    const match = filename.match(/rss-post-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\.html/);
    if (match) {
        const [, year, month, day, hour, minute] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
    return null;
}

// Get existing RSS files sorted by date (newest first)
function getExistingRSSFiles() {
    const rssContentDir = path.join(__dirname, 'htdocs', 'rsscontent');
    
    if (!fs.existsSync(rssContentDir)) {
        return [];
    }
    
    const files = fs.readdirSync(rssContentDir)
        .filter(file => file.startsWith('rss-post-') && file.endsWith('.html'))
        .map(file => ({
            name: file,
            date: extractDateFromFilename(file) || new Date(0)
        }))
        .sort((a, b) => b.date - a.date); // Sort newest first
    
    return files;
}

// Get RSS files with their first article titles
function getRSSFilesWithTitles() {
    const rssContentDir = path.join(__dirname, 'htdocs', 'rsscontent');
    
    if (!fs.existsSync(rssContentDir)) {
        return [];
    }
    
    const files = fs.readdirSync(rssContentDir)
        .filter(file => file.startsWith('rss-post-') && file.endsWith('.html'))
        .map(file => {
            const filePath = path.join(rssContentDir, file);
            let firstArticleTitle = null;
            
            try {
                // Read the HTML file and extract the first article title
                const htmlContent = fs.readFileSync(filePath, 'utf8');
                const titleMatch = htmlContent.match(/<h3 class="text-lg font-semibold text-gray-800 mb-2">([^<]+)<\/h3>/);
                if (titleMatch) {
                    firstArticleTitle = titleMatch[1].trim();
                }
            } catch (error) {
                console.warn(`Could not extract title from ${file}:`, error.message);
            }
            
            return {
                name: file,
                date: extractDateFromFilename(file) || new Date(0),
                firstArticleTitle: firstArticleTitle
            };
        })
        .sort((a, b) => b.date - a.date); // Sort newest first
    
    return files;
}

// Generate RSS 2.0 XML feed
function generateRSSXMLFeed(rssFilesWithTitles) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const maxItems = 20;
    const feedItems = rssFilesWithTitles.slice(0, maxItems);
    
    const currentDate = new Date().toUTCString();
    
    let rssXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>Opulent Shipyard Monaco - Maritime News</title>
    <link>${baseUrl}/rsscontent/</link>
    <description>Latest maritime news and yacht industry articles from Opulent Shipyard Monaco</description>
    <language>en-us</language>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <generator>Opulent Shipyard Monaco RSS Generator</generator>
    <atom:link href="${baseUrl}/rsscontent/rss.xml" rel="self" type="application/rss+xml" />
`;

    feedItems.forEach(file => {
        const title = file.firstArticleTitle
            ? `${file.firstArticleTitle} | Maritime News`
            : `Maritime News - ${file.date.toLocaleDateString()}`;
        
        const link = `${baseUrl}/rsscontent/${file.name}`;
        const pubDate = file.date.toUTCString();
        const description = `Latest yacht industry articles and maritime insights from ${file.firstArticleTitle || 'our maritime news collection'}.`;
        
        // Escape XML special characters
        const escapedTitle = escapeXML(title);
        const escapedDescription = escapeXML(description);
        
        rssXML += `
    <item>
        <title>${escapedTitle}</title>
        <link>${link}</link>
        <description>${escapedDescription}</description>
        <pubDate>${pubDate}</pubDate>
        <guid isPermaLink="true">${link}</guid>
    </item>`;
    });
    
    rssXML += `
</channel>
</rss>`;
    
    return rssXML;
}

// Escape XML special characters
function escapeXML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Main function to generate RSS static page
async function generateRSSStaticPage(feedIndex = null) {
    console.log(`[RSS Automation] Running generateRSSStaticPage('${feedIndex}')...`);
    try {
        console.log('Starting RSS static page generation...');
        
        // Load RSS feeds configuration
        const feedsConfig = loadRSSFeeds();
        
        if (!feedsConfig.feeds || feedsConfig.feeds.length === 0) {
            console.error('No RSS feeds configured');
            return false;
        }
        
        // Select feed - either specified index, random, or first
        let feed;
        if (feedIndex !== null && feedIndex >= 0 && feedIndex < feedsConfig.feeds.length) {
            feed = feedsConfig.feeds[feedIndex];
            console.log(`Using specified feed index ${feedIndex}: ${feed.url}`);
        } else if (feedIndex === 'random') {
            const randomIndex = Math.floor(Math.random() * feedsConfig.feeds.length);
            feed = feedsConfig.feeds[randomIndex];
            console.log(`Using random feed (index ${randomIndex}): ${feed.url}`);
        } else {
            // Default to first feed
            feed = feedsConfig.feeds[0];
            console.log(`Using default first feed: ${feed.url}`);
        }
        
        // DEBUG: Log feed source URL
        console.log("[DEBUG] RSS Automation feed source URL:", feed.url);
        
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
            return false;
        }
        
        console.log(`Found ${items.length} items in feed`);
        
        // DEBUG: Log article title
        const debugArticleTitle = items.length > 0 ? items[0].title : 'No title available';
        console.log("[DEBUG] RSS Automation using article title:", debugArticleTitle);
        
        // Generate SEO-friendly filename from first article title
        const filename = generateFilename(items);
        console.log(`Generated filename: ${filename}`);
        console.log("[DEBUG] RSS Automation static page being written to:", filename);
        
        // DEBUG: Log generated slug and target file path
        if (items.length > 0 && items[0].title) {
            const debugSeoSlug = items[0].title
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 80);
            console.log("[DEBUG] RSS Automation generated slug:", debugSeoSlug);
        }
        
        const debugRssContentDir = path.join(__dirname, 'htdocs', 'rsscontent');
        const debugFilePath = path.join(debugRssContentDir, filename);
        console.log("[DEBUG] RSS Automation target filename:", debugFilePath);
        
        // Generate static HTML page
        const staticHTML = generateStaticRSSPage(items, feed.name, filename);
        
        // Ensure rsscontent directory exists
        const rssContentDir = path.join(__dirname, 'htdocs', 'rsscontent');
        if (!fs.existsSync(rssContentDir)) {
            fs.mkdirSync(rssContentDir, { recursive: true });
        }
        
        // Write static RSS page
        const staticPagePath = path.join(rssContentDir, filename);
        fs.writeFileSync(staticPagePath, staticHTML);
        console.log(`RSS static page created: ${staticPagePath}`);
        
        // Get existing RSS files with titles and generate index
        const existingFiles = getExistingRSSFiles();
        const existingFilesWithTitles = getRSSFilesWithTitles();
        
        // Store the first article title for the current file
        const firstArticleTitle = items.length > 0 ? items[0].title : null;
        if (firstArticleTitle) {
            // Add current file to the titles list
            existingFilesWithTitles.unshift({
                name: filename,
                date: new Date(),
                firstArticleTitle: firstArticleTitle
            });
        }
        
        // Ensure both lists are sorted by newest first (timestamp)
        existingFiles.sort((a, b) => b.date - a.date);
        existingFilesWithTitles.sort((a, b) => b.date - a.date);
        
        // Generate all paginated index pages
        generateAllRSSIndexPages(existingFiles, existingFilesWithTitles);
        
        // Generate and write RSS XML feed
        const rssXML = generateRSSXMLFeed(existingFilesWithTitles);
        const rssXMLPath = path.join(rssContentDir, 'rss.xml');
        fs.writeFileSync(rssXMLPath, rssXML);
        console.log(`RSS XML feed updated: ${rssXMLPath}`);
        
        console.log('RSS static page generation completed successfully!');
        console.log(`Static page: http://localhost:3000/rsscontent/${filename}`);
        console.log(`Index page: http://localhost:3000/rsscontent/`);
        console.log(`RSS XML feed: http://localhost:3000/rsscontent/rss.xml`);
        
        return true;
        
    } catch (error) {
        console.error('Error generating RSS static page:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
        }
        return false;
    }
}

// Export functions
module.exports = {
    generateRSSStaticPage,
    getExistingRSSFiles,
    generateRSSIndexPage
};

// Run if called directly
if (require.main === module) {
    generateRSSStaticPage();
}