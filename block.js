// block.js
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get the blocked domain from URL parameters
        const params = new URLSearchParams(window.location.search);
        const domain = params.get('domain');
        
        if (domain) {
            const data = await chrome.storage.local.get(['timeData', 'siteLimits']);
            const today = new Date().toISOString().split('T')[0];
            const timeSpent = data.timeData?.[today]?.domains?.[domain]?.totalTime || 0;
            const limit = data.siteLimits?.[domain] || 0;
            
            // Update the display
            document.getElementById('timeSpent').textContent = 
                `${Math.round(timeSpent / 60)}m`;
            document.getElementById('timeLimit').textContent = 
                `${limit}m`;

            // Add domain information
            const title = document.querySelector('h1');
            if (title) {
                title.textContent = `Time Limit Reached for ${domain}`;
            }

            // Prevent navigation back to the blocked site
            history.pushState(null, '', window.location.href);
            window.addEventListener('popstate', () => {
                history.pushState(null, '', window.location.href);
            });
        }
    } catch (error) {
        console.error('Error in block.js:', error);
    }
});