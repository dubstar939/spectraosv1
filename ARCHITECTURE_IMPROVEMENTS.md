# Architecture Improvements - Implementation Guide

## Overview
Comprehensive architectural enhancements to SpectraOS that establish proper separation of concerns, decoupled component communication, and reusable utilities for app development.

---

## 1. Event Bus System ✅

### Implementation Location
`/workspace/core.js` (Lines 1520-1611)

### Features
- **Pub/Sub Pattern**: Decoupled event-driven communication
- **Subscription Management**: Subscribe, unsubscribe, one-time listeners
- **Error Handling**: Graceful error recovery in event handlers
- **Listener Counting**: Monitor active subscriptions
- **Bulk Cleanup**: Clear all events or specific ones

### API Reference

```javascript
// Subscribe to an event
const unsubscribe = eventBus.on('app:launched', (data) => {
    console.log(`App ${data.appId} was launched`);
});

// Emit an event
eventBus.emit('app:launched', { appId: 'calculator', timestamp: Date.now() });

// Unsubscribe
unsubscribe();

// One-time subscription
eventBus.once('system:ready', (data) => {
    // Handler called only once
});

// Get listener count
const count = eventBus.listenerCount('app:launched');

// Clear all listeners
eventBus.clear(); // or eventBus.clear('specific:event')
```

### Use Cases
- App lifecycle notifications
- Cross-app communication
- System state changes
- Plugin architecture support

---

## 2. IPC Layer (Inter-Process Communication) ✅

### Implementation Location
`/workspace/core.js` (Lines 1613-1844)

### Features
- **Sandboxed Messaging**: Secure app-to-system communication
- **Path Validation**: File system access restrictions
- **Rate Limiting**: Prevent abuse of system resources
- **Message Queuing**: Handle rate-limited requests gracefully
- **Built-in Handlers**: Pre-configured for common operations
- **Automatic Cleanup**: Remove subscriptions on window close

### Built-in Channels

#### Window Management
- `window:minimize` - Minimize a window
- `window:maximize` - Maximize/restore a window
- `window:close` - Close a window
- `window:focus` - Bring window to front

#### File System (Sandboxed)
- `fs:read` - Read file content
- `fs:write` - Write file content
- `fs:list` - List directory contents

#### Notifications
- `notification:send` - Send user notification (rate-limited: 1s)

#### Event Bus Integration
- `event:emit` - Emit events through IPC
- `event:subscribe` - Subscribe to events via IPC

### Security Features

#### Path Sandboxing
```javascript
// Only allows access to:
// - /home/user/*
// - /public/*
// - /tmp/*
// Blocks path traversal attempts (../)
```

#### Rate Limiting
```javascript
// Notifications limited to 1 per second per app
ipc.register('notification:send', handler, { rateLimit: 1000 });
```

### API Reference

```javascript
// From within an app (iframe)
window.parent.postMessage({
    type: 'IPC_REQUEST',
    channel: 'fs:read',
    data: { path: '/home/user/document.txt' }
}, '*');

// System-side usage
try {
    const content = await ipc.send('fs:read', {
        path: '/home/user/document.txt'
    }, windowId);
    
    await ipc.send('notification:send', {
        title: 'File Saved',
        message: 'Your document has been saved successfully',
        icon: '💾'
    }, windowId);
} catch (error) {
    console.error('IPC Error:', error);
}

// Register custom handler
ipc.register('app:custom', (data, windowId) => {
    // Custom logic here
    return { success: true };
}, { rateLimit: 500 });
```

### Integration with Window Manager
The IPC layer automatically cleans up subscriptions when windows close:

```javascript
// In WindowManager.closeWindow()
if (typeof ipc !== 'undefined') {
    ipc.cleanup(id); // Removes all event subscriptions
}
```

---

## 3. Shared App Utilities (AppUtils) ✅

### Implementation Location
`/workspace/core.js` (Lines 1846-2137)

### Purpose
Reduce code duplication across apps by providing common utility functions with consistent APIs.

### Utility Functions

#### Function Debouncing & Throttling
```javascript
// Debounce search input
const searchHandler = AppUtils.debounce((query) => {
    performSearch(query);
}, 300);

// Throttle scroll events
const scrollHandler = AppUtils.throttle(() => {
    updateScrollPosition();
}, 100);
```

#### ID Generation
```javascript
const uniqueId = AppUtils.generateId('window-'); 
// Returns: "window-lx9k2m3p4q5r6s7t8"
```

#### Data Formatting
```javascript
// Format file sizes
const size = AppUtils.formatBytes(1548624); // "1.48 MB"

// Format timestamps
const date = AppUtils.formatDate(1699564800000); 
// "Nov 09, 2023, 12:00 PM"
```

#### Safe Operations
```javascript
// Deep clone objects
const cloned = AppUtils.deepClone(originalObject);

// Safe JSON parsing
const data = AppUtils.safeJSONParse(invalidJson, defaultValue);
```

#### DOM Utilities
```javascript
// Create elements programmatically
const button = AppUtils.createElement('button', {
    className: 'btn-primary',
    style: { color: 'blue' },
    onClick: () => console.log('clicked')
}, ['Click Me']);

// Check visibility
const isVisible = AppUtils.isVisible(element);

// Smooth scroll
AppUtils.scrollTo(element, { behavior: 'smooth' });
```

#### Clipboard & Files
```javascript
// Copy to clipboard
const success = await AppUtils.copyToClipboard('Text to copy');

// Download file
AppUtils.downloadFile(content, 'filename.txt', 'text/plain');

// Read file as text
const text = await AppUtils.readFileAsText(fileInput.files[0]);

// Read file as data URL (for images)
const dataUrl = await AppUtils.readFileAsDataURL(imageFile);
```

#### Dynamic Resource Loading
```javascript
// Load external scripts
await AppUtils.loadScript('https://example.com/library.js');

// Load stylesheets
await AppUtils.loadStyle('/styles/custom-theme.css');
```

---

## Benefits

### 1. Decoupling
- Apps no longer need direct references to WM, FS, or notifSystem
- Components communicate through well-defined interfaces
- Easier to test individual components in isolation

### 2. Security
- Sandboxed file system access prevents unauthorized reads/writes
- Rate limiting protects against DoS attacks
- Path validation blocks directory traversal attacks

### 3. Maintainability
- Single source of truth for common utilities
- Consistent APIs across all apps
- Reduced code duplication (DRY principle)

### 4. Extensibility
- Easy to add new IPC channels
- Event bus enables plugin architecture
- Custom handlers can extend built-in functionality

### 5. Performance
- Automatic cleanup prevents memory leaks
- Rate limiting reduces unnecessary processing
- Efficient event distribution with Map-based storage

---

## Testing Examples

### EventBus Tests
```javascript
// Test subscription
let called = false;
const unsub = eventBus.on('test', () => called = true);
eventBus.emit('test');
console.assert(called === true, 'Event should trigger callback');

// Test unsubscription
called = false;
unsub();
eventBus.emit('test');
console.assert(called === false, 'Unsubscribed callback should not fire');

// Test once
let onceCalled = 0;
eventBus.once('once-test', () => onceCalled++);
eventBus.emit('once-test');
eventBus.emit('once-test');
console.assert(onceCalled === 1, 'Once should only fire once');
```

### IPC Tests
```javascript
// Test path validation
console.assert(ipc.validatePath('/home/user/file.txt', 'win1') === true);
console.assert(ipc.validatePath('/etc/passwd', 'win1') === false);
console.assert(ipc.validatePath('/home/../etc/passwd', 'win1') === false);

// Test rate limiting
const start = Date.now();
await ipc.send('notification:send', { title: 'Test' }, 'win1');
await ipc.send('notification:send', { title: 'Test2' }, 'win1'); // Should queue
console.assert(Date.now() - start >= 1000, 'Should respect rate limit');
```

### AppUtils Tests
```javascript
// Test debounce
let callCount = 0;
const debounced = AppUtils.debounce(() => callCount++, 100);
debounced();
debounced();
debounced();
setTimeout(() => console.assert(callCount === 1), 150);

// Test formatBytes
console.assert(AppUtils.formatBytes(0) === '0 Bytes');
console.assert(AppUtils.formatBytes(1024) === '1 KB');
console.assert(AppUtils.formatBytes(1048576) === '1 MB');
```

---

## Migration Guide for Existing Apps

### Before (Tightly Coupled)
```javascript
// Direct access to WindowManager
WM.minimizeWindow(windowId);

// Direct localStorage access
localStorage.setItem('myKey', JSON.stringify(data));

// Duplicate utility code
function formatBytes(bytes) { /* ... */ }
```

### After (Using Architecture)
```javascript
// Use IPC for window operations
await ipc.send('window:minimize', {}, windowId);

// Use IPC for safe file operations
await ipc.send('fs:write', { 
    path: '/home/user/settings.json', 
    content: JSON.stringify(data) 
}, windowId);

// Use shared utilities
const size = AppUtils.formatBytes(bytes);
```

---

## Best Practices

### 1. Event Naming Convention
Use colon-separated hierarchical names:
- `app:launched`
- `app:closed`
- `file:saved`
- `user:login`
- `system:shutdown`

### 2. IPC Channel Naming
Follow the pattern `domain:action`:
- `window:minimize`
- `fs:read`
- `notification:send`

### 3. Rate Limiting
Always apply rate limits to user-triggered actions:
```javascript
ipc.register('user:action', handler, { rateLimit: 500 });
```

### 4. Error Handling
Wrap IPC calls in try-catch:
```javascript
try {
    await ipc.send('fs:read', { path }, windowId);
} catch (error) {
    // Handle error gracefully
    showErrorMessage(error.message);
}
```

### 5. Cleanup
Always clean up subscriptions in app unload handlers:
```javascript
window.addEventListener('unload', () => {
    // IPC cleanup happens automatically on window close
    // But manual cleanup may be needed for long-lived apps
});
```

---

## Performance Considerations

### Event Bus
- O(1) subscription and emission
- Map-based storage for efficient lookups
- Automatic error isolation (one failing handler doesn't break others)

### IPC Layer
- Async/await for non-blocking operations
- Message queuing prevents request loss during rate limiting
- Automatic cleanup prevents memory leaks

### AppUtils
- Frozen object prevents runtime modifications
- Pure functions enable caching/memoization if needed
- No external dependencies

---

## Future Enhancements

### Potential Additions
1. **Event Persistence**: Store and replay critical events after refresh
2. **IPC Middleware**: Add logging, validation, or transformation layers
3. **Priority Events**: Support high-priority events that bypass queues
4. **Event Namespaces**: Isolate events by app or module
5. **IPC Permissions**: Fine-grained access control per app
6. **Utility Extensions**: Add more domain-specific utilities

---

## Summary

These architecture improvements transform SpectraOS from a monolithic design into a modular, maintainable, and extensible system:

✅ **Event Bus**: Decoupled pub/sub communication  
✅ **IPC Layer**: Secure, sandboxed inter-process messaging  
✅ **AppUtils**: Reusable utilities reducing code duplication  
✅ **Automatic Cleanup**: Memory leak prevention  
✅ **Security**: Path validation and rate limiting  
✅ **Developer Experience**: Clean APIs and comprehensive documentation  

The system is now production-ready with professional-grade architecture patterns!
