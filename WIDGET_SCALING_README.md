# Widget Scaling System — SpectraOS

## Overview

A production-grade, bulletproof widget scaling system for SpectraOS that ensures all resizable widgets (games, apps, tools) scale smoothly and correctly with perfect visual fidelity and accurate input mapping.

## Features

✅ **Dynamic Scaling** — Content automatically resizes when widget frame changes  
✅ **Aspect Ratio Preservation** — Enabled by default, can be disabled per-widget  
✅ **Pixel-Perfect Scaling** — Integer-only scaling prevents blur on retro games  
✅ **Upscaling & Downscaling** — Works at any size from minimum to fullscreen  
✅ **Input Remapping** — Mouse/touch coordinates correctly map to scaled canvas  
✅ **Universal Support** — Canvas, iframes, and DOM elements all supported  
✅ **Automatic Cleanup** — No memory leaks when windows close  
✅ **Performance Optimized** — Debounced via requestAnimationFrame  
✅ **Global Policy** — System-wide scaling configuration  

---

## Global Scaling Policy

```javascript
window.SpectraScalingPolicy = {
  preserveAspect: true,      // Maintain aspect ratio
  pixelArtDefault: false,    // Default pixel-art mode
  minScale: 0.25,            // Minimum scale factor
  maxScale: 4,               // Maximum scale factor
  allowFractional: true,     // Allow fractional scales
  interpolation: 'smooth'    // 'smooth', 'nearest', 'none'
};
```

All widgets respect this policy unless they override it locally.

---

## Files Modified

| File | Purpose |
|------|---------|
| `widget-scaling.js` | Reusable scaling engine module |
| `core.js` | WindowManager integration |
| `app23_pong.html` | Example game with scaling support |
| `app24_breakout.html` | Example game with scaling support |
| `test-scaling.html` | Comprehensive test suite (8 tests) |

---

## Integration Guide

### For New Widgets

1. **Add data attributes** to mark pixel-art content:
   ```html
   <canvas data-pixel-art="true" width="320" height="240"></canvas>
   ```

2. **Use coordinate remapping** for mouse/touch input:
   ```javascript
   function getCanvasMouse(e) {
       const rect = canvas.getBoundingClientRect();
       const scaleX = canvas.width / rect.width;
       const scaleY = canvas.height / rect.height;
       const clientX = e.touches ? e.touches[0].clientX : e.clientX;
       const clientY = e.touches ? e.touches[0].clientY : e.clientY;
       return {
           x: (clientX - rect.left) * scaleX,
           y: (clientY - rect.top) * scaleY
       };
   }
   ```

3. **Listen for resize events**:
   ```javascript
   canvas.addEventListener('canvasresized', (e) => {
       const { scale, width, height } = e.detail;
       // Adjust game logic if needed
   });
   ```

### For Existing Widgets

The WindowManager automatically applies scaling to all canvas, iframe, and DOM elements. No code changes required unless you need custom behavior.

---

## API Reference

### WidgetScalingEngine

```javascript
// Get singleton instance
const engine = window.__widgetScalingEngine || new WidgetScalingEngine();

// Attach scaling to a container
const controller = engine.attach(container, {
    preserveAspect: true,
    pixelArtDefault: false,
    minScale: 0.1,
    maxScale: 8
});

// Update options
controller.setOptions({ preserveAspect: false });

// Get current scale
const scale = controller.getScale();

// Force recalculation
controller.forceUpdate();

// Cleanup
controller.destroy();
```

### Helper Function

```javascript
// Simple initialization
const controller = initWidgetScaling(container, options);
```

---

## Test Suite

Open `test-scaling.html` in a browser to run 8 automated tests:

| Test | Description |
|------|-------------|
| 1 | Pixel-Art Canvas Scaling |
| 2 | Smooth Canvas Scaling |
| 3 | Input Coordinate Mapping |
| 4 | DOM Element Scaling |
| 5 | Aspect Ratio Preservation |
| 6 | ResizeObserver Performance |
| 7 | Global Policy Override |
| 8 | Extreme Resize Stress Test |

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Widget smaller than original | Scales down to minScale limit |
| Widget extremely wide/tall | Preserves aspect or stretches based on policy |
| Fullscreen mode | Upscales to fit, respects maxScale |
| Rapid resizing | Debounced via requestAnimationFrame |
| Touch input | Coordinates remapped correctly |
| Multi-monitor DPI | Uses CSS pixels, works across displays |
| Canvas with no context | Gracefully skips pixel-perfect setup |

---

## Before/After Comparison

| Aspect | Before | After |
|--------|--------|-------|
| Canvas scaling | Fixed size, clipped | Dynamic, fits container |
| Pixel art | Blurry when scaled | Crisp integer scaling |
| Mouse input | Misaligned clicks | Perfect coordinate mapping |
| Resize performance | Janky, multiple recalcs | Smooth, debounced |
| Policy control | None | Global + per-widget |

---

## Remaining Limitations

1. **Iframe content** — Cross-origin iframes cannot have their internal content scaled; only the iframe element itself scales
2. **Video elements** — May have browser-specific scaling behavior
3. **WebGL contexts** — Require manual canvas resize for proper resolution scaling

---

## Recommendations for Future Improvements

1. **Add WebGL support** — Detect WebGL canvases and handle resolution scaling
2. **DPI awareness** — Add devicePixelRatio handling for HiDPI displays
3. **Animation during resize** — Add smooth transitions between scale states
4. **Layout presets** — Allow widgets to define preferred aspect ratios
5. **Touch gesture support** — Pinch-to-zoom for touch-enabled devices

---

## License

Part of SpectraOS desktop environment.
