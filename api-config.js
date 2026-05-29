Set-Content -Path "api-config.js" -Value @'
// API Configuration - Auto-detects environment
const API_CONFIG = {
    getBaseUrl: function() {
        // Production on Render
        if (window.location.hostname.includes('onrender.com')) {
            return 'https://futo-assignment-api.onrender.com';
        }
        // Local development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:5000';
        }
        return 'http://localhost:5000';
    }
};

const API_URL = API_CONFIG.getBaseUrl();
console.log('🌐 API URL:', API_URL);
'@