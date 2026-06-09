/* ═══════════════════════════════════════════
   SPECTRAOS — Core System
   Window Manager, Filesystem, App Registry
   ═══════════════════════════════════════════ */

// ═══════════════════════════════════════════
// VIRTUAL FILESYSTEM
// ═══════════════════════════════════════════
class VirtualFS {
    constructor() {
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
                    'spectra.conf': { type: 'file', name: 'spectra.conf', content: '# SpectraOS Configuration
accent=cyan
' }
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
    }

    resolve(path) {
        if (path.startsWith('/')) {
            return path.split('/').filter(Boolean);
        }
        return this.cwd.split('/').filter(Boolean).concat(path.split('/').filter(Boolean));
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
        return true;
    }

    touch(path, content = '') {
        const { parent, name } = this.getParent(path);
        if (!parent || !parent.children) return false;
        parent.children[name] = { type: 'file', name, content };
        return true;
    }

    rm(path) {
        const { parent, name } = this.getParent(path);
        if (!parent || !parent.children || !parent.children[name]) return false;
        delete parent.children[name];
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
        return true;
    }

    cd(path) {
        const node = this.getNode(path);
        if (!node || node.type !== 'dir') return false;
        this.cwd = '/' + this.normalize(this.resolve(path)).join('/');
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
        this.notifications = [];
        this.listeners = [];
    }

    add(title, text, icon = '🔔', type = 'info') {
        const notif = {
            id: Date.now() + Math.random(),
            title, text, icon, type,
            time: new Date(),
            unread: true
        };
        this.notifications.unshift(notif);
        if (this.notifications.length > 50) this.notifications.pop();
        this.updateBadge();
        this.render();
        this.showToast(notif);
        this.listeners.forEach(cb => cb(notif));
        return notif;
    }

    clear() {
        this.notifications = [];
        this.updateBadge();
        this.render();
    }

    markRead(id) {
        const n = this.notifications.find(n => n.id === id);
        if (n) n.unread = false;
        this.updateBadge();
        this.render();
    }

    markAllRead() {
        this.notifications.forEach(n => n.unread = false);
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
                    aria-label="${n.title}: ${n.text}" tabindex="0">
                <div class="notif-icon" aria-hidden="true">${n.icon}</div>
                <div class="notif-body">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-text">${n.text}</div>
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
        toast.innerHTML = `
            <div class="notif-toast-title" aria-hidden="true">${notif.icon} ${notif.title}</div>
            <div class="notif-toast-body">${notif.text}</div>
        `;
        
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
        this.windows = new Map();
        this.zIndex = 200;
        this.activeWindow = null;
        this.windowLayer = document.getElementById('window-layer');
    }

    create(appId, title, icon, contentHTML, options = {}) {
        const id = `win-${appId}-${Date.now()}`;
        const win = document.createElement('div');
        win.className = 'spectra-window';
        win.id = id;
        win.dataset.appId = appId;

        const width = options.width || 800;
        const height = options.height || 500;
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
            <div class="wm-resize" aria-label="Resize window"></div>
        `;

        // Make window focusable for keyboard users
        win.setAttribute('tabindex', '-1');
        win.setAttribute('role', 'dialog');
        win.setAttribute('aria-label', title);
        win.setAttribute('aria-modal', 'false');

        this.windowLayer.appendChild(win);
        this.windows.set(id, { element: win, appId, title, minimized: false, maximized: false });

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
        const titlebar = win.querySelector('.wm-titlebar');
        const minimizeBtn = win.querySelector('.wm-btn.min');
        const maximizeBtn = win.querySelector('.wm-btn.max');
        const closeBtn = win.querySelector('.wm-btn.close');

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
            const minW = 280, minH = 180;

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
    }

    minimizeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.minimized = !win.minimized;
        win.element.classList.toggle('minimized', win.minimized);
    }

    toggleMaximize(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.maximized = !win.maximized;
        win.element.classList.toggle('maximized', win.maximized);
        const btn = win.element.querySelector('.win-btn.maximize');
        btn.textContent = win.maximized ? '❐' : '□';
    }

    closeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        // Cleanup event listeners to prevent memory leaks
        if (win.element._cleanupListeners) {
            win.element._cleanupListeners();
        }
        
        win.element.style.animation = 'none';
        win.element.style.transition = 'opacity 0.2s, transform 0.2s';
        win.element.style.opacity = '0';
        win.element.style.transform = 'scale(0.95)';
        setTimeout(() => {
            win.element.remove();
            this.windows.delete(id);
            if (this.activeWindow === id) {
                this.activeWindow = null;
                this.updateActiveLabel('Desktop');
            }
        }, 200);
    }

    updateActiveLabel(title) {
        document.getElementById('active-app-label').textContent = title;
    }

    getWindowContent(id) {
        const win = this.windows.get(id);
        return win ? win.element.querySelector('.window-content') : null;
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
