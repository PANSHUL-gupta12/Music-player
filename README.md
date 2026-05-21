# 🎵 In The Zone — Music Player

A modern, dark-themed web music player built with **HTML**, **CSS**, and **JavaScript**. Browse artist playlists, control playback, and create your own playlists — all from the browser.

---

## ✨ Features

- 🎨 **Midnight Slate & Electric Lime Theme** — A mature, high-contrast palette with enhanced glassmorphism and modern aesthetics.
- 🎵 **7 Artist Playlists** — Honey Singh, Karan Aujla, Shubh, Sidhu Moosewala, Talwiinder, Alan Walker, The Weeknd.
- ▶️ **Full Music Player** — play/pause, next/prev, shuffle, repeat, volume & seek sliders.
- 🎤 **Animated Wave Visualizer** — real-time wave animation synchronized with playback.
- 📋 **Custom Playlist** — add your own songs from your device via a slide-up panel with a premium glass design.
- 🎭 **Motion Design System** — sophisticated page entry reveals, floating effects, and micro-animations.
- 📱 **Responsive Design** — fully optimized for desktop and mobile devices.
- 🔗 **Integrated Navbar** — premium glassmorphic nav bar with integrated branding.

---

## 📸 Screenshots

### Home Page
![Home page with integrated navbar and artist grid](screenshots/home.png)

### Music Player
![Music player with circular art and controls](screenshots/player.png)

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, Safari)
- [Node.js](https://nodejs.org/) (optional, for the local dev server)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Music_player.git
   cd Music_player
   ```

2. **Start a local server**
   ```bash
   npx serve . -l 3500
   ```

3. **Open in your browser**
   ```
   http://localhost:3500/index.html
   ```

> **Tip:** You can also use VS Code's **Live Server** extension — right-click `index.html` → "Open with Live Server".

---

## 📂 Project Structure

```
Music_player/
├── index.html             # Home page (artist grid)
├── feedback.html          # Feedback form
├── contact.html           # Contact page
├── README.md              # This file
├── Images/                # Artist photos, logo, backgrounds
├── Songs/                 # Audio files (organized by artist)
│   ├── Honey/
│   ├── Karan/
│   ├── Alan/
│   ├── Weekend/
│   ├── Shubh/
│   ├── Sidhu/
│   ├── Tal/
│   └── Placeholder/       # Placeholder tracks for demo
├── ASSETS/
│   ├── css/
│   │   ├── Styles.css     # Global design system (home, contact, feedback)
│   │   ├── style.css      # Player page styles
│   │   └── animations.css # Reusable keyframe animations
│   ├── js/
│   │   ├── Honey.js       # Honey Singh player logic
│   │   ├── Karan.js       # Karan Aujla player logic
│   │   ├── Alan.js        # Alan Walker player logic
│   │   ├── Week.js        # The Weeknd player logic
│   │   ├── Shubh.js       # Shubh player logic
│   │   ├── Sidhu.js       # Sidhu Moosewala player logic
│   │   ├── Tal.js         # Talwiinder player logic
│   │   └── playlist.js    # Custom playlist manager
│   └── SHTML/             # Singer player pages
│       ├── Honey.html
│       ├── Karan.html
│       ├── Alan.html
│       ├── Weekend.html
│       ├── Shubh.html
│       ├── Sidhu.html
│       └── Tal.html
```

---

## 🎶 Adding Your Own Songs

1. Place your `.mp3` files in the appropriate `Songs/<ArtistName>/` folder.
2. Open the corresponding JS file (e.g., `ASSETS/js/Honey.js`).
3. Update the `music_list` array with your track details:

   ```javascript
   {
       img: '/Images/YourCover.jpg',
       name: 'Your Song Title',
       artist: 'Artist Name',
       music: '/Songs/Honey/YourSong.mp3'
   }
   ```

4. Save and refresh the page.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5** | Page structure and semantic markup |
| **CSS3** | Styling, animations, responsive design |
| **JavaScript (ES6)** | Player logic, playlist management |
| **Font Awesome 6** | Icons (play, pause, music, etc.) |
| **Google Fonts** | Modern typography (Inter, Roboto) |
| **localStorage** | Persist custom playlist tracks |

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the **MIT License**.

---

## 👨‍💻 Author

**Panshul Gupta**
- 📧 [panshulgupta0209@gmail.com](mailto:panshulgupta0209@gmail.com)
- 📷 [@panshul_gupta03](https://www.instagram.com/panshul_gupta03/)
- 💼 [LinkedIn](https://www.linkedin.com/in/panshul-gupta-862373324/)

---

> Made with ❤️ by Panshul Gupta · In The Zone
