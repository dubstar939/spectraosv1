/* ═══════════════════════════════════════════
   SPECTRAOS — Theme Manager
   Dynamic theming engine with CSS variables
   ═══════════════════════════════════════════ */

class ThemeManager {
  constructor() {
    this.storageKey = 'spectraos-theme';
    this.themes = new Map();
    this.currentTheme = 'default';
    this.registerDefaultThemes();
    this.loadFromStorage();
  }

  registerDefaultThemes() {
    // Default Spectra Theme
    this.themes.set('default', {
      id: 'default',
      name: 'Spectra Default',
      icon: '◉',
      preview: '#00ff88',
      description: 'The original SpectraOS cyber-aesthetic theme',
      cssVars: {
        '--window-border-radius': '14px',
        '--window-border-width': '1px',
        '--window-shadow': '0 20px 60px rgba(0,0,0,0.4)',
        '--window-backdrop-blur': '20px',
        '--titlebar-height': '36px',
        '--titlebar-bg': 'rgba(0,0,0,0.2)',
        '--control-style': 'circle',
        '--control-size': '12px',
        '--control-spacing': '6px',
        '--accent': '#00ff88',
        '--accent2': '#00ccff',
        '--bg': '#0a0a0f',
        '--glass': 'rgba(20, 20, 35, 0.75)',
        '--glass-border': 'rgba(255, 255, 255, 0.08)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#b0b0b0',
        '--focus-ring': 'rgba(0, 255, 136, 0.6)'
      }
    });

    // Windows 11 Theme
    this.themes.set('windows', {
      id: 'windows',
      name: 'Windows 11',
      icon: '🪟',
      preview: '#0078d4',
      description: 'Modern Windows 11 aesthetic with rounded corners',
      cssVars: {
        '--window-border-radius': '8px',
        '--window-border-width': '1px',
        '--window-shadow': '0 4px 20px rgba(0,0,0,0.3)',
        '--window-backdrop-blur': '15px',
        '--titlebar-height': '32px',
        '--titlebar-bg': 'rgba(32, 32, 32, 0.9)',
        '--control-style': 'square',
        '--control-size': '10px',
        '--control-spacing': '4px',
        '--accent': '#0078d4',
        '--accent2': '#00bcf2',
        '--bg': '#202020',
        '--glass': 'rgba(32, 32, 32, 0.85)',
        '--glass-border': 'rgba(255, 255, 255, 0.05)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#a0a0a0',
        '--focus-ring': 'rgba(0, 120, 212, 0.5)'
      }
    });

    // macOS Theme
    this.themes.set('macos', {
      id: 'macos',
      name: 'macOS',
      icon: '🍎',
      preview: '#007aff',
      description: 'Classic macOS design with traffic light controls',
      cssVars: {
        '--window-border-radius': '12px',
        '--window-border-width': '1px',
        '--window-shadow': '0 25px 80px rgba(0,0,0,0.5)',
        '--window-backdrop-blur': '25px',
        '--titlebar-height': '38px',
        '--titlebar-bg': 'rgba(30, 30, 30, 0.6)',
        '--control-style': 'circle',
        '--control-size': '12px',
        '--control-spacing': '8px',
        '--accent': '#007aff',
        '--accent2': '#5ac8fa',
        '--bg': '#1e1e1e',
        '--glass': 'rgba(30, 30, 30, 0.75)',
        '--glass-border': 'rgba(255, 255, 255, 0.1)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#a0a0a0',
        '--focus-ring': 'rgba(0, 122, 255, 0.5)'
      }
    });

    // Ubuntu/GNOME Theme
    this.themes.set('ubuntu', {
      id: 'ubuntu',
      name: 'Ubuntu',
      icon: '🐧',
      preview: '#e95420',
      description: 'Ubuntu GNOME desktop aesthetic',
      cssVars: {
        '--window-border-radius': '6px',
        '--window-border-width': '1px',
        '--window-shadow': '0 8px 32px rgba(0,0,0,0.4)',
        '--window-backdrop-blur': '10px',
        '--titlebar-height': '34px',
        '--titlebar-bg': 'rgba(45, 45, 45, 0.95)',
        '--control-style': 'circle',
        '--control-size': '14px',
        '--control-spacing': '6px',
        '--accent': '#e95420',
        '--accent2': '#c7162b',
        '--bg': '#2d2d2d',
        '--glass': 'rgba(45, 45, 45, 0.9)',
        '--glass-border': 'rgba(255, 255, 255, 0.08)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#b0b0b0',
        '--focus-ring': 'rgba(233, 84, 32, 0.5)'
      }
    });

    // Cyberpunk Theme
    this.themes.set('cyberpunk', {
      id: 'cyberpunk',
      name: 'Cyberpunk',
      icon: '🤖',
      preview: '#00ff88',
      description: 'Futuristic cyberpunk aesthetic with neon accents',
      cssVars: {
        '--window-border-radius': '0px',
        '--window-border-width': '2px',
        '--window-shadow': '0 0 20px rgba(0, 255, 136, 0.3)',
        '--window-backdrop-blur': '5px',
        '--titlebar-height': '40px',
        '--titlebar-bg': 'rgba(10, 10, 20, 0.98)',
        '--control-style': 'square',
        '--control-size': '14px',
        '--control-spacing': '8px',
        '--accent': '#00ff88',
        '--accent2': '#ff00ff',
        '--bg': '#0a0a14',
        '--glass': 'rgba(10, 10, 20, 0.95)',
        '--glass-border': 'rgba(0, 255, 136, 0.3)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#00ff88',
        '--focus-ring': 'rgba(0, 255, 136, 0.8)'
      }
    });

    // Light Theme
    this.themes.set('light', {
      id: 'light',
      name: 'Light',
      icon: '☀️',
      preview: '#f0f0f0',
      description: 'Clean light theme for daytime use',
      cssVars: {
        '--window-border-radius': '12px',
        '--window-border-width': '1px',
        '--window-shadow': '0 8px 32px rgba(0,0,0,0.15)',
        '--window-backdrop-blur': '20px',
        '--titlebar-height': '36px',
        '--titlebar-bg': 'rgba(255, 255, 255, 0.8)',
        '--control-style': 'circle',
        '--control-size': '12px',
        '--control-spacing': '6px',
        '--accent': '#0066cc',
        '--accent2': '#0099ff',
        '--bg': '#f5f5f5',
        '--glass': 'rgba(255, 255, 255, 0.85)',
        '--glass-border': 'rgba(0, 0, 0, 0.1)',
        '--text-primary': '#1a1a1a',
        '--text-secondary': '#666666',
        '--focus-ring': 'rgba(0, 102, 204, 0.4)'
      }
    });
  }

  /**
   * Apply a theme by setting CSS variables and data attribute
   * @param {string} themeId - The ID of the theme to apply
   * @returns {boolean} - Success status
   */
  setTheme(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) {
      console.warn(`Theme "${themeId}" not found`);
      return false;
    }

    const root = document.documentElement;
    
    // Apply CSS variables
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

    // Show notification if system is available
    if (typeof notifSystem !== 'undefined') {
      notifSystem.add('Theme Changed', `Switched to ${theme.name}`, theme.icon);
    }

    return true;
  }

  /**
   * Get a specific theme
   * @param {string} themeId - Theme ID
   * @returns {Object|undefined} - Theme object or undefined
   */
  getTheme(themeId) {
    return this.themes.get(themeId);
  }

  /**
   * Get all registered themes
   * @returns {Array} - Array of theme objects
   */
  getAllThemes() {
    return Array.from(this.themes.values());
  }

  /**
   * Install a custom theme
   * @param {Object} themeData - Theme configuration object
   * @returns {boolean} - Success status
   */
  installTheme(themeData) {
    if (!themeData.id || !themeData.cssVars) {
      console.error('Invalid theme format: requires id and cssVars');
      return false;
    }

    const theme = {
      id: themeData.id,
      name: themeData.name || themeData.id,
      icon: themeData.icon || '🎨',
      preview: themeData.preview || themeData.cssVars['--accent'] || '#888888',
      description: themeData.description || 'Custom theme',
      cssVars: themeData.cssVars,
      custom: true,
      version: themeData.version || '1.0.0'
    };

    this.themes.set(themeData.id, theme);
    this.saveToStorage();

    if (typeof notifSystem !== 'undefined') {
      notifSystem.add('Theme Installed', `${theme.name} has been added`, '🎨');
    }

    return true;
  }

  /**
   * Uninstall a custom theme
   * @param {string} themeId - Theme ID to remove
   * @returns {boolean} - Success status
   */
  uninstallTheme(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) {
      return false;
    }

    if (!theme.custom) {
      console.warn('Cannot uninstall built-in themes');
      return false;
    }

    this.themes.delete(themeId);
    
    // Switch to default if current theme was removed
    if (this.currentTheme === themeId) {
      this.setTheme('default');
    }
    
    this.saveToStorage();

    if (typeof notifSystem !== 'undefined') {
      notifSystem.add('Theme Removed', `${theme.name} has been removed`, '🗑️');
    }

    return true;
  }

  /**
   * Export a theme as JSON
   * @param {string} themeId - Theme ID to export
   * @returns {Object|null} - Theme data object or null
   */
  exportTheme(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) return null;

    return {
      id: theme.id,
      name: theme.name,
      icon: theme.icon,
      preview: theme.preview,
      description: theme.description,
      cssVars: theme.cssVars,
      version: theme.version || '1.0.0',
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import a theme from JSON data
   * @param {Object} themeData - Theme data object
   * @returns {boolean} - Success status
   */
  importTheme(themeData) {
    if (!themeData || !themeData.id || !themeData.cssVars) {
      throw new Error('Invalid theme format: requires id and cssVars');
    }
    return this.installTheme(themeData);
  }

  /**
   * Download a theme as JSON file
   * @param {string} themeId - Theme ID to download
   */
  downloadTheme(themeId) {
    const themeData = this.exportTheme(themeId);
    if (!themeData) return;

    const blob = new Blob([JSON.stringify(themeData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${themeId}-theme.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Save theme state to localStorage
   */
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

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  }

  /**
   * Load theme state from localStorage
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return;

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
    } catch (e) {
      console.error('Failed to load theme:', e);
    }
  }

  /**
   * Get the currently active theme
   * @returns {string} - Current theme ID
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Preview a theme without applying it permanently
   * @param {string} themeId - Theme ID to preview
   */
  previewTheme(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) return;

    const root = document.documentElement;
    Object.entries(theme.cssVars).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });
    root.setAttribute('data-theme-preview', themeId);
  }

  /**
   * Clear theme preview and restore current theme
   */
  clearPreview() {
    this.setTheme(this.currentTheme);
    document.documentElement.removeAttribute('data-theme-preview');
  }
}

// Create global instance
const themeManager = new ThemeManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, themeManager };
}
