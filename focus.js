// focus.js
class FocusMode {
    constructor() {
        this.timeLeft = 25 * 60; // 25 minutes in seconds
        this.isRunning = false;
        this.isBreak = false;
        this.timer = null;
        this.initializeElements();
        this.initializeEventListeners();
        this.loadQuote();
    }

    initializeElements() {
        this.timerDisplay = document.getElementById('timerDisplay');
        this.timerState = document.getElementById('timerState');
        this.startFocusBtn = document.getElementById('startFocus');
        this.startBreakBtn = document.getElementById('startBreak');
        this.stopTimerBtn = document.getElementById('stopTimer');
        this.quoteElement = document.getElementById('focusQuote');
    }

    initializeEventListeners() {
        this.startFocusBtn.addEventListener('click', () => this.startFocusSession());
        this.startBreakBtn.addEventListener('click', () => this.startBreakSession());
        this.stopTimerBtn.addEventListener('click', () => this.stopTimer());
    }

    async startFocusSession() {
        this.isBreak = false;
        this.timeLeft = 25 * 60;
        await this.startTimer();
        this.blockDistractions();
        this.loadQuote();
    }

    async startBreakSession() {
        this.isBreak = true;
        this.timeLeft = 5 * 60;
        await this.startTimer();
        this.unblockDistractions();
    }

    async startTimer() {
        this.isRunning = true;
        this.updateButtonStates();
        this.updateDisplay();

        // Save timer state
        await chrome.storage.local.set({
            focusState: {
                timeLeft: this.timeLeft,
                isRunning: true,
                isBreak: this.isBreak,
                startTime: Date.now()
            }
        });

        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();

            if (this.timeLeft <= 0) {
                this.handleTimerComplete();
            }
        }, 1000);
    }

    async stopTimer() {
        clearInterval(this.timer);
        this.isRunning = false;
        this.timeLeft = 25 * 60;
        this.updateButtonStates();
        this.updateDisplay();
        this.unblockDistractions();

        await chrome.storage.local.remove('focusState');
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
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

    async handleTimerComplete() {
        clearInterval(this.timer);
        this.isRunning = false;
        
        if (this.isBreak) {
            this.timeLeft = 25 * 60;
            this.showNotification('Break Complete', 'Ready to start another focus session?');
        } else {
            this.timeLeft = 5 * 60;
            this.showNotification('Focus Session Complete', 'Great work! Time for a break?');
            this.startBreakBtn.disabled = false;
        }

        this.updateDisplay();
        this.updateButtonStates();
        await chrome.storage.local.remove('focusState');
    }

    async blockDistractions() {
        const { distractingSites } = await chrome.storage.local.get('distractingSites');
        if (distractingSites) {
            // Implement site blocking during focus mode
            await chrome.runtime.sendMessage({
                type: 'BLOCK_DISTRACTIONS',
                sites: distractingSites
            });
        }
    }

    async unblockDistractions() {
        await chrome.runtime.sendMessage({ type: 'UNBLOCK_DISTRACTIONS' });
    }

    showNotification(title, message) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: title,
            message: message
        });
    }

    async loadQuote() {
        const quotes = [
            "The secret of getting ahead is getting started.",
            "Focus on being productive instead of busy.",
            "It's not about having time, it's about making time.",
            "Do the hard work especially when you don't feel like it.",
            "Small progress is still progress."
        ];
        this.quoteElement.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    }
}

// Initialize Focus Mode
document.addEventListener('DOMContentLoaded', () => {
    const focusMode = new FocusMode();
});