// src/focus/components/OptionsManager.js
export class OptionsManager {
    constructor() {
        this.autoStartBreak = document.getElementById('autoStartBreak');
        this.notifications = document.getElementById('notifications');
        
        this.initializeEventListeners();
        this.loadOptions();
    }

    initializeEventListeners() {
        this.autoStartBreak.addEventListener('change', () => this.saveOptions());
        this.notifications.addEventListener('change', () => this.saveOptions());
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
}