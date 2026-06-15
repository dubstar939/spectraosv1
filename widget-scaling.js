/**
 * ═══════════════════════════════════════════
 * WIDGET SCALING ENGINE
 * Dynamic scaling system for resizable widgets
 * ═══════════════════════════════════════════
 */

class WidgetScalingEngine {
    constructor() {
        this.widgets = new Map();
        this.defaultOptions = {
            preserveAspectRatio: true,
            pixelPerfect: false,
            minScale: 0.1,
            maxScale: 4.0,
            interpolation: 'smooth' // 'smooth', 'nearest', 'none'
        };
    }

    /**
     * Initialize scaling for a widget container
     * @param {HTMLElement} container - The widget content container
     * @param {Object} options - Scaling options
     * @returns {Object} Scaling controller
     */
    init(container, options = {}) {
        const config = { ...this.defaultOptions, ...options };
        const id = `scale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Find canvas or content element
        const canvas = container.querySelector('canvas');
        const content = canvas || container.firstElementChild || container;
        
        if (!content) {
            console.warn('WidgetScalingEngine: No content found in container');
            return null;
        }

        // Store original dimensions
        const originalWidth = content.offsetWidth || content.width || 0;
        const originalHeight = content.offsetHeight || content.height || 0;
        
        const state = {
            id,
            container,
            content,
            canvas,
            config,
            originalWidth,
            originalHeight,
            currentWidth: originalWidth,
            currentHeight: originalHeight,
            scale: 1,
            observer: null,
            rafId: null
        };

        // Setup ResizeObserver
        this.setupResizeObserver(state);
        
        // Setup input mapping if canvas exists
        if (canvas) {
            this.setupInputMapping(state);
        }

        // Apply initial scaling
        this.applyScale(state);
        
        this.widgets.set(id, state);
        
        return {
            id,
            destroy: () => this.destroy(id),
            setOptions: (opts) => this.setOptions(id, opts),
            getScale: () => state.scale,
            forceUpdate: () => this.applyScale(state)
        };
    }

    /**
     * Setup ResizeObserver for automatic resize detection
     */
    setupResizeObserver(state) {
        state.observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                
                // Debounce with requestAnimationFrame
                if (state.rafId) cancelAnimationFrame(state.rafId);
                
                state.rafId = requestAnimationFrame(() => {
                    state.currentWidth = width;
                    state.currentHeight = height;
                    this.applyScale(state);
                });
            }
        });

        state.observer.observe(state.container);
    }

    /**
     * Calculate optimal scale factor
     */
    calculateScale(state) {
        const { 
            currentWidth, 
            currentHeight, 
            originalWidth, 
            originalHeight,
            config 
        } = state;

        if (originalWidth === 0 || originalHeight === 0) return 1;

        let scaleX = currentWidth / originalWidth;
        let scaleY = currentHeight / originalHeight;

        if (config.preserveAspectRatio) {
            // Use the smaller scale to fit content within bounds
            const scale = Math.min(scaleX, scaleY);
            state.scale = this.clamp(scale, config.minScale, config.maxScale);
        } else {
            // Independent scaling for X and Y
            state.scaleX = this.clamp(scaleX, config.minScale, config.maxScale);
            state.scaleY = this.clamp(scaleY, config.minScale, config.maxScale);
            return { scaleX: state.scaleX, scaleY: state.scaleY };
        }

        return state.scale;
    }

    /**
     * Apply scaling transformation to content
     */
    applyScale(state) {
        const { content, canvas, config } = state;
        
        const scaleResult = this.calculateScale(state);
        const scale = typeof scaleResult === 'object' ? scaleResult.scaleX : scaleResult;

        if (config.pixelPerfect && canvas) {
            this.applyPixelPerfectScale(state, scale);
        } else {
            this.applyStandardScale(state, scale);
        }

        // Dispatch custom event for widgets to listen to
        state.container.dispatchEvent(new CustomEvent('widgetscaled', {
            detail: { scale, width: state.currentWidth, height: state.currentHeight }
        }));
    }

    /**
     * Standard CSS-based scaling with transforms
     */
    applyStandardScale(state, scale) {
        const { content, config } = state;

        // Apply CSS transform for smooth scaling
        content.style.transformOrigin = 'top left';
        content.style.transform = `scale(${scale})`;
        
        // Set interpolation based on config
        if (config.interpolation === 'nearest') {
            content.style.imageRendering = 'pixelated';
            content.style.imageRendering = 'crisp-edges';
        } else if (config.interpolation === 'none') {
            content.style.imageRendering = 'auto';
        }

        // Adjust container size to match scaled content
        const scaledWidth = state.originalWidth * scale;
        const scaledHeight = state.originalHeight * scale;
        
        content.style.width = `${scaledWidth}px`;
        content.style.height = `${scaledHeight}px`;
    }

    /**
     * Pixel-perfect scaling for canvas (retro games, pixel art)
     */
    applyPixelPerfectScale(state, scale) {
        const { canvas, config } = state;
        
        if (!canvas) return;

        // Disable image smoothing for crisp pixels
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.imageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
        }

        // Apply pixelated rendering
        canvas.style.imageRendering = 'pixelated';
        canvas.style.imageRendering = 'crisp-edges';

        // Calculate integer scale for pixel perfection
        const integerScale = Math.floor(scale);
        const effectiveScale = Math.max(1, integerScale);

        // Resize canvas display size (not internal resolution)
        canvas.style.width = `${state.originalWidth * effectiveScale}px`;
        canvas.style.height = `${state.originalHeight * effectiveScale}px`;
        
        // Center the canvas if there's extra space
        if (state.config.preserveAspectRatio) {
            canvas.style.margin = 'auto';
            canvas.style.display = 'block';
        }

        state.scale = effectiveScale;
    }

    /**
     * Setup input coordinate remapping for canvas
     */
    setupInputMapping(state) {
        const { canvas, container } = state;
        
        if (!canvas) return;

        const remapPointer = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            let clientX, clientY;
            
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY,
                rect,
                scaleX,
                scaleY
            };
        };

        // Wrap pointer events to provide correct coordinates
        const wrapEvent = (type, handler) => {
            const wrapped = (e) => {
                const coords = remapPointer(e);
                const customEvent = new CustomEvent(type, {
                    bubbles: e.bubbles,
                    cancelable: e.cancelable,
                    detail: {
                        originalEvent: e,
                        x: coords.x,
                        y: coords.y,
                        canvasX: coords.x,
                        canvasY: coords.y,
                        rect: coords.rect,
                        scaleX: coords.scaleX,
                        scaleY: coords.scaleY,
                        preventDefault: () => e.preventDefault(),
                        stopPropagation: () => e.stopPropagation()
                    }
                });
                handler(customEvent);
            };
            return wrapped;
        };

        // Store original listeners for cleanup
        state.inputListeners = [];

        // Override addEventListener for pointer events
        const originalAddEventListener = canvas.addEventListener.bind(canvas);
        const originalRemoveEventListener = canvas.removeEventListener.bind(canvas);

        canvas._scaledAddEventListener = function(type, handler, options) {
            if (['mousedown', 'mousemove', 'mouseup', 'click', 'touchstart', 'touchmove', 'touchend'].includes(type)) {
                const wrapped = wrapEvent(type, handler);
                state.inputListeners.push({ type, handler, wrapped, options });
                originalAddEventListener(type, wrapped, options);
            } else {
                originalAddEventListener(type, handler, options);
            }
        };

        canvas._scaledRemoveEventListener = function(type, handler, options) {
            const listener = state.inputListeners.find(l => l.type === type && l.handler === handler);
            if (listener) {
                originalRemoveEventListener(type, listener.wrapped, options);
            } else {
                originalRemoveEventListener(type, handler, options);
            }
        };

        // Replace canvas methods
        canvas.addEventListener = canvas._scaledAddEventListener;
        canvas.removeEventListener = canvas._scaledRemoveEventListener;
    }

    /**
     * Get pointer coordinates in canvas space
     */
    getCanvasCoordinates(canvas, e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        let clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    /**
     * Update scaling options
     */
    setOptions(id, options) {
        const state = this.widgets.get(id);
        if (!state) return;
        
        state.config = { ...state.config, ...options };
        this.applyScale(state);
    }

    /**
     * Cleanup and destroy scaling instance
     */
    destroy(id) {
        const state = this.widgets.get(id);
        if (!state) return;

        if (state.observer) {
            state.observer.disconnect();
        }

        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
        }

        // Restore original canvas methods
        if (state.canvas) {
            state.canvas.addEventListener = state.canvas._originalAddEventListener;
            state.canvas.removeEventListener = state.canvas._originalRemoveEventListener;
        }

        // Remove transform
        if (state.content) {
            state.content.style.transform = '';
            state.content.style.width = '';
            state.content.style.height = '';
        }

        this.widgets.delete(id);
    }

    /**
     * Utility: Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Utility: Check if element is visible
     */
    isVisible(element) {
        return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    }
}

/**
 * Global helper function for easy access
 */
function initWidgetScaling(container, options) {
    if (!window.__widgetScalingEngine) {
        window.__widgetScalingEngine = new WidgetScalingEngine();
    }
    return window.__widgetScalingEngine.init(container, options);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WidgetScalingEngine, initWidgetScaling };
}
