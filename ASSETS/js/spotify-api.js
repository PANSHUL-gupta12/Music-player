// ==========================================
// MusicAPI — Spotify (Primary) + Deezer (Fallback)
// ==========================================
// Provides a unified search interface:
//   MusicAPI.fetchTopSongs(query, limit)
//
// How it works:
// 1. Tries Spotify Search API first (Client Credentials flow)
// 2. Caches the access token for 1 hour (avoids re-auth every call)
// 3. Falls back to Deezer API via CORS proxy if Spotify fails
// 4. Returns tracks in a normalized format: {name, artist, img, music, spotifyUri}
// ==========================================

const SpotifyAPI = {
    // Token cache — avoids re-authenticating on every search
    _token: null,
    _tokenExpiry: 0,

    /**
     * GET AN ACCESS TOKEN (Client Credentials Flow)
     * 
     * How Client Credentials works:
     * - We send our Client ID + Client Secret to Spotify's token endpoint
     * - Spotify verifies them and returns an access token
     * - This token lets us search, browse, and read public data
     * - Token expires after 3600 seconds (1 hour)
     * - We cache it so we don't re-authenticate on every search
     * 
     * The credentials are sent as Base64-encoded "CLIENT_ID:CLIENT_SECRET"
     * in the Authorization header (HTTP Basic Auth)
     */
    async getToken() {
        // 1. Try to use the user's logged-in access token first (if they connected Spotify)
        if (typeof SpotifyAuth !== 'undefined') {
            try {
                const userToken = await SpotifyAuth.getAccessToken();
                if (userToken) {
                    console.log('[SpotifyAPI] 🔑 Using connected user access token for search');
                    return userToken;
                }
            } catch (e) {
                console.warn('[SpotifyAPI] Failed to get user access token:', e);
            }
        }

        // 2. Return cached client credentials token if still valid (with 60s buffer)
        if (this._token && Date.now() < this._tokenExpiry - 60000) {
            console.log('[SpotifyAPI] 🔑 Using cached client credentials token');
            return this._token;
        }

        console.log('[SpotifyAPI] 🔄 Fetching new client credentials token...');

        try {
            // Base64 encode "CLIENT_ID:CLIENT_SECRET" for HTTP Basic Auth
            const credentials = btoa(
                SPOTIFY_CONFIG.CLIENT_ID + ':' + SPOTIFY_CONFIG.CLIENT_SECRET
            );

            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + credentials,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SpotifyAPI] ❌ Token response not OK:', response.status, errorText);
                throw new Error(`Token request failed: ${response.status} — ${errorText}`);
            }

            const data = await response.json();

            // Validate the token actually exists in the response
            if (!data.access_token) {
                console.error('[SpotifyAPI] ❌ No access_token in response:', data);
                throw new Error('No access_token in token response');
            }

            // Cache the token and its expiry time
            this._token = data.access_token;
            this._tokenExpiry = Date.now() + (data.expires_in * 1000);

            console.log(`[SpotifyAPI] ✅ Token acquired (expires in ${data.expires_in}s)`);
            return this._token;

        } catch (error) {
            console.error('[SpotifyAPI] ❌ Token fetch failed:', error.message);
            this._token = null;
            this._tokenExpiry = 0;
            return null;
        }
    },

    /**
     * SEARCH SPOTIFY FOR TRACKS
     * 
     * Uses the /v1/search endpoint with type=track
     * Returns results sorted by popularity (Spotify's default)
     * 
     * Each result includes:
     * - Track name, artist name, album art (640px)
     * - preview_url: 30-second MP3 preview (can be null for some tracks)
     * - spotifyUri: "spotify:track:xxxx" — used by Web Playback SDK for full playback
     */
    async searchTracks(query, limit = 20) {
        const token = await this.getToken();
        if (!token) {
            console.warn('[SpotifyAPI] ⚠️ No valid token — skipping search');
            return null;
        }

        console.log(`[SpotifyAPI] 🔍 Searching: "${query}" (limit: ${limit})`);

        try {
            const searchLimit = Math.min(Math.max(1, parseInt(limit) || 20), 50);

            // Build search URL — try with fewer params first for compatibility
            let searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${searchLimit}`;
            console.log(`[SpotifyAPI] 🌐 URL: ${searchUrl}`);

            let response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // If first attempt fails, try with explicit market
            if (!response.ok) {
                const errText = await response.text();
                console.warn(`[SpotifyAPI] ⚠️ First attempt failed (${response.status}): ${errText}`);
                console.log('[SpotifyAPI] 🔄 Retrying with explicit market parameter...');
                
                searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${searchLimit}&market=IN`;
                response = await fetch(searchUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }

            if (response.status === 401) {
                // Token expired mid-session — clear cache and retry once
                console.warn('[SpotifyAPI] ⚠️ Token expired, clearing cache...');
                this._token = null;
                this._tokenExpiry = 0;
                return null;
            }

            if (!response.ok) {
                const errBody = await response.text();
                console.error(`[SpotifyAPI] ❌ Search response ${response.status}:`, errBody);
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();

            if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
                console.warn('[SpotifyAPI] ⚠️ No tracks found');
                return null;
            }

            // Normalize Spotify response to our app's track format
            // Include ALL tracks (even without preview_url) — SDK can play full songs
            const tracks = data.tracks.items.map(track => ({
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                img: track.album.images[0]?.url || '',   // Largest image (640px)
                music: track.preview_url || '',            // 30s preview (may be empty)
                spotifyUri: track.uri,                     // "spotify:track:xxx" for SDK
                source: 'spotify'
            }));

            // Filter: keep tracks that have EITHER a preview URL or a Spotify URI
            const playableTracks = tracks.filter(t => t.music || t.spotifyUri);

            if (playableTracks.length === 0) {
                console.warn('[SpotifyAPI] ⚠️ No playable tracks found');
                return null;
            }

            console.log(`[SpotifyAPI] ✅ Found ${playableTracks.length} tracks for "${query}"`);
            return playableTracks;

        } catch (error) {
            console.error('[SpotifyAPI] ❌ Search failed:', error.message);
            return null;
        }
    }
};


// ==========================================
// Deezer Fallback
// ==========================================
// Used ONLY when Spotify fails (network error, rate limit, etc.)
// - No auth needed — completely free & open API
// - Routed through CORS proxy to bypass browser restrictions
// - Tries multiple proxy services for reliability
// ==========================================

const DeezerFallback = {
    // Multiple CORS proxies for reliability
    _proxies: [
        (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ],

    async searchTracks(query, limit = 20) {
        console.log(`[DeezerFallback] 🔍 Searching: "${query}" (limit: ${limit})`);

        const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;

        // Try each proxy until one works
        for (let i = 0; i < this._proxies.length; i++) {
            try {
                const proxyUrl = this._proxies[i](deezerUrl);
                console.log(`[DeezerFallback] Trying proxy ${i + 1}/${this._proxies.length}...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

                const response = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.warn(`[DeezerFallback] Proxy ${i + 1} returned ${response.status}`);
                    continue; // Try next proxy
                }

                // Check if response is actually JSON (not an HTML error page)
                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (parseErr) {
                    console.warn(`[DeezerFallback] Proxy ${i + 1} returned non-JSON:`, text.substring(0, 100));
                    continue; // Try next proxy
                }

                if (!result.data || result.data.length === 0) {
                    console.warn('[DeezerFallback] ⚠️ No tracks found');
                    return null;
                }

                // Normalize Deezer response to our app's track format
                const tracks = result.data.slice(0, limit).map(song => ({
                    name: song.title,
                    artist: song.artist.name,
                    img: song.album.cover_xl || song.album.cover_big || '',
                    music: song.preview,        // 30s preview (always available on Deezer)
                    spotifyUri: null,            // No Spotify URI — can't use SDK playback
                    source: 'deezer'
                }));

                console.log(`[DeezerFallback] ✅ Found ${tracks.length} tracks via proxy ${i + 1}`);
                return tracks;

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.warn(`[DeezerFallback] Proxy ${i + 1} timed out`);
                } else {
                    console.warn(`[DeezerFallback] Proxy ${i + 1} error:`, error.message);
                }
                // Continue to next proxy
            }
        }

        console.error('[DeezerFallback] ❌ All proxies failed');
        return null;
    }
};


// ==========================================
// Unified Music API (Entry Point)
// ==========================================
// This is what artist scripts call:
//   MusicAPI.fetchTopSongs('Karan Aujla', 20)
//
// Priority: Spotify → Deezer → null (triggers dev picks fallback)
// ==========================================

const MusicAPI = {
    async fetchTopSongs(query, limit = 20) {
        console.log(`\n[MusicAPI] 🎵 Fetching top songs for: "${query}"`);
        console.log('[MusicAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // 1. Try Spotify first (primary source)
        let tracks = await SpotifyAPI.searchTracks(query, limit);

        if (tracks && tracks.length > 0) {
            console.log(`[MusicAPI] ✅ Spotify delivered ${tracks.length} tracks`);
            return tracks;
        }

        // 2. Spotify failed — fall back to Deezer
        console.warn('[MusicAPI] ⚠️ Spotify failed, trying Deezer fallback...');
        tracks = await DeezerFallback.searchTracks(query, limit);

        if (tracks && tracks.length > 0) {
            console.log(`[MusicAPI] ✅ Deezer fallback delivered ${tracks.length} tracks`);
            return tracks;
        }

        // 3. Both failed
        console.error('[MusicAPI] ❌ Both Spotify and Deezer failed');
        return null;
    }
};

console.log('[MusicAPI] 📦 Module loaded — Spotify (primary) + Deezer (fallback)');
