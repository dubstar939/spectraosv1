/**
 * ═══════════════════════════════════════════
 * GPU SCALING RENDERER v1.0
 * WebGL-accelerated scaling for SpectraOS widgets
 * Supports pixel-perfect integer scaling and smooth fractional scaling
 * ═══════════════════════════════════════════
 */

// ═══════════════════════════════════════════
// GPU SCALING CONFIGURATION
// ═══════════════════════════════════════════
window.SpectraGpuScalingConfig = {
    enabled: true,
    preferWebGL: true,
    pixelArtUseGpu: true,
    smoothUiUseGpu: true,
    fallbackToCanvas2D: true,
    maxGpuWidgets: 16,
    debugOverlay: false,
    vsync: true,
    textureFiltering: {
        pixelArt: 'nearest',  // 'nearest' for crisp pixels
        smooth: 'linear'      // 'linear' for smooth UI
    }
};

// ═══════════════════════════════════════════
// WEBGL SHADER SOURCES
// ═══════════════════════════════════════════
const GPU_SCALING_SHADERS = {
    vertex: `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `,
    
    fragment: `
        precision mediump float;
        varying vec2 v_texCoord;
        uniform sampler2D u_texture;
        uniform bool u_isPixelArt;
        uniform vec2 u_pixelSize;
        
        void main() {
            if (u_isPixelArt) {
                // Nearest-neighbor sampling for pixel art
                vec2 pixelCoord = floor(v_texCoord * u_pixelSize) + 0.5;
                vec2 texCoord = pixelCoord / u_pixelSize;
                gl_FragColor = texture2D(u_texture, texCoord);
            } else {
                // Linear interpolation for smooth UI
                gl_FragColor = texture2D(u_texture, v_texCoord);
            }
        }
    `
};

// ═══════════════════════════════════════════
// GPU SCALING RENDERER CLASS
// ═══════════════════════════════════════════
class GpuScalingRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = {
            isPixelArt: options.isPixelArt || false,
            logicalWidth: canvas.width || 320,
            logicalHeight: canvas.height || 240,
            preserveAspect: options.preserveAspect !== false,
            ...options
        };
        
        this.gl = null;
        this.program = null;
        this.texture = null;
        this.framebuffer = null;
        this.renderTexture = null;
        this.verticesBuffer = null;
        this.texCoordsBuffer = null;
        this.uniforms = {};
        this.initialized = false;
        this.needsUpdate = true;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.dpi = window.devicePixelRatio || 1;
        this.debugInfo = {
            path: 'cpu',
            scale: 1,
            dpi: this.dpi,
            frameTime: 0
        };
        
        // Shared context pool management
        this.contextId = null;
    }
    
    /**
     * Initialize WebGL context and resources
     */
    async initialize() {
        if (this.initialized) return true;
        
        const config = window.SpectraGpuScalingConfig;
        
        if (!config.enabled || !config.preferWebGL) {
            this.debugInfo.path = 'disabled';
            return false;
        }
        
        try {
            // Try to get WebGL context
            const glOptions = {
                alpha: true,
                antialias: false,
                preserveDrawingBuffer: false,
                depth: false,
                stencil: false,
                premultipliedAlpha: false
            };
            
            this.gl = this.canvas.getContext('webgl', glOptions) || 
                      this.canvas.getContext('experimental-webgl', glOptions);
            
            if (!this.gl) {
                throw new Error('WebGL not supported');
            }
            
            // Check WebGL capabilities
            const maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
            if (this.options.logicalWidth > maxTextureSize || 
                this.options.logicalHeight > maxTextureSize) {
                throw new Error('Canvas exceeds maximum texture size');
            }
            
            this.setupViewport();
            await this.setupShaders();
            this.setupBuffers();
            this.setupTexture();
            
            this.initialized = true;
            this.debugInfo.path = 'gpu';
            
            // Handle DPI changes
            this.setupDpiListener();
            
            return true;
            
        } catch (error) {
            console.warn('GpuScalingRenderer: WebGL initialization failed:', error.message);
            this.cleanup();
            
            if (config.fallbackToCanvas2D) {
                this.debugInfo.path = 'cpu-fallback';
                return false;
            }
            
            return false;
        }
    }
    
    /**
     * Setup viewport and handle DPI
     */
    setupViewport() {
        const { gl, canvas } = this;
        const displayWidth = Math.floor(canvas.clientWidth * this.dpi);
        const displayHeight = Math.floor(canvas.clientHeight * this.dpi);
        
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
        
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    
    /**
     * Compile and link shader program
     */
    async setupShaders() {
        const { gl } = this;
        
        const compileShader = (source, type) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const error = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(`Shader compilation failed: ${error}`);
            }
            return shader;
        };
        
        const vertexShader = compileShader(GPU_SCALING_SHADERS.vertex, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(GPU_SCALING_SHADERS.fragment, gl.FRAGMENT_SHADER);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(this.program);
            throw new Error(`Program linking failed: ${error}`);
        }
        
        // Cache uniform and attribute locations
        this.uniforms = {
            position: gl.getAttribLocation(this.program, 'a_position'),
            texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
            texture: gl.getUniformLocation(this.program, 'u_texture'),
            isPixelArt: gl.getUniformLocation(this.program, 'u_isPixelArt'),
            pixelSize: gl.getUniformLocation(this.program, 'u_pixelSize')
        };
        
        gl.useProgram(this.program);
    }
    
    /**
     * Setup vertex buffers for fullscreen quad
     */
    setupBuffers() {
        const { gl, uniforms } = this;
        
        // Fullscreen quad vertices (-1 to 1)
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1
        ]);
        
        this.verticesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.verticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        gl.enableVertexAttribArray(uniforms.position);
        gl.vertexAttribPointer(uniforms.position, 2, gl.FLOAT, false, 0, 0);
        
        // Texture coordinates (0 to 1)
        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            0, 0,
            1, 1,
            1, 0
        ]);
        
        this.texCoordsBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        
        gl.enableVertexAttribArray(uniforms.texCoord);
        gl.vertexAttribPointer(uniforms.texCoord, 2, gl.FLOAT, false, 0, 0);
    }
    
    /**
     * Setup texture for rendering
     */
    setupTexture() {
        const { gl, options } = this;
        
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        // Set texture parameters based on pixel art flag
        const filter = options.isPixelArt ? gl.NEAREST : gl.LINEAR;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Create empty texture with logical resolution
        const width = Math.floor(options.logicalWidth * this.dpi);
        const height = Math.floor(options.logicalHeight * this.dpi);
        
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA,
            width, height, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, null
        );
    }
    
    /**
     * Update texture from source canvas/content
     */
    updateTexture(sourceCanvas) {
        if (!this.initialized || !this.gl) return;
        
        const { gl } = this;
        
        try {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            
            // Upload texture data from source
            gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA,
                gl.RGBA, gl.UNSIGNED_BYTE,
                sourceCanvas
            );
            
            this.needsUpdate = false;
            
        } catch (error) {
            console.warn('Texture update failed:', error.message);
        }
    }
    
    /**
     * Render scaled content to display canvas
     */
    render(scaleFactor = 1) {
        if (!this.initialized || !this.gl) return;
        
        const startTime = performance.now();
        
        const { gl, options, uniforms, canvas } = this;
        
        // Update DPI if changed
        const currentDpi = window.devicePixelRatio || 1;
        if (currentDpi !== this.dpi) {
            this.dpi = currentDpi;
            this.setupViewport();
            this.debugInfo.dpi = this.dpi;
        }
        
        // Clear canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Set uniforms
        gl.uniform1i(uniforms.isPixelArt, options.isPixelArt ? 1 : 0);
        gl.uniform2f(
            uniforms.pixelSize,
            options.logicalWidth * this.dpi,
            options.logicalHeight * this.dpi
        );
        gl.uniform1i(uniforms.texture, 0);
        
        // Calculate display dimensions
        const displayWidth = Math.floor(options.logicalWidth * scaleFactor * this.dpi);
        const displayHeight = Math.floor(options.logicalHeight * scaleFactor * this.dpi);
        
        // Adjust viewport for current scale
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        // Draw fullscreen quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Update FPS tracking
        this.frameCount++;
        if (startTime - this.lastFrameTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = startTime;
        }
        
        this.debugInfo.scale = scaleFactor;
        this.debugInfo.frameTime = performance.now() - startTime;
    }
    
    /**
     * Set pixel art mode
     */
    setPixelArt(isPixelArt) {
        this.options.isPixelArt = isPixelArt;
        
        if (this.initialized && this.gl) {
            const filter = isPixelArt ? this.gl.NEAREST : this.gl.LINEAR;
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, filter);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, filter);
        }
    }
    
    /**
     * Handle DPI changes using matchMedia API (more efficient than polling)
     */
    setupDpiListener() {
        if (this._dpiListenerAttached) return;
        
        const currentDpi = window.devicePixelRatio || 1;
        
        const handleDpiChange = (e) => {
            const newDpi = window.devicePixelRatio || 1;
            if (newDpi !== this.dpi) {
                this.dpi = newDpi;
                this.debugInfo.dpi = newDpi;
                
                // Reinitialize texture with new DPI
                if (this.initialized) {
                    this.setupViewport();
                    this.setupTexture();
                    this.needsUpdate = true;
                }
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
        
        this._dpiListenerAttached = true;
    }
    
    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            ...this.debugInfo,
            fps: this.fps,
            initialized: this.initialized,
            isPixelArt: this.options.isPixelArt
        };
    }
    
    /**
     * Cleanup WebGL resources
     */
    cleanup() {
        if (!this.gl) return;
        
        const { gl } = this;
        
        if (this.texture) {
            gl.deleteTexture(this.texture);
            this.texture = null;
        }
        
        if (this.program) {
            gl.deleteProgram(this.program);
            this.program = null;
        }
        
        if (this.verticesBuffer) {
            gl.deleteBuffer(this.verticesBuffer);
            this.verticesBuffer = null;
        }
        
        if (this.texCoordsBuffer) {
            gl.deleteBuffer(this.texCoordsBuffer);
            this.texCoordsBuffer = null;
        }
        
        this.initialized = false;
        this.debugInfo.path = 'cleaned';
    }
}

// ═══════════════════════════════════════════
// GPU SCALING MANAGER
// Manages multiple GPU renderers with shared resources
// ═══════════════════════════════════════════
class GpuScalingManager {
    constructor() {
        this.renderers = new Map();
        this.activeCount = 0;
        this.maxRenderers = window.SpectraGpuScalingConfig?.maxGpuWidgets || 16;
        this.sharedContext = null;
        this.animationFrameId = null;
        this.isRunning = false;
    }
    
    /**
     * Create or get GPU renderer for a canvas
     */
    getRenderer(canvas, options = {}) {
        const config = window.SpectraGpuScalingConfig;
        
        if (!config.enabled) {
            return null;
        }
        
        // Check if we've hit the max renderer limit
        if (this.activeCount >= this.maxRenderers) {
            console.warn('GpuScalingManager: Max GPU renderers reached');
            return null;
        }
        
        // Check if canvas already has a renderer
        if (this.renderers.has(canvas)) {
            return this.renderers.get(canvas);
        }
        
        // Determine if this should use GPU based on content type
        const isPixelArt = canvas.dataset.pixelArt === 'true' ||
                          canvas.closest('[data-pixel-art="true"]');
        
        const useGpu = isPixelArt ? config.pixelArtUseGpu : config.smoothUiUseGpu;
        
        if (!useGpu) {
            return null;
        }
        
        // Create new renderer
        const renderer = new GpuScalingRenderer(canvas, {
            ...options,
            isPixelArt
        });
        
        this.renderers.set(canvas, renderer);
        this.activeCount++;
        
        // Start render loop if not running
        if (!this.isRunning) {
            this.startRenderLoop();
        }
        
        return renderer;
    }
    
    /**
     * Remove renderer for a canvas
     */
    removeRenderer(canvas) {
        const renderer = this.renderers.get(canvas);
        if (renderer) {
            renderer.cleanup();
            this.renderers.delete(canvas);
            this.activeCount--;
        }
    }
    
    /**
     * Main render loop - optimized to only render visible canvases
     */
    startRenderLoop() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        const render = () => {
            if (!this.isRunning) return;
            
            // Only render canvases that need updates and are visible
            this.renderers.forEach((renderer, canvas) => {
                // Check if canvas is visible in viewport
                const rect = canvas.getBoundingClientRect();
                const isVisible = (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );
                
                // Only render if visible and needs update
                if (renderer.initialized && renderer.needsUpdate && isVisible) {
                    renderer.render();
                    renderer.needsUpdate = false;
                }
            });
            
            this.animationFrameId = requestAnimationFrame(render);
        };
        
        this.animationFrameId = requestAnimationFrame(render);
    }
    
    /**
     * Stop render loop
     */
    stopRenderLoop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    /**
     * Cleanup all renderers
     */
    cleanup() {
        this.stopRenderLoop();
        this.renderers.forEach(renderer => renderer.cleanup());
        this.renderers.clear();
        this.activeCount = 0;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            activeRenderers: this.activeCount,
            maxRenderers: this.maxRenderers,
            isRunning: this.isRunning,
            renderers: []
        };
        
        this.renderers.forEach((renderer, canvas) => {
            stats.renderers.push({
                canvasId: canvas.id,
                ...renderer.getDebugInfo()
            });
        });
        
        return stats;
    }
}

// ═══════════════════════════════════════════
// GLOBAL MANAGER INSTANCE
// ═══════════════════════════════════════════
window.__gpuScalingManager = new GpuScalingManager();

// ═══════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Check if WebGL is supported
 */
function isWebGLSupported() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && 
                 (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

/**
 * Get GPU scaling debug overlay HTML
 */
function getGpuDebugOverlay() {
    const manager = window.__gpuScalingManager;
    const stats = manager.getStats();
    
    let html = `<div style="position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:#00ff88;padding:10px;border-radius:8px;font-family:monospace;font-size:11px;z-index:99999;">`;
    html += `<div style="font-weight:bold;margin-bottom:5px;">🎮 GPU Scaling Debug</div>`;
    html += `<div>Active: ${stats.activeRenderers}/${stats.maxRenderers}</div>`;
    html += `<div>Running: ${stats.isRunning ? '✓' : '✗'}</div>`;
    html += `<div>WebGL: ${isWebGLSupported() ? '✓' : '✗'}</div>`;
    
    stats.renderers.forEach(r => {
        html += `<div style="margin-top:5px;border-top:1px solid #333;padding-top:5px;">`;
        html += `<div>Canvas: ${r.canvasId || 'unnamed'}</div>`;
        html += `<div>Path: ${r.path}</div>`;
        html += `<div>Scale: ${r.scale.toFixed(2)}x</div>`;
        html += `<div>DPI: ${r.dpi}</div>`;
        html += `<div>FPS: ${r.fps}</div>`;
        html += `<div>Frame: ${r.frameTime.toFixed(2)}ms</div>`;
        html += `</div>`;
    });
    
    html += `</div>`;
    return html;
}

/**
 * Show debug overlay on page
 */
function showGpuDebugOverlay() {
    const existing = document.getElementById('gpu-scaling-debug');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'gpu-scaling-debug';
    overlay.innerHTML = getGpuDebugOverlay();
    document.body.appendChild(overlay);
    
    // Update every second
    setInterval(() => {
        overlay.innerHTML = getGpuDebugOverlay();
    }, 1000);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        GpuScalingRenderer, 
        GpuScalingManager,
        isWebGLSupported,
        showGpuDebugOverlay
    };
}
