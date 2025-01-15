import { StatsManager } from './StatsManager.js';
import { LimitManager } from './LimitManager.js';

class PopupManager {
    constructor() {
        this.limitManager = new LimitManager();
        this.initialize();
    }

    async initialize() {
        try {
            const data = await chrome.storage.local.get(['timeData', 'siteLimits']);
            const today = new Date().toISOString().split('T')[0];
            const todayData = data.timeData?.[today]?.domains || {};
            const siteLimits = data.siteLimits || {};

            const timeEntries = this.processTimeData(todayData, siteLimits);

            StatsManager.updateStats(timeEntries, data.timeData?.[today]?.totalTime || 0);
            StatsManager.updateBarChart(timeEntries);
            this.limitManager.updateLimitsList(siteLimits);
        } catch (error) {
            console.error('Error initializing popup:', error);
            this.showError();
        }
    }

    processTimeData(todayData, siteLimits) {
        return Object.entries(todayData)
            .map(([domain, data]) => ({
                domain,
                minutes: Math.round((data.totalTime || 0) / 60),
                visitCount: data.visitCount || 0,
                hasLimit: domain in siteLimits,
                limitMinutes: siteLimits[domain],
                percentOfLimit: domain in siteLimits ? 
                    (Math.round((data.totalTime || 0) / 60) / siteLimits[domain]) * 100 : 0
            }))
            .sort((a, b) => b.minutes - a.minutes);
    }

    showError() {
        // Implement error handling UI
        console.error('Failed to load data');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});