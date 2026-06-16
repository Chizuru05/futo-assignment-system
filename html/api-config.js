// api-config.js - Frontend API configuration
const API_URL = (() => {
    if (window.location.hostname.includes('onrender.com')) {
        return 'https://futo-assignment-system-api.onrender.com';
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://futo-assignment-system-api.onrender.com';
})();

window.API_URL = API_URL;
window.API_CONFIG = { getBaseUrl: () => API_URL };
console.log('API_URL initialized:', API_URL);

