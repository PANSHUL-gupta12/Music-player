// ==========================================
// Spotify Web Playback SDK Integration
// ==========================================
//
// HOW THE WEB PLAYBACK SDK WORKS:
//
// The SDK turns your browser tab into a virtual Spotify device
// (like a smart speaker or Spotify desktop app). When you play
// a track, Spotify's servers stream the FULL song to your browser.
//
// Requirements:
// - Spotify Premium account (free accounts can't use SDK)
// - User must be logged in via OAuth (SpotifyAuth module)
// - HTTPS in production (localhost is exempt for development)
//
// Architecture:
// ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
// │ Your Player  │────▶│ Spotify API  │────▶│ Spotify SDK │
// │ (controls)   │     │ (commands)   │     │ (audio out) │
// └─────────────┘     └──────────────┘     └─────────────┘
//       │                                         │
//       │  PUT /v1/me/player/play                 │
//       │  { uris: ["spotify:track:xxx"] }        │
//       │                                         │
//       └── seek, volume, pause ──────────────────┘
//
// The SDK creates a "device" with a device_id. We tell Spotify's
// API to play tracks ON that device. The SDK handles the actual
// audio streaming and decoding.
// ==========================================

const SpotifyPlayer = {
    // State
    _player: null,
    _deviceId: null,
    _isReady: false,
    _isActive: false,         // True when SDK is handling playback
    _sdkLoaded: false,
    _stateInterval: null,
    _currentTrackUri: null,

    // References to original HTML5 audio functions (set during init)
    _originalPlayTrack: null,
    _originalPauseTrack: null,
    _originalSeekTo: null,
    _originalSetVolume: null,
    _originalSetUpdate: null,

    /**
     * INITIALIZE THE SDK
     * 
     * Steps:
     * 1. Load the Spotify SDK script from CDN
     * 2. Create a Player instance with our access token
     * 3. Connect to Spotify and get a device_id
     * 4. Hook into the existing player controls
     */
    async init() {
        if (this._isReady) {
            console.log('[SpotifyPlayer] Already initialized');
            return true;
        }

        const token = await SpotifyAuth.getAccessToken();
        if (!token) {
            console.warn('[SpotifyPlayer] No access token — cannot initialize SDK');
            return false;
        }

        // Load SDK script if not already loaded
        if (!this._sdkLoaded) {
            await this._loadSDKScript();
        }

        return new Promise((resolve) => {
            // The SDK calls this global callback when it's ready
            window.onSpotifyWebPlaybackSDKReady = () => {
                console.log('[SpotifyPlayer] 🎵 SDK Ready — creating player...');

                this._player = new Spotify.Player({
                    name: 'In The Zone — Web Player',
                    getOAuthToken: async (cb) => {
                        // The SDK calls this whenever it needs a fresh token
                        const freshToken = await SpotifyAuth.getAccessToken();
                        cb(freshToken);
                    },
                    volume: 0.8
                });

                // ─── Event Listeners ───

                // Ready — device is registered with Spotify
                this._player.addListener('ready', ({ device_id }) => {
                    console.log(`[SpotifyPlayer] ✅ Device ready! ID: ${device_id}`);
                    this._deviceId = device_id;
                    this._isReady = true;
                    this._hookPlayerControls();
                    this._updateConnectButton(true);
                    resolve(true);
                });

                // Not ready — device went offline
                this._player.addListener('not_ready', ({ device_id }) => {
                    console.warn('[SpotifyPlayer] ⚠️ Device went offline:', device_id);
                    this._isReady = false;
                    this._isActive = false;
                    this._updateConnectButton(false);
                });

                // Playback state changed
                this._player.addListener('player_state_changed', (state) => {
                    if (!state) return;
                    this._handleStateChange(state);
                });

                // Errors
                this._player.addListener('initialization_error', ({ message }) => {
                    console.error('[SpotifyPlayer] ❌ Init error:', message);
                    resolve(false);
                });
                this._player.addListener('authentication_error', ({ message }) => {
                    console.error('[SpotifyPlayer] ❌ Auth error:', message);
                    SpotifyAuth.logout();
                    this._updateConnectButton(false);
                    resolve(false);
                });
                this._player.addListener('account_error', ({ message }) => {
                    console.error('[SpotifyPlayer] ❌ Account error (Premium required):', message);
                    alert('Spotify Premium is required for full playback. Using previews instead.');
                    resolve(false);
                });

                // Connect the player
                this._player.connect().then(success => {
                    if (!success) {
                        console.error('[SpotifyPlayer] ❌ Failed to connect');
                        resolve(false);
                    }
                });
            };

            // If SDK was already loaded, trigger the callback
            if (window.Spotify) {
                window.onSpotifyWebPlaybackSDKReady();
            }
        });
    },

    /**
     * PLAY A TRACK VIA SPOTIFY SDK
     * 
     * Instead of loading an MP3 into an HTML5 audio element,
     * we tell Spotify's API to start playing on our SDK device.
     * The SDK streams the full song from Spotify's servers.
     */
    async play(spotifyUri) {
        if (!this._isReady || !this._deviceId) {
            console.warn('[SpotifyPlayer] Not ready — falling back to HTML5 audio');
            return false;
        }

        const token = await SpotifyAuth.getAccessToken();
        if (!token) return false;

        try {
            console.log(`[SpotifyPlayer] ▶️ Playing: ${spotifyUri}`);

            const response = await fetch(
                `https://api.spotify.com/v1/me/player/play?device_id=${this._deviceId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uris: [spotifyUri]
                    })
                }
            );

            if (!response.ok && response.status !== 204) {
                throw new Error(`Play failed: ${response.status}`);
            }

            this._isActive = true;
            this._currentTrackUri = spotifyUri;

            // Start polling for playback state (for seek slider updates)
            this._startStatePolling();

            return true;

        } catch (error) {
            console.error('[SpotifyPlayer] ❌ Play failed:', error);
            this._isActive = false;
            return false;
        }
    },

    /**
     * PAUSE PLAYBACK
     */
    async pause() {
        if (!this._isActive) return;

        try {
            await this._player.pause();
            console.log('[SpotifyPlayer] ⏸️ Paused');
        } catch (error) {
            console.error('[SpotifyPlayer] Pause error:', error);
        }
    },

    /**
     * RESUME PLAYBACK
     */
    async resume() {
        if (!this._isActive) return;

        try {
            await this._player.resume();
            console.log('[SpotifyPlayer] ▶️ Resumed');
        } catch (error) {
            console.error('[SpotifyPlayer] Resume error:', error);
        }
    },

    /**
     * SEEK TO POSITION
     * @param {number} percent — 0 to 100
     */
    async seek(percent) {
        if (!this._isActive) return;

        try {
            const state = await this._player.getCurrentState();
            if (state) {
                const positionMs = Math.floor(state.duration * (percent / 100));
                await this._player.seek(positionMs);
            }
        } catch (error) {
            console.error('[SpotifyPlayer] Seek error:', error);
        }
    },

    /**
     * SET VOLUME
     * @param {number} percent — 0 to 100
     */
    async setVolume(percent) {
        if (!this._player) return;

        try {
            await this._player.setVolume(percent / 100);
        } catch (error) {
            console.error('[SpotifyPlayer] Volume error:', error);
        }
    },

    /**
     * DISCONNECT AND CLEAN UP
     */
    disconnect() {
        if (this._player) {
            this._player.disconnect();
            this._isReady = false;
            this._isActive = false;
            this._stopStatePolling();
            console.log('[SpotifyPlayer] 🔌 Disconnected');
        }
    },

    // ─── Private Methods ─────────────────────────

    /**
     * Load Spotify SDK script from CDN
     */
    _loadSDKScript() {
        return new Promise((resolve, reject) => {
            if (document.getElementById('spotify-sdk-script')) {
                this._sdkLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.id = 'spotify-sdk-script';
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.onload = () => {
                this._sdkLoaded = true;
                console.log('[SpotifyPlayer] 📦 SDK script loaded');
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load Spotify SDK'));
            document.head.appendChild(script);
        });
    },

    /**
     * HOOK INTO EXISTING PLAYER CONTROLS
     * 
     * This is the magic that makes the SDK work with the existing player:
     * We monkey-patch the global functions (playTrack, pauseTrack, seekTo, setVolume)
     * so that when the SDK is active, they route through Spotify instead of HTML5 audio.
     * When SDK is not active (Dev Picks), the original functions still work.
     */
    _hookPlayerControls() {
        console.log('[SpotifyPlayer] 🔗 Hooking into player controls...');

        // Save references to original functions
        this._originalPlayTrack = window.playTrack;
        this._originalPauseTrack = window.pauseTrack;
        this._originalSeekTo = window.seekTo;
        this._originalSetVolume = window.setVolume;
        this._originalSetUpdate = window.setUpdate;

        const self = this;

        // ─── Override playTrack ───
        window.playTrack = function () {
            // Check if current track has a Spotify URI AND SDK is ready
            if (self._isReady && typeof music_list !== 'undefined' &&
                music_list[track_index] && music_list[track_index].spotifyUri) {

                const uri = music_list[track_index].spotifyUri;

                // Mute the HTML5 audio to prevent double playback
                if (typeof curr_track !== 'undefined') {
                    curr_track.pause();
                    curr_track.src = '';
                }

                // Play via Spotify SDK
                self.play(uri).then(success => {
                    if (!success) {
                        // SDK failed — fall back to HTML5 audio with preview
                        console.warn('[SpotifyPlayer] SDK play failed, using preview');
                        if (typeof curr_track !== 'undefined' && music_list[track_index].music) {
                            curr_track.src = music_list[track_index].music;
                            curr_track.load();
                        }
                        self._originalPlayTrack.call(window);
                    }
                });

                // Update UI
                if (typeof isPlaying !== 'undefined') isPlaying = true;
                const trackArt = document.querySelector('.track-art');
                const wave = document.getElementById('wave');
                const playpauseBtn = document.querySelector('.playpause-track');
                if (trackArt) trackArt.classList.add('rotate');
                if (wave) wave.classList.add('loader');
                if (playpauseBtn) playpauseBtn.innerHTML = '<i class="fa fa-pause"></i>';

            } else {
                // No Spotify URI or SDK not ready → use original HTML5 audio
                self._isActive = false;
                self._stopStatePolling();
                self._originalPlayTrack.call(window);
            }
        };

        // ─── Override pauseTrack ───
        window.pauseTrack = function () {
            if (self._isActive) {
                self.pause();
                // Update UI
                if (typeof isPlaying !== 'undefined') isPlaying = false;
                const trackArt = document.querySelector('.track-art');
                const wave = document.getElementById('wave');
                const playpauseBtn = document.querySelector('.playpause-track');
                if (trackArt) trackArt.classList.remove('rotate');
                if (wave) wave.classList.remove('loader');
                if (playpauseBtn) playpauseBtn.innerHTML = '<i class="fa fa-play"></i>';
            } else {
                self._originalPauseTrack.call(window);
            }
        };

        // ─── Override seekTo ───
        window.seekTo = function () {
            if (self._isActive) {
                const seekSlider = document.querySelector('.seek_slider');
                if (seekSlider) {
                    self.seek(parseFloat(seekSlider.value));
                }
            } else {
                self._originalSeekTo.call(window);
            }
        };

        // ─── Override setVolume ───
        window.setVolume = function () {
            const volumeSlider = document.querySelector('.volume_slider');
            if (volumeSlider) {
                const volume = parseFloat(volumeSlider.value);

                // Always set SDK volume (even when not actively playing SDK tracks)
                if (self._player) {
                    self.setVolume(volume);
                }

                // Also set HTML5 audio volume (for when SDK is not active)
                if (typeof curr_track !== 'undefined') {
                    curr_track.volume = volume / 100;
                }
            }
        };

        console.log('[SpotifyPlayer] ✅ Controls hooked — SDK will intercept playback for Spotify tracks');
    },

    /**
     * Handle SDK state changes — update the seek slider and time display
     */
    _handleStateChange(state) {
        if (!state || !this._isActive) return;

        // If track ended, trigger next track
        if (state.paused && state.position === 0 && state.duration > 0) {
            // Track finished — play next
            if (typeof nextTrack === 'function') {
                setTimeout(() => nextTrack(), 100);
            }
        }
    },

    /**
     * Poll playback state to update seek slider and time display
     * (The SDK doesn't continuously fire state events, so we poll)
     */
    _startStatePolling() {
        this._stopStatePolling();

        this._stateInterval = setInterval(async () => {
            if (!this._isActive || !this._player) {
                this._stopStatePolling();
                return;
            }

            try {
                const state = await this._player.getCurrentState();
                if (!state) return;

                const { position, duration, paused } = state;

                // Update seek slider
                const seekSlider = document.querySelector('.seek_slider');
                if (seekSlider && duration > 0) {
                    seekSlider.value = (position / duration) * 100;
                }

                // Update time displays
                const currTime = document.querySelector('.current-time');
                const totalDur = document.querySelector('.total-duration');

                if (currTime) {
                    currTime.textContent = this._formatTime(position / 1000);
                }
                if (totalDur) {
                    totalDur.textContent = this._formatTime(duration / 1000);
                }

                // Detect track end
                if (paused && position >= duration - 500 && duration > 0) {
                    this._isActive = false;
                    this._stopStatePolling();
                    if (typeof nextTrack === 'function') {
                        nextTrack();
                    }
                }

            } catch (e) {
                // Silently ignore polling errors
            }
        }, 500); // Update every 500ms
    },

    _stopStatePolling() {
        if (this._stateInterval) {
            clearInterval(this._stateInterval);
            this._stateInterval = null;
        }
    },

    /**
     * Format seconds to MM:SS
     */
    _formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    },

    /**
     * Update the "Connect Spotify" button state
     */
    _updateConnectButton(connected) {
        const btn = document.getElementById('spotify-connect-btn');
        if (!btn) return;

        if (connected) {
            btn.innerHTML = '<i class="fab fa-spotify"></i> Connected';
            btn.classList.add('connected');
            btn.title = 'Spotify Premium — Full Playback Active';

            // Update trending tab label
            const topTab = document.getElementById('top-tab');
            if (topTab) {
                topTab.textContent = '🎵 Top 20 (Full Songs)';
            }
        } else {
            btn.innerHTML = '<i class="fab fa-spotify"></i> Connect Spotify';
            btn.classList.remove('connected');
            btn.title = 'Login for full song playback';

            const topTab = document.getElementById('top-tab');
            if (topTab) {
                topTab.textContent = 'Top 20 Trending';
            }
        }
    }
};


// ==========================================
// Connect Spotify Button Handler
// ==========================================
// Creates and manages the "Connect Spotify" button on each page
// ==========================================

function initSpotifyConnect() {
    const btn = document.getElementById('spotify-connect-btn');
    if (!btn) return;

    // Check if already logged in from a previous session
    if (SpotifyAuth.isLoggedIn()) {
        btn.innerHTML = '<i class="fab fa-spotify"></i> Connected';
        btn.classList.add('connected');

        // Auto-initialize the SDK
        SpotifyPlayer.init().then(ready => {
            if (!ready) {
                btn.innerHTML = '<i class="fab fa-spotify"></i> Connect Spotify';
                btn.classList.remove('connected');
            }
        });
    }

    btn.addEventListener('click', async () => {
        if (SpotifyAuth.isLoggedIn()) {
            // Already connected — offer to disconnect
            if (confirm('Disconnect from Spotify?\n\nYou\'ll switch back to 30-second previews.')) {
                SpotifyAuth.logout();
                SpotifyPlayer.disconnect();
                btn.innerHTML = '<i class="fab fa-spotify"></i> Connect Spotify';
                btn.classList.remove('connected');

                // Reset trending tab label
                const topTab = document.getElementById('top-tab');
                if (topTab) topTab.textContent = 'Top 20 Trending';
            }
            return;
        }

        // Not connected — start login flow
        btn.innerHTML = '<i class="fab fa-spotify"></i> Connecting...';
        btn.disabled = true;

        try {
            await SpotifyAuth.login();

            // Login successful — initialize SDK
            const ready = await SpotifyPlayer.init();

            if (ready) {
                btn.innerHTML = '<i class="fab fa-spotify"></i> Connected';
                btn.classList.add('connected');
            } else {
                btn.innerHTML = '<i class="fab fa-spotify"></i> Connect Spotify';
                alert('SDK initialization failed. Using 30-second previews.');
            }
        } catch (error) {
            console.error('[SpotifyConnect] Login error:', error);
            btn.innerHTML = '<i class="fab fa-spotify"></i> Connect Spotify';

            if (error.message !== 'Login cancelled') {
                alert('Spotify login failed: ' + error.message);
            }
        } finally {
            btn.disabled = false;
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initSpotifyConnect);

console.log('[SpotifyPlayer] 📦 Web Playback SDK module loaded');
