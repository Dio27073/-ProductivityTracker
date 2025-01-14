// background.js
class TimeTracker {
  constructor() {
    this.activeTab = null;
    this.startTime = null;
    this.isWindowActive = true;
    this.pausedAt = null;
    this.notifications = {};
    this.syncTimeout = null;
    this.focusMode = false;
    
    this.initializeListeners();
    
    // More frequent syncs for active sessions
    setInterval(() => this.verifyActiveTab(), 5000);
    // Backup sync for long-running sessions
    setInterval(() => this.syncCurrentSession(), 60000);
  }

  initializeListeners() {
    // Existing listeners...

    // Add focus mode message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'BLOCK_DISTRACTIONS') {
        this.enableFocusMode(message.sites);
      } else if (message.type === 'UNBLOCK_DISTRACTIONS') {
        this.disableFocusMode();
      }
    });
  }

  async enableFocusMode(sites) {
    this.focusMode = true;
    const rules = sites.map((site, index) => ({
      id: 100000 + index, // Use high IDs to avoid conflicts with site limit rules
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: chrome.runtime.getURL('block.html?reason=focus')
        }
      },
      condition: {
        urlFilter: site,
        resourceTypes: ['main_frame']
      }
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map(r => r.id),
      addRules: rules
    });
  }

  async disableFocusMode() {
    this.focusMode = false;
    // Get all rules and remove focus mode rules (IDs 100000+)
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const focusModeRules = rules.filter(rule => rule.id >= 100000);
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: focusModeRules.map(r => r.id)
    });
  }

  initializeListeners() {
    // Tab activation changes
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      this.handleTabChange(tab);
    });

    // URL changes within tabs
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        this.handleTabChange(tab);
      }
    });

    // Window focus changes
    chrome.windows.onFocusChanged.addListener((windowId) => {
      this.isWindowActive = windowId !== chrome.windows.WINDOW_ID_NONE;
      if (this.isWindowActive) {
        this.resumeTracking();
      } else {
        this.pauseTracking();
      }
    });

    // Handle browser startup
    chrome.runtime.onStartup.addListener(() => {
      this.initializeSession();
    });
  }

  async handleTabChange(tab) {
    if (!tab.url || tab.url.startsWith('chrome://')) {
      return;
    }

    await this.syncCurrentSession();
    this.startNewSession(tab);
    
    // Check site limits on tab change
    const domain = this.extractDomain(tab.url);
    if (domain) {
      this.checkSiteLimits(domain);
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

    await this.updateTimeData(domain, sessionDuration);
    
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

  async checkSiteLimits(domain) {
    const { siteLimits } = await chrome.storage.local.get('siteLimits');
    if (!siteLimits || !siteLimits[domain]) return;

    const data = await this.getStorageData();
    const today = new Date().toISOString().split('T')[0];
    const domainData = data.timeData[today]?.domains[domain];
    
    if (!domainData) return;

    const minutesSpent = domainData.totalTime / 60;
    const limitMinutes = siteLimits[domain];

    // Check if limit is exceeded
    if (minutesSpent >= limitMinutes) {
        console.log(`Time limit reached for ${domain}: ${minutesSpent}/${limitMinutes} minutes`);
        
        // Show notification
        this.showLimitNotification(domain);
        
        try {
            // Create blocking rule
            const ruleid = this.getDomainRuleId(domain);
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [ruleid],
                addRules: [{
                    id: ruleid,
                    priority: 1,
                    action: {
                        type: "redirect",
                        redirect: {
                            url: chrome.runtime.getURL(`block.html?domain=${encodeURIComponent(domain)}`)
                        }
                    },
                    condition: {
                        urlFilter: domain,
                        resourceTypes: ["main_frame"]
                    }
                }]
            });

            // Immediately redirect current tab if it's on the blocked domain
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            if (currentTab && this.extractDomain(currentTab.url) === domain) {
                await chrome.tabs.update(currentTab.id, {
                    url: chrome.runtime.getURL(`block.html?domain=${encodeURIComponent(domain)}`)
                });
            }
        } catch (error) {
            console.error('Error setting up blocking:', error);
        }
    } else if (minutesSpent >= limitMinutes * 0.8 && !this.notifications[domain]) {
        this.showLimitWarning(domain, limitMinutes, minutesSpent);
        this.notifications[domain] = true;
    }
  }

  async updateDynamicRules(domain) {
    try {
        const ruleId = this.getDomainRuleId(domain);
        
        // Remove any existing rules for this domain
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId]
        });

        // Add the blocking rule
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [{
                id: ruleId,
                priority: 1,
                action: {
                    type: 'redirect',
                    redirect: {
                        url: chrome.runtime.getURL(`block.html?domain=${encodeURIComponent(domain)}`)
                    }
                },
                condition: {
                    urlFilter: `*://*.${domain}/*`,
                    resourceTypes: ['main_frame']
                }
            }]
        });
    } catch (error) {
        console.error('Error updating dynamic rules:', error);
    }
  }

  getDomainRuleId(domain) {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
        const char = domain.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
  }

  showLimitWarning(domain, limit, current) {
    chrome.notifications.create(`warning_${domain}`, {
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Time Limit Warning',
      message: `You've used ${Math.round(current)}/${limit} minutes on ${domain} today`
    });
  }

  showLimitNotification(domain) {
    chrome.notifications.create(`limit_${domain}`, {
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Time Limit Reached',
      message: `You've reached your time limit for ${domain}`
    });
  }

  async updateTimeData(domain, duration) {
    const data = await this.getStorageData();
    const timeData = await this.aggregateTimeData(data, domain, duration);
    await this.saveTimeData(timeData);
  }

  async getStorageData() {
    const data = await chrome.storage.local.get(['timeData', 'sessionData']);
    return {
      timeData: data.timeData || {},
      sessionData: data.sessionData || {}
    };
  }

  async aggregateTimeData(data, domain, duration) {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const hourKey = now.getHours();

    if (!data.timeData[dateKey]) {
      data.timeData[dateKey] = {
        domains: {},
        hourly: Array(24).fill(0),
        totalTime: 0
      };
    }

    if (!data.timeData[dateKey].domains[domain]) {
      data.timeData[dateKey].domains[domain] = {
        totalTime: 0,
        visitCount: 0,
        hourlyBreakdown: Array(24).fill(0)
      };
    }

    const domainData = data.timeData[dateKey].domains[domain];
    domainData.totalTime += duration;
    domainData.visitCount++;
    domainData.hourlyBreakdown[hourKey] += duration;

    data.timeData[dateKey].hourly[hourKey] += duration;
    data.timeData[dateKey].totalTime += duration;

    // Check site limits
    await this.checkSiteLimits(domain);

    // Keep only last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    Object.keys(data.timeData).forEach(date => {
      if (date < cutoffDate) {
        delete data.timeData[date];
      }
    });

    return data.timeData;
  }

  async saveTimeData(timeData) {
    await chrome.storage.local.set({ timeData });
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

// Initialize the tracker
const tracker = new TimeTracker();