// src/background/index.js
import { TimeTracker } from './TimeTracker.js';
import focusManager from './FocusManager.js';
import limitManager from './LimitManager.js';
import storageManager from './StorageManager.js';

// Initialize the time tracker
const tracker = new TimeTracker(storageManager, limitManager);

// Initialize listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    tracker.handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
        tracker.handleTabChange(tab);
    }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
    tracker.isWindowActive = windowId !== chrome.windows.WINDOW_ID_NONE;
    if (tracker.isWindowActive) {
        tracker.resumeTracking();
    } else {
        tracker.pauseTracking();
    }
});

chrome.runtime.onStartup.addListener(() => {
    tracker.initializeSession();
    focusManager.disableFocusMode().catch(error => {
        console.error('Error clearing blocking rules:', error);
    });
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        switch (message.type) {
            case 'GET_FOCUS_STATE':
                sendResponse(focusManager.getFocusState());
                break;
            case 'START_FOCUS':
                const focusState = focusManager.startFocusTimer(message.duration, false);
                sendResponse(focusState);
                break;
            case 'START_BREAK':
                const breakState = focusManager.startFocusTimer(message.duration, true);
                sendResponse(breakState);
                break;
            case 'STOP_FOCUS':
                const stoppedState = focusManager.stopFocusTimer();
                sendResponse(stoppedState);
                break;
            case 'BLOCK_DISTRACTIONS':
                focusManager.enableFocusMode(message.sites);
                sendResponse({ success: true });
                break;
            case 'UNBLOCK_DISTRACTIONS':
                focusManager.disableFocusMode();
                sendResponse({ success: true });
                break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
    }
    return true; // Required for async response
});

// Set up periodic syncs
setInterval(() => tracker.verifyActiveTab(), 5000);
setInterval(() => tracker.syncCurrentSession(), 60000);