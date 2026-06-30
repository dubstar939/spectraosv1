/* ═══════════════════════════════════════════
   SPECTRAOS — Core System
   Window Manager, Filesystem, App Registry
   ═══════════════════════════════════════════ */

// ═══════════════════════════════════════════
// SECURITY: HTML Entity Encoder for XSS Prevention
// ═══════════════════════════════════════════
const SecurityUtils = {
    /**
     * Escape HTML entities to prevent XSS attacks
     * @param {string} str - Raw string to escape
     * @returns {string} - Escaped string safe for HTML insertion
     */
    escapeHtml(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    /**
     * Sanitize object with multiple string fields
     * @param {Object} obj - Object with string fields to sanitize
     * @param {Array<string>} fields - Field names to sanitize
     * @returns {Object} - New object with sanitized fields
     */
    sanitizeObject(obj, fields) {
        const result = { ...obj };
        for (const field of fields) {
            if (result[field] && typeof result[field] === 'string') {
                result[field] = this.escapeHtml(result[field]);
            }
        }
        return result;
    }
};

// ═══════════════════════════════════════════
// STORAGE MANAGER: Prevent race conditions with mutex lock
// ═══════════════════════════════════════════
class StorageManager {
    constructor() {
        this.writeLocks = new Map();
        this.writeQueue = new Map();
    }
    
    /**
     * Acquire a write lock for a storage key
     * @param {string} key - Storage key to lock
     * @returns {Promise<boolean>} - Resolves to true if lock acquired
     */
    async acquireLock(key) {
        if (!this.writeLocks.has(key)) {
            this.writeLocks.set(key, true);
            return true;
        }
        
        // Wait for lock to be released with timeout
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 10;
            const checkLock = () => {
                if (!this.writeLocks.get(key)) {
                    this.writeLocks.set(key, true);
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    console.warn(`Storage lock timeout for key: ${key}`);
                    resolve(false);
                } else {
                    attempts++;
                    setTimeout(checkLock, 50);
                }
            };
            checkLock();
        });
    }
    
    /**
     * Release a write lock
     * @param {string} key - Storage key to unlock
     */
    releaseLock(key) {
        this.writeLocks.set(key, false);
        
        // Process queued writes if any
        if (this.writeQueue.has(key) && this.writeQueue.get(key).length > 0) {
            const queue = this.writeQueue.get(key);
            const nextWrite = queue.shift();
            if (nextWrite) {
                setTimeout(() => nextWrite(), 10);
            }
        }
    }
    
    /**
     * Safe setItem with lock management
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     * @returns {Promise<boolean>} - Success status
     */
    async setItem(key, value) {
        try {
            const acquired = await this.acquireLock(key);
            if (!acquired) {
                // Queue the write for later
                return new Promise((resolve) => {
                    if (!this.writeQueue.has(key)) {
                        this.writeQueue.set(key, []);
                    }
                    this.writeQueue.get(key).push(async () => {
                        const result = await this.setItem(key, value);
                        resolve(result);
                    });
                });
            }
            
            localStorage.setItem(key, value);
            this.releaseLock(key);
            return true;
        } catch (e) {
            console.error('Storage write failed:', e);
            this.releaseLock(key);
            return false;
        }
    }
    
    /**
     * Safe getItem (reads don't need locking)
     * @param {string} key - Storage key
     * @returns {string|null} - Stored value or null
     */
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.error('Storage read failed:', e);
            return null;
        }
    }
}

const storageManager = new StorageManager();

// ═══════════════════════════════════════════
// ERROR BOUNDARY: Prevent app failures from breaking OS
// ═══════════════════════════════════════════
class ErrorBoundary {
    constructor() {
        this.errorHandlers = [];
        this.maxErrors = 5;
        this.errorCount = 0;
        this.lastErrorTime = 0;
        
        // Global error handler
        window.addEventListener('error', (e) => this.handleGlobalError(e));
        window.addEventListener('unhandledrejection', (e) => this.handleUnhandledRejection(e));
    }
    
    /**
     * Register an error handler for a specific context
     * @param {string} context - Context identifier (e.g., app name)
     * @param {Function} handler - Error handler function
     */
    registerHandler(context, handler) {
        this.errorHandlers.push({ context, handler });
    }
    
    /**
     * Handle errors within a safe execution context
     * @param {Function} fn - Function to execute safely
     * @param {string} context - Context for error reporting
     * @param {*} fallback - Fallback value on error
     * @returns {*} - Function result or fallback
     */
    execute(fn, context = 'unknown', fallback = null) {
        try {
            return fn();
        } catch (e) {
            this.handleError(e, context);
            return fallback;
        }
    }
    
    /**
     * Handle async errors within a safe execution context
     * @param {Promise} promise - Promise to execute safely
     * @param {string} context - Context for error reporting
     * @param {*} fallback - Fallback value on error
     * @returns {Promise<*>} - Promise result or fallback
     */
    async executeAsync(promise, context = 'unknown', fallback = null) {
        try {
            return await promise;
        } catch (e) {
            this.handleError(e, context);
            return fallback;
        }
    }
    
    /**
     * Handle global uncaught errors
     * @param {ErrorEvent} e - Error event
     */
    handleGlobalError(e) {
        this.handleError(e.error || e, 'global');
        
        // Prevent default browser error handling for controlled errors
        if (e.message?.includes('SpectraOS')) {
            e.preventDefault();
        }
    }
    
    /**
     * Handle unhandled promise rejections
     * @param {PromiseRejectionEvent} e - Rejection event
     */
    handleUnhandledRejection(e) {
        this.handleError(e.reason || new Error('Unhandled rejection'), 'async');
    }
    
    /**
     * Centralized error handling
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    handleError(error, context = 'unknown') {
        const now = Date.now();
        
        // Reset error count after 60 seconds of no errors
        if (now - this.lastErrorTime > 60000) {
            this.errorCount = 0;
        }
        
        this.errorCount++;
        this.lastErrorTime = now;
        
        // Log error with context
        console.error(`[ErrorBoundary] ${context}:`, error);
        
        // Notify registered handlers
        for (const { context: ctx, handler } of this.errorHandlers) {
            if (ctx === context || ctx === '*') {
                try {
                    handler(error, context);
                } catch (e) {
                    console.error('Error handler failed:', e);
                }
            }
        }
        
        // Show user-friendly error notification for critical errors
        if (this.errorCount >= this.maxErrors) {
            this.showSystemWarning();
        }
        
        // Dispatch custom event for apps to listen to
        window.dispatchEvent(new CustomEvent('spectra-error', { 
            detail: { error, context, timestamp: now } 
        }));
    }
    
    /**
     * Show system warning when too many errors occur
     */
    showSystemWarning() {
        const warning = document.getElementById('system-warning');
        if (warning) {
            warning.style.display = 'block';
            setTimeout(() => {
                warning.style.display = 'none';
            }, 5000);
        } else if (notifSystem) {
            notifSystem.add('System Warning', 'Multiple errors detected. Some features may be unstable.', '⚠️', 'warning');
        }
    }
    
    /**
     * Reset error counter
     */
    reset() {
        this.errorCount = 0;
        this.lastErrorTime = 0;
    }
}

const errorBoundary = new ErrorBoundary();

// ═══════════════════════════════════════════
// VIRTUAL FILESYSTEM
// ═══════════════════════════════════════════
class VirtualFS {
    constructor() {
        this.storageKey = 'spectraos-fs-data';
        this.root = {
            type: 'dir',
            name: '/',
            children: {
                'home': { type: 'dir', name: 'home', children: {
                    'user': { type: 'dir', name: 'user', children: {
                        'Documents': { type: 'dir', name: 'Documents', children: {} },
                        'Downloads': { type: 'dir', name: 'Downloads', children: {} },
                        'Pictures': { type: 'dir', name: 'Pictures', children: {} },
                        'Music': { type: 'dir', name: 'Music', children: {} },
                        'Videos': { type: 'dir', name: 'Videos', children: {} },
                        'Projects': { type: 'dir', name: 'Projects', children: {} },
                        'Desktop': { type: 'dir', name: 'Desktop', children: {} },
                        '.config': { type: 'dir', name: '.config', children: {} },
                    }}
                }},
                'bin': { type: 'dir', name: 'bin', children: {} },
                'etc': { type: 'dir', name: 'etc', children: {
                    'spectra.conf': { type: 'file', name: 'spectra.conf', content: '# SpectraOS Configuration\naccent=cyan\n' }
                }},
                'tmp': { type: 'dir', name: 'tmp', children: {} },
                'var': { type: 'dir', name: 'var', children: {
                    'log': { type: 'dir', name: 'log', children: {} }
                }},
                'usr': { type: 'dir', name: 'usr', children: {
                    'share': { type: 'dir', name: 'share', children: {} }
                }},
            }
        };
        this.cwd = '/home/user';
        this.saveDebounceTimer = null;
        this.pathCache = new Map(); // Cache for resolved paths
        this.cacheStats = { hits: 0, misses: 0, invalidations: 0 }; // Performance tracking
        this.loadFromStorage();
    }

    saveToStorage() {
        // Debounce filesystem state saves to reduce localStorage writes
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        
        this.saveDebounceTimer = setTimeout(() => {
            try {
                const data = JSON.stringify(this.root);
                localStorage.setItem(this.storageKey, data);
            } catch (e) {
                console.error('Failed to save filesystem state:', e);
            }
        }, 1000);
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed && parsed.type === 'dir') {
                    this.root = parsed;
                }
            }
        } catch (e) {
            console.error('Failed to load filesystem state:', e);
        }
    }

    resolve(path) {
        // Check cache first for performance
        const cacheKey = `${this.cwd}:${path}`;
        if (this.pathCache.has(cacheKey)) {
            this.cacheStats.hits++;
            return this.pathCache.get(cacheKey);
        }
        
        this.cacheStats.misses++;
        const result = path.startsWith('/') 
            ? path.split('/').filter(Boolean)
            : this.cwd.split('/').filter(Boolean).concat(path.split('/').filter(Boolean));
        
        // Cache the result
        this.pathCache.set(cacheKey, result);
        return result;
    }

    normalize(parts) {
        const result = [];
        for (const p of parts) {
            if (p === '..') result.pop();
            else if (p !== '.' && p !== '') result.push(p);
        }
        return result;
    }

    getNode(path) {
        const parts = this.normalize(this.resolve(path));
        let node = this.root;
        for (const part of parts) {
            if (!node.children || !node.children[part]) return null;
            node = node.children[part];
        }
        return node;
    }
    
    /**
     * Clear path cache - call when cwd changes or filesystem is modified
     * Tracks invalidation count for performance monitoring
     */
    clearPathCache() {
        this.cacheStats.invalidations++;
        this.pathCache.clear();
    }
    
    /**
     * Get cache statistics for performance monitoring
     * @returns {Object} Cache hit/miss/invalidation stats
     */
    getCacheStats() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0;
        return {
            ...this.cacheStats,
            hitRate: `${hitRate}%`,
            totalRequests: total
        };
    }

    getParent(path) {
        const parts = this.normalize(this.resolve(path));
        const name = parts.pop();
        let node = this.root;
        for (const part of parts) {
            node = node.children[part];
        }
        return { parent: node, name };
    }

    mkdir(path) {
        const { parent, name } = this.getParent(path);
        if (!parent || !parent.children) return false;
        if (parent.children[name]) return false;
        parent.children[name] = { type: 'dir', name, children: {} };
        this.clearPathCache(); // Clear cache after modification
        this.saveToStorage();
        return true;
    }

    touch(path, content = '') {
        const { parent, name } = this.getParent(path);
        if (!parent || !parent.children) return false;
        parent.children[name] = { type: 'file', name, content };
        this.clearPathCache(); // Clear cache after modification
        this.saveToStorage();
        return true;
    }

    rm(path) {
        const { parent, name } = this.getParent(path);
        if (!parent || !parent.children || !parent.children[name]) return false;
        delete parent.children[name];
        this.clearPathCache(); // Clear cache after modification
        this.saveToStorage();
        return true;
    }

    ls(path) {
        const node = this.getNode(path);
        if (!node || node.type !== 'dir') return null;
        return Object.values(node.children);
    }

    read(path) {
        const node = this.getNode(path);
        if (!node || node.type !== 'file') return null;
        return node.content;
    }

    write(path, content) {
        const node = this.getNode(path);
        if (!node || node.type !== 'file') return false;
        node.content = content;
        this.saveToStorage();
        return true;
    }

    cd(path) {
        const node = this.getNode(path);
        if (!node || node.type !== 'dir') return false;
        this.cwd = '/' + this.normalize(this.resolve(path)).join('/');
        this.clearPathCache(); // Clear cache after cwd change
        return true;
    }

    pwd() { return this.cwd; }
}

const fs = new VirtualFS();

// ═══════════════════════════════════════════
// NOTIFICATION SYSTEM
// ═══════════════════════════════════════════
class NotificationSystem {
    constructor() {
        this.storageKey = 'spectraos-notifications';
        this.notifications = [];
        this.listeners = [];
        this.pendingChanges = false;
        this.saveDebounceTimer = null;
        this.loadFromStorage();
    }
    
    /**
     * Debounced save to localStorage - batches writes for performance
     * Uses StorageManager to prevent race conditions
     */
    async saveToStorage() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        
        this.pendingChanges = true;
        
        // Debounce localStorage writes by 500ms
        this.saveDebounceTimer = setTimeout(async () => {
            if (!this.pendingChanges) return;
            
            try {
                const data = JSON.stringify(this.notifications);
                await storageManager.setItem(this.storageKey, data);
                this.pendingChanges = false;
            } catch (e) {
                console.error('Failed to save notifications:', e);
            }
        }, 500);
    }

    loadFromStorage() {
        try {
            const data = storageManager.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    this.notifications = parsed;
                    this.render();
                    this.updateBadge();
                }
            }
        } catch (e) {
            console.error('Failed to load notifications:', e);
        }
    }

    add(title, text, icon = '🔔', type = 'info') {
        // Sanitize input to prevent XSS attacks
        const sanitizedTitle = SecurityUtils.escapeHtml(title);
        const sanitizedText = SecurityUtils.escapeHtml(text);
        
        const notif = {
            id: Date.now() + Math.random(),
            title: sanitizedTitle, 
            text: sanitizedText, 
            icon: SecurityUtils.escapeHtml(icon), 
            type,
            time: new Date(),
            unread: true
        };
        this.notifications.unshift(notif);
        if (this.notifications.length > 50) this.notifications.pop();
        this.saveToStorage();
        this.updateBadge();
        this.render();
        this.showToast(notif);
        this.listeners.forEach(cb => cb(notif));
        return notif;
    }

    clear() {
        this.notifications = [];
        this.saveToStorage();
        this.updateBadge();
        this.render();
    }

    markRead(id) {
        const n = this.notifications.find(n => n.id === id);
        if (n) n.unread = false;
        this.saveToStorage();
        this.updateBadge();
        this.render();
    }

    markAllRead() {
        this.notifications.forEach(n => n.unread = false);
        this.saveToStorage();
        this.updateBadge();
        this.render();
    }

    updateBadge() {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        const unread = this.notifications.filter(n => n.unread).length;
        badge.textContent = unread;
        badge.classList.toggle('show', unread > 0);
    }

    render() {
        const list = document.getElementById('notif-list');
        if (!list) return;
        if (this.notifications.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);font-size:13px;">No notifications</div>';
            return;
        }
        list.innerHTML = this.notifications.map(n => `
            <button class="notif-item ${n.unread ? 'unread' : ''}" data-id="${n.id}" 
                    onclick="notifSystem.markRead(${n.id})" 
                    aria-label="${SecurityUtils.escapeHtml(n.title)}: ${SecurityUtils.escapeHtml(n.text)}" tabindex="0">
                <div class="notif-icon" aria-hidden="true">${SecurityUtils.escapeHtml(n.icon)}</div>
                <div class="notif-body">
                    <div class="notif-title">${SecurityUtils.escapeHtml(n.title)}</div>
                    <div class="notif-text">${SecurityUtils.escapeHtml(n.text)}</div>
                    <div class="notif-time">${this.formatTime(n.time)}</div>
                </div>
            </button>
        `).join('');
    }

    showToast(notif) {
        const area = document.getElementById('notif-area');
        if (!area) return;

        const toast = document.createElement('div');
        toast.className = 'notif-toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        // Use textContent for safe insertion instead of innerHTML to prevent XSS
        const titleEl = document.createElement('div');
        titleEl.className = 'notif-toast-title';
        titleEl.setAttribute('aria-hidden', 'true');
        titleEl.textContent = `${notif.icon} ${notif.title}`;
        
        const bodyEl = document.createElement('div');
        bodyEl.className = 'notif-toast-body';
        bodyEl.textContent = notif.text;
        
        toast.appendChild(titleEl);
        toast.appendChild(bodyEl);

        area.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s, transform 0.3s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    formatTime(d) {
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
        return d.toLocaleDateString();
    }

    onNotify(cb) { this.listeners.push(cb); }
}

const notifSystem = new NotificationSystem();

// ═══════════════════════════════════════════
// WINDOW MANAGER
// ═══════════════════════════════════════════
class WindowManager {
    constructor() {
        this.storageKey = 'spectraos-windows';
        this.windows = new Map();
        this.zIndex = 200;
        this.activeWindow = null;
        this.windowLayer = document.getElementById('window-layer');
        
        // Performance: Shared ResizeObserver for all windows
        this.sharedResizeObserver = null;
        this.resizeCallbacks = new Map();
        
        // Performance: DOM element cache
        this.domCache = new Map();
        
        // Performance: Render loop tracking
        this.visibleCanvases = new Set();
        this.renderLoopId = null;
        this.isRenderLoopRunning = false;
        
        // Performance: Selector cache to avoid repeated queries
        this.selectorCache = new Map();
        
        // Initialize shared resources
        this.initSharedResources();
    }
    
    /**
     * Initialize shared performance resources
     */
    initSharedResources() {
        // Create shared ResizeObserver
        this.sharedResizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const container = entry.target;
                const callback = this.resizeCallbacks.get(container);
                if (callback) {
                    // Debounce with requestAnimationFrame
                    if (container._rafId) {
                        cancelAnimationFrame(container._rafId);
                    }
                    container._rafId = requestAnimationFrame(() => {
                        callback(entry.contentRect.width, entry.contentRect.height);
                    });
                }
            }
        });
        
        // Setup matchMedia for DPI change detection (more efficient than polling)
        this.setupDpiDetection();
    }
    
    /**
     * Setup efficient DPI change detection using matchMedia API
     */
    setupDpiDetection() {
        let currentDpi = window.devicePixelRatio || 1;
        
        const handleDpiChange = (e) => {
            const newDpi = window.devicePixelRatio || 1;
            if (newDpi !== currentDpi) {
                currentDpi = newDpi;
                // Notify all windows of DPI change
                this.windows.forEach((win) => {
                    if (win.element._onDpiChange) {
                        win.element._onDpiChange(newDpi);
                    }
                });
            }
        };
        
        // Use matchMedia to detect DPI changes efficiently
        const dpiQuery = window.matchMedia(`(resolution: ${currentDpi}dppx)`);
        if (dpiQuery && dpiQuery.addEventListener) {
            dpiQuery.addEventListener('change', handleDpiChange);
        } else if (dpiQuery && dpiQuery.addListener) {
            // Fallback for older browsers
            dpiQuery.addListener(handleDpiChange);
        }
    }

    saveToStorage() {
        // Debounce window state saves to reduce localStorage writes
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        
        this.saveDebounceTimer = setTimeout(() => {
            try {
                const windowData = Array.from(this.windows.entries()).map(([id, win]) => ({
                    id,
                    appId: win.appId,
                    title: win.title,
                    minimized: win.minimized,
                    maximized: win.maximized,
                    style: {
                        width: win.element.style.width,
                        height: win.element.style.height,
                        left: win.element.style.left,
                        top: win.element.style.top,
                        zIndex: win.element.style.zIndex
                    }
                }));
                localStorage.setItem(this.storageKey, JSON.stringify(windowData));
            } catch (e) {
                console.error('Failed to save window state:', e);
            }
        }, 300);
    }

    loadFromStorage() {
        // Window restoration is handled on a per-app basis
        // since window content needs to be recreated by apps
    }

    create(appId, title, icon, contentHTML, options = {}) {
        const id = `win-${appId}-${Date.now()}`;
        const win = document.createElement('div');
        win.className = 'spectra-window';
        win.id = id;
        win.dataset.appId = appId;

        const width = options.width || 1200;
        const height = options.height || 800;
        const x = options.x || (50 + (this.windows.size * 30) % 200);
        const y = options.y || (50 + (this.windows.size * 30) % 150);

        win.style.width = width + 'px';
        win.style.height = height + 'px';
        win.style.left = x + 'px';
        win.style.top = y + 'px';
        win.style.zIndex = ++this.zIndex;

        win.innerHTML = `
            <div class="wm-titlebar" role="toolbar" aria-label="${title} window controls">
                <div class="wm-title">
                    <span class="win-icon" aria-hidden="true">${icon}</span>
                    <span class="win-title-text">${title}</span>
                </div>
                <div class="wm-controls" role="group" aria-label="Window actions">
                    <button class="wm-btn min" title="Minimize" aria-label="Minimize window">−</button>
                    <button class="wm-btn max" title="Maximize" aria-label="Maximize window">□</button>
                    <button class="wm-btn close" title="Close" aria-label="Close window">×</button>
                </div>
            </div>
            <div class="wm-content" role="document" aria-label="${title} content">${contentHTML}</div>
            <!-- Resize handles for all 8 directions -->
            <div class="resize-handle n" aria-hidden="true"></div>
            <div class="resize-handle s" aria-hidden="true"></div>
            <div class="resize-handle e" aria-hidden="true"></div>
            <div class="resize-handle w" aria-hidden="true"></div>
            <div class="resize-handle ne" aria-hidden="true"></div>
            <div class="resize-handle nw" aria-hidden="true"></div>
            <div class="resize-handle se" aria-hidden="true"></div>
            <div class="resize-handle sw" aria-hidden="true"></div>
        `;

        // Make window focusable for keyboard users
        win.setAttribute('tabindex', '-1');
        win.setAttribute('role', 'dialog');
        win.setAttribute('aria-label', title);
        win.setAttribute('aria-modal', 'false');

        this.windowLayer.appendChild(win);
        this.windows.set(id, { element: win, appId, title, minimized: false, maximized: false });

        // Performance: Cache frequently accessed DOM elements
        this.cacheWindowElements(win, id);

        this.setupWindowEvents(win, id);
        this.focusWindow(id);
        this.updateActiveLabel(title);

        // Initialize app if it has an init function
        const app = AppRegistry.get(appId);
        if (app && app.init) {
            setTimeout(() => app.init(win.querySelector('.wm-content'), id), 10);
        }

        return id;
    }

    setupWindowEvents(win, id) {
        // Use cached DOM elements if available
        const cache = this.windows.get(id)?.domCache;
        const titlebar = cache?.titlebar || win.querySelector('.wm-titlebar');
        const minimizeBtn = cache?.minimizeBtn || win.querySelector('.wm-btn.min');
        const maximizeBtn = cache?.maximizeBtn || win.querySelector('.wm-btn.max');
        const closeBtn = cache?.closeBtn || win.querySelector('.wm-btn.close');

        // Focus on click or focus
        win.addEventListener('mousedown', () => this.focusWindow(id));
        win.addEventListener('focus', () => this.focusWindow(id));
        
        // Keyboard support: Escape to minimize
        win.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.minimizeWindow(id);
            }
        });

        // Drag
        let isDragging = false, dragStartX, dragStartY, dragStartLeft, dragStartTop;
        titlebar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.wm-controls')) return;
            if (win.classList.contains('maximized')) return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartLeft = win.offsetLeft;
            dragStartTop = win.offsetTop;
            win.style.transition = 'none';
        });
        
        // Touch support for drag
        titlebar.addEventListener('touchstart', (e) => {
            if (e.target.closest('.wm-controls')) return;
            if (win.classList.contains('maximized')) return;
            isDragging = true;
            const touch = e.touches[0];
            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            dragStartLeft = win.offsetLeft;
            dragStartTop = win.offsetTop;
            win.style.transition = 'none';
        }, { passive: true });

        const handleMove = (e) => {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            win.style.left = (dragStartLeft + clientX - dragStartX) + 'px';
            win.style.top = (dragStartTop + clientY - dragStartY) + 'px';
        };
        
        const handleUp = () => {
            if (isDragging) {
                isDragging = false;
                win.style.transition = '';
            }
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchmove', handleMove, { passive: true });
        document.addEventListener('mouseup', handleUp);
        document.addEventListener('touchend', handleUp);

        // Minimize
        minimizeBtn.addEventListener('click', () => this.minimizeWindow(id));

        // Maximize/Restore
        maximizeBtn.addEventListener('click', () => this.toggleMaximize(id));
        titlebar.addEventListener('dblclick', () => this.toggleMaximize(id));

        // Close
        closeBtn.addEventListener('click', () => this.closeWindow(id));

        // Resize
        this.setupResize(win, id);
        
        // Store cleanup function for event listeners
        win._cleanupListeners = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('mouseup', handleUp);
            document.removeEventListener('touchend', handleUp);
        };
    }

    setupResize(win, id) {
        const handles = win.querySelectorAll('.resize-handle');
        let isResizing = false, currentHandle, startX, startY, startW, startH, startL, startT;
        
        // Get app-specific minimum dimensions if available
        const appId = win.dataset.appId;
        const appConfig = AppRegistry.get(appId);
        const minW = appConfig?.minWidth || 280;
        const minH = appConfig?.minHeight || 180;

        handles.forEach(h => {
            h.addEventListener('mousedown', (e) => {
                if (win.classList.contains('maximized')) return;
                isResizing = true;
                currentHandle = h.className.split(' ')[1];
                startX = e.clientX;
                startY = e.clientY;
                startW = win.offsetWidth;
                startH = win.offsetHeight;
                startL = win.offsetLeft;
                startT = win.offsetTop;
                win.style.transition = 'none';
                e.preventDefault();
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (currentHandle.includes('e')) {
                win.style.width = Math.max(minW, startW + dx) + 'px';
            }
            if (currentHandle.includes('s')) {
                win.style.height = Math.max(minH, startH + dy) + 'px';
            }
            if (currentHandle.includes('w')) {
                const newW = Math.max(minW, startW - dx);
                win.style.width = newW + 'px';
                win.style.left = (startL + startW - newW) + 'px';
            }
            if (currentHandle.includes('n')) {
                const newH = Math.max(minH, startH - dy);
                win.style.height = newH + 'px';
                win.style.top = (startT + startH - newH) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                win.style.transition = '';
            }
        });

        // ═══════════════════════════════════════════
        // WIDGET SCALING ENGINE INTEGRATION
        // Add ResizeObserver for automatic content scaling
        // ═══════════════════════════════════════════
        this.setupWidgetScaling(win, id);
    }

    /**
     * Setup automatic widget content scaling using ResizeObserver
     * Integrates with global SpectraScalingPolicy if available
     */
    setupWidgetScaling(win, id) {
        const cache = this.windows.get(id)?.domCache;
        const content = cache?.content || win.querySelector('.wm-content');
        if (!content) return;

        // Store scaling state on window object
        win._scalingState = {
            observer: null,
            rafId: null,
            widgets: []
        };

        // Use shared ResizeObserver for efficiency
        const resizeCallback = (width, height) => {
            this.scaleWindowContent(content, width, height);
        };
        
        this.sharedResizeObserver.observe(content);
        this.resizeCallbacks.set(content, resizeCallback);
        
        // Listen for widget resize events from manual resizing
        content.addEventListener('widgetresized', (e) => {
            const { width, height } = e.detail;
            this.scaleWindowContent(content, width, height);
        });
        
        // Store reference for cleanup
        win._scalingState.content = content;
    }

    /**
     * Scale window content to fit the container
     * Respects global SpectraScalingPolicy if defined
     * Implements throttling for canvas rendering when minimized
     */
    scaleWindowContent(content, containerWidth, containerHeight) {
        // Enhanced selector to catch all widget content types
        const widgets = content.querySelectorAll('.widget-content, canvas, iframe, .app-container, div[id^="app"], .spectra-widget, [data-widget], form, table, .container');
        
        // Get policy settings (use global or defaults)
        const policy = window.SpectraScalingPolicy || {
            preserveAspect: true,
            minScale: 0.25,
            maxScale: 4
        };
        
        // Check if window is minimized to throttle canvas rendering
        const win = content.closest('.spectra-window');
        const isMinimized = win?.classList.contains('minimized');
        
        widgets.forEach(widget => {
            // Skip if widget has its own scaling
            if (widget.dataset.hasScaling) return;

            // Store original dimensions on first run
            let originalWidth = widget.dataset.originalWidth;
            let originalHeight = widget.dataset.originalHeight;
            
            if (!originalWidth) {
                originalWidth = widget.offsetWidth || widget.width || 0;
                originalHeight = widget.offsetHeight || widget.height || 0;
                widget.dataset.originalWidth = originalWidth;
                widget.dataset.originalHeight = originalHeight;
            } else {
                originalWidth = parseFloat(originalWidth);
                originalHeight = parseFloat(originalHeight);
            }

            if (originalWidth === 0 || originalHeight === 0) return;

            // Calculate scale based on policy
            let scaleX = containerWidth / originalWidth;
            let scaleY = containerHeight / originalHeight;
            
            let scale;
            if (policy.preserveAspect) {
                scale = Math.min(scaleX, scaleY);
            } else {
                scale = scaleX; // Use X scale as default when not preserving aspect
            }
            
            // Clamp to policy limits
            scale = Math.max(policy.minScale, Math.min(scale, policy.maxScale));

            // Apply scaling based on widget type
            if (widget.tagName === 'CANVAS') {
                // Throttle canvas rendering when minimized for performance
                if (isMinimized) {
                    widget._pendingScale = { scale, originalWidth, originalHeight };
                    widget._needsRenderUpdate = false;
                } else {
                    // Clear pending scale if exists
                    if (widget._pendingScale) {
                        const pending = widget._pendingScale;
                        this.scaleCanvas(widget, pending.scale, pending.originalWidth, pending.originalHeight);
                        widget._pendingScale = null;
                    }
                    this.scaleCanvas(widget, scale, originalWidth, originalHeight);
                }
            } else if (widget.tagName === 'IFRAME') {
                this.scaleIframe(widget, scale, containerWidth, containerHeight);
            } else {
                this.scaleElement(widget, scale, originalWidth, originalHeight);
            }
        });
    }

    /**
     * Scale canvas element with pixel-perfect option
     */
    scaleCanvas(canvas, scale, originalWidth, originalHeight) {
        // Check if this is a pixel-art canvas (games, retro apps)
        const isPixelArt = canvas.dataset.pixelArt === 'true' || 
                          canvas.closest('[data-pixel-art="true"]');

        if (isPixelArt) {
            // Pixel-perfect integer scaling
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = false;
                ctx.mozImageSmoothingEnabled = false;
                ctx.webkitImageSmoothingEnabled = false;
                ctx.msImageSmoothingEnabled = false;
            }
            canvas.style.imageRendering = 'pixelated';
            canvas.style.imageRendering = 'crisp-edges';

            // Integer scale only
            const intScale = Math.max(1, Math.floor(scale));
            canvas.style.width = `${originalWidth * intScale}px`;
            canvas.style.height = `${originalHeight * intScale}px`;
        } else {
            // Smooth scaling for regular graphics
            canvas.style.imageRendering = 'auto';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
        }

        // Dispatch scale event for game logic to listen to
        canvas.dispatchEvent(new CustomEvent('canvasresized', {
            detail: { scale, width: canvas.offsetWidth, height: canvas.offsetHeight }
        }));
    }

    /**
     * Scale iframe to fit container
     */
    scaleIframe(iframe, scale, containerWidth, containerHeight) {
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
    }

    /**
     * Scale generic element using CSS transform
     */
    scaleElement(element, scale, originalWidth, originalHeight) {
        element.style.transformOrigin = 'top left';
        element.style.transform = `scale(${scale})`;
        element.style.width = `${originalWidth * scale}px`;
        element.style.height = `${originalHeight * scale}px`;
    }

    /**
     * Cleanup scaling resources when window closes
     */
    cleanupWidgetScaling(win) {
        if (win._scalingState) {
            // Unobserve from shared ResizeObserver
            if (win._scalingState.content) {
                this.sharedResizeObserver.unobserve(win._scalingState.content);
                this.resizeCallbacks.delete(win._scalingState.content);
            }
            if (win._scalingState.rafId) {
                cancelAnimationFrame(win._scalingState.rafId);
            }
            win._scalingState = null;
        }
    }

    focusWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;

        this.windows.forEach((w, wid) => {
            w.element.classList.remove('focused');
        });
        win.element.classList.add('focused');
        win.element.style.zIndex = ++this.zIndex;
        this.activeWindow = id;
        this.updateActiveLabel(win.title);
        this.saveToStorage();
    }

    minimizeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.minimized = !win.minimized;
        win.element.classList.toggle('minimized', win.minimized);
        
        // Trigger canvas render throttling when minimized/restored
        const content = win.element.querySelector('.wm-content');
        if (content && win.minimized) {
            // Notify canvases to pause rendering
            const canvases = content.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                if (canvas._pendingScale) {
                    // Already has pending scale, just mark as not needing update
                    canvas._needsRenderUpdate = false;
                }
            });
        } else if (content && !win.minimized) {
            // Restore canvases - apply pending scales
            const canvases = content.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                if (canvas._pendingScale) {
                    const pending = canvas._pendingScale;
                    this.scaleCanvas(canvas, pending.scale, pending.originalWidth, pending.originalHeight);
                    canvas._pendingScale = null;
                    canvas._needsRenderUpdate = true;
                }
            });
        }
        
        this.saveToStorage();
    }

    toggleMaximize(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.maximized = !win.maximized;
        win.element.classList.toggle('maximized', win.maximized);
        const btn = win.element.querySelector('.win-btn.maximize');
        btn.textContent = win.maximized ? '❐' : '□';
        this.saveToStorage();
    }

    closeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        // Cleanup event listeners to prevent memory leaks
        if (win.element._cleanupListeners) {
            win.element._cleanupListeners();
        }
        
        // Cleanup widget scaling resources
        this.cleanupWidgetScaling(win.element);
        
        win.element.style.animation = 'none';
        win.element.style.transition = 'opacity 0.2s, transform 0.2s';
        win.element.style.opacity = '0';
        win.element.style.transform = 'scale(0.95)';
        setTimeout(() => {
            win.element.remove();
            this.windows.delete(id);
            this.saveToStorage();
            if (this.activeWindow === id) {
                this.activeWindow = null;
                this.updateActiveLabel('Desktop');
            }
        }, 200);
    }

    updateActiveLabel(title) {
        // Use cached reference if available
        const activeLabel = document.getElementById('active-app-label');
        if (activeLabel) {
            activeLabel.textContent = title;
        }
    }

    getWindowContent(id) {
        const win = this.windows.get(id);
        return win ? win.element.querySelector('.window-content') : null;
    }
    
    /**
     * Optimized GPU render loop - only renders visible canvases
     */
    startRenderLoop() {
        if (this.isRenderLoopRunning) return;
        
        this.isRenderLoopRunning = true;
        const render = () => {
            if (!this.isRenderLoopRunning) return;
            
            // Only process visible canvases
            this.visibleCanvases.forEach(canvas => {
                if (canvas._needsUpdate && canvas._gpuRenderer) {
                    canvas._gpuRenderer.render();
                    canvas._needsUpdate = false;
                }
            });
            
            this.renderLoopId = requestAnimationFrame(render);
        };
        
        this.renderLoopId = requestAnimationFrame(render);
    }
    
    stopRenderLoop() {
        this.isRenderLoopRunning = false;
        if (this.renderLoopId) {
            cancelAnimationFrame(this.renderLoopId);
            this.renderLoopId = null;
        }
    }
    
    registerCanvasForRendering(canvas, gpuRenderer) {
        canvas._gpuRenderer = gpuRenderer;
        this.visibleCanvases.add(canvas);
        this.startRenderLoop();
    }
    
    unregisterCanvas(canvas) {
        this.visibleCanvases.delete(canvas);
        canvas._gpuRenderer = null;
        
        // Stop render loop if no visible canvases
        if (this.visibleCanvases.size === 0) {
            this.stopRenderLoop();
        }
    }
}

const WM = new WindowManager();

// ═══════════════════════════════════════════
// APP REGISTRY
// ═══════════════════════════════════════════
class AppRegistryClass {
    constructor() {
        this.apps = new Map();
    }

    register(app) {
        this.apps.set(app.id, app);
    }

    get(id) {
        return this.apps.get(id);
    }

    getAll() {
        return Array.from(this.apps.values());
    }

    getByCategory(cat) {
        if (cat === 'all') return this.getAll();
        return this.getAll().filter(a => a.category === cat);
    }

    search(query) {
        const q = query.toLowerCase();
        return this.getAll().filter(a => 
            a.name.toLowerCase().includes(q) || 
            a.description.toLowerCase().includes(q)
        );
    }

    launch(id) {
        const app = this.get(id);
        if (!app) return;

        // Check if app is already open (single instance apps)
        if (app.singleInstance) {
            const existing = Array.from(WM.windows.values()).find(w => w.appId === id);
            if (existing) {
                WM.focusWindow(existing.element.id);
                return;
            }
        }

        WM.create(id, app.name, app.icon, app.getHTML(), app.windowOptions || {});
    }
}

const AppRegistry = new AppRegistryClass();

// ═══════════════════════════════════════════
// SYSTEM INITIALIZATION
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // Clock
    function updateClock() {
        const now = new Date();
        document.getElementById('clock').textContent = 
            now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 1000);

    // App Launcher
    const launcher = document.getElementById('app-launcher');
    const launcherBtn = document.getElementById('app-launcher-btn');
    const closeLauncher = document.getElementById('close-launcher');
    const appSearch = document.getElementById('app-search');
    const launcherGrid = document.getElementById('launcher-grid');
    const catBtns = document.querySelectorAll('.cat-btn');

    function renderLauncher(apps) {
        launcherGrid.innerHTML = apps.map((app, index) => `
            <button class="app-tile" 
                    data-app="${app.id}" 
                    tabindex="${index === 0 ? '0' : '-1'}"
                    aria-label="Open ${app.name} - ${app.category}">
                <div class="tile-icon" style="color: ${app.accent || 'var(--accent-current)'}" aria-hidden="true">${app.icon}</div>
                <div class="tile-name">${app.name}</div>
                <div class="tile-cat">${app.category}</div>
            </button>
        `).join('');

        const tiles = launcherGrid.querySelectorAll('.app-tile');
        let tileIndex = 0;
        
        tiles.forEach(tile => {
            tile.addEventListener('click', () => {
                AppRegistry.launch(tile.dataset.app);
                launcher.classList.add('hidden');
                appSearch.value = '';
            });
            
            tile.addEventListener('keydown', (e) => {
                const columns = 5; // Match CSS grid
                switch(e.key) {
                    case 'ArrowRight':
                        e.preventDefault();
                        tileIndex = Math.min(tileIndex + 1, tiles.length - 1);
                        updateTileFocus(tiles, tileIndex);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        tileIndex = Math.max(tileIndex - 1, 0);
                        updateTileFocus(tiles, tileIndex);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        tileIndex = Math.min(tileIndex + columns, tiles.length - 1);
                        updateTileFocus(tiles, tileIndex);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        tileIndex = Math.max(tileIndex - columns, 0);
                        updateTileFocus(tiles, tileIndex);
                        break;
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        tile.click();
                        break;
                    case 'Escape':
                        closeLauncher.click();
                        break;
                    case 'Home':
                        e.preventDefault();
                        tileIndex = 0;
                        updateTileFocus(tiles, tileIndex);
                        break;
                    case 'End':
                        e.preventDefault();
                        tileIndex = tiles.length - 1;
                        updateTileFocus(tiles, tileIndex);
                        break;
                }
            });
        });
        
        function updateTileFocus(tileList, idx) {
            tileList.forEach((t, i) => {
                t.setAttribute('tabindex', i === idx ? '0' : '-1');
            });
            if (tileList[idx]) {
                tileList[idx].focus();
                tileList[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }

    launcherBtn.addEventListener('click', () => {
        launcher.classList.remove('hidden');
        appSearch.focus();
        renderLauncher(AppRegistry.getAll());
    });

    closeLauncher.addEventListener('click', () => {
        launcher.classList.add('hidden');
        appSearch.value = '';
    });

    appSearch.addEventListener('input', (e) => {
        renderLauncher(e.target.value ? AppRegistry.search(e.target.value) : AppRegistry.getAll());
    });

    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLauncher(AppRegistry.getByCategory(btn.dataset.cat));
        });
    });

    // Close launcher on Escape or click outside
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            launcher.classList.add('hidden');
            document.getElementById('notif-center').classList.add('hidden');
            document.getElementById('quick-settings').classList.add('hidden');
        }
    });
    launcher.addEventListener('click', (e) => {
        if (e.target === launcher) launcher.classList.add('hidden');
    });

    // Notifications
    const notifBtn = document.getElementById('notif-btn');
    const notifCenter = document.getElementById('notif-center');
    const clearNotifs = document.getElementById('clear-notifs');

    notifBtn.addEventListener('click', () => {
        notifCenter.classList.toggle('hidden');
        document.getElementById('quick-settings').classList.add('hidden');
        notifSystem.markAllRead();
    });

    clearNotifs.addEventListener('click', () => notifSystem.clear());

    notifCenter.addEventListener('click', (e) => {
        if (e.target === notifCenter) notifCenter.classList.add('hidden');
    });

    // Quick Settings
    const qsBtn = document.getElementById('quick-settings-btn');
    const quickSettings = document.getElementById('quick-settings');

    qsBtn.addEventListener('click', () => {
        quickSettings.classList.toggle('hidden');
        notifCenter.classList.add('hidden');
    });

    quickSettings.addEventListener('click', (e) => {
        if (e.target === quickSettings) quickSettings.classList.add('hidden');
    });

    // Toggle switches
    document.querySelectorAll('.qs-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const switchEl = toggle.querySelector('.toggle-switch');
            switchEl.classList.toggle('active');
            toggle.classList.toggle('active');

            if (toggle.id === 'qs-dark') {
                document.body.classList.toggle('light-mode');
            }
        });
    });

    // Brightness slider
    document.getElementById('brightness-slider').addEventListener('input', (e) => {
        document.getElementById('desktop-bg').style.filter = `brightness(${e.target.value}%)`;
    });

    // Context Menu
    const ctxMenu = document.getElementById('context-menu');
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.spectra-window') || e.target.closest('#top-bar') || 
            e.target.closest('.overlay') || e.target.closest('.notif-panel') ||
            e.target.closest('.qs-panel')) return;
        e.preventDefault();
        ctxMenu.style.left = e.clientX + 'px';
        ctxMenu.style.top = e.clientY + 'px';
        ctxMenu.classList.remove('hidden');
    });
    document.addEventListener('click', () => ctxMenu.classList.add('hidden'));

    document.querySelectorAll('.ctx-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            if (action === 'new-folder') {
                const name = prompt('Folder name:');
                if (name) fs.mkdir(`/home/user/Desktop/${name}`);
                renderDesktopIcons();
            } else if (action === 'new-file') {
                const name = prompt('File name:');
                if (name) fs.touch(`/home/user/Desktop/${name}`);
                renderDesktopIcons();
            } else if (action === 'settings') {
                AppRegistry.launch('settings');
            }
        });
    });

    // Desktop Icons
    function renderDesktopIcons() {
        const container = document.getElementById('desktop-icons');
        const items = fs.ls('/home/user/Desktop') || [];
        container.innerHTML = items.map(item => `
            <div class="desktop-icon" data-path="/home/user/Desktop/${item.name}">
                <div class="icon-img">${item.type === 'dir' ? '📁' : '📄'}</div>
                <div class="icon-label">${item.name}</div>
            </div>
        `).join('');

        container.querySelectorAll('.desktop-icon').forEach(icon => {
            icon.addEventListener('dblclick', () => {
                const path = icon.dataset.path;
                const node = fs.getNode(path);
                if (node.type === 'dir') {
                    AppRegistry.launch('filemanager');
                    setTimeout(() => {
                        const wins = Array.from(WM.windows.values());
                        const fm = wins.find(w => w.appId === 'filemanager');
                        if (fm && fm.element.querySelector('.fm-path')) {
                            fm.element.querySelector('.fm-path').value = path;
                            fm.element.querySelector('.fm-path').dispatchEvent(new Event('change'));
                        }
                    }, 100);
                }
            });
        });
    }
    renderDesktopIcons();

    // Boot notification
    setTimeout(() => {
        notifSystem.add('Welcome to SpectraOS', 'Your premium cyber-minimalist desktop is ready. 50+ apps available.', '✨', 'system');
    }, 800);
});
