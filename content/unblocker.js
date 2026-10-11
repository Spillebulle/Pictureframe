// Pictureframe - Right-Click & Image Protection Unblocker
// Runs at document_start to intercept blockers before website scripts run.

(function() {
  window.__pictureframe_unblockEnabled = true;
  window.__pictureframe_lastTarget = null;
  window.__pictureframe_lastContextMenuCoords = { x: 0, y: 0 };

  // 1. Capture Phase Contextmenu Interceptor
  // By intercepting in the capture phase (true), we prevent page scripts from
  // receiving the event and calling e.preventDefault() or e.stopPropagation().
  window.addEventListener('contextmenu', function(e) {
    window.__pictureframe_lastContextMenuCoords = { x: e.clientX, y: e.clientY };

    // Inspect elements under cursor
    const target = e.target;
    window.__pictureframe_lastTarget = target;

    if (!window.__pictureframe_unblockEnabled) return;

    // Check if the target or underlying element is an image or transparent overlay
    const detected = findImageUnderPoint(e.clientX, e.clientY);
    if (detected) {
      window.__pictureframe_lastTarget = detected.element;
    }

    // Stop propagation so website event listeners cannot block right-click
    e.stopPropagation();

    // Check and neutralize inline oncontextmenu
    clearContextmenuTraps();
  }, true);

  // 2. Clear inline property traps
  function clearContextmenuTraps() {
    try {
      if (document.oncontextmenu !== null) document.oncontextmenu = null;
      if (window.oncontextmenu !== null) window.oncontextmenu = null;
      if (document.body && document.body.oncontextmenu !== null) {
        document.body.oncontextmenu = null;
      }
    } catch (err) {}
  }

  // 3. Capture-phase dragstart / selectstart / mousedown bypass
  window.addEventListener('dragstart', function(e) {
    if (!window.__pictureframe_unblockEnabled) return;
    // Allow dragging images to desktop or new tab
    e.stopPropagation();
  }, true);

  window.addEventListener('selectstart', function(e) {
    if (!window.__pictureframe_unblockEnabled) return;
    e.stopPropagation();
  }, true);

  // 4. Transparent overlay detector & penetrator
  function findImageUnderPoint(x, y) {
    if (!document.elementsFromPoint) return null;
    const elements = document.elementsFromPoint(x, y);
    if (!elements || elements.length === 0) return null;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el || el.tagName === 'HTML' || el.tagName === 'BODY') continue;

      // Direct image tags
      if (el.tagName === 'IMG' || el.tagName === 'PICTURE' || el.tagName === 'CANVAS' || el.tagName === 'SVG') {
        return { element: el, type: el.tagName.toLowerCase() };
      }

      // Check for CSS background-image
      try {
        const style = window.getComputedStyle(el);
        if (style && style.backgroundImage && style.backgroundImage !== 'none') {
          return { element: el, type: 'background-image' };
        }
      } catch (err) {}

      // Check if element has an img child covering it
      const childImg = el.querySelector && el.querySelector('img');
      if (childImg) {
        const rect = childImg.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return { element: childImg, type: 'img' };
        }
      }
    }

    return null;
  }

  // Expose helper globally for content scripts
  window.__pictureframe_findImageUnderPoint = findImageUnderPoint;

  // MutationObserver to neutralize dynamic pointer-events: none on images
  function removePointerEventsNone() {
    if (!window.__pictureframe_unblockEnabled) return;
    const images = document.querySelectorAll('img, picture, canvas');
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img.style && img.style.pointerEvents === 'none') {
        img.style.pointerEvents = 'auto';
      }
      if (img.style && img.style.userSelect === 'none') {
        img.style.userSelect = 'auto';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    clearContextmenuTraps();
    removePointerEventsNone();
  });

  window.addEventListener('load', () => {
    clearContextmenuTraps();
    removePointerEventsNone();
  });
})();
