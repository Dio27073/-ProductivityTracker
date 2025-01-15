// src/focus/utils/quotes.js
export const FOCUS_QUOTES = [
    "The secret of getting ahead is getting started.",
    "Focus on being productive instead of busy.",
    "It's not about having time, it's about making time.",
    "Do the hard work especially when you don't feel like it.",
    "Small progress is still progress.",
    "Stay focused on your goals.",
    "One task at a time.",
    "Deep work leads to great results.",
    "Your focus determines your reality.",
    "Concentrate all your thoughts upon the work in hand."
];

export function getRandomQuote() {
    return FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];
}