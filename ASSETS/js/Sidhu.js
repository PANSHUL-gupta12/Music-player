// ==========================================
// IN THE ZONE — Music Player: Sidhu Moosewala
// NOTE: Song files not yet added — using
//       Honey Singh audio as placeholders.
//       Replace paths when you add Sidhu mp3s.
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
        img: '/01_singers/Photos/Sidhu/Dollar.jpeg',
        name: 'Dollar',
        artist: 'Sidhu Moosewala',
        music: '/Songs/Honey/Brown Rang.mp3'  // placeholder
    },
    {
        img: '/01_singers/Photos/Sidhu/Jatt.jpeg',
        name: 'Jatt Da Muqabala',
        artist: 'Sidhu Moosewala',
        music: '/Songs/Honey/DESI.mp3'  // placeholder
    },
    {
        img: '/01_singers/Photos/Sidhu/295.jpg',
        name: '295',
        artist: 'Sidhu Moosewala',
        music: '/Songs/Honey/Millionaire.mp3'  // placeholder
    },
    {
        img: '/01_singers/Photos/Sidhu/Everybody.jpg',
        name: 'Everybody Hurts',
        artist: 'Sidhu Moosewala',
        music: '/Songs/Honey/Kuley.mp3'  // placeholder
    },
    {
        img: '/01_singers/Photos/Sidhu/410.jpg',
        name: '410',
        artist: 'Sidhu Moosewala',
        music: '/Songs/Honey/Blue_Eyes.mp3'  // placeholder
    },
    {
        img: '/01_singers/Photos/Sidhu/Drippy.jpeg',
        name: 'Drippy',
        artist: 'Sidhu Moosewala',
        music: '/Songs/Honey/Dope Shope.mp3'  // placeholder
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
            await fetchTopSongs('Sidhu Moosewala');
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
