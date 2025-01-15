// src/focus/focus.js
import { FocusMode } from './components/FocusMode.js';

let focusMode;
document.addEventListener('DOMContentLoaded', () => {
    focusMode = new FocusMode();
    // Make focusMode available globally for event handlers
    window.focusMode = focusMode;
});