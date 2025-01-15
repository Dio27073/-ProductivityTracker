// src/block/utils/suggestions.js
const SUGGESTIONS = {
    social: [
        'Write in your journal instead',
        'Call a friend or family member',
        'Take a short break and stretch',
        'Practice mindful breathing'
    ],
    
    productivity: [
        'Review your to-do list',
        'Clean up your workspace',
        'Reply to important emails',
        'Plan your next project milestone'
    ],
    
    entertainment: [
        'Do a quick workout',
        'Learn something new on an educational site',
        'Work on a personal project',
        'Practice meditation or mindfulness'
    ]
};

export function customizeSuggestions(domain) {
    let suggestions;
    
    if (domain.includes('facebook') || domain.includes('twitter') || 
        domain.includes('instagram')) {
        suggestions = SUGGESTIONS.social;
    } else if (domain.includes('youtube') || domain.includes('netflix') || 
              domain.includes('reddit')) {
        suggestions = SUGGESTIONS.entertainment;
    } else {
        suggestions = SUGGESTIONS.productivity;
    }
    
    const suggestionsList = document.getElementById('suggestions');
    suggestionsList.innerHTML = suggestions
        .map(suggestion => `<li>${suggestion}</li>`)
        .join('');
}