/**
 * Opulent Shipyard Monaco - Backend Server
 * Handles Perplexity API calls and search functionality
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const compression = require('compression');
require('dotenv').config({ path: '.env.local' });

// PERFORMANCE OPTIMIZATION: Image caching system
const imageCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 1000; // Maximum cached images

// RSS AUTOMATION: Search counter and configuration
let searchCounter = 0;
const RSS_TRIGGER_SEARCHES = parseInt(process.env.RSS_TRIGGER_SEARCHES || '2', 10);
console.log(`RSS automation configured: trigger after ${RSS_TRIGGER_SEARCHES} searches`);

// Check if this is a restart due to .env.local change
if (process.env.RSS_TRIGGER_SEARCHES) {
    console.log('✅ Server restarted due to .env.local change — new env variables applied.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression()); // PERFORMANCE OPTIMIZATION: Enable gzip compression
app.use(cors());
app.use(express.json());

// PERFORMANCE OPTIMIZATION: Add caching headers for static files
app.use(express.static(path.join(__dirname, 'htdocs'), {
    maxAge: '1h', // Cache static files for 1 hour
    etag: true,   // Enable ETags for better caching
    lastModified: true
}));

// PERFORMANCE OPTIMIZATION: Add specific caching for search pages
app.use('/searches/', (req, res, next) => {
    if (req.url.endsWith('.html')) {
        res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache
        res.set('Vary', 'Accept-Encoding');
    }
    next();
});

// Serve specific files from root directory
app.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.js'));
});

// Handle dynamic search route
app.get('/search', (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.redirect('/');
    }
    
    // Generate filename from query using the same logic as the search generation
    const today = new Date().toISOString().split('T')[0];
    const cleanQuery = query.toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
    
    const filename = `${today}-${cleanQuery}.html`;
    const filePath = path.join(__dirname, 'htdocs', 'searches', filename);
    
    console.log(`Looking for search file: ${filename}`);
    
    // Check if static file exists, if so serve it
    res.sendFile(filePath, (err) => {
        if (err) {
            // If file doesn't exist, redirect to homepage
            console.log(`Search file not found: ${filename}, redirecting to homepage`);
            res.redirect('/');
        } else {
            console.log(`Successfully served search file: ${filename}`);
        }
    });
});


// Settings storage
let settings = {
    resultsCount: 12,
    minResultsThreshold: 5,
    rssFeeds: []
};

// Load settings from file
async function loadSettings() {
    try {
        const data = await fs.readFile('settings.json', 'utf8');
        settings = JSON.parse(data);
    } catch (error) {
        console.log('No settings file found, using defaults');
    }
}

// Save settings to file
async function saveSettings() {
    try {
        await fs.writeFile('settings.json', JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

/**
 * Fetch yacht image using Google Custom Search API
 */
async function fetchYachtImage(yacht) {
    try {
        // PERFORMANCE OPTIMIZATION: Check cache first
        const cacheKey = `${yacht.title}_${yacht.url}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const cached = imageCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`Using cached image for yacht: ${yacht.title}`);
            return { ...yacht, image: cached.image };
        }
        
        console.log(`Fetching image for yacht: ${yacht.title}`);
        
        // Create search query for yacht images
        const searchQuery = `${yacht.title} luxury yacht superyacht`;
        const googleApiKey = process.env.GOOGLE_API_KEY;
        const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
        
        console.log(`Google API Key present: ${!!googleApiKey}`);
        console.log(`Search Engine ID present: ${!!searchEngineId}`);
        
        if (!googleApiKey || !searchEngineId) {
            console.log('Google API credentials not found, using placeholder image');
            return yacht;
        }
        
        // Google Custom Search API URL for image search
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&searchType=image&imgSize=large&imgType=photo&num=3&safe=active`;
        
        const response = await axios.get(searchUrl);
        
        if (response.data && response.data.items && response.data.items.length > 0) {
            // Get the first high-quality image
            const imageUrl = response.data.items[0].link;
            
            // Verify the image URL is accessible
            try {
                await axios.head(imageUrl, { timeout: 3000 });
                yacht.image = imageUrl;
                console.log(`Found image for yacht: ${yacht.title}`);
                
                // PERFORMANCE OPTIMIZATION: Cache the successful result
                cacheImageResult(cacheKey, imageUrl);
                
            } catch (imageError) {
                console.log(`Image not accessible for ${yacht.title}, trying next...`);
                // Try the second image if first fails
                if (response.data.items.length > 1) {
                    try {
                        const secondImageUrl = response.data.items[1].link;
                        await axios.head(secondImageUrl, { timeout: 3000 });
                        yacht.image = secondImageUrl;
                        console.log(`Found backup image for yacht: ${yacht.title}`);
                        
                        // PERFORMANCE OPTIMIZATION: Cache the successful backup result
                        cacheImageResult(cacheKey, secondImageUrl);
                        
                    } catch (secondImageError) {
                        console.log(`Backup image also failed for ${yacht.title}`);
                    }
                }
            }
        } else {
            console.log(`No images found for yacht: ${yacht.title}`);
        }
    } catch (error) {
        console.error(`Error fetching image for yacht ${yacht.title}:`, error.message);
    }
    
    return yacht;
}

/**
 * PERFORMANCE OPTIMIZATION: Cache image result with size management
 */
function cacheImageResult(cacheKey, imageUrl) {
    // Manage cache size to prevent memory issues
    if (imageCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries (simple FIFO)
        const oldestKey = imageCache.keys().next().value;
        imageCache.delete(oldestKey);
        console.log(`Cache size limit reached, removed oldest entry: ${oldestKey}`);
    }
    
    imageCache.set(cacheKey, {
        image: imageUrl,
        timestamp: Date.now()
    });
    
    console.log(`Cached image result for key: ${cacheKey} (cache size: ${imageCache.size})`);
}

/**
 * Generate expanded queries for comprehensive yacht search
 */
function generateExpandedQueries(originalQuery) {
    const expansions = [
        'luxury yacht charter',
        'superyacht rental',
        'yacht for sale',
        'motor yacht',
        'sailing yacht',
        'mega yacht',
        'yacht charter services',
        'premium yacht'
    ];
    
    const location = originalQuery.toLowerCase().includes('monaco') ? 'Monaco' : '';
    const expandedQueries = [];
    
    // Add original query
    expandedQueries.push(originalQuery);
    
    // Generate expanded queries
    expansions.forEach(expansion => {
        if (location) {
            expandedQueries.push(`${expansion} ${location}`);
        } else {
            expandedQueries.push(`${expansion} ${originalQuery}`);
        }
    });
    
    return expandedQueries.slice(0, 4); // Limit to 4 total queries to avoid API overuse
}

/**
 * Enhanced Perplexity API call with better prompting
 */
async function callPerplexityAPI(query, isExpanded = false) {
    const enhancedPrompt = isExpanded
        ? `You are AVA, a sophisticated Monaco yacht concierge. Find yachts matching: ${query}. IMPORTANT: Provide at least 5-6 unique yacht sources in your response. Format as JSON with 'answer' and 'sources' fields. Each source needs 'title', 'snippet', and 'url'. Focus on different yacht types, sizes, and services to ensure variety.`
        : `You are AVA, a sophisticated Monaco yacht concierge with extensive knowledge of luxury yachts. Respond as a warm, knowledgeable personal concierge speaking in first-person. Format your response as a JSON object with 'answer' and 'sources' fields. The 'answer' should be a very concise summary (2-3 sentences maximum, about 30% of typical length) that begins with 'Bonjour! I'm AVA, your Monaco yacht concierge.' and ends with '—AVA'. Focus only on the most prestigious details. IMPORTANT: The 'sources' should contain at least 5-6 unique yacht entries, each with 'title', 'snippet', and 'url' fields. Provide diverse yacht options including different sizes, types, and services.`;

    return await axios.post('https://api.perplexity.ai/chat/completions', {
        model: 'sonar-pro',
        messages: [
            {
                role: "system",
                content: enhancedPrompt
            },
            {
                role: "user",
                content: `Find yachts that match this criteria: ${query}. Please provide your response in JSON format with 'answer' and 'sources' fields. Ensure at least 5-6 unique yacht sources.`
            }
        ],
        max_tokens: 1500 // Increased for more comprehensive results
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Merge and deduplicate yacht sources
 */
function mergeYachtSources(sourcesArrays) {
    const allSources = sourcesArrays.flat();
    const uniqueSources = [];
    const seenTitles = new Set();
    
    allSources.forEach(source => {
        const normalizedTitle = source.title.toLowerCase().trim();
        if (!seenTitles.has(normalizedTitle)) {
            seenTitles.add(normalizedTitle);
            uniqueSources.push(source);
        }
    });
    
    return uniqueSources;
}

/**
 * Comprehensive yacht search with fallback mechanisms
 */
async function performComprehensiveYachtSearch(originalQuery) {
    let allSources = [];
    let finalAnswer = '';
    
    try {
        // Step 1: Primary search with enhanced prompt
        console.log(`Primary search for: ${originalQuery}`);
        const primaryResponse = await callPerplexityAPI(originalQuery, false);
        
        let primaryResults;
        try {
            const content = primaryResponse.data.choices[0].message.content;
            primaryResults = JSON.parse(content);
        } catch (parseError) {
            const content = primaryResponse.data.choices[0].message.content;
            primaryResults = {
                answer: content,
                sources: []
            };
        }
        
        if (primaryResults.sources && Array.isArray(primaryResults.sources)) {
            allSources.push(...primaryResults.sources);
            finalAnswer = primaryResults.answer || '';
        }
        
        console.log(`Primary search returned ${allSources.length} sources`);
        
        // Step 2: If insufficient results, perform expanded searches
        if (allSources.length < settings.minResultsThreshold) {
            console.log(`Insufficient results (${allSources.length}), performing expanded searches...`);
            
            const expandedQueries = generateExpandedQueries(originalQuery);
            
            for (let i = 1; i < expandedQueries.length && allSources.length < settings.resultsCount; i++) {
                try {
                    console.log(`Expanded search ${i}: ${expandedQueries[i]}`);
                    const expandedResponse = await callPerplexityAPI(expandedQueries[i], true);
                    
                    let expandedResults;
                    try {
                        const content = expandedResponse.data.choices[0].message.content;
                        expandedResults = JSON.parse(content);
                    } catch (parseError) {
                        continue; // Skip this expanded search if parsing fails
                    }
                    
                    if (expandedResults.sources && Array.isArray(expandedResults.sources)) {
                        allSources.push(...expandedResults.sources);
                        console.log(`Expanded search ${i} added ${expandedResults.sources.length} sources`);
                    }
                    
                    // Small delay between API calls
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.log(`Expanded search ${i} failed:`, error.message);
                    continue;
                }
            }
        }
        
        // Step 3: Merge and deduplicate sources
        const uniqueSources = mergeYachtSources([allSources]);
        console.log(`Final unique sources: ${uniqueSources.length}`);
        
        return {
            answer: finalAnswer || "I found some excellent yacht options for your search.",
            sources: uniqueSources.slice(0, settings.resultsCount)
        };
        
    } catch (error) {
        console.error('Comprehensive yacht search error:', error);
        return {
            answer: "I apologize, but I encountered an issue while searching for yachts. Please try again.",
            sources: []
        };
    }
}

// Initialize settings
loadSettings();

// Search endpoint with progressive loading
app.get('/api/search-stream/:query', async (req, res) => {
    try {
        const query = decodeURIComponent(req.params.query);
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log('Searching for:', query);
        

        // Set headers for Server-Sent Events
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Send initial status
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting comprehensive yacht search...' })}\n\n`);

        // Use the new comprehensive search function
        const searchResults = await performComprehensiveYachtSearch(query);

        // Send the summary first
        res.write(`data: ${JSON.stringify({
            type: 'summary',
            query: query,
            answer: searchResults.answer,
            totalResults: searchResults.sources.length
        })}\n\n`);

        // PERFORMANCE OPTIMIZATION: Fetch all images in parallel instead of sequential
        console.log('Starting parallel image fetching for', searchResults.sources.length, 'yachts');
        const startTime = Date.now();
        
        // Fetch all yacht images in parallel for maximum performance
        const imagePromises = searchResults.sources.map(yacht => fetchYachtImage(yacht));
        const yachtsWithImages = await Promise.all(imagePromises);
        
        console.log('Parallel image fetching completed in', Date.now() - startTime, 'ms');
        
        // Send yacht cards in small batches for smooth UX (3 at a time)
        for (let i = 0; i < yachtsWithImages.length; i += 3) {
            const batch = yachtsWithImages.slice(i, i + 3);
            
            // Send batch of yacht cards
            batch.forEach((yacht, batchIndex) => {
                res.write(`data: ${JSON.stringify({
                    type: 'yacht',
                    index: i + batchIndex,
                    yacht: yacht
                })}\n\n`);
            });
            
            // Small delay between batches only for UX smoothness (much faster than before)
            if (i + 3 < yachtsWithImages.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Generate internal page in background
        generateInternalPage(query, searchResults).catch(console.error);
        updateSiteFiles().catch(console.error);

        // RSS AUTOMATION: Increment search counter and trigger RSS generation if needed
        searchCounter++;
        console.log(`[RSS Automation] Current search count: ${searchCounter}/${RSS_TRIGGER_SEARCHES}`);
        
        if (searchCounter >= RSS_TRIGGER_SEARCHES) {
            console.log(`[RSS Automation] Threshold reached, triggering generateRSSStaticPage('random')...`);
            
            // Reset counter immediately to prevent multiple triggers
            searchCounter = 0;
            
            // Trigger RSS generation in background (non-blocking)
            setImmediate(async () => {
                try {
                    const { generateRSSStaticPage } = require('./rss-static-generator.js');
                    const success = await generateRSSStaticPage('random');
                    if (success) {
                        console.log('[Background] RSS static page generation completed successfully');
                    } else {
                        console.log('[Background] RSS static page generation failed');
                    }
                } catch (error) {
                    console.error('[Background] RSS generation error:', error.message);
                    console.error('[Background] RSS generation stack:', error.stack);
                }
            });
        }

        // Send completion signal
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Search error:', error);
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: 'Search failed',
            answer: 'I apologize, but I encountered an issue while searching for yachts. Please try again.'
        })}\n\n`);
        res.end();
    }
});

// Legacy search endpoint for backward compatibility
app.post('/api/search-legacy', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log('Searching for:', query);

        // Make the exact Perplexity API call as specified
        const response = await axios.post('https://api.perplexity.ai/chat/completions', {
            model: 'sonar-pro',
            messages: [
                {
                    role: "system",
                    content: "You are a yacht search assistant. When asked about yachts, provide detailed information and format your response as a JSON object with 'answer' and 'sources' fields. The 'answer' should be a string with your response, and 'sources' should be an array of yacht objects, each with 'title', 'snippet', and 'url' fields."
                },
                {
                    role: "user",
                    content: `Find yachts that match this criteria: ${query}. Please provide your response in JSON format with 'answer' and 'sources' fields.`
                }
            ],
            max_tokens: 1024
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        let searchResults;
        try {
            // Try to parse the response as JSON
            const content = response.data.choices[0].message.content;
            searchResults = JSON.parse(content);
        } catch (parseError) {
            // If parsing fails, create a structured response
            const content = response.data.choices[0].message.content;
            searchResults = {
                answer: content,
                sources: []
            };
        }

        // Ensure we have the required structure
        if (!searchResults.answer) {
            searchResults.answer = "I found some yacht information for your search.";
        }
        if (!searchResults.sources || !Array.isArray(searchResults.sources)) {
            searchResults.sources = [];
        }

        // Limit results based on settings
        searchResults.sources = searchResults.sources.slice(0, settings.resultsCount);

        // Generate internal page
        await generateInternalPage(query, searchResults);

        // Update sitemap and other files
        await updateSiteFiles();

        res.json(searchResults);

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            answer: 'I apologize, but I encountered an issue while searching for yachts. Please try again.',
            sources: []
        });
    }
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
    res.json(settings);
});

app.post('/api/settings', async (req, res) => {
    try {
        const { resultsCount, rssFeeds } = req.body;
        
        if (resultsCount !== undefined) {
            settings.resultsCount = Math.max(3, Math.min(9, parseInt(resultsCount)));
        }
        
        if (rssFeeds !== undefined) {
            settings.rssFeeds = rssFeeds;
        }
        
        await saveSettings();
        res.json(settings);
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Serve search result pages
app.get('/searches/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'htdocs', 'searches', filename);
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).send('Search page not found');
        }
    });
});

// Generate internal search page
async function generateInternalPage(query, results) {
    const searchSlug = query.toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${timestamp}-${searchSlug}.html`;
    
    // Ensure searches directory exists
    try {
        await fs.mkdir('htdocs/searches', { recursive: true });
    } catch (error) {
        // Directory already exists
    }

    const pageContent = generateSearchPageHTML(query, results, filename);
    
    try {
        await fs.writeFile(`htdocs/searches/${filename}`, pageContent);
        console.log(`Generated internal page: searches/${filename}`);
    } catch (error) {
        console.error('Failed to generate internal page:', error);
    }
}

// Generate HTML for search results page
function generateSearchPageHTML(query, results, filename) {
    const currentDate = new Date().toISOString();
    const pageTitle = `${query} - Yacht Search Results | Opulent Shipyard Monaco`;
    const pageDescription = `Discover luxury yachts matching "${query}". ${results.answer.substring(0, 150)}...`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDescription}">
    
    <!-- Preconnect to Google Fonts for performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet">
    
    <!-- Load Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:type" content="website">
    <meta property="og:image" content="https://placehold.co/1200x630/E0E0E0/333333?text=Yacht%20Search%20Results">
    <meta property="og:url" content="https://opulentshipyardmonaco.com/searches/${filename}">
    <meta property="og:description" content="${pageDescription}">
    <meta property="og:site_name" content="Opulent Shipyard Monaco">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${pageTitle}">
    <meta name="twitter:description" content="${pageDescription}">
    <meta name="twitter:image" content="https://placehold.co/1200x630/E0E0E0/333333?text=Yacht%20Search%20Results">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        "name": "${pageTitle}",
        "description": "${pageDescription}",
        "url": "https://opulentshipyardmonaco.com/searches/${filename}",
        "datePublished": "${currentDate}",
        "publisher": {
            "@type": "Organization",
            "name": "Opulent Shipyard Monaco",
            "url": "https://opulentshipyardmonaco.com"
        },
        "mainEntity": {
            "@type": "SearchAction",
            "query": "${query}",
            "result": {
                "@type": "ItemList",
                "numberOfItems": ${results.sources.length},
                "itemListElement": [
                    ${results.sources.map((yacht, index) => `{
                        "@type": "ListItem",
                        "position": ${index + 1},
                        "url": "${yacht.url}",
                        "name": "${yacht.title.replace(/"/g, '\\"')}"
                    }`).join(',')}
                ]
            }
        }
    }
    </script>
    
    <style>
        body {
            font-family: 'Montserrat', sans-serif;
            background-color: #F8F8F8;
        }
        .luxurious-search-bar {
            background: linear-gradient(145deg, #ffffff, #f0f0f0);
            box-shadow: 8px 8px 16px rgba(0, 0, 0, 0.1), -8px -8px 16px rgba(255, 255, 255, 0.5);
            border: 1px solid rgba(220, 220, 220, 0.5);
        }
        .luxurious-button {
            background: linear-gradient(145deg, #e0e0e0, #ffffff);
            box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.05), -4px -4px 8px rgba(255, 255, 255, 0.3);
            border: 1px solid rgba(200, 200, 200, 0.5);
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
        
        <!-- Search Query Display -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Search Results for "${query}"</h1>
            <p class="text-gray-600">Found ${results.sources.length} yacht${results.sources.length !== 1 ? 's' : ''} matching your criteria</p>
        </div>

        <!-- Progress Bar Container -->
        <div id="search-progress-container" class="mb-6">
            <div class="w-full bg-gray-200 rounded-full h-1">
                <div id="search-progress-bar" class="bg-blue-600 h-1 rounded-full transition-all duration-300 ease-out" style="width: 0%"></div>
            </div>
        </div>

        <!-- AVA Summary (initially hidden) -->
        <div id="ava-summary" class="bg-white rounded-lg p-6 mb-8 shadow-sm border opacity-0 transform translate-y-4 transition-all duration-500 ease-out">
            <h2 class="text-xl font-semibold text-gray-800 mb-3">AVA Summary</h2>
            <p class="text-gray-700 leading-relaxed">${results.answer}</p>
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

        <!-- Results Grid -->
        <div id="results-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            ${results.sources.map((yacht, index) => {
                // Responsive initial cards: 1 on mobile, 3 on desktop
                const isMobileInitial = index < 1;
                const isDesktopInitial = index < 3;
                const isHiddenCard = index >= 1; // All cards after first are initially hidden
                return `
                <div class="yacht-card rounded-lg overflow-hidden opacity-0 transform translate-y-4 transition-all duration-500 ease-out ${isHiddenCard ? 'hidden-next-cards' : ''}"
                     data-yacht-index="${index}"
                     ${isHiddenCard ? 'style="display: none;"' : ''}>
                    <img src="${yacht.image || `https://placehold.co/400x250/E0E0E0/333333?text=Yacht%20${index + 1}`}"
                         alt="${yacht.title}"
                         class="w-full h-48 object-cover"
                         onerror="this.src='https://placehold.co/400x250/E0E0E0/333333?text=Yacht%20${index + 1}'">
                    <div class="p-4">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">${yacht.title}</h3>
                        <p class="text-gray-600 text-sm mb-3 line-clamp-3">${yacht.snippet}</p>
                        <a href="${yacht.url}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition duration-200">
                            View Yacht Details
                        </a>
                    </div>
                </div>
            `;
            }).join('')}
            
            ${results.sources.length > 1 ? `
            <!-- Show More Link (responsive text) -->
            <div id="show-more-container" class="col-span-full flex justify-center mt-6 mb-4">
                <button id="show-more-link"
                        class="text-blue-600 hover:text-blue-800 font-medium text-lg transition-colors duration-200 flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-blue-50"
                        onclick="showNextCards()">
                    <span id="show-more-text">👉 Would you like AVA to present the next results?</span>
                </button>
            </div>
            ` : ''}
        </div>

        <!-- Sources Cited -->
        <div class="mb-8">
            <p class="text-gray-600 leading-relaxed"><strong>Sources:</strong> Yacht Buyer, Boat International, Robb Report, Megayacht News, Marine Link, and other public yacht listings.</p>
        </div>

        <!-- New Search Section -->

        <!-- Social Sharing -->
        <div class="mt-8 text-center">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Share These Results</h3>
            <div class="flex justify-center space-x-4">
                <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent('https://opulentshipyardmonaco.com/searches/' + filename)}" 
                   target="_blank" 
                   class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200">
                    Share on Twitter
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://opulentshipyardmonaco.com/searches/' + filename)}" 
                   target="_blank" 
                   class="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 transition duration-200">
                    Share on Facebook
                </a>
                <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://opulentshipyardmonaco.com/searches/' + filename)}" 
                   target="_blank" 
                   class="bg-blue-800 text-white px-4 py-2 rounded hover:bg-blue-900 transition duration-200">
                    Share on LinkedIn
                </a>
            </div>
        </div>

    </main>

    <!-- Footer -->
    <footer class="w-full py-8 px-6 bg-white border-t mt-12">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
            <a href="mailto:tech@opulentshipyardmonaco.com?subject=Yacht Search Inquiry" class="text-gray-500 hover:text-gray-700 text-sm font-light">Contact</a>
            <a href="/searches/" class="text-gray-500 hover:text-gray-700 text-sm font-light">Previous Searches</a>
        </div>
    </footer>


    <!-- JavaScript for responsive pagination (1+1+1 mobile, 3+3 desktop) -->
    <script>
        // Detect if we're on mobile (same breakpoint as Tailwind's 'sm')
        function isMobile() {
            return window.innerWidth < 640;
        }
        
        // Update show more button text based on device
        function updateShowMoreText() {
            const showMoreText = document.getElementById('show-more-text');
            if (showMoreText) {
                const mobile = isMobile();
                const nextCount = mobile ? '1' : '3';
                const nextText = mobile ? 'result' : 'results';
                showMoreText.textContent = \`👉 Would you like AVA to present the next \${nextCount} \${nextText}?\`;
            }
        }
        
        // Show the next batch of pre-loaded cards with smooth animation (responsive)
        async function showNextCards() {
            const resultsGrid = document.getElementById('results-grid');
            const showMoreContainer = document.getElementById('show-more-container');
            const hiddenCards = resultsGrid.querySelectorAll('.hidden-next-cards');
            
            // Determine how many cards to show based on device type
            const cardsToShow = isMobile() ? 1 : 3;
            
            // Remove the "Show more" link immediately
            if (showMoreContainer) {
                showMoreContainer.style.transition = 'opacity 0.3s ease-out';
                showMoreContainer.style.opacity = '0';
                setTimeout(() => {
                    showMoreContainer.remove();
                }, 300);
            }
            
            // Reveal the next batch of cards with staggered animation
            for (let i = 0; i < hiddenCards.length && i < cardsToShow; i++) {
                const card = hiddenCards[i];
                
                // Show the card
                card.style.display = 'block';
                card.classList.remove('hidden-next-cards');
                card.classList.add('opacity-0', 'transform', 'translate-y-4', 'transition-all', 'duration-500', 'ease-out');
                
                // Animate in after a small delay
                const delay = isMobile() ? 200 : 300; // Faster on mobile
                setTimeout(() => {
                    card.classList.remove('opacity-0', 'translate-y-4');
                }, 50 + (i * delay)); // Staggered delay
            }
            
            // Check if there are still more cards to show and add another "Show more" link
            setTimeout(() => {
                const remainingCards = resultsGrid.querySelectorAll('.hidden-next-cards');
                if (remainingCards.length > 0) {
                    const newShowMoreContainer = document.createElement('div');
                    newShowMoreContainer.id = 'show-more-container';
                    newShowMoreContainer.className = 'col-span-full flex justify-center mt-6 mb-4';
                    
                    const mobile = isMobile();
                    const nextCount = mobile ? '1' : '3';
                    const nextText = mobile ? 'result' : 'results';
                    
                    newShowMoreContainer.innerHTML = \`
                        <button id="show-more-link"
                                class="text-blue-600 hover:text-blue-800 font-medium text-lg transition-colors duration-200 flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-blue-50"
                                onclick="showNextCards()">
                            <span>👉 Would you like AVA to present the next \${nextCount} \${nextText}?</span>
                        </button>
                    \`;
                    
                    resultsGrid.appendChild(newShowMoreContainer);
                }
            }, cardsToShow * (isMobile() ? 200 : 300) + 100);
        }
        
        // Auto-reveal initial cards on page load (responsive)
        document.addEventListener('DOMContentLoaded', function() {
            const initialCards = document.querySelectorAll('[data-yacht-index]');
            const mobile = isMobile();
            const initialCardsToShow = mobile ? 1 : 3;
            
            // Update show more button text
            updateShowMoreText();
            
            // Reveal initial cards with staggered animation
            for (let i = 0; i < Math.min(initialCardsToShow, initialCards.length); i++) {
                const card = initialCards[i];
                if (card && !card.classList.contains('hidden-next-cards')) {
                    setTimeout(() => {
                        card.classList.remove('opacity-0', 'translate-y-4');
                    }, 100 + (i * 200)); // Staggered reveal
                }
            }
            
            // Show additional cards on desktop (cards 1 and 2, since card 0 is already shown)
            if (!mobile && initialCards.length > 1) {
                for (let i = 1; i < Math.min(3, initialCards.length); i++) {
                    const card = initialCards[i];
                    if (card && card.classList.contains('hidden-next-cards')) {
                        card.style.display = 'block';
                        card.classList.remove('hidden-next-cards');
                        setTimeout(() => {
                            card.classList.remove('opacity-0', 'translate-y-4');
                        }, 100 + (i * 200));
                    }
                }
            }
            
            // Also reveal AVA summary
            const avaSummary = document.getElementById('ava-summary');
            if (avaSummary) {
                setTimeout(() => {
                    avaSummary.classList.remove('opacity-0', 'translate-y-4');
                }, 50);
            }
        });
        
        // Update text on window resize
        window.addEventListener('resize', updateShowMoreText);
    </script>

</body>
</html>`;
}

// Update site files (sitemap, llms.txt, etc.)
async function updateSiteFiles() {
    try {
        console.log('Starting parallel site file updates...');
        const startTime = Date.now();
        
        // PERFORMANCE OPTIMIZATION: Run all file updates in parallel
        await Promise.all([
            updateSitemap(),
            updateLLMsFile(),
            updateSearchesIndex()
        ]);
        
        console.log('Parallel site file updates completed in', Date.now() - startTime, 'ms');
        
    } catch (error) {
        console.error('Failed to update site files:', error);
    }
}

// Update sitemap.xml
async function updateSitemap() {
    try {
        const searchFiles = await fs.readdir('htdocs/searches').catch(() => []);
        const searchPages = searchFiles.filter(file => file.endsWith('.html'));
        
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://opulentshipyardmonaco.com/</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>https://opulentshipyardmonaco.com/searches/</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
    ${searchPages.map(page => `
    <url>
        <loc>https://opulentshipyardmonaco.com/searches/${page}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.6</priority>
    </url>`).join('')}
</urlset>`;
        
        await fs.writeFile('htdocs/sitemap.xml', sitemap);
    } catch (error) {
        console.error('Failed to update sitemap:', error);
    }
}

// Update llms.txt
async function updateLLMsFile() {
    try {
        const searchFiles = await fs.readdir('htdocs/searches').catch(() => []);
        const htmlFiles = searchFiles
            .filter(file => file.endsWith('.html'))
            .sort((a, b) => b.localeCompare(a)); // Sort by date (newest first)
        
        // Determine base URL based on environment
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const baseUrl = isDevelopment ? 'http://localhost:3000' : 'https://opulentshipyardmonaco.com';
        
        // Generate URLs for latest 100 searches (llms.txt)
        const latest100Files = htmlFiles.slice(0, 100);
        const llmsContent = latest100Files
            .map(file => `${baseUrl}/searches/${file}`)
            .join('\n');
        
        // Generate URLs for all searches (llms-full.txt)
        const llmsFullContent = htmlFiles
            .map(file => `${baseUrl}/searches/${file}`)
            .join('\n');
        
        await fs.writeFile('htdocs/llms.txt', llmsContent);
        await fs.writeFile('htdocs/llms-full.txt', llmsFullContent);
    } catch (error) {
        console.error('Failed to update LLMs file:', error);
    }
}

// Update searches index page
async function updateSearchesIndex() {
    try {
        const searchFiles = await fs.readdir('htdocs/searches').catch(() => []);
        const searchPages = searchFiles
            .filter(file => file.endsWith('.html'))
            .sort((a, b) => b.localeCompare(a)) // Sort by date (newest first)
            .slice(0, 100); // Limit to 100 most recent
        
        const indexContent = generateSearchesIndexHTML(searchPages);
        await fs.writeFile('htdocs/searches/index.html', indexContent);
    } catch (error) {
        console.error('Failed to update searches index:', error);
    }
}

// Generate searches index HTML with pagination
function generateSearchesIndexHTML(searchPages) {
    const formatTitle = (title) => {
        return title.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    // Convert search pages to data format for JavaScript
    const searchData = searchPages.map(page => {
        const title = page.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.html$/, '').replace(/-/g, ' ');
        const formattedTitle = formatTitle(title);
        const date = page.substring(0, 10);
        return {
            query: formattedTitle,
            date: date,
            file: page
        };
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Previous Searches | Opulent Shipyard Monaco</title>
    <meta name="description" content="Browse previous yacht searches and discover luxury vessels found by other users. Explore superyacht charters, Monaco yacht shows, and luxury yacht rentals.">
    <link rel="canonical" href="https://opulentshipyardmonaco.com/searches">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="Previous Searches | Opulent Shipyard Monaco">
    <meta property="og:description" content="Browse previous yacht searches and discover luxury vessels found by other users. Explore superyacht charters, Monaco yacht shows, and luxury yacht rentals.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://opulentshipyardmonaco.com/searches">
    <meta property="og:image" content="https://opulentshipyardmonaco.com/images/banner.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Opulent Shipyard Monaco">
    <meta property="og:locale" content="en_US">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Previous Searches | Opulent Shipyard Monaco">
    <meta name="twitter:description" content="Browse previous yacht searches and discover luxury vessels found by other users.">
    <meta name="twitter:image" content="https://opulentshipyardmonaco.com/images/banner.png">
    
    <!-- Schema.org Structured Data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Previous Yacht Searches",
        "description": "Browse previous yacht searches and discover luxury vessels found by other users.",
        "url": "https://opulentshipyardmonaco.com/searches",
        "numberOfItems": ${searchPages.length},
        "itemListOrder": "https://schema.org/ItemListOrderDescending",
        "itemListElement": [
            ${searchPages.slice(0, 10).map((page, index) => {
                const title = page.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.html$/, '').replace(/-/g, ' ');
                const formattedTitle = formatTitle(title);
                return `{
                    "@type": "ListItem",
                    "position": ${index + 1},
                    "name": "${formattedTitle}",
                    "url": "https://opulentshipyardmonaco.com/searches/${page}"
                }`;
            }).join(',')}
        ]
    }
    </script>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    
    <style>
        body { font-family: 'Montserrat', sans-serif; background-color: #F8F8F8; }
    </style>
</head>
<body class="min-h-screen bg-gray-50">
    
    <header class="w-full py-4 px-6 flex justify-between items-center bg-white shadow-sm">
        <div class="flex items-center">
            <img src="https://placehold.co/40x40/000000/FFFFFF?text=OSM" alt="Opulent Shipyard Monaco Logo" class="h-10 w-10 mr-2 rounded-lg">
            <a href="/" class="text-xl font-bold text-gray-800">Opulent Shipyard Monaco</a>
        </div>
        <nav>
            <ul class="flex space-x-6">
                <li><a href="/" class="text-gray-600 hover:text-gray-900 font-medium">Home</a></li>
                <li><a href="/about" class="text-gray-600 hover:text-gray-900 font-medium">About</a></li>
                <li><a href="/settings" class="text-gray-600 hover:text-gray-900 font-medium">Settings</a></li>
            </ul>
        </nav>
    </header>

    <main class="max-w-2xl mx-auto px-4 py-8 w-full">
        <h1 class="text-3xl font-bold text-gray-800 mb-8 text-center">Previous Searches</h1>
        
        <div id="search-results" class="flex flex-col space-y-6 w-full">
            <!-- Search cards will be populated here by JavaScript -->
        </div>
        
        <!-- Pagination Controls -->
        <nav id="pagination-nav" class="flex justify-center items-center mt-12 space-x-2" aria-label="Pagination" style="display: none;">
            <button id="prev-btn" class="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                Previous
            </button>
            
            <div id="page-numbers" class="flex space-x-1">
                <!-- Page numbers will be populated here -->
            </div>
            
            <button id="next-btn" class="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Next
            </button>
        </nav>
        
        ${searchPages.length === 0 ? '<p id="no-searches" class="text-gray-600 text-center py-12">No searches have been performed yet.</p>' : ''}
    </main>

    <footer class="w-full py-8 px-6 bg-white border-t mt-12">
        <div class="max-w-2xl mx-auto text-center">
            <a href="mailto:tech@opulentshipyardmonaco.com?subject=Search Inquiry" class="text-gray-500 hover:text-gray-700 text-sm font-light">Contact</a>
        </div>
    </footer>

    <script>
        // Search data from server
        const searchData = ${JSON.stringify(searchData)};

        class SearchPagination {
            constructor() {
                this.itemsPerPage = 20;
                this.currentPage = 1;
                this.totalPages = Math.ceil(searchData.length / this.itemsPerPage);
                
                this.init();
            }

            init() {
                this.parseURLParams();
                this.renderPage();
                this.bindEvents();
            }

            parseURLParams() {
                const urlParams = new URLSearchParams(window.location.search);
                const page = parseInt(urlParams.get('page')) || 1;
                this.currentPage = Math.max(1, Math.min(page, this.totalPages));
            }

            updateURL() {
                const url = new URL(window.location);
                if (this.currentPage === 1) {
                    url.searchParams.delete('page');
                } else {
                    url.searchParams.set('page', this.currentPage);
                }
                window.history.pushState({}, '', url);
            }

            renderPage() {
                this.renderSearchCards();
                this.renderPagination();
                this.updateURL();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            renderSearchCards() {
                const container = document.getElementById('search-results');
                const startIndex = (this.currentPage - 1) * this.itemsPerPage;
                const endIndex = startIndex + this.itemsPerPage;
                const pageData = searchData.slice(startIndex, endIndex);

                container.innerHTML = pageData.map(item => \`
                    <div class="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition duration-200 w-full">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2 capitalize">\${item.query.toLowerCase()}</h3>
                        <p class="text-gray-600 text-sm mb-4">Search performed on \${item.date}</p>
                        <a href="/searches/\${item.file}" class="block w-full bg-blue-600 text-white px-4 py-3 rounded text-center font-medium hover:bg-blue-700 transition duration-200 text-sm sm:text-base">
                            \${item.query}
                        </a>
                    </div>
                \`).join('');
            }

            renderPagination() {
                const prevBtn = document.getElementById('prev-btn');
                const nextBtn = document.getElementById('next-btn');
                const pageNumbers = document.getElementById('page-numbers');
                const paginationNav = document.getElementById('pagination-nav');

                // Always show pagination navigation when there are results
                if (paginationNav) {
                    paginationNav.style.display = 'flex';
                }

                // Update Previous/Next buttons
                prevBtn.disabled = this.currentPage === 1;
                nextBtn.disabled = this.currentPage === this.totalPages;

                // Generate page numbers
                let pages = [];
                const maxVisible = 5;
                let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
                let end = Math.min(this.totalPages, start + maxVisible - 1);

                if (end - start + 1 < maxVisible) {
                    start = Math.max(1, end - maxVisible + 1);
                }

                for (let i = start; i <= end; i++) {
                    pages.push(i);
                }

                pageNumbers.innerHTML = pages.map(page => \`
                    <button class="px-3 py-2 text-sm font-medium \${
                        page === this.currentPage
                            ? 'bg-blue-600 text-white border border-blue-600'
                            : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                    } \${pages.length === 1 ? 'rounded' : ''}" data-page="\${page}">
                        \${page}
                    </button>
                \`).join('');
            }

            bindEvents() {
                // Previous button
                document.getElementById('prev-btn').addEventListener('click', () => {
                    if (this.currentPage > 1) {
                        this.currentPage--;
                        this.renderPage();
                    }
                });

                // Next button
                document.getElementById('next-btn').addEventListener('click', () => {
                    if (this.currentPage < this.totalPages) {
                        this.currentPage++;
                        this.renderPage();
                    }
                });

                // Page number buttons
                document.getElementById('page-numbers').addEventListener('click', (e) => {
                    if (e.target.dataset.page) {
                        this.currentPage = parseInt(e.target.dataset.page);
                        this.renderPage();
                    }
                });

                // Handle browser back/forward
                window.addEventListener('popstate', () => {
                    this.parseURLParams();
                    this.renderPage();
                });
            }
        }

        // Initialize pagination when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            if (searchData.length > 0) {
                // Hide the "no searches" message if it exists
                const noSearchesMsg = document.getElementById('no-searches');
                if (noSearchesMsg) {
                    noSearchesMsg.style.display = 'none';
                }
                
                // Always show pagination navigation when there are results
                const paginationNav = document.getElementById('pagination-nav');
                if (paginationNav) {
                    paginationNav.style.display = 'flex';
                }
                
                // Initialize pagination
                new SearchPagination();
            }
        });
    </script>

</body>
</html>`;
}

// Settings API endpoints
app.get('/api/settings', (req, res) => {
    res.json(settings);
});

app.post('/api/settings', (req, res) => {
    try {
        // Update settings with new values
        if (req.body.resultsCount !== undefined) {
            settings.resultsCount = parseInt(req.body.resultsCount);
        }
        if (req.body.minResultsThreshold !== undefined) {
            settings.minResultsThreshold = parseInt(req.body.minResultsThreshold);
        }
        if (req.body.rssFeeds !== undefined) {
            settings.rssFeeds = req.body.rssFeeds;
        }
        
        // Save settings to file
        saveSettings();
        
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Serve settings page
app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'htdocs', 'settings.html'));
});

app.get('/settings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'htdocs', 'settings.html'));
});

// Serve RSS content directory
app.use('/rsscontent', express.static(path.join(__dirname, 'htdocs', 'rsscontent'), {
    maxAge: '1h',
    etag: true,
    lastModified: true
}));

// RSS Build API endpoint
app.post('/api/build-rss', async (req, res) => {
    try {
        console.log('RSS build requested via API');
        
        // Import and run RSS static generator
        const { generateRSSStaticPage } = require('./rss-static-generator.js');
        const success = await generateRSSStaticPage();
        
        if (success) {
            // Get the latest generated file for response
            const { getExistingRSSFiles } = require('./rss-static-generator.js');
            const existingFiles = getExistingRSSFiles();
            const latestFile = existingFiles.length > 0 ? existingFiles[0].name : null;
            
            res.json({
                success: true,
                message: 'RSS content generated successfully',
                staticPageUrl: latestFile ? `http://localhost:${PORT}/rsscontent/${latestFile}` : null,
                indexUrl: `http://localhost:${PORT}/rsscontent/`
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'RSS generation failed'
            });
        }
    } catch (error) {
        console.error('RSS build API error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'RSS build failed'
        });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'htdocs', 'index.html'));
});

// Start server
// Manual RSS trigger endpoint (localhost only)
app.post('/api/manual-rss-trigger', async (req, res) => {
    try {
        console.log('[Manual Trigger] generateRSSStaticPage(\'random\') called...');
        const { generateRSSStaticPage } = require('./rss-static-generator.js');
        const success = await generateRSSStaticPage('random');
        
        if (success) {
            res.json({ success: true, message: 'RSS static page generated successfully' });
        } else {
            res.json({ success: false, message: 'RSS static page generation failed' });
        }
    } catch (error) {
        console.error('[Manual Trigger] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Opulent Shipyard Monaco server running on port ${PORT}`);
});