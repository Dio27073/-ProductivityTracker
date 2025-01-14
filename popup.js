// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await chrome.storage.local.get(['timeData', 'siteLimits']);
    const today = new Date().toISOString().split('T')[0];
    const todayData = data.timeData?.[today]?.domains || {};
    const siteLimits = data.siteLimits || {};

    // Process data for visualization
    const timeEntries = Object.entries(todayData)
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

    updateStats(timeEntries, data.timeData?.[today]?.totalTime || 0);
    updateBarChart(timeEntries);
    updateLimitsList(siteLimits);
    
    // Set up form handlers
    setupLimitForm();
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError();
  }
});

function updateStats(timeEntries, totalSeconds) {
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

function updateBarChart(timeEntries) {
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
    
    // Add warning class if approaching limit
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

function updateLimitsList(siteLimits) {
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
  
  // Add remove limit handlers
  document.querySelectorAll('.remove-limit').forEach(button => {
    button.addEventListener('click', async () => {
      const domain = button.dataset.domain;
      const limits = await chrome.storage.local.get('siteLimits');
      delete limits.siteLimits[domain];
      await chrome.storage.local.set(limits);
      updateLimitsList(limits.siteLimits);
    });
  });
}

function setupLimitForm() {
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
      
      // Clear form and update display
      siteInput.value = '';
      minutesInput.value = '';
      updateLimitsList(siteLimits);
      
    } catch (error) {
      console.error('Error setting time limit:', error);
      alert('Failed to set time limit. Please try again.');
    }
  });
}