// ==========================================
// IN THE ZONE — Music Player: Karan Aujla
// ==========================================

let now_playing = document.querySelector('.now-playing');
let track_art = document.querySelector('.track-art');
let track_name = document.querySelector('.track-name');
let track_artist = document.querySelector('.track-artist');

let playpause_btn = document.querySelector('.playpause-track');
let next_btn = document.querySelector('.next-track');
let prev_btn = document.querySelector('.prev-track');

let seek_slider = document.querySelector('.seek_slider');
let volume_slider = document.querySelector('.volume_slider');
let curr_time = document.querySelector('.current-time');
let total_duration = document.querySelector('.total-duration');
let wave = document.getElementById('wave');
let randomIcon = document.querySelector('.fa-random');
let curr_track = document.createElement('audio');

let track_index = 0;
let isPlaying = false;
let isRandom = false;
let updateTimer;

// Data Storage
let dev_picks = [
    {
        img: '/01_singers/Photos/Karan/Dont worry.jpeg',
        name: "Don't Worry",
        artist: 'Karan Aujla',
        music: '/Songs/Karan/Dont Worry.mp3'
    },
    {
        img: '/01_singers/Photos/Karan/Chitta.jpeg',
        name: 'Chitta Kurta',
        artist: 'Karan Aujla',
        music: '/Songs/Karan/Chitta Kurta.mp3'
    },
    {
        img: '/01_singers/Photos/Karan/White-Brown-Black.jpg',
        name: 'White Brown Black',
        artist: 'Karan Aujla',
        music: '/Songs/Karan/White Brown Black.mp3'
    },
    {
        img: '/01_singers/Photos/Karan/Admirin-You.jpg',
        name: 'Admirin You',
        artist: 'Karan Aujla',
        music: '/Songs/Karan/Admirin You.mp3'
    },
    {
        img: '/01_singers/Photos/Karan/Wavy.jpg',
        name: 'Wavy',
        artist: 'Karan Aujla',
        music: '/Songs/Karan/Wavy.mp3'
    },
    {
        img: '/01_singers/Photos/Karan/Winning.jpeg',
        name: 'Winning Speech',
        artist: 'Karan Aujla',
        music: '/Songs/Karan/Winning Speech.mp3'
    }
];

let top_20_list = [];
let music_list = dev_picks; // Current active list

// Tab Switcher Logic
async function switchTab(tab) {
    const devTab = document.getElementById('dev-tab');
    const topTab = document.getElementById('top-tab');

    if (tab === 'top') {
        devTab.classList.remove('active');
        topTab.classList.add('active');
        
        if (top_20_list.length === 0) {
            await fetchTopSongs('Karan Aujla');
        }
        music_list = top_20_list;
    } else {
        topTab.classList.remove('active');
        devTab.classList.add('active');
        music_list = dev_picks;
    }

    track_index = 0;
    loadTrack(track_index);
    if (isPlaying) playTrack();
}

async function fetchTopSongs(query) {
    // Uses Spotify as primary, Deezer as fallback (via shared MusicAPI module)
    const tracks = await MusicAPI.fetchTopSongs(query, 20);
    if (tracks && tracks.length > 0) {
        top_20_list = tracks;
    } else {
        alert("Failed to fetch trending songs. Using Developer Picks.");
        switchTab('dev');
    }
}

loadTrack(track_index);

function loadTrack(index) {
    clearInterval(updateTimer);
    reset();

    curr_track.src = music_list[index].music;
    curr_track.load();
    track_name.textContent = music_list[index].name;
    track_artist.textContent = music_list[index].artist;
    now_playing.textContent =
        'Playing ' + (index + 1) + ' of ' + music_list.length;

    let trackImg = document.getElementById('track-image');
    if (trackImg) {
        trackImg.src = music_list[index].img;
    }

    updateTimer = setInterval(setUpdate, 1000);
    curr_track.removeEventListener('ended', nextTrack);
    curr_track.addEventListener('ended', nextTrack);
}

function reset() {
    curr_time.textContent = '00:00';
    total_duration.textContent = '00:00';
    seek_slider.value = 0;
}

function randomTrack() {
    isRandom ? pauseRandom() : playRandom();
}

function playRandom() {
    isRandom = true;
    randomIcon.classList.add('randomActive');
}

function pauseRandom() {
    isRandom = false;
    randomIcon.classList.remove('randomActive');
}

function repeatTrack() {
    loadTrack(track_index);
    playTrack();
}

function playpauseTrack() {
    isPlaying ? pauseTrack() : playTrack();
}

function playTrack() {
    curr_track.play();
    isPlaying = true;
    track_art.classList.add('rotate');
    wave.classList.add('loader');
    playpause_btn.innerHTML = '<i class="fa fa-pause"></i>';
}

function pauseTrack() {
    curr_track.pause();
    isPlaying = false;
    track_art.classList.remove('rotate');
    wave.classList.remove('loader');
    playpause_btn.innerHTML = '<i class="fa fa-play"></i>';
}

function nextTrack() {
    if (track_index < music_list.length - 1 && !isRandom) {
        track_index += 1;
    } else if (isRandom) {
        let random_index = Math.floor(Math.random() * music_list.length);
        track_index = random_index;
    } else {
        track_index = 0;
    }
    loadTrack(track_index);
    playTrack();
}

function prevTrack() {
    if (track_index > 0) {
        track_index -= 1;
    } else {
        track_index = music_list.length - 1;
    }
    loadTrack(track_index);
    playTrack();
}

function seekTo() {
    let seekto = curr_track.duration * (seek_slider.value / 100);
    curr_track.currentTime = seekto;
}

function setVolume() {
    curr_track.volume = volume_slider.value / 100;
}

function setUpdate() {
    let seekPosition = 0;
    if (!isNaN(curr_track.duration)) {
        seekPosition = curr_track.currentTime * (100 / curr_track.duration);
        seek_slider.value = seekPosition;

        let currentMinutes = Math.floor(curr_track.currentTime / 60);
        let currentSeconds = Math.floor(
            curr_track.currentTime - currentMinutes * 60
        );
        let durationMinutes = Math.floor(curr_track.duration / 60);
        let durationSeconds = Math.floor(
            curr_track.duration - durationMinutes * 60
        );

        if (currentSeconds < 10) currentSeconds = '0' + currentSeconds;
        if (durationSeconds < 10) durationSeconds = '0' + durationSeconds;
        if (currentMinutes < 10) currentMinutes = '0' + currentMinutes;
        if (durationMinutes < 10) durationMinutes = '0' + durationMinutes;

        curr_time.textContent = currentMinutes + ':' + currentSeconds;
        total_duration.textContent = durationMinutes + ':' + durationSeconds;
    }
}
