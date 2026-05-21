// ==========================================
// Spotify OAuth — Authorization Code with PKCE
// ==========================================
// 
// HOW PKCE (Proof Key for Code Exchange) WORKS:
//
// PKCE is designed for apps that can't keep a secret (like browser JS).
// Instead of a client secret, it uses a one-time cryptographic challenge.
//
// Step 1: Generate a random "code_verifier" (43-128 character string)
// Step 2: Create "code_challenge" = base64url(SHA-256(code_verifier))
// Step 3: Send user to Spotify login with the code_challenge
// Step 4: Spotify redirects back with an authorization code
// Step 5: Exchange the code + code_verifier for tokens
//         (Spotify verifies that SHA-256(code_verifier) === code_challenge)
//
// This prevents attackers from intercepting the auth code and using it,
// because they don't have the original code_verifier.
//
// WHY POPUP?
// We use a popup window instead of redirecting the main page, so the user
// stays on their artist page and doesn't lose their place in the player.
// ==========================================

const SpotifyAuth = {

    // ─── Token Storage Keys ───
    TOKEN_KEY: 'spotify_access_token',
    REFRESH_KEY: 'spotify_refresh_token',
    EXPIRY_KEY: 'spotify_token_expiry',
    VERIFIER_KEY: 'spotify_code_verifier',

    /**
     * CHECK IF USER IS LOGGED IN
     * Returns true if we have a valid (non-expired) access token
     */
    isLoggedIn() {
        const token = localStorage.getItem(this.TOKEN_KEY);
        const expiry = localStorage.getItem(this.EXPIRY_KEY);
        return token && expiry && Date.now() < parseInt(expiry);
    },

    /**
     * GET THE CURRENT ACCESS TOKEN
     * Auto-refreshes if expired
     */
    async getAccessToken() {
        const token = localStorage.getItem(this.TOKEN_KEY);
        const expiry = localStorage.getItem(this.EXPIRY_KEY);

        if (token && Date.now() < parseInt(expiry) - 60000) {
            return token; // Still valid (with 60s buffer)
        }

        // Try refreshing
        const refreshToken = localStorage.getItem(this.REFRESH_KEY);
        if (refreshToken) {
            console.log('[SpotifyAuth] 🔄 Token expired, refreshing...');
            return await this.refreshAccessToken(refreshToken);
        }

        return null; // Not logged in
    },

    /**
     * START LOGIN FLOW (Opens popup)
     * 
     * How the popup flow works:
     * 1. We open a small popup window pointed at Spotify's authorize URL
     * 2. User logs in to Spotify in the popup
     * 3. Spotify redirects the popup to our callback.html
     * 4. callback.html exchanges the code for tokens
     * 5. callback.html sends tokens to the main window via postMessage
     * 6. Popup closes, main window receives tokens
     */
    async login() {
        return new Promise(async (resolve, reject) => {
            try {
                // Step 1: Generate PKCE code verifier (random 64-char string)
                const codeVerifier = this._generateRandomString(64);
                sessionStorage.setItem(this.VERIFIER_KEY, codeVerifier);
                localStorage.setItem(this.VERIFIER_KEY, codeVerifier); // fallback for cross-origin popup redirects

                // Step 2: Create code challenge (SHA-256 hash of verifier, base64url encoded)
                const codeChallenge = await this._generateCodeChallenge(codeVerifier);

                // Step 3: Build the Spotify authorization URL
                const params = new URLSearchParams({
                    client_id: SPOTIFY_CONFIG.CLIENT_ID,
                    response_type: 'code',
                    redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
                    scope: SPOTIFY_CONFIG.SCOPES,
                    code_challenge_method: 'S256',
                    code_challenge: codeChallenge,
                    show_dialog: 'true'  // Always show login dialog
                });

                const authUrl = 'https://accounts.spotify.com/authorize?' + params.toString();

                // Step 4: Open popup window
                const popup = window.open(
                    authUrl,
                    'Spotify Login',
                    'width=500,height=700,left=200,top=100'
                );

                if (!popup) {
                    reject(new Error('Popup blocked! Please allow popups for this site.'));
                    return;
                }

                // Step 5: Listen for the callback message from popup
                let checkClosed;
                const messageHandler = (event) => {
                    // Security: only accept messages from our origin
                    if (event.origin !== window.location.origin) return;

                    if (event.data.type === 'spotify-auth-success') {
                        if (checkClosed) clearInterval(checkClosed);
                        window.removeEventListener('message', messageHandler);
                        console.log('[SpotifyAuth] ✅ Login successful!');
                        resolve(event.data.token);
                    } else if (event.data.type === 'spotify-auth-error') {
                        if (checkClosed) clearInterval(checkClosed);
                        window.removeEventListener('message', messageHandler);
                        reject(new Error(event.data.error));
                    }
                };

                window.addEventListener('message', messageHandler);

                // Fallback: check if popup was closed without completing
                checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        window.removeEventListener('message', messageHandler);
                        if (!this.isLoggedIn()) {
                            reject(new Error('Login cancelled'));
                        }
                    }
                }, 500);

            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * EXCHANGE AUTHORIZATION CODE FOR TOKENS
     * Called from callback.html after Spotify redirects back
     * 
     * Sends: auth code + code_verifier → Spotify
     * Receives: access_token + refresh_token
     */
    async exchangeCode(code) {
        const codeVerifier = sessionStorage.getItem(this.VERIFIER_KEY) || localStorage.getItem(this.VERIFIER_KEY);

        if (!codeVerifier) {
            throw new Error('No code verifier found — login flow may have been interrupted');
        }

        console.log('[SpotifyAuth] 🔄 Exchanging auth code for tokens...');

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: SPOTIFY_CONFIG.CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
                code_verifier: codeVerifier
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error_description || 'Token exchange failed');
        }

        const data = await response.json();

        // Store tokens
        this._saveTokens(data);

        // Clean up verifier
        sessionStorage.removeItem(this.VERIFIER_KEY);
        localStorage.removeItem(this.VERIFIER_KEY);

        console.log('[SpotifyAuth] ✅ Tokens received and stored');
        return data.access_token;
    },

    /**
     * REFRESH AN EXPIRED ACCESS TOKEN
     * 
     * Access tokens expire after 1 hour.
     * The refresh token lets us get a new access token without
     * making the user log in again.
     */
    async refreshAccessToken(refreshToken) {
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: SPOTIFY_CONFIG.CLIENT_ID,
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) {
                throw new Error('Refresh failed');
            }

            const data = await response.json();
            this._saveTokens(data);

            console.log('[SpotifyAuth] ✅ Token refreshed successfully');
            return data.access_token;

        } catch (error) {
            console.error('[SpotifyAuth] ❌ Token refresh failed:', error);
            this.logout();
            return null;
        }
    },

    /**
     * LOGOUT — Clear all stored tokens
     */
    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_KEY);
        localStorage.removeItem(this.EXPIRY_KEY);
        console.log('[SpotifyAuth] 👋 Logged out');
    },

    // ─── Private Helpers ─────────────────────────

    _saveTokens(data) {
        localStorage.setItem(this.TOKEN_KEY, data.access_token);
        if (data.refresh_token) {
            localStorage.setItem(this.REFRESH_KEY, data.refresh_token);
        }
        localStorage.setItem(
            this.EXPIRY_KEY,
            (Date.now() + data.expires_in * 1000).toString()
        );
    },

    /**
     * Generate a cryptographically random string
     * Used for PKCE code verifier
     */
    _generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let values;
        if (window.crypto && window.crypto.getRandomValues) {
            values = window.crypto.getRandomValues(new Uint8Array(length));
        } else {
            values = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                values[i] = Math.floor(Math.random() * 256);
            }
        }
        return Array.from(values, v => chars[v % chars.length]).join('');
    },

    /**
     * Generate PKCE code challenge from verifier
     * code_challenge = base64url(SHA-256(code_verifier))
     */
    async _generateCodeChallenge(verifier) {
        let digest;
        if (window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(verifier);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
            digest = new Uint8Array(hashBuffer);
        } else {
            console.warn('[SpotifyAuth] crypto.subtle is not available (insecure context). Using fallback SHA-256.');
            digest = this._sha256Fallback(verifier);
        }

        // Convert to base64url encoding (URL-safe base64 without padding)
        return btoa(String.fromCharCode(...digest))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    },

    /**
     * Pure JavaScript SHA-256 implementation
     * Used when SubtleCrypto is unavailable (insecure HTTP contexts)
     */
    _sha256Fallback(str) {
        function rotateRight(n, x) {
            return (x >>> n) | (x << (32 - n));
        }
        
        const mathPow = Math.pow;
        const maxWord = mathPow(2, 32);
        
        // Initial hash values
        let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
            h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
            
        // Initial constants
        const k = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        
        const strBytes = [];
        for (let i = 0; i < str.length; i++) {
            strBytes.push(str.charCodeAt(i));
        }
        
        // Padding
        const asciiBitLength = str.length * 8;
        strBytes.push(0x80);
        while ((strBytes.length * 8 + 64) % 512 !== 0) {
            strBytes.push(0x00);
        }
        
        // Append length in bits as 64-bit big-endian integer
        const lengthBytes = new Array(8);
        for (let i = 7; i >= 0; i--) {
            lengthBytes[i] = (asciiBitLength >>> (8 * (7 - i))) & 0xff;
        }
        strBytes.push(...lengthBytes);
        
        const numBlocks = strBytes.length * 8 / 512;
        
        for (let b = 0; b < numBlocks; b++) {
            const w = new Array(64);
            for (let t = 0; t < 16; t++) {
                w[t] = (strBytes[b * 64 + t * 4] << 24) |
                       (strBytes[b * 64 + t * 4 + 1] << 16) |
                       (strBytes[b * 64 + t * 4 + 2] << 8) |
                       (strBytes[b * 64 + t * 4 + 3]);
            }
            
            for (let t = 16; t < 64; t++) {
                const s0 = rotateRight(7, w[t - 15]) ^ rotateRight(18, w[t - 15]) ^ (w[t - 15] >>> 3);
                const s1 = rotateRight(17, w[t - 2]) ^ rotateRight(19, w[t - 2]) ^ (w[t - 2] >>> 10);
                w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
            }
            
            let a = h0, e = h4;
            let bVal = h1, cVal = h2, dVal = h3;
            let fVal = h5, gVal = h6, hVal = h7;
            
            for (let t = 0; t < 64; t++) {
                const S1 = rotateRight(6, e) ^ rotateRight(11, e) ^ rotateRight(25, e);
                const ch = (e & fVal) ^ ((~e) & gVal);
                const temp1 = (hVal + S1 + ch + k[t] + w[t]) | 0;
                const S0 = rotateRight(2, a) ^ rotateRight(13, a) ^ rotateRight(22, a);
                const maj = (a & bVal) ^ (a & cVal) ^ (bVal & cVal);
                const temp2 = (S0 + maj) | 0;
                
                hVal = gVal;
                gVal = fVal;
                fVal = e;
                e = (dVal + temp1) | 0;
                dVal = cVal;
                cVal = bVal;
                bVal = a;
                a = (temp1 + temp2) | 0;
            }
            
            h0 = (h0 + a) | 0;
            h1 = (h1 + bVal) | 0;
            h2 = (h2 + cVal) | 0;
            h3 = (h3 + dVal) | 0;
            h4 = (h4 + e) | 0;
            h5 = (h5 + fVal) | 0;
            h6 = (h6 + gVal) | 0;
            h7 = (h7 + hVal) | 0;
        }
        
        const resBytes = new Uint8Array(32);
        const hashWords = [h0, h1, h2, h3, h4, h5, h6, h7];
        for (let i = 0; i < 8; i++) {
            resBytes[i * 4] = (hashWords[i] >>> 24) & 0xff;
            resBytes[i * 4 + 1] = (hashWords[i] >>> 16) & 0xff;
            resBytes[i * 4 + 2] = (hashWords[i] >>> 8) & 0xff;
            resBytes[i * 4 + 3] = hashWords[i] & 0xff;
        }
        return resBytes;
    }
};

console.log('[SpotifyAuth] 📦 PKCE Auth module loaded');
