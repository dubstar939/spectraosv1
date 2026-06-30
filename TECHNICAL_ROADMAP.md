# SpectraOS Technical Roadmap

## Overview
This document outlines the technical roadmap and implementation patterns for scaling, UX, and architectural improvements in SpectraOS.

---

## 1. Window Management & Responsive Scaling

### Current State
- ✅ Basic window manager implemented in `core.js`
- ✅ Resize handles (8-directional) implemented
- ✅ Fullscreen mode with hidden controls
- ✅ Widget scaling using `transform: scale()`
- ✅ App-specific minimum window sizes supported

### Issues to Address
1. **Content Scaling**: Apps inside windows need better responsive scaling
2. **Aspect Ratio Preservation**: Content should maintain aspect ratio when needed
3. **Container Queries**: Better than media queries for individual window components

### Implementation Patterns

#### A. CSS Container Queries (Modern Approach)
```css
/* Enable container queries on window content */
.wm-content {
  container-type: size;
  container-name: window-content;
}

/* Responsive app layouts based on container size */
@container window-content (min-width: 600px) {
  .app-layout {
    grid-template-columns: 250px 1fr;
  }
}

@container window-content (max-width: 599px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
}
```

#### B. Smart Scaling with transform: scale()
```javascript
// Enhanced scaling function in core.js
scaleWindowContent(content, containerWidth, containerHeight) {
  const widget = content.querySelector('canvas, .app-root, iframe');
  if (!widget) return;
  
  // Store original dimensions on first run
  let originalWidth = parseFloat(widget.dataset.originalWidth || widget.offsetWidth);
  let originalHeight = parseFloat(widget.dataset.originalHeight || widget.offsetHeight);
  
  if (!widget.dataset.originalWidth) {
    widget.dataset.originalWidth = originalWidth;
    widget.dataset.originalHeight = originalHeight;
  }
  
  // Calculate scale factors
  const scaleX = containerWidth / originalWidth;
  const scaleY = containerHeight / originalHeight;
  
  // Get app's scaling policy from registry
  const appId = content.closest('.wm-window').dataset.appId;
  const appConfig = AppRegistry.get(appId);
  const scalePolicy = appConfig?.scalePolicy || 'fill'; // 'fill', 'fit', 'stretch'
  
  let scale;
  switch (scalePolicy) {
    case 'fit':
      // Maintain aspect ratio, fit within container
      scale = Math.min(scaleX, scaleY);
      break;
    case 'cover':
      // Maintain aspect ratio, cover entire container
      scale = Math.max(scaleX, scaleY);
      break;
    case 'stretch':
      // Fill container, ignore aspect ratio
      widget.style.transform = `scale(${scaleX}, ${scaleY})`;
      widget.style.width = '100%';
      widget.style.height = '100%';
      return;
    default: // 'fill'
      scale = Math.min(scaleX, scaleY);
  }
  
  widget.style.transform = `scale(${scale})`;
  widget.style.transformOrigin = 'top left';
  widget.style.width = `${originalWidth}px`;
  widget.style.height = `${originalHeight}px`;
}
```

#### C. Full-Screen Implementation
Already implemented in `index.html`. Key features:
- Toggle button (⛶) in window titlebar
- Press Escape to exit fullscreen
- Titlebar and resize handles hidden in fullscreen
- Content fills 100vw × 100vh

---

## 2. App Locker (Application Manager)

### Goal
Allow users to install/uninstall apps from their desktop/dashboard.

### Architecture

#### A. App Registry Structure
```javascript
// Enhanced AppRegistry with installation state management
class AppRegistryClass {
  constructor() {
    this.apps = new Map();
    this.storageKey = 'spectraos-app-registry';
    this.installedApps = new Set();
    this.loadFromStorage();
  }
  
  register(app) {
    this.apps.set(app.id, {
      ...app,
      installed: app.installed !== false, // Default to installed
      version: app.version || '1.0.0',
      size: app.size || 'N/A',
      developer: app.developer || 'SpectraOS',
      description: app.description || '',
      screenshots: app.screenshots || [],
      tags: app.tags || []
    });
    if (app.installed !== false) {
      this.installedApps.add(app.id);
    }
  }
  
  install(appId) {
    const app = this.apps.get(appId);
    if (!app) return false;
    
    app.installed = true;
    this.installedApps.add(appId);
    this.saveToStorage();
    
    // Notify system
    window.dispatchEvent(new CustomEvent('app:installed', { detail: { appId } }));
    
    return true;
  }
  
  uninstall(appId) {
    const app = this.apps.get(appId);
    if (!app) return false;
    
    // Prevent uninstalling system apps
    if (app.systemApp) {
      console.warn(`Cannot uninstall system app: ${appId}`);
      return false;
    }
    
    app.installed = false;
    this.installedApps.delete(appId);
    this.saveToStorage();
    
    // Close any open windows for this app
    Array.from(WM.windows.values())
      .filter(w => w.appId === appId)
      .forEach(w => WM.closeWindow(w.element.id));
    
    // Notify system
    window.dispatchEvent(new CustomEvent('app:uninstalled', { detail: { appId } }));
    
    return true;
  }
  
  getInstalled() {
    return this.getAll().filter(app => app.installed);
  }
  
  getAvailable() {
    return this.getAll().filter(app => !app.installed);
  }
  
  saveToStorage() {
    const data = {
      installedApps: Array.from(this.installedApps),
      appStates: {}
    };
    
    this.apps.forEach((app, id) => {
      data.appStates[id] = {
        installed: app.installed,
        lastOpened: app.lastOpened
      };
    });
    
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }
  
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.installedApps) {
          this.installedApps = new Set(parsed.installedApps);
        }
        // Restore app states when apps are registered
        this.pendingStates = parsed.appStates || {};
      }
    } catch (e) {
      console.error('Failed to load app registry:', e);
    }
  }
}
```

#### B. App Store Component
```html
<!-- App Store UI -->
<div id="app-store" class="modal hidden">
  <div class="modal-header">
    <h2>📦 App Store</h2>
    <button onclick="closeAppStore()">✕</button>
  </div>
  
  <div class="store-tabs">
    <button class="tab active" data-tab="installed">Installed</button>
    <button class="tab" data-tab="available">Available</button>
    <button class="tab" data-tab="all">All Apps</button>
  </div>
  
  <div class="store-search">
    <input type="text" placeholder="Search apps..." id="store-search">
  </div>
  
  <div class="store-grid" id="store-grid">
    <!-- App cards rendered here -->
  </div>
</div>

<style>
#app-store {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.store-modal {
  width: 90%;
  max-width: 1000px;
  height: 80vh;
  background: var(--glass);
  backdrop-filter: blur(30px);
  border-radius: 20px;
  padding: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.store-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 12px;
}

.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  overflow-y: auto;
  padding: 8px;
}

.app-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
  cursor: pointer;
}

.app-card:hover {
  background: rgba(255,255,255,0.1);
  transform: translateY(-2px);
}

.app-card-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: 12px;
}

.app-card-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.app-card-dev {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.app-card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
}

.install-btn {
  background: var(--accent);
  color: #000;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.install-btn:hover {
  filter: brightness(1.2);
}

.install-btn.installed {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.uninstall-btn {
  background: #ff5f57;
  color: #fff;
}
</style>
```

#### C. App Card Rendering
```javascript
function renderAppCard(app) {
  return `
    <div class="app-card" data-app-id="${app.id}">
      <div class="app-card-icon" style="color: ${app.accent || 'var(--accent)'}">
        ${app.icon}
      </div>
      <div class="app-card-name">${app.name}</div>
      <div class="app-card-dev">${app.developer}</div>
      <div class="app-card-meta">
        <span>${app.size}</span>
        <span>v${app.version}</span>
      </div>
      <button 
        class="install-btn ${app.installed ? 'installed' : ''}"
        onclick="handleAppInstall('${app.id}', ${app.installed})"
      >
        ${app.installed ? '✓ Installed' : 'Install'}
      </button>
    </div>
  `;
}

function handleAppInstall(appId, isInstalled) {
  if (isInstalled) {
    if (confirm('Uninstall this app?')) {
      AppRegistry.uninstall(appId);
      renderAppStore('installed');
    }
  } else {
    AppRegistry.install(appId);
    renderAppStore('available');
    
    // Show notification
    notifSystem.add(
      'App Installed',
      `${AppRegistry.get(appId).name} has been added to your launcher`,
      '📦'
    );
  }
}
```

---

## 3. Theming & Customization Engine

### Goal
Allow users to switch UI/UX styles (Windows-like vs macOS-like) dynamically.

### Architecture

#### A. CSS Variables Theme System
```css
/* ===== THEME DEFINITIONS ===== */

/* Base theme variables */
:root {
  /* Window appearance */
  --window-border-radius: 14px;
  --window-border-width: 1px;
  --window-shadow: 0 20px 60px rgba(0,0,0,0.4);
  --window-backdrop-blur: 20px;
  
  /* Titlebar */
  --titlebar-height: 36px;
  --titlebar-bg: rgba(0,0,0,0.2);
  --titlebar-border: 1px solid var(--glass-border);
  
  /* Window controls */
  --control-style: 'circle'; /* circle, square, pill */
  --control-size: 12px;
  --control-spacing: 6px;
  
  /* Colors */
  --accent: #00ff88;
  --accent2: #00ccff;
  --bg: #0a0a0f;
  --glass: rgba(20, 20, 35, 0.75);
  --glass-border: rgba(255, 255, 255, 0.08);
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
}

/* Windows 11 Theme */
[data-theme="windows"] {
  --window-border-radius: 8px;
  --window-shadow: 0 4px 20px rgba(0,0,0,0.3);
  --titlebar-height: 32px;
  --control-style: 'square';
  --control-size: 10px;
  --accent: #0078d4;
  --accent2: #00bcf2;
  --glass: rgba(32, 32, 32, 0.85);
}

/* macOS Theme */
[data-theme="macos"] {
  --window-border-radius: 12px;
  --window-shadow: 0 25px 80px rgba(0,0,0,0.5);
  --titlebar-height: 38px;
  --control-style: 'circle';
  --control-size: 12px;
  --control-spacing: 8px;
  --accent: #007aff;
  --accent2: #5ac8fa;
  --glass: rgba(30, 30, 30, 0.75);
}

/* Ubuntu/GNOME Theme */
[data-theme="ubuntu"] {
  --window-border-radius: 6px;
  --window-shadow: 0 8px 32px rgba(0,0,0,0.4);
  --titlebar-height: 34px;
  --control-style: 'circle';
  --control-size: 14px;
  --accent: #e95420;
  --accent2: #c7162b;
  --glass: rgba(45, 45, 45, 0.9);
}

/* Cyberpunk Theme */
[data-theme="cyberpunk"] {
  --window-border-radius: 0px;
  --window-border-width: 2px;
  --window-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
  --titlebar-height: 40px;
  --control-style: 'square';
  --control-size: 14px;
  --accent: #00ff88;
  --accent2: #ff00ff;
  --glass: rgba(10, 10, 20, 0.95);
  --glass-border: rgba(0, 255, 136, 0.3);
}
```

#### B. Theme Provider Class
```javascript
class ThemeManager {
  constructor() {
    this.storageKey = 'spectraos-theme';
    this.themes = new Map();
    this.currentTheme = 'default';
    this.registerDefaultThemes();
    this.loadFromStorage();
  }
  
  registerDefaultThemes() {
    this.themes.set('default', {
      name: 'Spectra Default',
      icon: '◉',
      preview: '#00ff88',
      cssVars: {
        '--window-border-radius': '14px',
        '--window-shadow': '0 20px 60px rgba(0,0,0,0.4)',
        '--titlebar-height': '36px',
        '--control-style': 'circle',
        '--accent': '#00ff88',
        '--accent2': '#00ccff'
      }
    });
    
    this.themes.set('windows', {
      name: 'Windows 11',
      icon: '🪟',
      preview: '#0078d4',
      cssVars: {
        '--window-border-radius': '8px',
        '--window-shadow': '0 4px 20px rgba(0,0,0,0.3)',
        '--titlebar-height': '32px',
        '--control-style': 'square',
        '--accent': '#0078d4',
        '--accent2': '#00bcf2'
      }
    });
    
    this.themes.set('macos', {
      name: 'macOS',
      icon: '🍎',
      preview: '#007aff',
      cssVars: {
        '--window-border-radius': '12px',
        '--window-shadow': '0 25px 80px rgba(0,0,0,0.5)',
        '--titlebar-height': '38px',
        '--control-style': 'circle',
        '--accent': '#007aff',
        '--accent2': '#5ac8fa'
      }
    });
    
    this.themes.set('ubuntu', {
      name: 'Ubuntu',
      icon: '🐧',
      preview: '#e95420',
      cssVars: {
        '--window-border-radius': '6px',
        '--window-shadow': '0 8px 32px rgba(0,0,0,0.4)',
        '--titlebar-height': '34px',
        '--control-style': 'circle',
        '--accent': '#e95420',
        '--accent2': '#c7162b'
      }
    });
    
    this.themes.set('cyberpunk', {
      name: 'Cyberpunk',
      icon: '🤖',
      preview: '#00ff88',
      cssVars: {
        '--window-border-radius': '0px',
        '--window-border-width': '2px',
        '--window-shadow': '0 0 20px rgba(0, 255, 136, 0.3)',
        '--titlebar-height': '40px',
        '--control-style': 'square',
        '--accent': '#00ff88',
        '--accent2': '#ff00ff'
      }
    });
  }
  
  setTheme(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) {
      console.warn(`Theme "${themeId}" not found`);
      return false;
    }
    
    // Apply CSS variables
    const root = document.documentElement;
    Object.entries(theme.cssVars).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });
    
    // Set data attribute for CSS selectors
    root.setAttribute('data-theme', themeId);
    
    this.currentTheme = themeId;
    this.saveToStorage();
    
    // Dispatch event for components to react
    window.dispatchEvent(new CustomEvent('theme:changed', { 
      detail: { themeId, theme } 
    }));
    
    return true;
  }
  
  getTheme(themeId) {
    return this.themes.get(themeId);
  }
  
  getAllThemes() {
    return Array.from(this.themes.values());
  }
  
  installTheme(themeData) {
    // Allow installing custom themes
    this.themes.set(themeData.id, {
      name: themeData.name,
      icon: themeData.icon || '🎨',
      preview: themeData.preview || themeData.cssVars['--accent'],
      cssVars: themeData.cssVars,
      custom: true
    });
    
    this.saveToStorage();
    return true;
  }
  
  uninstallTheme(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme || !theme.custom) {
      return false; // Can't uninstall built-in themes
    }
    
    this.themes.delete(themeId);
    if (this.currentTheme === themeId) {
      this.setTheme('default');
    }
    this.saveToStorage();
    return true;
  }
  
  exportTheme(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) return null;
    
    return {
      id: themeId,
      name: theme.name,
      icon: theme.icon,
      preview: theme.preview,
      cssVars: theme.cssVars,
      version: '1.0.0'
    };
  }
  
  importTheme(themeData) {
    if (!themeData.id || !themeData.cssVars) {
      throw new Error('Invalid theme format');
    }
    return this.installTheme(themeData);
  }
  
  saveToStorage() {
    const data = {
      currentTheme: this.currentTheme,
      customThemes: {}
    };
    
    this.themes.forEach((theme, id) => {
      if (theme.custom) {
        data.customThemes[id] = theme;
      }
    });
    
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }
  
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        
        // Load custom themes
        if (parsed.customThemes) {
          Object.entries(parsed.customThemes).forEach(([id, theme]) => {
            this.themes.set(id, theme);
          });
        }
        
        // Restore current theme
        if (parsed.currentTheme && this.themes.has(parsed.currentTheme)) {
          this.setTheme(parsed.currentTheme);
        }
      }
    } catch (e) {
      console.error('Failed to load theme:', e);
    }
  }
}

const themeManager = new ThemeManager();
```

#### C. Theme Settings UI
```html
<!-- Theme Selector in Settings App -->
<div class="settings-section">
  <h3>🎨 Appearance</h3>
  <div class="theme-grid">
    ${themeManager.getAllThemes().map(theme => `
      <div class="theme-card ${themeManager.currentTheme === theme.id ? 'active' : ''}" 
           onclick="themeManager.setTheme('${theme.id}')">
        <div class="theme-preview" style="background: ${theme.preview}"></div>
        <div class="theme-info">
          <span class="theme-icon">${theme.icon}</span>
          <span class="theme-name">${theme.name}</span>
        </div>
        ${theme.custom ? `
          <button class="theme-delete" onclick="themeManager.uninstallTheme('${theme.id}')">
            ✕
          </button>
        ` : ''}
      </div>
    `).join('')}
  </div>
  
  <div class="theme-actions">
    <button onclick="exportCurrentTheme()">📥 Export Theme</button>
    <button onclick="document.getElementById('theme-import').click()">📤 Import Theme</button>
    <input type="file" id="theme-import" accept=".json" style="display:none" 
           onchange="importThemeFile(event)">
  </div>
</div>

<style>
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.theme-card {
  background: rgba(255,255,255,0.05);
  border: 2px solid var(--glass-border);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.theme-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.theme-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.theme-preview {
  width: 100%;
  height: 80px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.theme-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.theme-icon {
  font-size: 16px;
}

.theme-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255,59,48,0.8);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.theme-card:hover .theme-delete {
  opacity: 1;
}
</style>

<script>
function exportCurrentTheme() {
  const theme = themeManager.exportTheme(themeManager.currentTheme);
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${theme.id}-theme.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importThemeFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const themeData = JSON.parse(e.target.result);
      themeManager.importTheme(themeData);
      notifSystem.add('Theme Imported', `${themeData.name} has been added`, '🎨');
      renderThemeSettings();
    } catch (err) {
      notifSystem.add('Import Failed', 'Invalid theme file', '❌');
    }
  };
  reader.readAsText(file);
}
</script>
```

#### D. Dynamic Window Control Styling
```css
/* Window controls adapt based on theme */
.wm-controls {
  display: flex;
  gap: var(--control-spacing, 6px);
}

.wm-btn {
  width: var(--control-size, 12px);
  height: var(--control-size, 12px);
  border-radius: calc(var(--control-size, 12px) * 0.5);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

/* Square controls for Windows theme */
[data-theme="windows"] .wm-btn {
  border-radius: 2px;
}

[data-theme="windows"] .wm-btn.min { background: #ffbd2e; }
[data-theme="windows"] .wm-btn.max { background: #28c840; }
[data-theme="windows"] .wm-btn.close { background: #ff5f57; }

/* macOS-style traffic lights */
[data-theme="macos"] .wm-controls {
  gap: 8px;
}

[data-theme="macos"] .wm-btn {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid rgba(0,0,0,0.2);
}

[data-theme="macos"] .wm-btn.min { background: #ffbd2e; }
[data-theme="macos"] .wm-btn.max { background: #28c840; }
[data-theme="macos"] .wm-btn.close { background: #ff5f57; }

[data-theme="macos"] .wm-btn:hover {
  filter: brightness(1.2);
}
```

---

## 4. Implementation Priority

### Phase 1: Core Enhancements (Week 1)
- [x] Window scaling improvements
- [x] Fullscreen mode
- [ ] Enhanced AppRegistry with install/uninstall
- [ ] ThemeManager class

### Phase 2: UI Components (Week 2)
- [ ] App Store modal/component
- [ ] Theme settings panel
- [ ] Install/uninstall buttons in launcher

### Phase 3: Persistence & Polish (Week 3)
- [ ] localStorage integration for app states
- [ ] Theme export/import functionality
- [ ] Notification system integration
- [ ] Documentation and examples

---

## 5. File Structure

```
/workspace
├── index.html              # Main HTML with inline styles
├── core.js                 # Core system (WM, FS, Registry)
├── styles.css              # Main stylesheet
├── apps/
│   ├── spectra.css         # App-specific styles
│   └── app*.html           # Individual apps
├── systems/                # NEW: System modules
│   ├── theme-manager.js    # Theme engine
│   └── app-locker.js       # App installation manager
└── themes/                 # NEW: Downloadable themes
    ├── windows.json
    ├── macos.json
    └── cyberpunk.json
```

---

## 6. Best Practices

### Performance
- Use CSS containment (`contain: layout style paint`) for isolated rendering
- Debounce localStorage writes
- Use ResizeObserver instead of resize events
- Cache DOM references

### Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus indicators
- Screen reader announcements for dynamic content

### Browser Support
- CSS Container Queries (Chrome 105+, Firefox 110+)
- Fallback to media queries for older browsers
- Feature detection for advanced APIs
