export class LimitManager {
    constructor() {
        this.setupLimitForm();
    }

    updateLimitsList(siteLimits) {
        const limitsList = document.getElementById('limitsList');
        if (!limitsList) return;
        
        limitsList.innerHTML = '';
        
        Object.entries(siteLimits).forEach(([domain, minutes]) => {
            const item = document.createElement('div');
            item.className = 'limit-item';
            item.innerHTML = `
                <span>${domain}: ${minutes}m</span>
                <button class="remove-limit" data-domain="${domain}">×</button>
            `;
            limitsList.appendChild(item);
        });
        
        this.setupRemoveHandlers();
    }

    setupRemoveHandlers() {
        document.querySelectorAll('.remove-limit').forEach(button => {
            button.addEventListener('click', async () => {
                const domain = button.dataset.domain;
                const limits = await chrome.storage.local.get('siteLimits');
                delete limits.siteLimits[domain];
                await chrome.storage.local.set(limits);
                this.updateLimitsList(limits.siteLimits);
            });
        });
    }

    setupLimitForm() {
        const limitForm = document.getElementById('limitForm');
        if (!limitForm) return;
        
        limitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const siteInput = document.getElementById('site');
            const minutesInput = document.getElementById('minutes');
            
            if (!siteInput || !minutesInput) return;
            
            const site = siteInput.value.trim();
            const minutes = parseInt(minutesInput.value);
            
            if (!site || isNaN(minutes)) return;
            
            try {
                const limits = await chrome.storage.local.get('siteLimits');
                const siteLimits = limits.siteLimits || {};
                siteLimits[site] = minutes;
                
                await chrome.storage.local.set({ siteLimits });
                
                siteInput.value = '';
                minutesInput.value = '';
                this.updateLimitsList(siteLimits);
                
            } catch (error) {
                console.error('Error setting time limit:', error);
                alert('Failed to set time limit. Please try again.');
            }
        });
    }
}