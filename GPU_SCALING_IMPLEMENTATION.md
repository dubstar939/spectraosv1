# GPU-Accelerated Scaling Pipeline for SpectraOS

## Implementation Notes

### Overview

This implementation adds GPU-accelerated scaling to SpectraOS widgets, providing:
- **Pixel-perfect integer scaling** for retro games (Pong, Breakout) using nearest-neighbor filtering
- **Smooth fractional scaling** for modern UI elements using linear filtering
- **DPI-aware rendering** that adapts to different display densities
- **Automatic fallback** to CPU-based canvas2D when WebGL is unavailable
- **Minimal CPU overhead** by offloading scaling operations to the GPU

---

## Architecture

### New Files

#### `gpu-scaling.js`
Core GPU scaling module containing:

1. **`GpuScalingRenderer`** - Per-canvas WebGL renderer
   - Manages WebGL context, shaders, and textures
   - Handles DPI changes automatically
   - Supports both nearest-neighbor (pixel art) and linear (smooth) filtering
   - Tracks FPS and frame timing for debugging

2. **`GpuScalingManager`** - Global resource manager
   - Limits concurrent GPU renderers (configurable max)
   - Manages shared WebGL contexts
   - Runs centralized render loop via requestAnimationFrame
   - Provides cleanup on window close

3. **Configuration Object** (`window.SpectraGpuScalingConfig`)
   ```js
   {
     enabled: true,           // Master switch for GPU scaling
     preferWebGL: true,       // Use WebGL when available
     pixelArtUseGpu: true,    // Pixel art uses GPU path
     smoothUiUseGpu: true,    // Modern UI uses GPU path
     fallbackToCanvas2D: true,// Fallback when GPU unavailable
     maxGpuWidgets: 16,       // Max concurrent GPU renderers
     debugOverlay: false,     // Show debug overlay
     vsync: true,             // Sync to display refresh
     textureFiltering: {
       pixelArt: 'nearest',   // Nearest for crisp pixels
       smooth: 'linear'       // Linear for smooth UI
     }
   }
   ```

### Modified Files

#### `widget-scaling.js`
- Added `gpuManager` reference in `WidgetScalingEngine` constructor
- Modified `attach()` to initialize GPU renderer for canvases
- Added `applyGpuScale()` method for GPU rendering path
- Updated `applyScale()` to choose between GPU/CPU paths
- Enhanced `detach()` to cleanup GPU resources

#### `test-scaling.html`
- Added 4 new GPU-specific tests (Tests 9-12):
  - Test 9: GPU Pixel-Art Scaling
  - Test 10: GPU Smooth Scaling
  - Test 11: DPI Awareness
  - Test 12: GPU vs CPU Performance Comparison
- Added GPU debug overlay toggle
- Added configuration panel for runtime adjustments

---

## How GPU Scaling Works

### Initialization Flow

```
1. WidgetScalingEngine.attach(container)
   ↓
2. Check if content is canvas with data-pixel-art="true"
   ↓
3. If GPU enabled → GpuScalingManager.getRenderer(canvas)
   ↓
4. Create GpuScalingRenderer with appropriate settings
   ↓
5. Initialize WebGL context, compile shaders, setup buffers
   ↓
6. On each resize → applyGpuScale() updates texture & renders
```

### Rendering Path Selection

```
┌─────────────────────┐
│   Content Type?     │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
 Pixel Art      Smooth UI
    │             │
    ▼             ▼
Nearest        Linear
Filter         Filter
    │             │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ GPU Available?│
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │             │
   Yes           No
    │             │
    ▼             ▼
  WebGL       Canvas2D
  Renderer    Fallback
```

### Shader Implementation

The fragment shader handles both filtering modes:

```glsl
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform bool u_isPixelArt;
uniform vec2 u_pixelSize;

void main() {
    if (u_isPixelArt) {
        // Nearest-neighbor: snap to pixel grid
        vec2 pixelCoord = floor(v_texCoord * u_pixelSize) + 0.5;
        vec2 texCoord = pixelCoord / u_pixelSize;
        gl_FragColor = texture2D(u_texture, texCoord);
    } else {
        // Linear interpolation (default texture sampling)
        gl_FragColor = texture2D(u_texture, v_texCoord);
    }
}
```

---

## Enabling/Disabling GPU Scaling

### Global Configuration

```js
// Disable all GPU scaling
window.SpectraGpuScalingConfig.enabled = false;

// Only use GPU for pixel art
window.SpectraGpuScalingConfig.pixelArtUseGpu = true;
window.SpectraGpuScalingConfig.smoothUiUseGpu = false;

// Increase max concurrent GPU widgets
window.SpectraGpuScalingConfig.maxGpuWidgets = 32;
```

### Per-Widget Control

Add `data-pixel-art="true"` attribute to enable pixel-perfect GPU scaling:

```html
<!-- Retro game - uses nearest-neighbor GPU scaling -->
<canvas id="game-canvas" width="320" height="240" data-pixel-art="true"></canvas>

<!-- Modern UI - uses linear GPU scaling -->
<canvas id="ui-canvas" width="800" height="600"></canvas>
```

Or configure via options:

```js
initWidgetScaling(container, {
  pixelArtDefault: true  // Force pixel-art mode
});
```

---

## DPI Handling

The GPU renderer automatically detects and adapts to DPI changes:

1. **Detection**: Monitors `window.devicePixelRatio` via animation frame
2. **Adjustment**: Reinitializes texture at correct resolution when DPI changes
3. **Accuracy**: Input coordinate mapping remains correct regardless of DPI

```js
// In GpuScalingRenderer.setupDpiListener()
const checkDpi = () => {
    const currentDpi = window.devicePixelRatio || 1;
    if (currentDpi !== this.dpi) {
        this.dpi = currentDpi;
        this.setupViewport();
        this.setupTexture();
        this.needsUpdate = true;
    }
    requestAnimationFrame(checkDpi);
};
```

---

## Resource Management

### Cleanup on Window Close

```js
// In WidgetScalingEngine.detach()
if (state.gpuRenderer && this.gpuManager) {
    this.gpuManager.removeRenderer(state.canvas);
    state.gpuRenderer = null;
}
```

### GpuScalingRenderer.cleanup()

Destroys all WebGL resources:
- Deletes textures
- Deletes programs
- Deletes buffers
- Resets initialized flag

---

## Integration with Existing Systems

### WindowManager (core.js)

No changes required to core.js - the GPU scaling integrates through the existing `WidgetScalingEngine` which is already called by WindowManager's `setupWidgetScaling()`.

### Input Remapping

Input coordinate remapping continues to work correctly because:
1. The logical canvas resolution (`canvas.width`, `canvas.height`) doesn't change
2. Only the display size changes via CSS
3. `getBoundingClientRect()` returns the scaled display size
4. Coordinate calculation uses the ratio between logical and display sizes

---

## Known Limitations & Browser Constraints

### WebGL Support
- Requires WebGL 1.0 or higher (supported in all modern browsers)
- Falls back to CPU canvas2D when unavailable
- Some mobile browsers may have limited WebGL capabilities

### Texture Size Limits
- Maximum texture size varies by GPU (typically 4096x4096 to 16384x16384)
- Canvases exceeding `gl.MAX_TEXTURE_SIZE` will fall back to CPU

### Context Loss
- WebGL contexts can be lost under memory pressure
- Current implementation logs warnings but doesn't auto-recover
- Future enhancement: Add context restoration handling

### Multi-Monitor DPI
- DPI changes are detected but may cause brief flicker during transition
- Moving windows between monitors with different DPIs triggers reinitialization

### Performance Considerations
- Each GPU widget has its own WebGL context (up to `maxGpuWidgets`)
- Too many concurrent contexts may impact performance
- Recommended: Keep `maxGpuWidgets` ≤ 16 for most systems

### Browser-Specific Notes
- **Chrome/Edge**: Full support, best performance
- **Firefox**: Full support, may have slightly different precision
- **Safari**: Supported on macOS/iOS, watch for texture size limits on mobile
- **Mobile**: May have stricter limits on concurrent WebGL contexts

---

## Debugging

### Debug Overlay

Click "Toggle GPU Debug Overlay" in test-scaling.html to see:
- Active GPU renderer count
- Current scale factor per widget
- DPI value
- FPS counter
- Frame time in milliseconds

### Console Output

GPU initialization failures are logged:
```
GpuScalingRenderer: WebGL initialization failed: [reason]
```

### Configuration Panel

Click "Toggle Config Panel" to adjust settings at runtime:
- Enable/disable GPU scaling
- Toggle pixel art vs smooth UI paths
- Adjust max concurrent widgets
- Apply changes without page reload

---

## Testing

Run `test-scaling.html` to verify:

1. **Test 9**: GPU pixel-art scaling with nearest-neighbor
2. **Test 10**: GPU smooth scaling with linear filtering  
3. **Test 11**: DPI awareness (zoom browser to test)
4. **Test 12**: GPU vs CPU performance comparison

Visual verification:
- Pong/Breakout should show crisp pixels at any scale
- UI elements should scale smoothly without aliasing
- No visible artifacts during resize operations

---

## Future Enhancements

Potential improvements for future versions:

1. **Shared WebGL Context**: Pool contexts across widgets to reduce overhead
2. **OffscreenCanvas**: Use OffscreenCanvas for background rendering
3. **Context Restoration**: Handle WebGL context loss gracefully
4. **Shader Optimization**: Add optional post-processing effects
5. **WebGPU Support**: Add WebGPU backend for next-gen browsers
6. **Memory Monitoring**: Auto-disable GPU for low-memory devices
