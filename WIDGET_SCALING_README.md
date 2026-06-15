# Widget Scaling Engine - Integration Guide

## Overview

The Widget Scaling Engine provides automatic, dynamic scaling for all widget content in SpectraOS. When users resize windows, the content inside automatically scales to fit while preserving aspect ratio and maintaining crisp pixel-art rendering.

## Features

- **Automatic ResizeObserver**: Detects window size changes in real-time
- **Aspect Ratio Preservation**: Content scales proportionally by default
- **Pixel-Perfect Scaling**: Integer-only scaling for retro games and pixel art
- **Input Coordinate Remapping**: Mouse/touch coordinates correctly map to scaled canvas
- **Universal Support**: Works with canvas, iframes, and DOM elements
- **Memory Efficient**: Automatic cleanup when windows close

## Files Modified/Created

1. `/workspace/widget-scaling.js` - Standalone scaling module (reusable)
2. `/workspace/core.js` - Integrated scaling into WindowManager
3. `/workspace/apps/app24_breakout.html` - Example game with scaling support
4. `/workspace/apps/app23_pong.html` - Example game with scaling support

## How It Works

### 1. Window Manager Integration (core.js)

The WindowManager now includes:

```javascript
// setupResize() now calls setupWidgetScaling()
setupResize(win, id) {
    // ... existing resize code ...
    this.setupWidgetScaling(win, id);
}

// Automatically observes content container size changes
setupWidgetScaling(win, id) {
    const content = win.querySelector('.wm-content');
    win._scalingState.observer = new ResizeObserver((entries) => {
        // Debounced scaling update
        requestAnimationFrame(() => {
            this.scaleWindowContent(content, width, height);
        });
    });
    win._scalingState.observer.observe(content);
}
```

### 2. Scaling Types

**Canvas Elements:**
- Pixel-art canvases use integer scaling with `imageRendering: 'pixelated'`
- Regular canvases scale smoothly to fill available space
- Dispatches `canvasresized` event for game logic updates

**Iframes:**
- Scale to 100% of container
- Border removed for seamless appearance

**DOM Elements:**
- CSS transform-based scaling
- Preserves aspect ratio

### 3. Input Mapping

For games that need mouse/touch input:

```javascript
// Get correct canvas coordinates regardless of scale
function getCanvasMouseX(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) * scaleX;
}
```

## Integration Instructions

### For Existing Widgets/Games

**Step 1: Add pixel-art marker (if applicable)**

```html
<body data-pixel-art="true">
  <canvas data-pixel-art="true" ...>
```

**Step 2: Add coordinate remapping for mouse/touch**

```javascript
// For horizontal movement (like Breakout paddle)
function updatePaddleFromMouse(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    // Use canvasX for game logic
}

canvas.addEventListener('mousemove', (e) => {
    updatePaddleFromMouse(e.clientX);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    updatePaddleFromMouse(e.touches[0].clientX);
}, { passive: false });
```

**Step 3: Listen for resize events (optional)**

```javascript
canvas.addEventListener('canvasresized', (e) => {
    console.log('New scale:', e.detail.scale);
    // Redraw or adjust game logic if needed
});
```

### For New Widgets

**Option A: Use the standalone module**

```html
<script src="widget-scaling.js"></script>
<script>
    const scaler = initWidgetScaling(container, {
        preserveAspectRatio: true,
        pixelPerfect: true
    });
</script>
```

**Option B: Rely on automatic WindowManager scaling**

No additional code needed! The WindowManager automatically scales content.

## Testing Scenarios

### Portrait Mode
1. Open any game app (Breakout, Pong)
2. Resize window to tall, narrow dimensions
3. Verify content scales without distortion
4. Test mouse/touch input accuracy

### Landscape Mode
1. Open game app
2. Resize to wide, short dimensions
3. Verify aspect ratio is preserved
4. Check for clipping or overflow

### Small Windows
1. Resize window to minimum size (280x180)
2. Content should scale down appropriately
3. Pixel-art games should use integer scaling only
4. Input should still work correctly

### Fullscreen/Maximized
1. Maximize window
2. Content should scale up to fill space
3. No blurring on pixel-art content
4. Games remain playable with correct input mapping

## API Reference

### WindowManager Methods

| Method | Description |
|--------|-------------|
| `setupWidgetScaling(win, id)` | Initialize scaling observer for window |
| `scaleWindowContent(content, w, h)` | Scale all widgets in container |
| `scaleCanvas(canvas, scale, origW, origH)` | Apply canvas-specific scaling |
| `cleanupWidgetScaling(win)` | Remove observers and free resources |

### Custom Events

| Event | Target | Detail |
|-------|--------|--------|
| `canvasresized` | Canvas elements | `{ scale, width, height }` |
| `widgetscaled` | Container | `{ scale, width, height }` |

### Data Attributes

| Attribute | Element | Effect |
|-----------|---------|--------|
| `data-pixel-art="true"` | body, canvas | Enables integer-only scaling |
| `data-original-width` | Any widget | Stores original dimension |
| `data-has-scaling` | Any widget | Skips auto-scaling |

## Troubleshooting

**Content not scaling:**
- Ensure widget is inside `.wm-content` container
- Check browser supports ResizeObserver (modern browsers only)
- Verify widget has defined dimensions

**Input misaligned:**
- Use `getBoundingClientRect()` for coordinate remapping
- Account for canvas internal resolution vs display size
- Test both mouse and touch events

**Blurry pixel art:**
- Add `data-pixel-art="true"` to canvas
- Ensure `imageRendering: 'pixelated'` is applied
- Check integer scaling is being used

**Performance issues:**
- Scaling is debounced via requestAnimationFrame
- Large numbers of widgets may need optimization
- Cleanup is automatic on window close

## Browser Compatibility

- Chrome 64+ ✓
- Firefox 69+ ✓
- Safari 13.1+ ✓
- Edge 79+ ✓

ResizeObserver is supported in all modern browsers. For older browsers, consider polyfill.
