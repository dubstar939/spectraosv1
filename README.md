# SpectraOS v1.0

A sleek, web-based Linux-style operating system recreated entirely in the browser.

## Overview

SpectraOS delivers a premium cyber-minimalist desktop environment with:
- **Dark, glassy UI** with neon accent colors
- **Draggable, resizable windows** with smooth transitions
- **Modular app registration system** - easy to extend
- **Virtual filesystem** simulation
- **50+ functional apps** across creative, dev, gaming, and utility categories

## Quick Start

Simply open `index.html` in any modern web browser. No build step required.

## Architecture

```
spectraos/
├── index.html          # Desktop environment (window manager, launcher, dock)
├── apps/
│   ├── spectra.css     # Shared styles for all apps
│   ├── app01-50.html   # Individual application modules
│   └── ...
└── assets/             # Static assets (if needed)
```

## App Categories

### Creative Tools (10 apps)
- Pixel Art Editor, Vector Drawing, Mini Art Studio
- Sprite Sheet Viewer, Animation Timeline
- Soundboard, Chiptune Tracker
- Color Palette Generator, Wallpaper Designer, Logo Playground

### Developer Tools (11 apps)
- Code Editor, Terminal, Git Client
- API Tester, JSON Formatter, Markdown Editor
- Regex Tester, Package Manager, Virtual FS
- File Manager, System Monitor

### Gaming (11 apps)
- Tetris, Pong, Breakout, Snake
- Match-3, Minesweeper
- Pixel Platformer, Sliding Tiles
- Particle Sim, Physics Toy, Spectra Arcade Hub

### Utilities (18 apps)
- Calculator, Calendar, Notes, Weather
- Music Player, Video Player, Image Viewer
- Clipboard Manager, Settings, Notifications
- Task Manager, Browser, and more

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Toggle App Launcher |
| `Ctrl/Cmd + T` | Open Terminal |
| `Ctrl/Cmd + N` | Open Notes |
| `Ctrl/Cmd + E` | Open Code Editor |

## Extending SpectraOS

To add a new app:

1. Create `apps/appXX_yourapp.html` using the shared `spectra.css`
2. Register it in `index.html` app registry
3. Add an icon to the launcher grid

## Technical Details

- **Pure HTML/CSS/JS** - no frameworks required
- **Web Audio API** for sound generation
- **Canvas API** for graphics and games
- **CSS Grid/Flexbox** for layouts
- **CSS Variables** for theming
- **postMessage API** for app-to-desktop communication

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT License - Built for the Spectra community.
