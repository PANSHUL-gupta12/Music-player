const fs = require('fs');
const path = require('path');

// Read Spotify credentials from environment variables
const clientID = process.env.SPOTIFY_CLIENT_ID || '';
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';

const dirPath = path.join(__dirname, 'ASSETS', 'js');
const configFilePath = path.join(dirPath, 'config.js');

// If running locally, config.js exists, and no env vars are defined, skip overwrite to preserve local keys
if (fs.existsSync(configFilePath) && !process.env.SPOTIFY_CLIENT_ID) {
    console.log('ℹ️ Local ASSETS/js/config.js already exists and SPOTIFY_CLIENT_ID is not set. Skipping generation to preserve local config.');
    process.exit(0);
}

// We dynamically determine redirect_uri using window.location.origin
const configContent = `// ==========================================
// Spotify Configuration — Generated during build
// ==========================================

const SPOTIFY_CONFIG = {
    CLIENT_ID: '${clientID}',
    CLIENT_SECRET: '${clientSecret}',
    REDIRECT_URI: window.location.origin + '/callback.html',
    SCOPES: [
        'streaming',
        'user-read-email',
        'user-read-private',
        'user-modify-playback-state',
        'user-read-playback-state'
    ].join(' ')
};
`;

if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
}

fs.writeFileSync(configFilePath, configContent);
console.log('✅ config.js generated successfully at ASSETS/js/config.js');
