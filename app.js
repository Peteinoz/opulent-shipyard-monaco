/**
 * Opulent Shipyard Monaco - Main Application JavaScript
 * Handles search functionality, UI interactions, and application logic
 */

console.log("Autocomplete script loaded - app.js");

class OpulentShipyardApp {
    constructor() {
        this.searchInput = null;
        this.discoverButton = null;
        this.isInitialized = false;
        
        // Configuration
        this.config = {
            searchEndpoint: 'https://opulentshipyardmonaco.com/search',
            apiEndpoint: 'https://api.opulentshipyardmonaco.com',
            placeholderTexts: [
                "Ask any question in natural language to find amazing results.",
                "Find your perfect superyacht...",
                "Discover luxury vessels...",
                "Search for bespoke yachts..."
            ],
            searchDelay: 300, // Debounce delay in ms
            animationDuration: 300
        };
        
        // State management
        this.state = {
            currentQuery: '',
            isSearching: false,
            searchHistory: [],
            suggestions: []
        };
        
        // Search data for staggered reveal
        this.searchData = null;
        
        // EventSource connection reference for proper cleanup
        this.currentEventSource = null;
        
        this.init();
    }
    
    /**
     * Initialize the application
     */
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupApp());
        } else {
            this.setupApp();
        }
    }
    
    /**
     * Setup the main application components
     */
    setupApp() {
        try {
            this.initializeElements();
            this.bindEvents();
            this.loadSearchHistory();
            this.initializeStructuredData();
            this.setupPlaceholderRotation();
            this.isInitialized = true;
            
            console.log('Opulent Shipyard Monaco app initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }
    
    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.searchInput = document.getElementById('natural-language-search');
        this.discoverButton = document.getElementById('discover-button');
        
        if (!this.searchInput || !this.discoverButton) {
            throw new Error('Required DOM elements not found');
        }
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Search button click - BULLETPROOF implementation
        this.discoverButton.addEventListener('click', (e) => {
            e.preventDefault();
            
            // ATOMIC CHECK AND SET - prevent any race conditions
            if (this.state.isSearching) {
                console.log('Search already in progress - click blocked');
                return;
            }
            
            // IMMEDIATELY set flag and disable button synchronously
            this.state.isSearching = true;
            this.discoverButton.disabled = true;
            this.discoverButton.textContent = 'Searching…';
            this.discoverButton.classList.add('opacity-50', 'cursor-not-allowed');
            this.discoverButton.classList.remove('hover:bg-gray-100');
            
            console.log('Button disabled immediately - starting search');
            
            // Now perform the search
            this.performSearch();
        });
        
        // Enter key press in search input - BULLETPROOF implementation
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                
                // ATOMIC CHECK AND SET - prevent any race conditions
                if (this.state.isSearching) {
                    console.log('Search already in progress - Enter key blocked');
                    return;
                }
                
                // IMMEDIATELY set flag and disable button synchronously
                this.state.isSearching = true;
                this.discoverButton.disabled = true;
                this.discoverButton.textContent = 'Searching…';
                this.discoverButton.classList.add('opacity-50', 'cursor-not-allowed');
                this.discoverButton.classList.remove('hover:bg-gray-100');
                
                console.log('Button disabled immediately via Enter key - starting search');
                
                // Now perform the search
                this.performSearch();
            }
        });
        
        // Input change for real-time suggestions (debounced)
        this.searchInput.addEventListener('input', this.debounce((e) => {
            this.handleInputChange(e.target.value);
        }, this.config.searchDelay));
        
        // Focus and blur events for enhanced UX
        this.searchInput.addEventListener('focus', () => this.handleSearchFocus());
        this.searchInput.addEventListener('blur', () => this.handleSearchBlur());
        
        // Window resize for responsive adjustments
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));
        
        // Clean up EventSource on page unload
        window.addEventListener('beforeunload', () => {
            this.closeEventSource();
        });
        
        // Clean up EventSource on page hide (mobile/tab switching)
        window.addEventListener('pagehide', () => {
            this.closeEventSource();
        });
    }
    
    /**
     * Handle search input changes
     */
    handleInputChange(value) {
        console.log("User typed: ", value);
        this.state.currentQuery = value.trim();
        
        if (this.state.currentQuery.length > 2) {
            console.log("Fetching suggestions for: ", this.state.currentQuery);
            this.fetchSuggestions(this.state.currentQuery);
        } else {
            console.log("Clearing suggestions - query too short");
            this.clearSuggestions();
        }
    }
    
    /**
     * Handle search input focus
     */
    handleSearchFocus() {
        this.searchInput.parentElement.classList.add('focused');
        if (this.state.searchHistory.length > 0 && !this.state.currentQuery) {
            this.showSearchHistory();
        }
    }
    
    /**
     * Handle search input blur
     */
    handleSearchBlur() {
        setTimeout(() => {
            this.searchInput.parentElement.classList.remove('focused');
            this.clearSuggestions();
        }, 150);
    }
    
    /**
     * Perform the main search action
     */
    async performSearch() {
        // State should already be set by event handlers, but double-check
        if (!this.state.isSearching) {
            console.warn('performSearch called but isSearching not set - this should not happen');
            this.state.isSearching = true;
            this.updateSearchButton(true);
        }
        
        const query = this.searchInput.value.trim();
        
        if (!query) {
            // Re-enable if no query
            this.state.isSearching = false;
            this.updateSearchButton(false);
            this.showEmptySearchFeedback();
            return;
        }
        
        try {
            console.log('Starting single search for:', query);
            
            // Add to search history
            this.addToSearchHistory(query);
            
            // Perform the search
            await this.executeSearch(query);
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showSearchError();
        } finally {
            // Always re-enable button, even on error
            this.state.isSearching = false;
            this.updateSearchButton(false);
            console.log('Search completed, button re-enabled');
        }
    }
    
    /**
     * Execute the actual search with progressive loading
     */
    async executeSearch(query) {
        try {
            // Initialize progressive search display
            this.initializeProgressiveSearch(query);
            
            // Use regular fetch for JSON API
            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(`/api/opensearch?query=${encodedQuery}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Search API response:', data);
            
            // Simulate the progressive search events that the UI expects
            this.handleProgressiveSearchEvent({
                type: 'status',
                message: 'Processing search results...'
            });
            
            // Simulate summary event
            this.handleProgressiveSearchEvent({
                type: 'summary',
                query: query,
                answer: this.generateAVAMessage(query, data.results?.length || 0),
                totalResults: data.results?.length || 0
            });
            
            // Simulate yacht events for each result
            if (data.results && data.results.length > 0) {
                for (let i = 0; i < data.results.length; i++) {
                    const result = data.results[i];
                    this.handleProgressiveSearchEvent({
                        type: 'yacht',
                        yacht: {
                            title: result.title,
                            description: result.description,
                            url: result.url,
                            image: result.image || '/images/banner.png', // Use fetched image or fallback
                            price: 'Contact for pricing',
                            length: 'Various sizes available'
                        }
                    });
                }
            }
            
            // Complete the search
            this.handleProgressiveSearchEvent({
                type: 'complete'
            });

        } catch (error) {
            console.error('Search API error:', error);
            this.handleProgressiveSearchEvent({
                type: 'error',
                answer: 'Search failed. Please try again.'
            });
            throw error;
        }
    }

    /**
     * Initialize the progressive search display
     */
    initializeProgressiveSearch(query) {
        // Modify the main element layout for search results
        const mainElement = document.querySelector('main');
        
        // Clear any existing results container to prevent stacking
        const existingResultsContainer = mainElement.querySelector('.progressive-search-container');
        if (existingResultsContainer) {
            existingResultsContainer.remove();
        }
        
        // Change from centered layout to top-aligned layout
        mainElement.className = 'flex-grow w-full search-container pt-8';
        
        // Get the existing search container and modify its layout
        const searchContainer = mainElement.querySelector('div');
        if (searchContainer) {
            searchContainer.className = 'w-full max-w-6xl mx-auto px-4';
        }
        
        // Create progressive results container
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'progressive-search-container mt-8 max-w-6xl mx-auto px-4';
        resultsContainer.innerHTML = this.generateProgressiveSearchHTML(query);
        
        // Add results container below the search interface
        mainElement.appendChild(resultsContainer);
        
        // Update page title
        document.title = `Searching: ${query} | Opulent Shipyard Monaco`;
    }

    /**
     * Generate initial HTML for progressive search
     */
    generateProgressiveSearchHTML(query) {
        return `
                <!-- Search Status with Progress Bar -->
                <div id="search-status" class="text-gray-600 mb-6">
                    <div class="flex items-center mb-3">
                        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        <span>Starting search...</span>
                    </div>
                    <!-- Progress Bar -->
                    <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div id="search-progress-bar" class="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out" style="width: 0%"></div>
                    </div>
                    <div class="text-xs text-gray-500">
                        <span id="progress-text">Preparing search...</span>
                    </div>
                </div>

                <!-- AVA Summary (initially hidden) -->
                <div id="ava-summary" class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8 shadow-lg border border-blue-100 hidden staggered-reveal-item">
                    <div class="flex items-start space-x-4">
                        <!-- AVA Avatar -->
                        <div class="flex-shrink-0">
                            <img src="/images/ava.png"
                                 alt="AVA Yacht Concierge Logo"
                                 class="w-14 h-14 rounded-full shadow-md object-cover border-2 border-blue-200">
                        </div>
                        <!-- AVA Content -->
                        <div class="flex-grow">
                            <div class="flex items-center mb-2">
                                <h2 class="text-lg font-semibold text-gray-800">Your Monaco Yacht Concierge</h2>
                                <div class="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                    AI Concierge
                                </div>
                            </div>
                            <div id="summary-content" class="text-gray-700 leading-relaxed italic"></div>
                        </div>
                    </div>
                </div>

                <!-- Results Grid -->
                <div id="results-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <!-- Yacht cards will be added progressively -->
                </div>


            </main>
        `;
    }

    /**
     * Handle progressive search events
     */
    handleProgressiveSearchEvent(data) {
        // Store data for staggered reveal instead of immediately showing
        switch (data.type) {
            case 'status':
                this.updateSearchStatus(data.message);
                break;

            case 'summary':
                // Store summary data for staggered reveal
                this.searchData = {
                    query: data.query,
                    answer: data.answer,
                    totalResults: data.totalResults,
                    yachts: []
                };
                document.title = `${data.query} - Yacht Search Results | Opulent Shipyard Monaco`;
                break;

            case 'yacht':
                // Collect yacht data instead of immediately showing
                if (this.searchData) {
                    this.searchData.yachts.push(data.yacht);
                }
                break;

            case 'complete':
                // Close EventSource connection immediately when search completes
                this.closeEventSource();
                // Clear the search input box
                if (this.searchInput) {
                    this.searchInput.value = '';
                }
                // Start the staggered reveal sequence
                this.startStaggeredReveal();
                break;

            case 'error':
                const statusElement = document.getElementById('search-status');
                if (statusElement) {
                    statusElement.innerHTML = `<span class="text-red-600">${data.answer}</span>`;
                }
                // Close EventSource and re-enable button on error
                this.closeEventSource();
                this.state.isSearching = false;
                this.updateSearchButton(false);
                this.resetProgressUI();
                break;
        }
    }

    /**
     * Update search status message and progress
     */
    updateSearchStatus(message) {
        const statusElement = document.getElementById('search-status');
        const progressText = document.getElementById('progress-text');
        
        if (statusElement && progressText) {
            const spinner = statusElement.querySelector('.animate-spin');
            if (spinner) {
                spinner.nextElementSibling.textContent = message;
            }
            progressText.textContent = message;
        }
    }

    /**
     * Update progress bar percentage
     */
    updateProgressBar(percentage, text = null) {
        const progressBar = document.getElementById('search-progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        if (text && progressText) {
            progressText.textContent = text;
        }
    }

    /**
     * Start the staggered reveal sequence with responsive pagination
     * Desktop: 3+3 pagination, Mobile: 1+1+1 pagination (like ChatGPT Overviews)
     * This creates the "thoughtful" reveal effect where AVA appears first,
     * then cards appear based on screen size
     */
    async startStaggeredReveal() {
        const REVEAL_DELAY = 700; // Adjustable timing for reveals
        const summaryElement = document.getElementById('ava-summary');
        const summaryContent = document.getElementById('summary-content');
        const resultsGrid = document.getElementById('results-grid');
        
        // Detect if we're on mobile (same breakpoint as Tailwind's 'sm')
        const isMobile = window.innerWidth < 640;
        const cardsPerPage = isMobile ? 1 : 3;
        
        // Initialize progress tracking (only for first batch of cards + summary)
        const initialCards = Math.min(cardsPerPage, this.searchData?.yachts?.length || 0);
        const totalSteps = 1 + initialCards; // 1 for summary + first batch of cards
        let currentStep = 0;
        
        try {
            // Step 1: Reveal AVA Summary first (the "thinking" moment)
            this.updateProgressBar(10, 'AVA is analyzing your request...');
            
            if (summaryContent && this.searchData?.answer) {
                summaryContent.textContent = this.searchData.answer;
            }
            
            if (summaryElement) {
                await this.revealElementWithAnimation(summaryElement, 'AVA has insights for you...');
                currentStep++;
                this.updateProgressBar((currentStep / totalSteps) * 80, `Found ${this.searchData?.totalResults || 0} yacht${(this.searchData?.totalResults || 0) !== 1 ? 's' : ''}`);
            }
            
            // Wait before revealing results (the "thoughtful pause")
            await this.delay(REVEAL_DELAY);
            
            // Step 2: Reveal yacht cards based on screen size (responsive pagination)
            if (this.searchData?.yachts && resultsGrid) {
                // Create all yacht cards but only reveal the first batch
                for (let i = 0; i < this.searchData.yachts.length; i++) {
                    const yacht = this.searchData.yachts[i];
                    const yachtCard = this.createYachtCard(yacht, i);
                    
                    if (i < cardsPerPage) {
                        // First batch of cards: add to grid and reveal with animation
                        yachtCard.classList.add('staggered-reveal-item');
                        resultsGrid.appendChild(yachtCard);
                        
                        // Reveal with animation
                        const cardText = isMobile ?
                            `Revealing yacht ${i + 1} of ${Math.min(cardsPerPage, this.searchData.yachts.length)}...` :
                            `Revealing yacht ${i + 1} of ${Math.min(cardsPerPage, this.searchData.yachts.length)}...`;
                        await this.revealElementWithAnimation(yachtCard, cardText);
                        
                        // Update progress
                        currentStep++;
                        const progressPercent = Math.min(90, (currentStep / totalSteps) * 80 + 10);
                        this.updateProgressBar(progressPercent);
                        
                        // Wait before next reveal (the staggered effect)
                        if (i < Math.min(cardsPerPage - 1, this.searchData.yachts.length - 1)) {
                            await this.delay(REVEAL_DELAY);
                        }
                    } else {
                        // Remaining cards: pre-load but keep hidden for instant display later
                        yachtCard.classList.add('hidden-next-cards');
                        yachtCard.style.display = 'none';
                        resultsGrid.appendChild(yachtCard);
                    }
                }
                
                // Add "Show next" link if there are more results than the first batch
                if (this.searchData.yachts.length > cardsPerPage) {
                    this.addShowMoreLink(resultsGrid, isMobile);
                }
            }
            
            // Step 3: Complete the sequence
            this.updateProgressBar(100, 'Search complete!');
            
            // Wait a moment, then re-enable button and reset UI
            await this.delay(500);
            
            // Re-enable the discover button (search is complete)
            this.state.isSearching = false;
            this.updateSearchButton(false);
            
            // Reset progress UI to idle state after completion
            await this.delay(1500); // Wait a bit longer to show "Search complete!"
            this.resetProgressUI();
            
        } catch (error) {
            console.error('Error during staggered reveal:', error);
            // Fallback: close EventSource, re-enable button, and reset UI
            this.closeEventSource();
            this.state.isSearching = false;
            this.updateSearchButton(false);
            this.resetProgressUI();
        }
    }

    /**
     * Close the current EventSource connection if it exists
     */
    closeEventSource() {
        if (this.currentEventSource) {
            console.log('Closing EventSource connection');
            this.currentEventSource.close();
            this.currentEventSource = null;
        }
    }

    /**
     * Reset progress UI to idle state
     */
    resetProgressUI() {
        const statusElement = document.getElementById('search-status');
        const progressBar = document.getElementById('search-progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (statusElement) {
            // Hide the entire progress section with fade out
            statusElement.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            statusElement.style.opacity = '0';
            statusElement.style.transform = 'scale(0.95)';
            
            // After fade out, completely hide it
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 500);
        }
        
        // Reset progress bar
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        
        // Reset progress text
        if (progressText) {
            progressText.textContent = 'Preparing search...';
        }
    }

    /**
     * Add "Show next" link below the first batch of cards (responsive)
     */
    addShowMoreLink(resultsGrid, isMobile = false) {
        const showMoreContainer = document.createElement('div');
        showMoreContainer.id = 'show-more-container';
        showMoreContainer.className = 'col-span-full flex justify-center mt-6 mb-4';
        
        const showMoreLink = document.createElement('button');
        showMoreLink.id = 'show-more-link';
        showMoreLink.className = 'text-blue-600 hover:text-blue-800 font-medium text-lg transition-colors duration-200 flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-blue-50';
        
        // Responsive text based on device type
        const nextCount = isMobile ? '1' : '3';
        const nextText = isMobile ? 'result' : 'results';
        showMoreLink.innerHTML = `
            <span>👉 Would you like AVA to present the next ${nextCount} ${nextText}?</span>
        `;
        
        showMoreLink.addEventListener('click', () => {
            this.showNextCards(isMobile);
        });
        
        showMoreContainer.appendChild(showMoreLink);
        resultsGrid.appendChild(showMoreContainer);
    }

    /**
     * Show the next batch of pre-loaded cards with smooth animation (responsive)
     */
    async showNextCards(isMobile = false) {
        const resultsGrid = document.getElementById('results-grid');
        const showMoreContainer = document.getElementById('show-more-container');
        const hiddenCards = resultsGrid.querySelectorAll('.hidden-next-cards');
        
        // Determine how many cards to show based on device type
        const cardsToShow = isMobile ? 1 : 3;
        
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
            card.classList.add('staggered-reveal-item');
            
            // Animate in
            await this.revealElementWithAnimation(card);
            
            // Small delay between cards for staggered effect (shorter on mobile)
            if (i < hiddenCards.length - 1 && i < cardsToShow - 1) {
                const delay = isMobile ? 200 : 300; // Faster on mobile for 1+1+1
                await this.delay(delay);
            }
        }
        
        // Check if there are still more cards to show and add another "Show more" link
        const remainingCards = resultsGrid.querySelectorAll('.hidden-next-cards');
        if (remainingCards.length > 0) {
            // Re-detect mobile state in case of orientation change
            const currentlyMobile = window.innerWidth < 640;
            this.addShowMoreLink(resultsGrid, currentlyMobile);
        }
    }

    /**
     * Reveal an element with smooth fade-in animation
     * @param {HTMLElement} element - Element to reveal
     * @param {string} statusText - Optional status text to show during reveal
     */
    async revealElementWithAnimation(element, statusText = null) {
        return new Promise((resolve) => {
            if (!element) {
                resolve();
                return;
            }
            
            // Update status if provided
            if (statusText) {
                this.updateSearchStatus(statusText);
            }
            
            // Remove hidden class and prepare for animation
            element.classList.remove('hidden');
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'all 0.6s ease-out';
            
            // Trigger animation on next frame
            requestAnimationFrame(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
                
                // Resolve after animation completes
                setTimeout(resolve, 600);
            });
        });
    }

    /**
     * Utility function for delays
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create a yacht card element
     */
    createYachtCard(yacht, index) {
        const cardElement = document.createElement('div');
        cardElement.className = 'yacht-card rounded-lg overflow-hidden bg-white shadow-sm border hover:shadow-md transition duration-200 hidden';
        cardElement.innerHTML = `
            <img src="${yacht.image || `https://placehold.co/400x250/E0E0E0/333333?text=Yacht%20${index + 1}`}"
                 alt="${yacht.title}"
                 class="w-full h-48 object-cover">
            <div class="p-4">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">${yacht.title}</h3>
                <p class="text-gray-600 text-sm mb-3">${yacht.snippet}</p>
                <a href="${yacht.url}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition duration-200">
                    View Yacht Details
                </a>
            </div>
        `;
        return cardElement;
    }
    
    /**
     * Show feedback for empty search
     */
    showEmptySearchFeedback() {
        const originalPlaceholder = this.searchInput.placeholder;
        this.searchInput.placeholder = "Please enter a search query...";
        this.searchInput.classList.add('error-state');
        
        setTimeout(() => {
            this.searchInput.placeholder = originalPlaceholder;
            this.searchInput.classList.remove('error-state');
        }, 2000);
    }
    
    /**
     * Show search error feedback
     */
    showSearchError() {
        const originalPlaceholder = this.searchInput.placeholder;
        this.searchInput.placeholder = "Search temporarily unavailable. Please try again.";
        this.searchInput.classList.add('error-state');
        
        setTimeout(() => {
            this.searchInput.placeholder = originalPlaceholder;
            this.searchInput.classList.remove('error-state');
        }, 3000);
    }
    
    /**
     * Update search button state - BULLETPROOF implementation
     */
    updateSearchButton(isSearching) {
        if (!this.discoverButton) {
            console.warn('Discover button not found');
            return;
        }
        
        if (isSearching) {
            // Only update if not already disabled (avoid redundant operations)
            if (!this.discoverButton.disabled) {
                this.discoverButton.disabled = true;
                this.discoverButton.textContent = 'Searching…';
                this.discoverButton.classList.add('opacity-50', 'cursor-not-allowed');
                this.discoverButton.classList.remove('hover:bg-gray-100');
                console.log('Button disabled - Searching…');
            }
        } else {
            // Re-enable button and restore text
            this.discoverButton.disabled = false;
            this.discoverButton.textContent = 'Discover';
            this.discoverButton.classList.remove('opacity-50', 'cursor-not-allowed');
            this.discoverButton.classList.add('hover:bg-gray-100');
            console.log('Button enabled - Discover');
        }
    }
    
    /**
     * Fetch search suggestions (placeholder for future API integration)
     */
    async fetchSuggestions(query) {
        // Placeholder for future API integration
        // For now, return mock suggestions based on yacht-related terms
        const mockSuggestions = this.generateMockSuggestions(query);
        this.showSuggestions(mockSuggestions);
    }
    
    /**
     * Generate mock suggestions for development
     */
    generateMockSuggestions(query) {
        const yachtTerms = [
            'luxury superyacht', 'motor yacht', 'sailing yacht', 'expedition yacht',
            'custom yacht design', 'yacht charter', 'yacht interior', 'yacht specifications',
            'Monaco yachts', 'Mediterranean yachts', 'yacht builder', 'bespoke yacht'
        ];
        
        return yachtTerms
            .filter(term => term.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
    }
    
    /**
     * Show search suggestions
     */
    showSuggestions(suggestions) {
        console.log('showSuggestions called with:', suggestions);
        const dropdown = document.getElementById('autocomplete-dropdown');
        console.log('Dropdown element found:', !!dropdown);
        
        if (!dropdown || suggestions.length === 0) {
            console.log('No dropdown or no suggestions, clearing...');
            this.clearSuggestions();
            return;
        }

        console.log('Creating dropdown with', suggestions.length, 'suggestions');
        dropdown.innerHTML = '';
        dropdown.classList.add('autocomplete-dropdown');

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item text-gray-700 hover:text-gray-900 px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0';
            item.textContent = suggestion;
            item.addEventListener('click', () => {
                // ATOMIC CHECK AND SET - prevent any race conditions
                if (this.state.isSearching) {
                    console.log('Autocomplete click blocked - search already in progress');
                    return;
                }
                
                // IMMEDIATELY set flag and disable button synchronously
                this.state.isSearching = true;
                this.discoverButton.disabled = true;
                this.discoverButton.textContent = 'Searching…';
                this.discoverButton.classList.add('opacity-50', 'cursor-not-allowed');
                this.discoverButton.classList.remove('hover:bg-gray-100');
                
                this.searchInput.value = suggestion;
                this.clearSuggestions();
                
                console.log('Button disabled immediately via autocomplete - starting search');
                this.performSearch();
            });
            dropdown.appendChild(item);
        });

        dropdown.classList.remove('hidden');
        console.log('Dropdown should now be visible');
    }
    
    /**
     * Clear search suggestions
     */
    clearSuggestions() {
        const dropdown = document.getElementById('autocomplete-dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
        }
    }
    /**
     * Generate a friendly, personal AVA message (max 70 words)
     */
    generateAVAMessage(query, resultCount) {
        const messages = [
            `Hello! I've discovered ${resultCount} stunning ${query} options for you. Each vessel represents the pinnacle of luxury craftsmanship. From Monaco's exclusive harbors to the Mediterranean's finest marinas, these yachts offer unparalleled elegance and sophistication. Let me guide you through these exceptional choices!`,
            
            `Wonderful! Your search for ${query} has revealed ${resultCount} magnificent vessels. As your Monaco yacht concierge, I'm excited to present these carefully curated options. Each yacht embodies luxury, performance, and timeless design. These selections represent the very best in maritime excellence!`,
            
            `Delighted to help! I've found ${resultCount} exquisite ${query} possibilities that match your refined taste. From sleek modern designs to classic elegance, these yachts offer the ultimate in luxury living. Each vessel promises unforgettable experiences on the world's most beautiful waters!`,
            
            `Perfect timing! Your ${query} search has uncovered ${resultCount} remarkable vessels. As Monaco's premier yacht concierge, I've handpicked these exceptional options for you. Each yacht represents superior craftsmanship, luxury amenities, and the freedom to explore the Mediterranean in absolute style!`,
            
            `Excellent choice! I've located ${resultCount} spectacular ${query} options that embody luxury and sophistication. These vessels offer the perfect blend of performance, comfort, and elegance. From intimate gatherings to grand celebrations, each yacht provides an unmatched platform for creating lasting memories!`
        ];
        
        // Select message based on query hash for consistency
        const messageIndex = Math.abs(query.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % messages.length;
        return messages[messageIndex];
    }
    
    
    /**
     * Add query to search history
     */
    addToSearchHistory(query) {
        if (!this.state.searchHistory.includes(query)) {
            this.state.searchHistory.unshift(query);
            this.state.searchHistory = this.state.searchHistory.slice(0, 10); // Keep last 10
            this.saveSearchHistory();
        }
    }
    
    /**
     * Load search history from localStorage
     */
    loadSearchHistory() {
        try {
            const history = localStorage.getItem('opulent_search_history');
            if (history) {
                this.state.searchHistory = JSON.parse(history);
            }
        } catch (error) {
            console.warn('Failed to load search history:', error);
        }
    }
    
    /**
     * Save search history to localStorage
     */
    saveSearchHistory() {
        try {
            localStorage.setItem('opulent_search_history', JSON.stringify(this.state.searchHistory));
        } catch (error) {
            console.warn('Failed to save search history:', error);
        }
    }
    
    /**
     * Show search history
     */
    showSearchHistory() {
        // Placeholder for search history UI
        console.log('Search history:', this.state.searchHistory);
    }
    
    /**
     * Initialize structured data
     */
    initializeStructuredData() {
        const structuredDataElement = document.getElementById('structured-data-json');
        if (!structuredDataElement) return;
        
        const schemaData = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": ["Organization", "Corporation"],
                    "name": "Opulent Shipyard Monaco",
                    "url": "https://opulentshipyardmonaco.com",
                    "logo": "https://placehold.co/100x100/000000/FFFFFF?text=OSM",
                    "description": "Opulent Shipyard Monaco crafts the world's most luxurious, bespoke superyachts at the heart of the Riviera, blending Monaco's legendary glamour with next-generation shipbuilding mastery.",
                    "sameAs": [
                        "https://www.linkedin.com/company/opulent-shipyard-monaco/",
                        "https://www.instagram.com/opulentshipyardmonaco/",
                        "https://twitter.com/OpulentShipyard",
                        "https://www.facebook.com/OpulentShipyardMonaco/"
                    ],
                    "contactPoint": {
                        "@type": "ContactPoint",
                        "email": "tech@opulentshipyardmonaco.com",
                        "contactType": "customer service"
                    }
                },
                {
                    "@type": "WebSite",
                    "name": "Opulent Shipyard Monaco",
                    "url": "https://opulentshipyardmonaco.com",
                    "description": "Opulent Shipyard Monaco crafts the world's most luxurious, bespoke superyachts at the heart of the Riviera, blending Monaco's legendary glamour with next-generation shipbuilding mastery.",
                    "potentialAction": {
                        "@type": "SearchAction",
                        "target": "https://opulentshipyardmonaco.com/search?q={search_term_string}",
                        "query-input": "required name=search_term_string"
                    }
                },
                {
                    "@type": ["LocalBusiness", "ProfessionalService"],
                    "name": "Opulent Shipyard Monaco",
                    "image": "https://placehold.co/800x600/E0E0E0/333333?text=Monaco%20Shipyard",
                    "address": {
                        "@type": "PostalAddress",
                        "streetAddress": "Port Hercule",
                        "addressLocality": "Monaco",
                        "addressRegion": "Monaco",
                        "postalCode": "98000",
                        "addressCountry": "MC"
                    },
                    "telephone": "+1234567890",
                    "url": "https://opulentshipyardmonaco.com",
                    "openingHoursSpecification": {
                        "@type": "OpeningHoursSpecification",
                        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                        "opens": "00:00",
                        "closes": "23:59"
                    },
                    "priceRange": "$$$$$",
                    "geo": {
                        "@type": "GeoCoordinates",
                        "latitude": 43.733334,
                        "longitude": 7.416667
                    },
                    "areaServed": "Worldwide"
                },
                {
                    "@type": "Service",
                    "name": "Bespoke Superyacht Crafting",
                    "serviceType": ["Superyacht Manufacturing", "Custom Yacht Building", "Luxury Marine Design"],
                    "description": "Nestled in the sparkling enclave of the French Riviera, Opulent Shipyard Monaco stands as the definitive symbol of prestige, innovation, and timeless luxury in the world of superyacht creation. Our shipyard is more than a manufacturing facility—it is a sanctuary where imagination, artistry, and state-of-the-art engineering converge to bring the world's most ambitious maritime visions to life. From the first pencil stroke to the champagne christening, every Opulent vessel is a bespoke masterpiece, meticulously tailored to the unique desires and lifestyles of our elite clientele. We collaborate with renowned naval architects, interior designers, and marine engineers—each a virtuoso in their field—to ensure every detail reflects the client's distinct identity and the unrivaled glamour of Monaco. Our flagship facility, overlooking the iconic Port Hercule, features cutting-edge fabrication halls, artisan workshops, and innovation labs. Here, Old World craftsmanship meets the latest in sustainable marine technology, enabling us to produce superyachts that are both peerlessly elegant and environmentally advanced. At Opulent Shipyard Monaco, every project is stewarded by a dedicated concierge team—guiding clients through the exhilarating journey from concept sketches to maiden voyage. With a philosophy rooted in absolute discretion, white-glove service, and obsessive attention to detail, we turn dreams into legends that sail the seas. The world's most discerning owners choose Opulent Shipyard Monaco because we deliver not only vessels, but legacies—creations that define eras, host unforgettable celebrations, and inspire awe in every harbor they enter. Join us in Monaco, where your yachting story becomes a living legend.",
                    "provider": {
                        "@type": "Organization",
                        "name": "Opulent Shipyard Monaco"
                    },
                    "areaServed": "Worldwide",
                    "url": "https://opulentshipyardmonaco.com",
                    "offers": {
                        "@type": "Offer",
                        "priceCurrency": "EUR",
                        "availability": "https://schema.org/InStock",
                        "itemCondition": "https://schema.org/NewCondition"
                    }
                },
                {
                    "@type": "WebPage",
                    "name": "Opulent Shipyard Monaco - Bespoke Superyacht Crafting & Natural Language Search",
                    "url": "https://opulentshipyardmonaco.com",
                    "description": "Opulent Shipyard Monaco crafts the world's most luxurious, bespoke superyachts at the heart of the Riviera, blending Monaco's legendary glamour with next-generation shipbuilding mastery.",
                    "isPartOf": {
                        "@type": "WebSite",
                        "name": "Opulent Shipyard Monaco",
                        "url": "https://opulentshipyardmonaco.com"
                    }
                }
            ]
        };
        
        structuredDataElement.textContent = JSON.stringify(schemaData, null, 2);
    }
    
    /**
     * Setup placeholder text rotation
     */
    setupPlaceholderRotation() {
        let currentIndex = 0;
        
        setInterval(() => {
            if (document.activeElement !== this.searchInput && !this.state.currentQuery) {
                currentIndex = (currentIndex + 1) % this.config.placeholderTexts.length;
                this.searchInput.placeholder = this.config.placeholderTexts[currentIndex];
            }
        }, 4000);
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        // Placeholder for responsive adjustments
        const isMobile = window.innerWidth < 640;
        document.body.classList.toggle('mobile', isMobile);
    }
    
    /**
     * Debounce utility function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Public API methods
     */
    
    /**
     * Get current application state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Set search query programmatically
     */
    setSearchQuery(query) {
        if (this.searchInput) {
            this.searchInput.value = query;
            this.state.currentQuery = query;
        }
    }
    
    /**
     * Trigger search programmatically
     */
    triggerSearch(query = null) {
        // ATOMIC CHECK AND SET - prevent any race conditions
        if (this.state.isSearching) {
            console.log('Trigger search blocked - search already in progress');
            return;
        }
        
        // IMMEDIATELY set flag and disable button synchronously
        this.state.isSearching = true;
        this.discoverButton.disabled = true;
        this.discoverButton.textContent = 'Searching…';
        this.discoverButton.classList.add('opacity-50', 'cursor-not-allowed');
        this.discoverButton.classList.remove('hover:bg-gray-100');
        
        if (query) {
            this.setSearchQuery(query);
        }
        
        console.log('Button disabled immediately via triggerSearch - starting search');
        this.performSearch();
    }
    
    /**
     * Clear search input
     */
    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
            this.state.currentQuery = '';
            this.clearSuggestions();
        }
    }
    /**
     * Display search results on the page
     */
    displaySearchResults(query, results) {
        // Hide the main search interface
        const mainElement = document.querySelector('main');
        const headerElement = document.querySelector('header');
        const footerElement = document.querySelector('footer');
        
        // Create results container
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results-container';
        resultsContainer.innerHTML = this.generateResultsHTML(query, results);
        
        // Replace main content
        document.body.innerHTML = '';
        document.body.appendChild(headerElement);
        document.body.appendChild(resultsContainer);
        document.body.appendChild(footerElement);
        
        
        // Update page title and meta
        document.title = `${query} - Yacht Search Results | Opulent Shipyard Monaco`;
        
        // Update URL without page reload
        const newUrl = `/?q=${encodeURIComponent(query)}`;
        window.history.pushState({ query, results }, '', newUrl);
    }
    
    /**
     * Generate HTML for search results
     */
    generateResultsHTML(query, results) {
        return `
            <main class="max-w-6xl mx-auto px-4 py-8">
                
                <!-- Search Query Display -->
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">Search Results for "${query}"</h1>
                    <p class="text-gray-600">Found ${results.sources.length} yacht${results.sources.length !== 1 ? 's' : ''} matching your criteria</p>
                </div>

                <!-- AVA Summary -->
                <div class="bg-white rounded-lg p-6 mb-8 shadow-sm border">
                    <h2 class="text-xl font-semibold text-gray-800 mb-3">AVA Summary</h2>
                    <p class="text-gray-700 leading-relaxed">${results.answer}</p>
                </div>

                <!-- Results Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    ${results.sources.map((yacht, index) => `
                        <div class="yacht-card rounded-lg overflow-hidden bg-white shadow-sm border hover:shadow-md transition duration-200">
                            <img src="${yacht.image || `https://placehold.co/400x250/E0E0E0/333333?text=Yacht%20${index + 1}`}"
                                 alt="${yacht.title}"
                                 class="w-full h-48 object-cover">
                            <div class="p-4">
                                <h3 class="text-lg font-semibold text-gray-800 mb-2">${yacht.title}</h3>
                                <p class="text-gray-600 text-sm mb-3">${yacht.snippet}</p>
                                <a href="${yacht.url}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   class="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition duration-200">
                                    View Yacht Details
                                </a>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- New Search Section -->
                <div class="bg-white rounded-lg p-8 shadow-sm border">
                    <h2 class="text-2xl font-semibold text-gray-800 mb-4 text-center">Search for More Yachts</h2>
                    <div class="flex w-full max-w-2xl mx-auto rounded-full overflow-hidden luxurious-search-bar">
                        <input
                            type="text"
                            id="new-search-input"
                            placeholder="Ask any question in natural language to find amazing results."
                            class="flex-grow p-4 text-lg bg-transparent border-none focus:outline-none placeholder-gray-500 rounded-l-full"
                        >
                        <button
                            id="new-search-button"
                            class="luxurious-button px-6 text-gray-800 font-semibold rounded-r-full hover:bg-gray-100 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            Discover
                        </button>
                    </div>
                </div>

            </main>
        `;
    }
    
    
    /**
     * Handle browser back/forward navigation
     */
    handlePopState() {
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.query) {
                this.displaySearchResults(event.state.query, event.state.results);
            } else {
                // Reload the page to show the main search interface
                window.location.reload();
            }
        });
    }
}

// Initialize the application
const opulentApp = new OpulentShipyardApp();

// Handle URL parameters on page load
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    if (query) {
        // Small delay to ensure app is fully initialized
        setTimeout(() => {
            opulentApp.setSearchQuery(query);
            opulentApp.performSearch();
        }, 100);
    }
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpulentShipyardApp;
}

// Global access for debugging
window.OpulentApp = opulentApp;