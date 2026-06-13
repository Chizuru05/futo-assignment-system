// api-config.js - Frontend API configuration
// Always use production backend URL when deployed on Render
const API_URL = (() => {
    // Check if we're on Render
    if (window.location.hostname.includes('onrender.com')) {
        return 'https://futo-assignment-system-api.onrender.com';
    }
    // Local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    // Default to production
    return 'https://futo-assignment-system-api.onrender.com';
})();

// Make it globally available
window.API_URL = API_URL;
window.API_CONFIG = { getBaseUrl: () => API_URL };

console.log('✅ API_URL initialized:', API_URL);
console.log('🌐 Environment:', window.location.hostname.includes('onrender.com') ? 'Production' : 'Development');