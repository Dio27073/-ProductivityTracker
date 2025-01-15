// src/background/StorageManager.js
export class StorageManager {
    async getStorageData() {
        const data = await chrome.storage.local.get(['timeData', 'sessionData']);
        return {
            timeData: data.timeData || {},
            sessionData: data.sessionData || {}
        };
    }

    async saveTimeData(timeData) {
        await chrome.storage.local.set({ timeData });
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
}

export default new StorageManager();