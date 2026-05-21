// ==========================================
// Spotify Configuration Template
// ==========================================
// 1. Copy this file and rename to: config.js
// 2. Fill in your Spotify credentials below
// 3. config.js is gitignored — your secrets stay local
// ==========================================

const SPOTIFY_CONFIG = {
    CLIENT_ID: 'YOUR_SPOTIFY_CLIENT_ID_HERE',
    CLIENT_SECRET: 'YOUR_SPOTIFY_CLIENT_SECRET_HERE',
    REDIRECT_URI: window.location.origin + '/callback.html',
    SCOPES: [
        'streaming',
        'user-read-email',
        'user-read-private',
        'user-modify-playback-state',
        'user-read-playback-state'
    ].join(' ')
};
