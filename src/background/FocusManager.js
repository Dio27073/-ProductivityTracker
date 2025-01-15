// src/background/FocusManager.js
export class FocusManager {
    constructor() {
        this.focusTimer = null;
        this.focusState = null;
        this.focusMode = false;
    }

    getFocusState() {
        return this.focusState || {
            isRunning: false,
            isBreak: false,
            timeLeft: 25 * 60,
            endTime: null
        };
    }

    startFocusTimer(duration, isBreak) {
        if (this.focusTimer) {
            clearInterval(this.focusTimer);
        }

        const endTime = Date.now() + (duration * 1000);
        
        this.focusState = {
            isRunning: true,
            isBreak: isBreak,
            endTime: endTime,
            timeLeft: duration
        };

        this.broadcastFocusState();

        this.focusTimer = setInterval(() => {
            const now = Date.now();
            const timeLeft = Math.ceil((endTime - now) / 1000);
            
            if (timeLeft <= 0) {
                this.handleTimerComplete();
            } else {
                this.focusState.timeLeft = timeLeft;
                this.broadcastFocusState();
            }
        }, 1000);

        return this.focusState;
    }

    stopFocusTimer() {
        if (this.focusTimer) {
            clearInterval(this.focusTimer);
            this.focusTimer = null;
        }
        this.focusState = null;
        this.broadcastFocusState();
        return this.getFocusState();
    }

    broadcastFocusState() {
        chrome.runtime.sendMessage({
            type: 'FOCUS_STATE_UPDATE',
            state: this.getFocusState()
        }).catch(error => {
            if (!error.message.includes("Could not establish connection")) {
                console.error('Error broadcasting focus state:', error);
            }
        });
    }

    handleTimerComplete() {
        const wasBreak = this.focusState?.isBreak;
        this.stopFocusTimer();
        
        const notification = {
            type: 'basic',
            iconUrl: 'assets/icons/icon48.png',
            title: wasBreak ? 'Break Complete' : 'Focus Session Complete',
            message: wasBreak ? 
                'Ready to start another focus session?' : 
                'Great work! Time for a break?'
        };
        
        chrome.notifications.create(notification);
    }

    async enableFocusMode(sites) {
        try {
            await this.disableFocusMode();
            
            const rules = sites.flatMap((site, index) => {
                const cleanSite = site.replace(/^https?:\/\//i, '')
                                    .replace(/^www\./i, '')
                                    .replace(/\/.*$/, '');
                
                return [{
                    id: index * 2 + 1,
                    priority: 1,
                    action: { 
                        type: 'redirect',
                        redirect: {
                            url: chrome.runtime.getURL('block.html')
                        }
                    },
                    condition: {
                        urlFilter: `*://*.${cleanSite}/*`,
                        resourceTypes: ['main_frame']
                    }
                },
                {
                    id: index * 2 + 2,
                    priority: 1,
                    action: { type: 'block' },
                    condition: {
                        urlFilter: `*://*.${cleanSite}/*`,
                        resourceTypes: [
                            'sub_frame', 'stylesheet', 'script',
                            'image', 'font', 'object',
                            'xmlhttprequest', 'ping', 'media',
                            'websocket'
                        ]
                    }
                }];
            });
            
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [],
                addRules: rules
            });
            
            await chrome.storage.local.set({ blockedSites: sites });
            this.focusMode = true;
            
            return { success: true, rules: await chrome.declarativeNetRequest.getDynamicRules() };
        } catch (error) {
            console.error('Error enabling focus mode:', error);
            return { success: false, error: error.message };
        }
    }
    
    async disableFocusMode() {
        try {
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const ruleIds = existingRules.map(rule => rule.id);
            
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIds,
                addRules: []
            });
        } catch (error) {
            console.error('Error disabling focus mode:', error);
        }
    }
}

export default new FocusManager();