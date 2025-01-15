export class SiteManager {
    constructor(focusMode) {
        this.focusMode = focusMode;
        this.blockedSites = new Set();
        this.initializeElements();
        this.initializeEventListeners();
        this.loadBlockedSites();
    }

    initializeElements() {
        this.siteList = document.getElementById('siteList');
        this.siteInput = document.getElementById('siteInput');
        this.addSiteBtn = document.getElementById('addSite');
    }

    initializeEventListeners() {
        this.addSiteBtn.addEventListener('click', () => this.addSite());
        this.siteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSite();
        });
        
        document.querySelectorAll('.quick-add button').forEach(button => {
            button.addEventListener('click', () => {
                const site = button.dataset.site;
                if (site) this.addSite(site);
            });
        });
    }

    async loadBlockedSites() {
        try {
            const { blockedSites } = await chrome.storage.local.get('blockedSites');
            if (blockedSites) {
                this.blockedSites = new Set(blockedSites);
                this.updateSiteList();
            }
        } catch (error) {
            console.error('Error loading blocked sites:', error);
        }
    }

    async saveBlockedSites() {
        try {
            await chrome.storage.local.set({
                blockedSites: Array.from(this.blockedSites)
            });
        } catch (error) {
            console.error('Error saving blocked sites:', error);
        }
    }

    addSite(site) {
        const siteToAdd = site || this.siteInput.value.trim().toLowerCase();
        if (!siteToAdd) return;

        // Basic URL cleaning
        const cleanSite = siteToAdd.replace(/^https?:\/\//i, '')
                                 .replace(/^www\./i, '')
                                 .split('/')[0]; // Get just the domain
        
        if (this.blockedSites.has(cleanSite)) {
            this.siteInput.value = '';
            return;
        }

        this.blockedSites.add(cleanSite);
        this.saveBlockedSites();
        this.updateSiteList();
        
        if (!site) this.siteInput.value = '';
    }

    removeSite(site) {
        this.blockedSites.delete(site);
        this.saveBlockedSites();
        this.updateSiteList();
    }

    updateSiteList() {
        this.siteList.innerHTML = '';
        
        for (const site of this.blockedSites) {
            const chip = document.createElement('div');
            chip.className = 'site-chip';
            chip.innerHTML = `
                ${site}
                <button onclick="focusMode.siteManager.removeSite('${site}')">&times;</button>
            `;
            this.siteList.appendChild(chip);
        }
    }
}