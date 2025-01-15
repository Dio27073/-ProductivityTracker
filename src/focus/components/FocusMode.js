import { getRandomQuote } from '../utils/quotes';
import { SiteManager } from './SiteManager';

export class FocusMode {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.loadQuote();
        this.isRunning = false;
        this.isBreak = false;
        
        // Initialize site manager
        this.siteManager = new SiteManager(this);
        
        this.syncWithBackgroundState();
    }

    initializeElements() {
        // Timer elements
        this.timerDisplay = document.getElementById('timerDisplay');
        this.timerState = document.getElementById('timerState');
        this.startFocusBtn = document.getElementById('startFocus');
        this.startBreakBtn = document.getElementById('startBreak');
        this.stopTimerBtn = document.getElementById('stopTimer');
        this.quoteElement = document.getElementById('focusQuote');
        
        // Options
        this.autoStartBreak = document.getElementById('autoStartBreak');
        this.notifications = document.getElementById('notifications');
    }

    initializeEventListeners() {
        // Timer controls
        this.startFocusBtn.addEventListener('click', () => this.startFocusSession());
        this.startBreakBtn.addEventListener('click', () => this.startBreakSession());
        this.stopTimerBtn.addEventListener('click', () => this.stopTimer());
        
        // Options
        this.loadOptions();
        this.autoStartBreak.addEventListener('change', () => this.saveOptions());
        this.notifications.addEventListener('change', () => this.saveOptions());
        
        // Background state updates
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'FOCUS_STATE_UPDATE') {
                this.updateFromBackgroundState(message.state);
            }
        });

        // Handle window/tab visibility
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.syncWithBackgroundState();
            }
        });
    }

    async loadOptions() {
        try {
            const { focusOptions } = await chrome.storage.local.get('focusOptions');
            if (focusOptions) {
                this.autoStartBreak.checked = focusOptions.autoStartBreak ?? false;
                this.notifications.checked = focusOptions.notifications ?? true;
            }
        } catch (error) {
            console.error('Error loading options:', error);
        }
    }

    async saveOptions() {
        try {
            await chrome.storage.local.set({
                focusOptions: {
                    autoStartBreak: this.autoStartBreak.checked,
                    notifications: this.notifications.checked
                }
            });
        } catch (error) {
            console.error('Error saving options:', error);
        }
    }

    async syncWithBackgroundState() {
        try {
            const response = await this.sendMessageWithRetry({ type: 'GET_FOCUS_STATE' });
            this.updateFromBackgroundState(response);
        } catch (error) {
            console.error('Error syncing with background state:', error);
            // Use default state if sync fails
            this.updateDisplay(25 * 60);
            this.updateButtonStates();
        }
    }

    async sendMessageWithRetry(message, maxRetries = 3) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(message, response => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(response);
                        }
                    });
                });
            } catch (error) {
                if (attempt === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
            }
        }
    }

    updateFromBackgroundState(state) {
        if (!state) return;

        const { isRunning, isBreak, timeLeft, endTime } = state;
        
        // Update UI state
        this.isRunning = isRunning;
        this.isBreak = isBreak;
        
        if (isRunning && endTime) {
            const remaining = Math.ceil((endTime - Date.now()) / 1000);
            this.updateDisplay(Math.max(0, remaining));
        } else {
            this.updateDisplay(timeLeft || (this.isBreak ? 5 * 60 : 25 * 60));
        }
        
        this.updateButtonStates();
    }

    async startFocusSession() {
        if (this.siteManager.blockedSites.size > 0) {
            try {
                await chrome.runtime.sendMessage({
                    type: 'BLOCK_DISTRACTIONS',
                    sites: Array.from(this.siteManager.blockedSites)
                });
            } catch (error) {
                console.error('Error blocking sites:', error);
            }
        }

        try {
            const response = await this.sendMessageWithRetry({
                type: 'START_FOCUS',
                duration: 25 * 60
            });
            this.updateFromBackgroundState(response);
        } catch (error) {
            console.error('Error starting focus session:', error);
        }
    }

    async startBreakSession() {
        try {
            await chrome.runtime.sendMessage({ type: 'UNBLOCK_DISTRACTIONS' });
            
            const response = await this.sendMessageWithRetry({
                type: 'START_BREAK',
                duration: 5 * 60
            });
            this.updateFromBackgroundState(response);
        } catch (error) {
            console.error('Error starting break:', error);
        }
    }

    async stopTimer() {
        try {
            await chrome.runtime.sendMessage({ type: 'UNBLOCK_DISTRACTIONS' });
            
            const response = await this.sendMessageWithRetry({ type: 'STOP_FOCUS' });
            this.updateFromBackgroundState(response);
        } catch (error) {
            console.error('Error stopping timer:', error);
        }
    }

    updateDisplay(timeLeft) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        this.timerDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.timerState.textContent = this.isRunning
            ? this.isBreak ? 'Break Time' : 'Focus Time'
            : 'Ready to Focus';
    }

    updateButtonStates() {
        this.startFocusBtn.disabled = this.isRunning;
        this.startBreakBtn.disabled = this.isRunning && !this.isBreak;
        this.stopTimerBtn.disabled = !this.isRunning;
    }

    loadQuote() {
        this.quoteElement.textContent = getRandomQuote();
    }
}