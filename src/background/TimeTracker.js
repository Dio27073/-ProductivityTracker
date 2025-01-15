// src/background/TimeTracker.js
import { StorageManager } from './StorageManager.js';
import { LimitManager } from './LimitManager.js';

export class TimeTracker {
    constructor() {
        this.activeTab = null;
        this.startTime = null;
        this.isWindowActive = true;
        this.pausedAt = null;
        this.syncTimeout = null;
    }

    async handleTabChange(tab) {
        if (!tab.url || tab.url.startsWith('chrome://')) {
            return;
        }

        await this.syncCurrentSession();
        this.startNewSession(tab);
        
        const domain = this.extractDomain(tab.url);
        if (domain) {
            const data = await StorageManager.getStorageData();
            LimitManager.checkSiteLimits(domain, data.timeData);
        }
    }

    startNewSession(tab) {
        this.activeTab = tab;
        this.startTime = Date.now();
        this.pausedAt = null;
    }

    pauseTracking() {
        if (this.startTime && !this.pausedAt) {
            this.pausedAt = Date.now();
            this.syncCurrentSession();
        }
    }

    resumeTracking() {
        if (this.pausedAt && this.activeTab) {
            const pauseDuration = Date.now() - this.pausedAt;
            this.startTime = this.startTime + pauseDuration;
            this.pausedAt = null;
        }
    }

    async syncCurrentSession() {
        if (!this.activeTab || !this.startTime || !this.isWindowActive) {
            return;
        }

        const domain = this.extractDomain(this.activeTab.url);
        if (!domain) return;

        const endTime = this.pausedAt || Date.now();
        const sessionDuration = (endTime - this.startTime) / 1000;

        if (sessionDuration < 1) return;

        const data = await StorageManager.getStorageData();
        const timeData = await StorageManager.aggregateTimeData(data, domain, sessionDuration);
        await StorageManager.saveTimeData(timeData);
        
        if (!this.pausedAt) {
            this.startTime = Date.now();
            
            if (this.syncTimeout) {
                clearTimeout(this.syncTimeout);
            }
            this.syncTimeout = setTimeout(() => this.syncCurrentSession(), 5000);
        }
    }

    extractDomain(url) {
        try {
            const hostname = new URL(url).hostname;
            return hostname.replace(/^www\./, '');
        } catch (e) {
            console.error('Invalid URL:', url);
            return null;
        }
    }

    async verifyActiveTab() {
        try {
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (currentTab && (!this.activeTab || currentTab.id !== this.activeTab.id || currentTab.url !== this.activeTab.url)) {
                this.handleTabChange(currentTab);
            }
        } catch (error) {
            console.error('Error in verifyActiveTab:', error);
        }
    }

    async initializeSession() {
        this.activeTab = null;
        this.startTime = null;
        this.pausedAt = null;
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            this.handleTabChange(tab);
        }
    }
}

export default new TimeTracker();