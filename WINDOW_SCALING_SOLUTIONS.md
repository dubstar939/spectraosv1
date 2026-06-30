# ═══════════════════════════════════════════
# SPECTRAOS — WINDOW SCALING & FULLSCREEN FIXES
# Direct integration solutions for responsive app content
# ═══════════════════════════════════════════

## PROBLEM ANALYSIS

Based on the screenshots (1000009391.png and 1000009395.png), the issues are:
1. **Dead space around apps**: Calculator and Calendar apps don't fill their window containers
2. **Fixed iframe dimensions**: Apps render at fixed sizes regardless of window dimensions
3. **No aspect ratio preservation**: Content doesn't scale proportionally when resizing

## ═══════════════════════════════════════════
## SOLUTION 1: DYNAMIC WINDOW SCALING (CSS)
## ═══════════════════════════════════════════

### Add these CSS rules to your index.html <style> section or styles.css:

```css
/* ═══════════════════════════════════════════
   ENHANCED WM-CONTENT WITH CONTAINER QUERIES
   ═══════════════════════════════════════════ */

.wm-content {
  /* Force content to fill available space */
  flex: 1;
  width: 100%;
  height: calc(100% - var(--titlebar-height, 36px));
  overflow: hidden;
  position: relative;
  
  /* Enable container queries for child components */
  container-type: size;
  container-name: wm-content;
  
  /* Ensure proper layout */
  display: flex;
  flex-direction: column;
}

/* Iframe fills container completely */
.wm-content iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  
  /* Critical: Allow transform scaling */
  transform-origin: top left;
  will-change: transform;
  
  /* Prevent default responsive behavior that conflicts with our scaling */
  min-width: 0;
  min-height: 0;
}

/* ═══════════════════════════════════════════
   SMART SCALE TRANSFORM FOR APP CONTENT
   ═══════════════════════════════════════════ */

/* When iframe is scaled, ensure it stays positioned correctly */
.wm-content iframe.scaled {
  position: absolute;
  top: 0;
  left: 0;
}

/* Container query: Adjust based on wm-content size, not viewport */
@container wm-content (min-width: 800px) {
  .wm-content iframe {
    /* Larger windows can show content at native resolution */
  }
}

@container wm-content (max-width: 799px) {
  .wm-content iframe {
    /* Smaller windows need scaling */
  }
}

/* ═══════════════════════════════════════════
   ASPECT RATIO PRESERVATION (OPTIONAL)
   ═══════════════════════════════════════════ */

/* For apps that must maintain specific aspect ratio */
.wm-content.preserve-aspect {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
}

.wm-content.preserve-aspect iframe {
  /* Let JS handle the exact positioning */
}

/* ═══════════════════════════════════════════
   FULLSCREEN MODE STYLES
   ═══════════════════════════════════════════ */

.wm-window.fullscreen {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  border-radius: 0 !important;
  z-index: 99999 !important;
  border: none !important;
  box-shadow: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Hide titlebar in fullscreen for immersive experience */
.wm-window.fullscreen .wm-titlebar {
  display: none !important;
}

/* Hide resize handle in fullscreen */
.wm-window.fullscreen .wm-resize {
  display: none !important;
}

/* Fullscreen content fills entire viewport */
.wm-window.fullscreen .wm-content {
  height: 100vh !important;
  width: 100vw !important;
}

/* Exit fullscreen button appears only in fullscreen mode */
.wm-window.fullscreen .exit-fullscreen-btn {
  display: flex !important;
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 100000;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
}

.wm-window.fullscreen .exit-fullscreen-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.6);
}

/* Hidden by default */
.exit-fullscreen-btn {
  display: none !important;
}
```

## ═══════════════════════════════════════════
## SOLUTION 2: FULLSCREEN TOGGLE LOGIC (JavaScript)
## ═══════════════════════════════════════════

### Replace or enhance your existing toggleFullscreen function:

```javascript
/**
 * Enhanced Fullscreen Toggle Logic
 * Toggles window between normal and true viewport-filling fullscreen
 * @param {string} id - Window ID
 */
function toggleFullscreen(id) {
  const w = document.getElementById(id);
  if (!w) return;
  
  const btn = w.querySelector('.wm-btn.max');
  const isFullscreen = w.classList.contains('fullscreen');
  const appTitle = w.querySelector('.wm-title span:last-child')?.textContent || 'window';
  
  if (isFullscreen) {
    // === EXIT FULLSCREEN ===
    w.classList.remove('fullscreen');
    
    // Restore previous dimensions from data attributes
    if (w.dataset.prevLeft) w.style.left = w.dataset.prevLeft;
    if (w.dataset.prevTop) w.style.top = w.dataset.prevTop;
    if (w.dataset.prevWidth) w.style.width = w.dataset.prevWidth;
    if (w.dataset.prevHeight) w.style.height = w.dataset.prevHeight;
    if (w.dataset.prevZIndex) w.style.zIndex = w.dataset.prevZIndex;
    
    // Remove exit fullscreen button
    const exitBtn = w.querySelector('.exit-fullscreen-btn');
    if (exitBtn) exitBtn.remove();
    
    // Update button UI
    if (btn) {
      btn.setAttribute('aria-label', `Toggle fullscreen for ${appTitle}`);
      btn.textContent = '⛶';
      btn.title = 'Fullscreen';
    }
    
    // Restore iframe scaling if needed
    const iframe = w.querySelector('.wm-content iframe');
    if (iframe && iframe.dataset.originalWidth) {
      // Re-trigger resize observer to recalculate scale
      const content = w.querySelector('.wm-content');
      if (content && content._resizeObserver) {
        content._resizeObserver.observe(content);
      }
    }
    
    console.log(`[WindowManager] Exited fullscreen for ${appTitle}`);
    
  } else {
    // === ENTER FULLSCREEN ===
    
    // Save current state for restoration
    w.dataset.prevLeft = w.style.left;
    w.dataset.prevTop = w.style.top;
    w.dataset.prevWidth = w.style.width;
    w.dataset.prevHeight = w.style.height;
    w.dataset.prevZIndex = w.style.zIndex;
    
    // Apply fullscreen styles via class (CSS handles the rest)
    w.classList.add('fullscreen');
    
    // Force reflow to ensure styles apply
    void w.offsetWidth;
    
    // Set maximum z-index
    w.style.zIndex = '99999';
    
    // Add exit fullscreen button for better UX
    const exitBtn = document.createElement('button');
    exitBtn.className = 'exit-fullscreen-btn';
    exitBtn.innerHTML = '⛶ Exit Fullscreen';
    exitBtn.setAttribute('aria-label', `Exit fullscreen for ${appTitle}`);
    exitBtn.onclick = () => toggleFullscreen(id);
    w.appendChild(exitBtn);
    
    // Update button UI
    if (btn) {
      btn.setAttribute('aria-label', `Exit fullscreen for ${appTitle}`);
      btn.textContent = '❐';
      btn.title = 'Exit Fullscreen';
    }
    
    // Reset iframe transform to fill viewport at native resolution
    const iframe = w.querySelector('.wm-content iframe');
    if (iframe) {
      iframe.style.transform = 'none';
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
    }
    
    // Focus the window
    focusWindow(id);
    
    console.log(`[WindowManager] Entered fullscreen for ${appTitle}`);
    
    // Show notification
    if (typeof notifSystem !== 'undefined') {
      notifSystem.add('Fullscreen', `${appTitle} is now fullscreen`, '⛶');
    }
  }
  
  // Dispatch event for other components
  window.dispatchEvent(new CustomEvent('window:fullscreen', {
    detail: { windowId: id, isFullscreen: !isFullscreen }
  }));
}

/**
 * Alternative: Programmatic Fullscreen API (browser native)
 * Use this if you want true browser fullscreen (F11-like)
 */
function toggleNativeFullscreen(element) {
  if (!document.fullscreenElement) {
    element.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}
```

## ═══════════════════════════════════════════
## SOLUTION 3: IMPROVED IFRAME SCALING FUNCTION
## ═══════════════════════════════════════════

### Replace your existing scaleIframeContent with this enhanced version:

```javascript
/**
 * Enhanced Iframe Content Scaling
 * Scales iframe content to fit container while preserving aspect ratio
 * @param {HTMLIFrameElement} iframe - The iframe to scale
 * @param {number} containerWidth - Available container width
 * @param {number} containerHeight - Available container height
 */
function scaleIframeContent(iframe, containerWidth, containerHeight) {
  if (!iframe || !iframe.dataset.originalWidth) return;
  
  // Skip scaling in fullscreen mode
  const windowEl = iframe.closest('.wm-window');
  if (windowEl && windowEl.classList.contains('fullscreen')) {
    iframe.style.transform = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    return;
  }
  
  const originalWidth = parseFloat(iframe.dataset.originalWidth);
  const originalHeight = parseFloat(iframe.dataset.originalHeight);
  
  if (originalWidth === 0 || originalHeight === 0) return;
  
  // Calculate scale factors
  const scaleX = containerWidth / originalWidth;
  const scaleY = containerHeight / originalHeight;
  
  // Use the larger scale to fill container (or smaller to fit entirely)
  // Change Math.min to Math.max if you want to crop instead of letterbox
  const scale = Math.min(scaleX, scaleY);
  
  // Clamp scale to reasonable bounds
  const clampedScale = Math.max(0.25, Math.min(scale, 4));
  
  // Apply smooth scaling
  iframe.style.transformOrigin = 'top left';
  iframe.style.transform = `scale(${clampedScale})`;
  
  // Set dimensions to match scaled content
  iframe.style.width = `${originalWidth}px`;
  iframe.style.height = `${originalHeight}px`;
  
  // Optional: Center the scaled content if there's extra space
  const scaledWidth = originalWidth * clampedScale;
  const scaledHeight = originalHeight * clampedScale;
  const offsetX = (containerWidth - scaledWidth) / 2;
  const offsetY = (containerHeight - scaledHeight) / 2;
  
  // Only apply offset if using Math.min (fit mode)
  if (scale === Math.min(scaleX, scaleY)) {
    iframe.style.position = 'absolute';
    iframe.style.left = `${offsetX}px`;
    iframe.style.top = `${offsetY}px`;
  }
}
```

## ═══════════════════════════════════════════
## SOLUTION 4: APP LOCKER REGISTRY STRUCTURE
## ═══════════════════════════════════════════

### Simple JavaScript object structure for App Locker:

```javascript
/**
 * App Registry Structure
 * Maps app IDs to their metadata and components
 */
const appRegistry = {
  // Built-in System Apps (always installed)
  'calculator': {
    id: 'calculator',
    name: 'Calculator',
    icon: '🧮',
    file: 'app37_calculator.html',
    category: 'Utilities',
    systemApp: true,
    description: 'Basic calculator application',
    version: '1.0.0'
  },
  
  'calendar': {
    id: 'calendar',
    name: 'Calendar',
    icon: '📅',
    file: 'app38_calendar.html',
    category: 'Productivity',
    systemApp: true,
    description: 'Calendar and scheduling app',
    version: '1.0.0'
  },
  
  'notes': {
    id: 'notes',
    name: 'Notes',
    icon: '📝',
    file: 'app39_notes.html',
    category: 'Productivity',
    systemApp: true,
    description: 'Note-taking application',
    version: '1.0.0'
  },
  
  // Third-party Apps (installable)
  'tetris': {
    id: 'tetris',
    name: 'Tetris',
    icon: '🎮',
    file: 'app22_tetris.html',
    category: 'Games',
    systemApp: false,
    description: 'Classic Tetris game',
    version: '1.0.0',
    size: '256 KB',
    developer: 'SpectraArcade'
  },
  
  'weather': {
    id: 'weather',
    name: 'Weather',
    icon: '🌤️',
    file: 'app40_weather.html',
    category: 'Utilities',
    systemApp: false,
    description: 'Live weather forecasts',
    version: '1.0.0',
    size: '512 KB',
    developer: 'SpectraOS'
  }
};

/**
 * Usage Example:
 */

// Check if app exists
if (appRegistry['calculator']) {
  openApp(appRegistry['calculator'].file);
}

// Get all games
const games = Object.values(appRegistry).filter(app => 
  app.category === 'Games' && !app.systemApp
);

// Install an app
appLocker.install('tetris');

// Launch only if installed
if (appLocker.isInstalled('tetris')) {
  openApp(appRegistry['tetris'].file);
  appLocker.recordLaunch('tetris');
}
```

## ═══════════════════════════════════════════
## SOLUTION 5: CSS VARIABLE THEME SYSTEM
## ═══════════════════════════════════════════

### Complete CSS Variable Theme Implementation:

```css
/* ═══════════════════════════════════════════
   THEME VARIABLES (Add to :root in styles.css)
   ═══════════════════════════════════════════ */

:root {
  /* Default Spectra Theme */
  --window-border-radius: 14px;
  --window-border-width: 1px;
  --window-shadow: 0 20px 60px rgba(0,0,0,0.4);
  --window-backdrop-blur: 20px;
  --titlebar-height: 36px;
  --titlebar-bg: rgba(0,0,0,0.2);
  --control-style: circle;
  --control-size: 12px;
  --control-spacing: 6px;
  
  /* Color Palette */
  --accent: #00ff88;
  --accent2: #00ccff;
  --bg: #0a0a0f;
  --glass: rgba(20, 20, 35, 0.75);
  --glass-border: rgba(255, 255, 255, 0.08);
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --focus-ring: rgba(0, 255, 136, 0.6);
}

/* ═══════════════════════════════════════════
   WINDOWS THEME CLASS
   ═══════════════════════════════════════════ */

body.windows-theme,
[data-theme="windows"] {
  --window-border-radius: 8px;
  --window-border-width: 1px;
  --window-shadow: 0 4px 20px rgba(0,0,0,0.3);
  --window-backdrop-blur: 15px;
  --titlebar-height: 32px;
  --titlebar-bg: rgba(32, 32, 32, 0.9);
  --control-style: square;
  --control-size: 10px;
  --control-spacing: 4px;
  
  --accent: #0078d4;
  --accent2: #00bcf2;
  --bg: #202020;
  --glass: rgba(32, 32, 32, 0.85);
  --glass-border: rgba(255, 255, 255, 0.05);
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --focus-ring: rgba(0, 120, 212, 0.5);
}

/* ═══════════════════════════════════════════
   MACOS THEME CLASS
   ═══════════════════════════════════════════ */

body.macos-theme,
[data-theme="macos"] {
  --window-border-radius: 12px;
  --window-border-width: 1px;
  --window-shadow: 0 25px 80px rgba(0,0,0,0.5);
  --window-backdrop-blur: 25px;
  --titlebar-height: 38px;
  --titlebar-bg: rgba(30, 30, 30, 0.6);
  --control-style: circle;
  --control-size: 12px;
  --control-spacing: 8px;
  
  --accent: #007aff;
  --accent2: #5ac8fa;
  --bg: #1e1e1e;
  --glass: rgba(30, 30, 30, 0.75);
  --glass-border: rgba(255, 255, 255, 0.1);
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --focus-ring: rgba(0, 122, 255, 0.5);
}

/* ═══════════════════════════════════════════
   UBUNTU THEME CLASS
   ═══════════════════════════════════════════ */

body.ubuntu-theme,
[data-theme="ubuntu"] {
  --window-border-radius: 6px;
  --window-border-width: 1px;
  --window-shadow: 0 8px 32px rgba(0,0,0,0.4);
  --window-backdrop-blur: 10px;
  --titlebar-height: 34px;
  --titlebar-bg: rgba(45, 45, 45, 0.95);
  --control-style: circle;
  --control-size: 14px;
  --control-spacing: 6px;
  
  --accent: #e95420;
  --accent2: #c7162b;
  --bg: #2d2d2d;
  --glass: rgba(45, 45, 45, 0.9);
  --glass-border: rgba(255, 255, 255, 0.08);
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --focus-ring: rgba(233, 84, 32, 0.5);
}

/* ═══════════════════════════════════════════
   CYBERPUNK THEME CLASS
   ═══════════════════════════════════════════ */

body.cyberpunk-theme,
[data-theme="cyberpunk"] {
  --window-border-radius: 0px;
  --window-border-width: 2px;
  --window-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
  --window-backdrop-blur: 5px;
  --titlebar-height: 40px;
  --titlebar-bg: rgba(10, 10, 20, 0.98);
  --control-style: square;
  --control-size: 14px;
  --control-spacing: 8px;
  
  --accent: #00ff88;
  --accent2: #ff00ff;
  --bg: #0a0a14;
  --glass: rgba(10, 10, 20, 0.95);
  --glass-border: rgba(0, 255, 136, 0.3);
  --text-primary: #ffffff;
  --text-secondary: #00ff88;
  --focus-ring: rgba(0, 255, 136, 0.8);
}

/* ═══════════════════════════════════════════
   APPLY THEME VARIABLES TO COMPONENTS
   ═══════════════════════════════════════════ */

/* Windows use theme variables */
.wm-window {
  border-radius: var(--window-border-radius);
  border-width: var(--window-border-width);
  box-shadow: var(--window-shadow);
  backdrop-filter: blur(var(--window-backdrop-blur)) saturate(1.5);
  -webkit-backdrop-filter: blur(var(--window-backdrop-blur)) saturate(1.5);
}

.wm-titlebar {
  height: var(--titlebar-height);
  background: var(--titlebar-bg);
}

/* Window controls adapt to theme */
.wm-btn {
  width: var(--control-size);
  height: var(--control-size);
  border-radius: var(--control-style) == 'circle' ? 50% : 4px;
}

.wm-controls {
  gap: var(--control-spacing);
}

/* Desktop background uses theme colors */
#desktop-bg {
  background: var(--bg);
}

/* Top bar uses theme glass */
#top-bar {
  background: var(--glass);
  border-bottom: 1px solid var(--glass-border);
}
```

### JavaScript Theme Switcher Function:

```javascript
/**
 * Theme Switcher Function
 * Toggles theme by setting class on body and data attribute
 * @param {string} themeName - Theme name (windows, macos, ubuntu, cyberpunk, default)
 */
function setTheme(themeName) {
  const body = document.body;
  const root = document.documentElement;
  
  // Remove all theme classes
  body.classList.remove('windows-theme', 'macos-theme', 'ubuntu-theme', 'cyberpunk-theme');
  root.removeAttribute('data-theme');
  
  // Apply new theme
  if (themeName !== 'default') {
    body.classList.add(`${themeName}-theme`);
    root.setAttribute('data-theme', themeName);
  }
  
  // Save to localStorage
  try {
    localStorage.setItem('spectraos-theme', themeName);
  } catch (e) {
    console.warn('Could not save theme preference:', e);
  }
  
  // Dispatch event for components to react
  window.dispatchEvent(new CustomEvent('theme:changed', {
    detail: { theme: themeName }
  }));
  
  console.log(`[Theme] Switched to ${themeName} theme`);
}

/**
 * Load saved theme on startup
 */
function loadSavedTheme() {
  try {
    const savedTheme = localStorage.getItem('spectraos-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  } catch (e) {
    console.warn('Could not load theme preference:', e);
  }
}

// Call on page load
loadSavedTheme();
```

## ═══════════════════════════════════════════
## INTEGRATION CHECKLIST
## ═══════════════════════════════════════════

### Step 1: Add CSS to styles.css or index.html <style>
- [ ] Copy "ENHANCED WM-CONTENT" CSS rules
- [ ] Copy "SMART SCALE TRANSFORM" CSS rules
- [ ] Copy "FULLSCREEN MODE STYLES" CSS rules
- [ ] Copy all theme variable definitions

### Step 2: Update JavaScript in index.html
- [ ] Replace `toggleFullscreen()` function
- [ ] Replace `scaleIframeContent()` function
- [ ] Add `setTheme()` and `loadSavedTheme()` functions
- [ ] Add `appRegistry` object

### Step 3: Update Window Creation
- [ ] Ensure `openApp()` sets iframe data attributes:
  ```javascript
  iframe.dataset.originalWidth = '900';
  iframe.dataset.originalHeight = '650';
  ```

### Step 4: Test
- [ ] Resize windows - content should scale smoothly
- [ ] Click maximize button - should enter true fullscreen
- [ ] Press ESC in fullscreen - should exit
- [ ] Switch themes - entire UI should update instantly

## ═══════════════════════════════════════════
## USAGE EXAMPLES
## ═══════════════════════════════════════════

```javascript
// Switch to Windows theme
setTheme('windows');

// Switch to macOS theme
setTheme('macos');

// Install an app
appLocker.install('tetris');

// Check if installed
if (appLocker.isInstalled('tetris')) {
  openApp('app22_tetris.html');
}

// Toggle fullscreen programmatically
toggleFullscreen('win-123456');

// Enter native browser fullscreen
toggleNativeFullscreen(document.getElementById('win-123456'));
```
