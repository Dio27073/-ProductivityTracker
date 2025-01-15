// src/block/block.js
import { customizeSuggestions } from './utils/suggestions';

class BlockPage {
    constructor() {
        this.initializeEventListeners();
    }

    async initializeEventListeners() {
        try {
            // Get URL parameters
            const params = new URLSearchParams(window.location.search);
            const domain = params.get('domain');
            const reason = params.get('reason');
            
            if (domain || reason === 'focus') {
                await this.handleBlockedSite(domain, reason);
                this.preventNavigation();
            }
            
            // Add focus mode button handler
            const focusButton = document.getElementById('startFocus');
            if (focusButton) {
                focusButton.addEventListener('click', () => this.startFocusSession());
            }
        } catch (error) {
            console.error('Error initializing block page:', error);
        }
    }

    async handleBlockedSite(domain, reason) {
        if (reason === 'focus') {
            this.updateForFocusMode();
        } else {
            await this.updateForTimeLimitReached(domain);
        }
    }

    updateForFocusMode() {
        document.querySelector('h1').textContent = 'Focus Mode Active';
        document.getElementById('mainMessage').textContent = 
            'This site is blocked during your focus session.';
    }

    async updateForTimeLimitReached(domain) {
        const data = await chrome.storage.local.get(['timeData', 'siteLimits']);
        const today = new Date().toISOString().split('T')[0];
        const timeSpent = data.timeData?.[today]?.domains?.[domain]?.totalTime || 0;
        const limit = data.siteLimits?.[domain] || 0;
        
        this.updateStatistics(timeSpent, limit);
        this.updateTitle(domain);
        customizeSuggestions(domain);
    }

    updateStatistics(timeSpent, limit) {
        document.getElementById('timeSpent').textContent = 
            `${Math.round(timeSpent / 60)}m`;
        document.getElementById('timeLimit').textContent = 
            `${limit}m`;
        
        const percentage = Math.min((timeSpent / (limit * 60)) * 100, 100);
        document.getElementById('progressBar').style.width = `${percentage}%`;
    }

    updateTitle(domain) {
        document.querySelector('h1').textContent = 
            `Time Limit Reached for ${domain}`;
    }

    preventNavigation() {
        history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', () => {
            history.pushState(null, '', window.location.href);
        });
    }

    startFocusSession() {
        chrome.runtime.sendMessage({
            type: 'START_FOCUS',
            duration: 25 * 60
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BlockPage();
});