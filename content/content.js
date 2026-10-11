// Pictureframe - Content Script Orchestrator
// Coordinates Smart Click Detection, Hover Action Badge, Context Menus, and Settings.
// Follows House Design Principles.

(function() {
  let settings = {
    enabled: true,
    smartClickEnabled: true,
    triggerMode: 'smart',         // 'smart' | 'modifier' | 'hover_only' | 'always'
    modifierKey: 'Alt',           // 'Alt' | 'Shift' | 'Ctrl' | 'None'
    hoverIconEnabled: true,
    hoverIconMinSize: 100,
    unblockRightClick: true,
    zoomSpeed: 1.18,
    minZoom: 0.05,
    maxZoom: 50,
    invertZoom: false,
    backdropOpacity: 0.90,
    closeOnBackdropClick: true
  };

  // 1. Load initial settings
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(null, (items) => {
      if (items) {
        settings = Object.assign(settings, items);
        syncSettings();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (const [key, { newValue }] of Object.entries(changes)) {
          settings[key] = newValue;
        }
        syncSettings();
      }
    });
  }

  function syncSettings() {
    window.__pictureframe_unblockEnabled = settings.unblockRightClick && settings.enabled;
    if (window.__pictureframeViewer) {
      window.__pictureframeViewer.updateSettings(settings);
    }
  }

  // 2. Smart Click Detection
  // Each check returns a reason string (truthy = interactive) so the misfire
  // reporter can say *why* a click was yielded, not just that it was.
  const INTERACTIVE_TAGS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'NAV', 'LABEL'];
  const INTERACTIVE_ROLES = [
    'button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'option', 'switch',
    'slider', 'gridcell', 'treeitem', 'textbox', 'combobox'
  ];
  const INTERACTIVE_ATTRS = [
    'data-fancybox', 'data-lightbox', 'data-pswp', 'data-toggle',
    'data-bs-toggle', 'data-fslightbox', 'data-magnific', 'data-action'
  ];
  // Regions that are apps, not documents: every click there means something.
  const APP_REGION_SELECTOR = [
    '[contenteditable=""]', '[contenteditable="true"]',
    '[role="application"]', '[role="grid"]', '[role="treegrid"]',
    '[role="textbox"]', '[role="listbox"]', '[role="menu"]', '[role="toolbar"]'
  ].join(',');

  function interactiveReason(el) {
    if (!el || el === document.body || el === document.documentElement) return null;

    const tag = el.tagName.toUpperCase();
    if (INTERACTIVE_TAGS.includes(tag)) return `tag <${tag.toLowerCase()}>`;

    const role = el.getAttribute('role');
    if (role && INTERACTIVE_ROLES.includes(role.toLowerCase())) return `role="${role}"`;

    for (const attr of ['onclick', 'onmousedown', 'onmouseup', 'onpointerdown']) {
      if (el.hasAttribute(attr)) return `inline ${attr}`;
    }

    for (const attr of INTERACTIVE_ATTRS) {
      if (el.hasAttribute(attr)) return `attribute ${attr}`;
    }

    const tabindex = el.getAttribute('tabindex');
    if (tag !== 'IMG' && tabindex !== null && parseInt(tabindex, 10) >= 0) return `tabindex="${tabindex}"`;

    const classList = el.className && typeof el.className === 'string' ? el.className.toLowerCase() : '';
    const cls = classList.match(/(lightbox|gallery|fslightbox|spotlight|glightbox|magnific|photoswipe|zoom-in)/);
    if (cls) return `class contains "${cls[1]}"`;

    try {
      const style = window.getComputedStyle(el);
      if (style && style.cursor === 'pointer' && tag !== 'IMG') return 'cursor: pointer';
    } catch (e) {}

    return null;
  }

  function findInteractiveAncestor(el) {
    let current = el;
    let depth = 0;
    while (current && depth < 6) {
      const reason = interactiveReason(current);
      if (reason) return { element: current, depth, reason };
      current = current.parentElement;
      depth++;
    }
    return null;
  }

  function isModifierPressed(e) {
    switch (settings.modifierKey) {
      case 'Alt': return e.altKey;
      case 'Shift': return e.shiftKey;
      case 'Ctrl': return e.ctrlKey || e.metaKey;
      case 'None': return true;
      default: return e.altKey;
    }
  }

  // The whole click decision, side-effect free.
  // Returns { open, stopPropagation, reason, imgInfo, ancestor }.
  function explainClick(target, e) {
    const verdict = (open, reason, extra) => Object.assign({ open, stopPropagation: false, reason, imgInfo: null, ancestor: null }, extra);

    if (!settings.enabled) return verdict(false, 'Extension is switched off.');

    const modifierActive = isModifierPressed(e);
    if (e.defaultPrevented && !modifierActive) return verdict(false, 'Page already called preventDefault().');

    const imgInfo = window.__pictureframe_extractImageInfo ? window.__pictureframe_extractImageInfo(target) : null;
    if (!imgInfo || !imgInfo.url) return verdict(false, 'Extractor found no image on the target.');

    if (imgInfo.renderedWidth > 0 && imgInfo.renderedHeight > 0 &&
        imgInfo.renderedWidth < 32 && imgInfo.renderedHeight < 32) {
      return verdict(false, `Too small (${imgInfo.renderedWidth}×${imgInfo.renderedHeight} < 32×32).`, { imgInfo });
    }

    if (modifierActive && settings.modifierKey !== 'None') {
      return verdict(true, `${settings.modifierKey} held.`, { imgInfo, stopPropagation: true });
    }

    if (settings.triggerMode === 'hover_only') return verdict(false, 'triggerMode is hover_only.', { imgInfo });
    if (settings.triggerMode === 'always') return verdict(true, 'triggerMode is always.', { imgInfo, stopPropagation: true });

    if (!settings.smartClickEnabled) return verdict(false, 'Smart click is off; plain clicks never open.', { imgInfo });

    // Canvas, inline SVG and video are almost always live UI (spreadsheets,
    // charts, maps, players). They open via modifier, hover badge or menu only.
    if (imgInfo.kind === 'canvas' || imgInfo.kind === 'svg' || imgInfo.kind === 'video') {
      return verdict(false, `Plain clicks never open <${imgInfo.kind}>.`, { imgInfo });
    }

    const region = imgInfo.element && imgInfo.element.closest && imgInfo.element.closest(APP_REGION_SELECTOR);
    if (region) {
      return verdict(false, 'Inside an app region (editable or interactive role).', {
        imgInfo, ancestor: { element: region, depth: -1, reason: 'app region' }
      });
    }

    const ancestor = findInteractiveAncestor(target);
    if (ancestor) return verdict(false, `Yielded to interactive ancestor (${ancestor.reason}).`, { imgInfo, ancestor });

    return verdict(true, 'Plain image, nothing interactive around it.', { imgInfo });
  }

  window.__pictureframe_explainClick = explainClick;
  window.__pictureframe_interactiveReason = interactiveReason;
  window.__pictureframe_getSettings = () => Object.assign({}, settings);

  // 3. Document Click Handler (Bubble Phase)
  document.addEventListener('click', function(e) {
    const path = e.composedPath();
    const isInsidePf = path.some(node => node && node.id === 'pictureframe-root');
    if (isInsidePf) return;

    const result = explainClick(e.target, e);
    if (!result.open) return;

    e.preventDefault();
    if (result.stopPropagation) e.stopPropagation();
    openViewer(result.imgInfo);
  }, false);

  function openViewer(imgInfo) {
    if (window.__pictureframeViewer) {
      window.__pictureframeViewer.open(imgInfo.url, imgInfo);
    }
  }

  // 4. Floating Hover Quick-Action Button with Lucide Geometry
  let hoverBadge = null;
  let currentHoveredEl = null;

  function ensureHoverBadgeStyle() {
    if (document.getElementById('pictureframe-hover-badge-style')) return;
    const style = document.createElement('style');
    style.id = 'pictureframe-hover-badge-style';
    style.textContent = `
      #pictureframe-hover-badge {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        background: rgba(15, 17, 21, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 5px;
        color: #FFFFFF;
        cursor: pointer;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: color 80ms, border-color 80ms, background 80ms, opacity 160ms;
        z-index: 2147483640;
        opacity: 0;
        pointer-events: none;
        box-sizing: border-box;
        padding: 0;
        margin: 0;
      }
      #pictureframe-hover-badge.pf-visible {
        opacity: 1;
        pointer-events: auto;
      }
      #pictureframe-hover-badge:hover {
        background: rgba(25, 28, 35, 0.98);
        border-color: #6a4cce;
      }
      #pictureframe-hover-badge:hover svg,
      #pictureframe-hover-badge:hover svg * {
        stroke: #6a4cce !important;
      }
      #pictureframe-hover-badge svg {
        width: 14px;
        height: 14px;
        stroke: #FFFFFF;
        fill: none;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        display: block;
        pointer-events: none;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function createHoverBadge() {
    if (hoverBadge) return hoverBadge;

    ensureHoverBadgeStyle();

    hoverBadge = document.createElement('div');
    hoverBadge.className = 'pf-hover-badge';
    hoverBadge.id = 'pictureframe-hover-badge';
    hoverBadge.title = 'Inspect with Pictureframe.';
    // Lucide maximize-2
    hoverBadge.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9" fill="none" stroke="#FFFFFF"></polyline>
        <polyline points="9 21 3 21 3 15" fill="none" stroke="#FFFFFF"></polyline>
        <line x1="21" x2="14" y1="3" y2="10" stroke="#FFFFFF"></line>
        <line x1="3" x2="10" y1="21" y2="14" stroke="#FFFFFF"></line>
      </svg>
    `;

    hoverBadge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentHoveredEl) {
        const info = window.__pictureframe_extractImageInfo(currentHoveredEl);
        if (info) openViewer(info);
      }
      hideHoverBadge();
    });

    document.documentElement.appendChild(hoverBadge);
    return hoverBadge;
  }

  function positionHoverBadge(el) {
    if (!settings.hoverIconEnabled || !settings.enabled) {
      hideHoverBadge();
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < settings.hoverIconMinSize || rect.height < settings.hoverIconMinSize) {
      hideHoverBadge();
      return;
    }

    const badge = createHoverBadge();
    currentHoveredEl = el;

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    const top = rect.top + scrollY + 8;
    const left = rect.right + scrollX - 34;

    badge.style.top = `${top}px`;
    badge.style.left = `${left}px`;
    badge.classList.add('pf-visible');
  }

  function hideHoverBadge() {
    if (hoverBadge) {
      hoverBadge.classList.remove('pf-visible');
    }
    currentHoveredEl = null;
  }

  let hoverTimeout = null;
  document.addEventListener('mousemove', (e) => {
    if (!settings.hoverIconEnabled || !settings.enabled) return;

    if (hoverTimeout) return;
    hoverTimeout = setTimeout(() => {
      hoverTimeout = null;

      if (e.target && (e.target === hoverBadge || (hoverBadge && hoverBadge.contains(e.target)))) {
        return;
      }

      const info = window.__pictureframe_extractImageInfo ? window.__pictureframe_extractImageInfo(e.target) : null;
      if (info && info.renderedWidth >= settings.hoverIconMinSize && info.renderedHeight >= settings.hoverIconMinSize) {
        positionHoverBadge(e.target);
      } else {
        hideHoverBadge();
      }
    }, 40);
  }, { passive: true });

  // 5. Message Listener for Background Context Menus
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return;

    if (message.action === 'OPEN_FROM_CONTEXT_MENU') {
      let url = message.url;
      if (!url && window.__pictureframe_lastTarget) {
        const info = window.__pictureframe_extractImageInfo(window.__pictureframe_lastTarget);
        if (info) url = info.url;
      }
      if (url) {
        openViewer({ url: url });
      }
    } else if (message.action === 'DOWNLOAD_LAST_TARGET') {
      if (window.__pictureframe_lastTarget) {
        const info = window.__pictureframe_extractImageInfo(window.__pictureframe_lastTarget);
        if (info && info.url) {
          chrome.runtime.sendMessage({
            action: 'DOWNLOAD_IMAGE',
            url: info.url
          });
        }
      }
    } else if (message.action === 'COPY_TEXT') {
      if (message.text) {
        navigator.clipboard.writeText(message.text);
      }
    }
  });
})();
