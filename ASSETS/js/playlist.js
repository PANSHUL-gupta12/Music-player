/* ============================================
   IN THE ZONE — Playlist Manager (playlist.js)
   ============================================ */

(function () {
  'use strict';

  // ---- DOM elements ----
  const playlistBtn = document.getElementById('playlistBtn');
  const playlistPanel = document.getElementById('playlistPanel');
  const closeBtn = document.getElementById('closePlaylist');
  const fileInput = document.getElementById('fileInput');
  const playlistUl = document.getElementById('playlist');

  if (!playlistBtn || !playlistPanel) return; // guard – elements missing on this page

  // ---- State ----
  let isOpen = false;
  let playlistItems = []; // { name, objectUrl }
  let currentAudio = null;

  // ---- Toggle panel ----
  function openPanel() {
    isOpen = true;
    playlistPanel.classList.add('show');
  }

  function closePanel() {
    isOpen = false;
    playlistPanel.classList.remove('show');
  }

  playlistBtn.addEventListener('click', function () {
    isOpen ? closePanel() : openPanel();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closePanel);
  }

  // ---- Render playlist ----
  function renderPlaylist() {
    playlistUl.innerHTML = '';

    if (playlistItems.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'playlist-empty';
      empty.textContent = 'No songs added yet. Click "Add Songs" to get started!';
      playlistUl.appendChild(empty);
      return;
    }

    playlistItems.forEach(function (item, index) {
      const li = document.createElement('li');

      const nameSpan = document.createElement('span');
      nameSpan.textContent = (index + 1) + '. ' + item.name;
      nameSpan.style.flex = '1';
      nameSpan.style.overflow = 'hidden';
      nameSpan.style.textOverflow = 'ellipsis';
      nameSpan.style.whiteSpace = 'nowrap';

      const playBtn = document.createElement('button');
      playBtn.className = 'play-btn';
      playBtn.innerHTML = '<i class="fa fa-play"></i>';
      playBtn.title = 'Play ' + item.name;
      playBtn.addEventListener('click', function () {
        playSong(item, playBtn);
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'play-btn';
      removeBtn.innerHTML = '<i class="fa fa-trash"></i>';
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', function () {
        if (currentAudio && currentAudio._src === item.objectUrl) {
          currentAudio.pause();
          currentAudio = null;
        }
        URL.revokeObjectURL(item.objectUrl);
        playlistItems.splice(index, 1);
        savePlaylistNames();
        renderPlaylist();
      });

      li.appendChild(nameSpan);
      li.appendChild(playBtn);
      li.appendChild(removeBtn);
      playlistUl.appendChild(li);
    });
  }

  // ---- Play a song ----
  function playSong(item, btn) {
    // Stop current playback
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    // Reset all play buttons
    playlistUl.querySelectorAll('.play-btn i.fa-pause').forEach(function (icon) {
      icon.className = 'fa fa-play';
    });

    // Create new audio
    currentAudio = new Audio(item.objectUrl);
    currentAudio._src = item.objectUrl;
    currentAudio.play();

    // Update button to pause
    btn.querySelector('i').className = 'fa fa-pause';

    currentAudio.addEventListener('ended', function () {
      btn.querySelector('i').className = 'fa fa-play';
      currentAudio = null;
    });

    // Allow toggling pause
    btn.onclick = function () {
      if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        btn.querySelector('i').className = 'fa fa-play';
      } else if (currentAudio) {
        currentAudio.play();
        btn.querySelector('i').className = 'fa fa-pause';
      }
    };
  }

  // ---- Handle file input ----
  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      var files = Array.from(e.target.files);

      files.forEach(function (file) {
        // Only add audio files
        if (!file.type.startsWith('audio/')) return;

        var url = URL.createObjectURL(file);
        playlistItems.push({
          name: file.name.replace(/\.[^/.]+$/, ''), // strip extension
          objectUrl: url
        });
      });

      savePlaylistNames();
      renderPlaylist();

      // Reset input so same file can be added again
      fileInput.value = '';
    });
  }

  // ---- Persist playlist names (actual audio requires re-upload) ----
  function savePlaylistNames() {
    var names = playlistItems.map(function (item) {
      return item.name;
    });
    localStorage.setItem('itz_playlist', JSON.stringify(names));
  }

  // ---- Initial render ----
  renderPlaylist();
})();
