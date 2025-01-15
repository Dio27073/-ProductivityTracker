export class StatsManager {
    static async updateStats(timeEntries, totalSeconds) {
        const totalTimeElement = document.getElementById('totalTime');
        const topSiteElement = document.getElementById('topSite');
        
        if (totalTimeElement && topSiteElement) {
            const totalMinutes = Math.round(totalSeconds / 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            
            totalTimeElement.textContent = `${hours}h ${minutes}m`;
            topSiteElement.textContent = timeEntries.length > 0 ? timeEntries[0].domain : '-';
        }
    }

    static updateBarChart(timeEntries) {
        const barChart = document.getElementById('barChart');
        if (!barChart) return;
        
        barChart.innerHTML = '';
        
        if (timeEntries.length === 0) {
            barChart.innerHTML = '<div class="bar-item">No data recorded yet today</div>';
            return;
        }

        const maxMinutes = Math.max(...timeEntries.map(entry => entry.minutes), 1);
        
        timeEntries.slice(0, 10).forEach(entry => {
            const percentage = (entry.minutes / maxMinutes) * 100;
            const barItem = document.createElement('div');
            barItem.className = 'bar-item';
            
            const barClass = entry.hasLimit && entry.percentOfLimit >= 80 ? 'bar warning' : 'bar';
            
            barItem.innerHTML = `
                <div class="bar-label" title="${entry.domain}">
                    ${entry.domain}
                    <span class="visit-count">(${entry.visitCount} visits)</span>
                </div>
                <div class="bar-wrapper">
                    <div class="${barClass}" style="width: ${percentage}%"></div>
                    ${entry.hasLimit ? `
                        <div class="limit-indicator" style="left: ${(entry.limitMinutes / maxMinutes) * 100}%"></div>
                    ` : ''}
                </div>
                <div class="bar-value">
                    ${entry.minutes}m
                    ${entry.hasLimit ? `/${entry.limitMinutes}m` : ''}
                </div>
            `;
            
            barChart.appendChild(barItem);
        });
    }
}