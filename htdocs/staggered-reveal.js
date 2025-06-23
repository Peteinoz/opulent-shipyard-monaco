/**
 * Staggered Results Reveal Script
 * Handles progressive display of search results with streaming effect
 */

document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const STAGGER_DELAY = 350; // Delay between each yacht card reveal (ms)
    const AVA_DELAY = 200; // Delay before showing AVA summary (ms)
    const PROGRESS_COMPLETE_DELAY = 500; // Delay before hiding progress bar after all results shown
    
    // Get all yacht cards and AVA summary
    const avaElement = document.querySelector('.bg-white.rounded-lg.p-6.mb-8.shadow-sm.border');
    const yachtCards = document.querySelectorAll('.yacht-card');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const discoverButton = document.getElementById('discover-button');
    
    // Initially hide all elements
    function hideAllElements() {
        if (avaElement) {
            avaElement.style.opacity = '0';
            avaElement.style.transform = 'translateY(20px)';
            avaElement.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        }
        
        yachtCards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        });
    }
    
    // Show progress bar
    function showProgressBar() {
        if (progressContainer && progressBar) {
            // Create and inject progress bar if it doesn't exist
            if (!progressContainer) {
                const progressHTML = `
                    <div id="progress-container" class="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-3 mb-6 opacity-0 transition-opacity duration-300">
                        <div id="progress-bar" class="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transform -translate-x-full transition-transform ease-out"></div>
                    </div>
                `;
                const mainContent = document.querySelector('main');
                if (mainContent) {
                    mainContent.insertAdjacentHTML('afterbegin', progressHTML);
                }
            }
            
            const container = document.getElementById('progress-container');
            const bar = document.getElementById('progress-bar');
            
            if (container && bar) {
                container.style.opacity = '1';
                bar.style.transitionDuration = '2s';
                bar.style.transform = 'translateX(-10%)'; // Fill to 90%
            }
        }
    }
    
    // Complete progress bar
    function completeProgressBar() {
        const container = document.getElementById('progress-container');
        const bar = document.getElementById('progress-bar');
        
        if (container && bar) {
            // Fill to 100%
            bar.style.transitionDuration = '300ms';
            bar.style.transform = 'translateX(0%)';
            
            // Fade out after delay
            setTimeout(() => {
                container.style.opacity = '0';
                // Re-enable discover button if it exists
                if (discoverButton) {
                    discoverButton.disabled = false;
                }
            }, PROGRESS_COMPLETE_DELAY);
        }
    }
    
    // Show AVA summary
    function showAVA() {
        if (avaElement) {
            avaElement.style.opacity = '1';
            avaElement.style.transform = 'translateY(0)';
        }
    }
    
    // Show yacht card with animation
    function showYachtCard(card, index) {
        if (card) {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * STAGGER_DELAY);
        }
    }
    
    // Main reveal sequence
    function startRevealSequence() {
        // Step 1: Show progress bar
        showProgressBar();
        
        // Step 2: Show AVA summary first
        setTimeout(() => {
            showAVA();
        }, AVA_DELAY);
        
        // Step 3: Show yacht cards one by one
        yachtCards.forEach((card, index) => {
            showYachtCard(card, index + 1); // +1 to account for AVA delay
        });
        
        // Step 4: Complete progress bar after all cards are shown
        const totalRevealTime = AVA_DELAY + (yachtCards.length * STAGGER_DELAY) + 500;
        setTimeout(() => {
            completeProgressBar();
        }, totalRevealTime);
    }
    
    // Initialize the reveal sequence
    function init() {
        // Only run if we have yacht cards (i.e., this is a search results page)
        if (yachtCards.length > 0) {
            hideAllElements();
            
            // Start the reveal sequence after a brief delay
            setTimeout(() => {
                startRevealSequence();
            }, 100);
        }
    }
    
    // Check if page was loaded from cache (back button)
    if (performance.navigation.type === performance.navigation.TYPE_BACK_FORWARD) {
        // Skip animation if user navigated back
        return;
    }
    
    // Start the initialization
    init();
});