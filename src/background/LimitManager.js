// src/background/LimitManager.js
export class LimitManager {
    constructor() {
        this.notifications = {};
    }

    async checkSiteLimits(domain, timeData) {
        const { siteLimits } = await chrome.storage.local.get('siteLimits');
        if (!siteLimits || !siteLimits[domain]) return;

        const today = new Date().toISOString().split('T')[0];
        const domainData = timeData[today]?.domains[domain];
        
        if (!domainData) return;

        const minutesSpent = domainData.totalTime / 60;
        const limitMinutes = siteLimits[domain];

        if (minutesSpent >= limitMinutes) {
            this.showLimitNotification(domain);
            await this.updateDynamicRules(domain);
        } else if (minutesSpent >= limitMinutes * 0.8 && !this.notifications[domain]) {
            this.showLimitWarning(domain, limitMinutes, minutesSpent);
            this.notifications[domain] = true;
        }
    }

    async updateDynamicRules(domain) {
        try {
            const ruleId = this.getDomainRuleId(domain);
            
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [ruleId],
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
                        urlFilter: `*://*${domain}/*`,
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
            iconUrl: 'assets/icons/icon48.png',
            title: 'Time Limit Warning',
            message: `You've used ${Math.round(current)}/${limit} minutes on ${domain} today`
        });
    }

    showLimitNotification(domain) {
        chrome.notifications.create(`limit_${domain}`, {
            type: 'basic',
            iconUrl: 'assets/icons/icon48.png',
            title: 'Time Limit Reached',
            message: `You've reached your time limit for ${domain}`
        });
    }
}

export default new LimitManager();