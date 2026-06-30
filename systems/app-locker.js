/* ═══════════════════════════════════════════
   SPECTRAOS — App Locker (Application Manager)
   Install/uninstall apps with persistence
   ═══════════════════════════════════════════ */

class AppLocker {
  constructor() {
    this.storageKey = 'spectraos-app-locker';
    this.installedApps = new Set();
    this.appMetadata = new Map();
    this.loadFromStorage();
  }

  /**
   * Register an app in the system
   * @param {Object} app - App configuration object
   */
  register(app) {
    const appData = {
      id: app.id,
      name: app.name || app.id,
      icon: app.icon || '📦',
      category: app.category || 'Utilities',
      description: app.description || '',
      version: app.version || '1.0.0',
      size: app.size || 'N/A',
      developer: app.developer || 'SpectraOS',
      systemApp: app.systemApp || false,
      installed: app.systemApp !== false, // System apps installed by default
      installDate: null,
      lastOpened: null,
      openCount: 0
    };

    this.appMetadata.set(app.id, appData);
    
    if (appData.installed) {
      this.installedApps.add(app.id);
    }

    // Restore state if we have pending data
    if (this.pendingStates && this.pendingStates[app.id]) {
      const state = this.pendingStates[app.id];
      appData.installed = state.installed;
      appData.installDate = state.installDate;
      appData.lastOpened = state.lastOpened;
      appData.openCount = state.openCount || 0;
      
      if (state.installed) {
        this.installedApps.add(app.id);
      } else {
        this.installedApps.delete(app.id);
      }
    }
  }

  /**
   * Install an app
   * @param {string} appId - App ID to install
   * @returns {boolean} - Success status
   */
  install(appId) {
    const app = this.appMetadata.get(appId);
    if (!app) {
      console.error(`App "${appId}" not found in registry`);
      return false;
    }

    if (app.installed) {
      console.warn(`App "${appId}" is already installed`);
      return true;
    }

    app.installed = true;
    app.installDate = new Date().toISOString();
    this.installedApps.add(appId);
    this.saveToStorage();

    // Dispatch event
    window.dispatchEvent(new CustomEvent('app:installed', { 
      detail: { appId, app } 
    }));

    // Show notification
    if (typeof notifSystem !== 'undefined') {
      notifSystem.add(
        'App Installed',
        `${app.name} has been added to your launcher`,
        '📦'
      );
    }

    return true;
  }

  /**
   * Uninstall an app
   * @param {string} appId - App ID to uninstall
   * @returns {boolean} - Success status
   */
  uninstall(appId) {
    const app = this.appMetadata.get(appId);
    if (!app) {
      console.error(`App "${appId}" not found in registry`);
      return false;
    }

    // Prevent uninstalling system apps
    if (app.systemApp) {
      if (typeof notifSystem !== 'undefined') {
        notifSystem.add(
          'Cannot Uninstall',
          `${app.name} is a system app and cannot be removed`,
          '⚠️'
        );
      }
      return false;
    }

    app.installed = false;
    this.installedApps.delete(appId);
    this.saveToStorage();

    // Close any open windows for this app
    if (typeof WM !== 'undefined') {
      Array.from(WM.windows.values())
        .filter(w => w.appId === appId)
        .forEach(w => WM.closeWindow(w.element.id));
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('app:uninstalled', { 
      detail: { appId, app } 
    }));

    // Show notification
    if (typeof notifSystem !== 'undefined') {
      notifSystem.add(
        'App Uninstalled',
        `${app.name} has been removed`,
        '🗑️'
      );
    }

    return true;
  }

  /**
   * Check if an app is installed
   * @param {string} appId - App ID to check
   * @returns {boolean} - Installation status
   */
  isInstalled(appId) {
    return this.installedApps.has(appId);
  }

  /**
   * Get all installed apps
   * @returns {Array} - Array of installed app objects
   */
  getInstalled() {
    return this.getAll().filter(app => app.installed);
  }

  /**
   * Get all available (not installed) apps
   * @returns {Array} - Array of available app objects
   */
  getAvailable() {
    return this.getAll().filter(app => !app.installed);
  }

  /**
   * Get all registered apps
   * @returns {Array} - Array of all app objects
   */
  getAll() {
    return Array.from(this.appMetadata.values());
  }

  /**
   * Get a specific app
   * @param {string} appId - App ID
   * @returns {Object|undefined} - App object or undefined
   */
  getApp(appId) {
    return this.appMetadata.get(appId);
  }

  /**
   * Get apps by category
   * @param {string} category - Category name
   * @returns {Array} - Array of apps in category
   */
  getByCategory(category) {
    if (category === 'all') return this.getAll();
    if (category === 'installed') return this.getInstalled();
    if (category === 'available') return this.getAvailable();
    return this.getAll().filter(app => app.category === category);
  }

  /**
   * Search apps by name or description
   * @param {string} query - Search query
   * @returns {Array} - Array of matching apps
   */
  search(query) {
    const q = query.toLowerCase();
    return this.getAll().filter(app => 
      app.name.toLowerCase().includes(q) || 
      app.description.toLowerCase().includes(q) ||
      app.category.toLowerCase().includes(q)
    );
  }

  /**
   * Record app launch
   * @param {string} appId - App ID that was launched
   */
  recordLaunch(appId) {
    const app = this.appMetadata.get(appId);
    if (app) {
      app.lastOpened = new Date().toISOString();
      app.openCount = (app.openCount || 0) + 1;
      this.saveToStorage();
    }
  }

  /**
   * Save state to localStorage
   */
  saveToStorage() {
    const data = {
      installedApps: Array.from(this.installedApps),
      appStates: {}
    };

    this.appMetadata.forEach((app, id) => {
      data.appStates[id] = {
        installed: app.installed,
        installDate: app.installDate,
        lastOpened: app.lastOpened,
        openCount: app.openCount
      };
    });

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save app locker state:', e);
    }
  }

  /**
   * Load state from localStorage
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        
        if (parsed.installedApps) {
          this.installedApps = new Set(parsed.installedApps);
        }
        
        // Store pending states to apply when apps are registered
        this.pendingStates = parsed.appStates || {};
      }
    } catch (e) {
      console.error('Failed to load app locker state:', e);
    }
  }

  /**
   * Export app list as JSON
   * @returns {Object} - Export data
   */
  export() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      installedApps: Array.from(this.installedApps),
      apps: this.getAll()
    };
  }

  /**
   * Import app state from JSON
   * @param {Object} data - Import data
   */
  import(data) {
    if (!data || !data.installedApps) {
      throw new Error('Invalid import data');
    }

    this.installedApps = new Set(data.installedApps);
    
    if (data.apps) {
      data.apps.forEach(app => {
        if (this.appMetadata.has(app.id)) {
          const existing = this.appMetadata.get(app.id);
          existing.installed = app.installed;
          existing.installDate = app.installDate;
          existing.lastOpened = app.lastOpened;
          existing.openCount = app.openCount;
        }
      });
    }

    this.saveToStorage();
  }

  /**
   * Reset all app installations (keep system apps)
   */
  reset() {
    this.appMetadata.forEach((app, id) => {
      if (app.systemApp) {
        this.installedApps.add(id);
        app.installed = true;
      } else {
        this.installedApps.delete(id);
        app.installed = false;
      }
    });
    this.saveToStorage();
  }
}

// Create global instance
const appLocker = new AppLocker();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppLocker, appLocker };
}
