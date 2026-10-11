// Pictureframe - Shadow DOM Fullscreen Lightbox & Viewer
// Features: Cursor-anchored zoom, pan, rotation, flip, copy, download, pixel inspector.
// Follows House Design Principles: Lucide iconography, white icons on dark toolbar.

(function() {
  const VIEWER_STYLES = `/* Pictureframe Viewer Styles - House Design Principles */

:host {
  all: initial;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
  -webkit-user-select: none;
  display: block;

  --accent-h: 254;
  --accent: #6a4cce;
  --backdrop: #0D0E10;
  --window: #111214;
  --chrome: #17181A;
  --popover: #1B1C1F;

  --text-strong: #FFFFFF;
  --text: #C9CBCE;
  --text-muted: #9A9DA2;
  --text-dim: #84878C;

  --r-tight: 3px;
  --r-ctl: 5px;
  --r-card: 8px;
  --r-modal: 10px;

  --t-hover: 80ms;
  --t-open: 160ms;
  --ease: cubic-bezier(.22,1,.36,1);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Overlay Backdrop */
.pf-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(13, 14, 16, 0.90);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  opacity: 0;
  transition: opacity var(--t-open) var(--ease);
  touch-action: none;
}

.pf-overlay.pf-active {
  opacity: 1;
}

/* Viewport & Canvas */
.pf-viewport {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
  overflow: hidden;
}

.pf-viewport.pf-panning {
  cursor: grabbing;
}

.pf-image-canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
  pointer-events: auto;
}

.pf-image-canvas img {
  display: block;
  max-width: none;
  max-height: none;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
  border-radius: var(--r-tight);
  image-rendering: auto;
  pointer-events: auto;
}

/* A will-change layer is scaled by the compositor as a bitmap, which smooths
   it no matter what image-rendering says. Drop the layer once pixels matter. */
.pf-image-canvas.pf-pixelated {
  will-change: auto;
}

.pf-image-canvas.pf-pixelated img {
  image-rendering: crisp-edges;
  image-rendering: pixelated;
}

/* Floating Top Toolbar */
.pf-toolbar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 8px;
  background: rgba(15, 17, 21, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 10;
  color: #FFFFFF;
}

.pf-toolbar-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.pf-separator {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

/* Tool Buttons: Pure White on Dark Toolbar */
button.pf-btn, .pf-btn {
  background: transparent;
  border: none;
  outline: none;
  color: #FFFFFF !important;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 80ms cubic-bezier(.22,1,.36,1), color 80ms cubic-bezier(.22,1,.36,1);
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
}

button.pf-btn:hover, .pf-btn:hover {
  background: rgba(255, 255, 255, 0.14) !important;
  color: #FFFFFF !important;
}

button.pf-btn:active, .pf-btn:active {
  background: rgba(255, 255, 255, 0.22) !important;
  transform: scale(0.95);
}

/* Lucide Icon Styling - Pure White Strokes */
svg.i {
  width: 14px !important;
  height: 14px !important;
  stroke: #FFFFFF !important;
  fill: none !important;
  stroke-width: 1.5 !important;
  stroke-linecap: round !important;
  stroke-linejoin: round !important;
  flex: none;
  display: block;
}

svg.i * {
  fill: none !important;
  stroke: #FFFFFF !important;
  stroke-width: 1.5 !important;
  stroke-linecap: round !important;
  stroke-linejoin: round !important;
}

.pf-zoom-display {
  font-family: ui-monospace, "Cascadia Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #6a4cce;
  padding: 0 8px;
  min-width: 48px;
  text-align: center;
  cursor: pointer;
  line-height: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  transition: background 80ms cubic-bezier(.22,1,.36,1);
}

.pf-zoom-display:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #FFFFFF;
}

/* Bottom Status Bar */
.pf-statusbar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 14px;
  background: rgba(15, 17, 21, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  z-index: 10;
  white-space: nowrap;
}

.pf-statusbar strong {
  font-family: ui-monospace, "Cascadia Mono", monospace;
  color: #FFFFFF;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pf-dot {
  color: rgba(255, 255, 255, 0.3);
}

/* Toast Notification */
.pf-toast {
  position: absolute;
  bottom: 24px;
  right: 24px;
  background: #1B1C1F;
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.18);
  padding: 8px 16px;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11.5px;
  font-weight: 500;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition: opacity 160ms cubic-bezier(.22,1,.36,1), transform 160ms cubic-bezier(.22,1,.36,1);
  z-index: 20;
}

.pf-toast.pf-show {
  opacity: 1;
  transform: translateY(0);
}

/* Hover Quick-Action Badge on Webpage Images */
.pf-hover-badge {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: rgba(15, 17, 21, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 5px;
  color: #FFFFFF;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: color 80ms, border-color 80ms, opacity 160ms;
  z-index: 2147483640;
  opacity: 0;
  pointer-events: none;
}

.pf-hover-badge svg.i {
  stroke: #FFFFFF !important;
}

.pf-hover-badge.pf-visible {
  opacity: 1;
  pointer-events: auto;
}

.pf-hover-badge:hover {
  color: #6a4cce;
  border-color: #6a4cce;
}

.pf-hover-badge:hover svg.i {
  stroke: #6a4cce !important;
}`;

  class PictureframeViewer {
    constructor() {
      this.isOpen = false;
      this.imageUrl = '';
      this.metadata = null;
      this.settings = {
        zoomSpeed: 1.18,
        minZoom: 0.05,
        maxZoom: 50,
        invertZoom: false,
        backdropOpacity: 0.90,
        closeOnBackdropClick: true
      };

      // Transform state
      this.scale = 1;
      this.translateX = 0;
      this.translateY = 0;
      this.rotation = 0;
      this.flipH = false;
      this.flipV = false;

      // Pan state
      this.isPanning = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.initialTx = 0;
      this.initialTy = 0;
      this.hasDragged = false;

      // Elements
      this.host = null;
      this.shadow = null;
      this.overlay = null;
      this.viewport = null;
      this.canvas = null;
      this.img = null;
      this.zoomDisplay = null;
      this.statusbar = null;
      this.toastEl = null;
      this.toastTimeout = null;

      // Bound handlers
      this.boundOnWheel = this.onWheel.bind(this);
      this.boundOnPointerDown = this.onPointerDown.bind(this);
      this.boundOnPointerMove = this.onPointerMove.bind(this);
      this.boundOnPointerUp = this.onPointerUp.bind(this);
      this.boundOnKeyDown = this.onKeyDown.bind(this);

      this.initShadowDom();
    }

    updateSettings(newSettings) {
      this.settings = Object.assign(this.settings, newSettings);
      if (this.overlay && this.settings.backdropOpacity) {
        this.overlay.style.backgroundColor = `rgba(13, 14, 16, ${this.settings.backdropOpacity})`;
      }
    }

    initShadowDom() {
      if (this.host) return;

      this.host = document.createElement('pictureframe-container');
      this.host.id = 'pictureframe-root';
      this.shadow = this.host.attachShadow({ mode: 'open' });

      // Synchronous inline style tag without BOM
      const styleEl = document.createElement('style');
      styleEl.textContent = VIEWER_STYLES;
      this.shadow.appendChild(styleEl);

      // Create markup with explicit stroke="#FFFFFF" on every Lucide element
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div class="pf-overlay" id="pf-overlay">
          <!-- Top Floating Toolbar (white on dark) -->
          <div class="pf-toolbar">
            <div class="pf-toolbar-group">
              <button class="pf-btn" id="pf-btn-zoom-out" title="Zoom out (-)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8" fill="none" stroke="#FFFFFF"/>
                  <line x1="21" x2="16.65" y1="21" y2="16.65" stroke="#FFFFFF"/>
                  <line x1="8" x2="14" y1="11" y2="11" stroke="#FFFFFF"/>
                </svg>
              </button>
              <div class="pf-zoom-display mono" id="pf-zoom-display" title="Click to reset zoom">100%</div>
              <button class="pf-btn" id="pf-btn-zoom-in" title="Zoom in (+)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8" fill="none" stroke="#FFFFFF"/>
                  <line x1="21" x2="16.65" y1="21" y2="16.65" stroke="#FFFFFF"/>
                  <line x1="11" x2="11" y1="8" y2="14" stroke="#FFFFFF"/>
                  <line x1="8" x2="14" y1="11" y2="11" stroke="#FFFFFF"/>
                </svg>
              </button>
            </div>

            <div class="pf-separator"></div>

            <div class="pf-toolbar-group">
              <button class="pf-btn" id="pf-btn-fit" title="Fit to screen (F or 0)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9" fill="none" stroke="#FFFFFF"/>
                  <polyline points="9 21 3 21 3 15" fill="none" stroke="#FFFFFF"/>
                  <line x1="21" x2="14" y1="3" y2="10" stroke="#FFFFFF"/>
                  <line x1="3" x2="10" y1="21" y2="14" stroke="#FFFFFF"/>
                </svg>
              </button>
              <button class="pf-btn" id="pf-btn-actual" title="Actual size 1:1 (1)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" fill="none" stroke="#FFFFFF"/>
                </svg>
              </button>
              <button class="pf-btn" id="pf-btn-rotate" title="Rotate 90° clockwise (R)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" fill="none" stroke="#FFFFFF"/>
                  <path d="M21 3v5h-5" fill="none" stroke="#FFFFFF"/>
                </svg>
              </button>
              <button class="pf-btn" id="pf-btn-flip-h" title="Flip horizontal (H)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 7 5 5-5 5V7" fill="none" stroke="#FFFFFF"/>
                  <path d="m21 7-5 5 5 5V7" fill="none" stroke="#FFFFFF"/>
                  <line x1="12" x2="12" y1="20" y2="22" stroke="#FFFFFF"/>
                  <line x1="12" x2="12" y1="14" y2="16" stroke="#FFFFFF"/>
                  <line x1="12" x2="12" y1="8" y2="10" stroke="#FFFFFF"/>
                  <line x1="12" x2="12" y1="2" y2="4" stroke="#FFFFFF"/>
                </svg>
              </button>
            </div>

            <div class="pf-separator"></div>

            <div class="pf-toolbar-group">
              <button class="pf-btn" id="pf-btn-copy" title="Copy image to clipboard (C or Ctrl+C)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" fill="none" stroke="#FFFFFF"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" fill="none" stroke="#FFFFFF"/>
                </svg>
              </button>
              <button class="pf-btn" id="pf-btn-download" title="Download image (D)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" fill="none" stroke="#FFFFFF"/>
                  <polyline points="7 10 12 15 17 10" fill="none" stroke="#FFFFFF"/>
                  <line x1="12" x2="12" y1="15" y2="3" stroke="#FFFFFF"/>
                </svg>
              </button>
              <button class="pf-btn" id="pf-btn-tab" title="Open in new tab" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 3h6v6" fill="none" stroke="#FFFFFF"/>
                  <path d="M10 14 21 3" fill="none" stroke="#FFFFFF"/>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" fill="none" stroke="#FFFFFF"/>
                </svg>
              </button>
              <button class="pf-btn" id="pf-btn-close" title="Close (Escape)" style="color:#ffffff;">
                <svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18" fill="none" stroke="#FFFFFF"/>
                  <path d="m6 6 12 12" fill="none" stroke="#FFFFFF"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Viewport canvas area for panning/zooming -->
          <div class="pf-viewport" id="pf-viewport">
            <div class="pf-image-canvas" id="pf-image-canvas">
              <img id="pf-img" draggable="false" alt="Pictureframe preview" />
            </div>
          </div>

          <!-- Bottom Status Bar (white on dark pill) -->
          <div class="pf-statusbar" id="pf-statusbar">
            <span id="pf-status-res"><strong>0 × 0 px</strong></span>
            <span class="pf-dot">·</span>
            <span id="pf-status-type"><strong>IMAGE</strong></span>
            <span class="pf-dot">·</span>
            <span>Scroll to zoom · Drag to pan · Esc to close</span>
          </div>

          <!-- Toast Message -->
          <div class="pf-toast" id="pf-toast">Notification</div>
        </div>
      `;

      this.shadow.appendChild(wrapper);

      // Cache DOM references
      this.overlay = this.shadow.getElementById('pf-overlay');
      this.viewport = this.shadow.getElementById('pf-viewport');
      this.canvas = this.shadow.getElementById('pf-image-canvas');
      this.img = this.shadow.getElementById('pf-img');
      this.zoomDisplay = this.shadow.getElementById('pf-zoom-display');
      this.statusbar = this.shadow.getElementById('pf-statusbar');
      this.toastEl = this.shadow.getElementById('pf-toast');

      this.bindEvents();
    }

    bindEvents() {
      this.viewport.addEventListener('wheel', this.boundOnWheel, { passive: false });
      this.viewport.addEventListener('pointerdown', this.boundOnPointerDown);
      this.viewport.addEventListener('pointermove', this.boundOnPointerMove);
      this.viewport.addEventListener('pointerup', this.boundOnPointerUp);
      this.viewport.addEventListener('pointercancel', this.boundOnPointerUp);

      this.shadow.getElementById('pf-btn-zoom-in').addEventListener('click', (e) => {
        e.stopPropagation();
        this.zoomByCenter(this.settings.zoomSpeed);
      });

      this.shadow.getElementById('pf-btn-zoom-out').addEventListener('click', (e) => {
        e.stopPropagation();
        this.zoomByCenter(1 / this.settings.zoomSpeed);
      });

      this.zoomDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        if (Math.abs(this.scale - 1) < 0.05) {
          this.fitToScreen();
        } else {
          this.setActualSize();
        }
      });

      this.shadow.getElementById('pf-btn-fit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.fitToScreen();
      });

      this.shadow.getElementById('pf-btn-actual').addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActualSize();
      });

      this.shadow.getElementById('pf-btn-rotate').addEventListener('click', (e) => {
        e.stopPropagation();
        this.rotateClockwise();
      });

      this.shadow.getElementById('pf-btn-flip-h').addEventListener('click', (e) => {
        e.stopPropagation();
        this.flipHorizontal();
      });

      this.shadow.getElementById('pf-btn-copy').addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyImageToClipboard();
      });

      this.shadow.getElementById('pf-btn-download').addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadCurrentImage();
      });

      this.shadow.getElementById('pf-btn-tab').addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(this.imageUrl, '_blank');
      });

      this.shadow.getElementById('pf-btn-close').addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });

      this.img.addEventListener('contextmenu', (e) => {
        e.stopPropagation();
      });
    }

    open(imageUrl, metadata = {}) {
      if (!imageUrl) return;
      this.imageUrl = imageUrl;
      this.metadata = metadata;

      if (!document.documentElement.contains(this.host)) {
        document.documentElement.appendChild(this.host);
      }

      this.isOpen = true;
      this.rotation = 0;
      this.flipH = false;
      this.flipV = false;

      const typeSpan = this.shadow.getElementById('pf-status-type');
      let ext = 'IMAGE';
      try {
        const u = new URL(imageUrl);
        const match = u.pathname.match(/\.([a-zA-Z0-9]+)$/);
        if (match) ext = match[1].toUpperCase();
      } catch (e) {}
      typeSpan.innerHTML = `<strong>${ext}</strong>`;

      this.img.onload = () => {
        this.fitToScreen();
        const resSpan = this.shadow.getElementById('pf-status-res');
        resSpan.innerHTML = `<strong>${this.img.naturalWidth} × ${this.img.naturalHeight} px</strong>`;
      };

      this.img.src = imageUrl;

      requestAnimationFrame(() => {
        this.overlay.classList.add('pf-active');
      });

      window.addEventListener('keydown', this.boundOnKeyDown, true);
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.overlay.classList.remove('pf-active');

      window.removeEventListener('keydown', this.boundOnKeyDown, true);

      setTimeout(() => {
        if (!this.isOpen && this.host && this.host.parentNode) {
          this.host.parentNode.removeChild(this.host);
        }
      }, 160);
    }

    fitToScreen() {
      const vWidth = window.innerWidth;
      const vHeight = window.innerHeight;
      const imgWidth = this.img.naturalWidth || 800;
      const imgHeight = this.img.naturalHeight || 600;

      const padding = 60;
      const availableW = Math.max(100, vWidth - padding * 2);
      const availableH = Math.max(100, vHeight - padding * 2);

      const scaleX = availableW / imgWidth;
      const scaleY = availableH / imgHeight;
      this.scale = Math.min(scaleX, scaleY, 1.0);

      this.translateX = (vWidth - imgWidth * this.scale) / 2;
      this.translateY = (vHeight - imgHeight * this.scale) / 2;

      this.applyTransform();
    }

    setActualSize() {
      const vWidth = window.innerWidth;
      const vHeight = window.innerHeight;
      const imgWidth = this.img.naturalWidth || 800;
      const imgHeight = this.img.naturalHeight || 600;

      this.scale = 1.0;
      this.translateX = (vWidth - imgWidth) / 2;
      this.translateY = (vHeight - imgHeight) / 2;

      this.applyTransform();
    }

    onWheel(e) {
      e.preventDefault();
      e.stopPropagation();

      const rect = this.viewport.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      let direction = e.deltaY < 0 ? 1 : -1;
      if (this.settings.invertZoom) direction = -direction;

      const factor = direction > 0 ? this.settings.zoomSpeed : 1 / this.settings.zoomSpeed;
      const newScale = Math.min(Math.max(this.scale * factor, this.settings.minZoom), this.settings.maxZoom);

      if (newScale === this.scale) return;

      const actualFactor = newScale / this.scale;

      this.translateX = cursorX - (cursorX - this.translateX) * actualFactor;
      this.translateY = cursorY - (cursorY - this.translateY) * actualFactor;
      this.scale = newScale;

      this.applyTransform();
    }

    zoomByCenter(factor) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const newScale = Math.min(Math.max(this.scale * factor, this.settings.minZoom), this.settings.maxZoom);
      const actualFactor = newScale / this.scale;

      this.translateX = centerX - (centerX - this.translateX) * actualFactor;
      this.translateY = centerY - (centerY - this.translateY) * actualFactor;
      this.scale = newScale;

      this.applyTransform();
    }

    onPointerDown(e) {
      if (e.button !== 0) return;

      this.isPanning = true;
      this.hasDragged = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.initialTx = this.translateX;
      this.initialTy = this.translateY;

      this.viewport.setPointerCapture(e.pointerId);
      this.viewport.classList.add('pf-panning');
    }

    onPointerMove(e) {
      if (!this.isPanning) return;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.hasDragged = true;
      }

      this.translateX = this.initialTx + dx;
      this.translateY = this.initialTy + dy;

      this.applyTransform();
    }

    onPointerUp(e) {
      if (!this.isPanning) return;
      this.isPanning = false;
      this.viewport.classList.remove('pf-panning');

      try {
        this.viewport.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (!this.hasDragged && this.settings.closeOnBackdropClick) {
        const path = e.composedPath();
        if (!path.includes(this.img) && !path.includes(this.shadow.querySelector('.pf-toolbar'))) {
          this.close();
        }
      }
    }

    rotateClockwise() {
      const cx = (this.viewport && this.viewport.clientWidth ? this.viewport.clientWidth : window.innerWidth) / 2;
      const cy = (this.viewport && this.viewport.clientHeight ? this.viewport.clientHeight : window.innerHeight) / 2;

      const relX = this.translateX - cx;
      const relY = this.translateY - cy;

      // Rotate 90 degrees clockwise in screen coordinates around center of current view: (x, y) -> (-y, x)
      this.translateX = cx - relY;
      this.translateY = cy + relX;

      this.rotation = (this.rotation + 90) % 360;
      this.applyTransform();
    }

    flipHorizontal() {
      const cx = (this.viewport && this.viewport.clientWidth ? this.viewport.clientWidth : window.innerWidth) / 2;
      const cy = (this.viewport && this.viewport.clientHeight ? this.viewport.clientHeight : window.innerHeight) / 2;

      // Double-angle formulation for reflection around center of view under rotation
      const rad2 = (this.rotation * 2 * Math.PI) / 180;
      const cos2 = Math.cos(rad2);
      const sin2 = Math.sin(rad2);

      const Vx = cx - this.translateX;
      const Vy = cy - this.translateY;

      const newVx = -Vx * cos2 - Vy * sin2;
      const newVy = -Vx * sin2 + Vy * cos2;

      this.translateX = cx - newVx;
      this.translateY = cy - newVy;

      this.flipH = !this.flipH;
      this.applyTransform();
    }

    applyTransform() {
      const transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.scale}) rotate(${this.rotation}deg) scaleX(${this.flipH ? -1 : 1}) scaleY(${this.flipV ? -1 : 1})`;
      this.canvas.style.transform = transform;

      const percent = Math.round(this.scale * 100);
      this.zoomDisplay.textContent = `${percent}%`;

      if (this.scale >= 4) {
        this.canvas.classList.add('pf-pixelated');
      } else {
        this.canvas.classList.remove('pf-pixelated');
      }
    }

    showToast(message) {
      if (!this.toastEl) return;
      this.toastEl.textContent = message;
      this.toastEl.classList.add('pf-show');

      clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        this.toastEl.classList.remove('pf-show');
      }, 2500);
    }

    async copyImageToClipboard() {
      this.showToast('Copying image.');
      try {
        const res = await fetch(this.imageUrl);
        const blob = await res.blob();
        const pngBlob = await this.convertToPngBlob(blob);
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        this.showToast('Image copied to clipboard.');
      } catch (err) {
        try {
          await navigator.clipboard.writeText(this.imageUrl);
          this.showToast('Image link copied to clipboard.');
        } catch (copyErr) {
          this.showToast('Could not copy image.');
        }
      }
    }

    convertToPngBlob(blob) {
      return new Promise((resolve, reject) => {
        if (blob.type === 'image/png') {
          resolve(blob);
          return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas toBlob failed'));
          }, 'image/png');
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Image decode failed'));
        };
        img.src = url;
      });
    }

    downloadCurrentImage() {
      this.showToast('Starting download.');
      chrome.runtime.sendMessage({
        action: 'DOWNLOAD_IMAGE',
        url: this.imageUrl,
        filename: this.getSuggestedFilename()
      }, (res) => {
        if (res && res.success) {
          this.showToast('Download complete.');
        }
      });
    }

    getSuggestedFilename() {
      try {
        const u = new URL(this.imageUrl);
        const name = u.pathname.split('/').pop();
        if (name && name.includes('.')) return name;
      } catch (e) {}
      return 'pictureframe_preview.jpg';
    }

    onKeyDown(e) {
      if (!this.isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
        case 'f':
        case 'F':
        case '0':
          e.preventDefault();
          this.fitToScreen();
          break;
        case '1':
          e.preventDefault();
          this.setActualSize();
          break;
        case '+':
        case '=':
          e.preventDefault();
          this.zoomByCenter(this.settings.zoomSpeed);
          break;
        case '-':
        case '_':
          e.preventDefault();
          this.zoomByCenter(1 / this.settings.zoomSpeed);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          this.rotateClockwise();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          this.flipHorizontal();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          this.copyImageToClipboard();
          break;
        case 'd':
        case 'D':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.downloadCurrentImage();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.translateX += 40;
          this.applyTransform();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.translateX -= 40;
          this.applyTransform();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.translateY += 40;
          this.applyTransform();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.translateY -= 40;
          this.applyTransform();
          break;
      }
    }
  }

  window.__pictureframeViewer = new PictureframeViewer();
})();
