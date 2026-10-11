// Pictureframe - Misfire Reporter
// An eyedropper started from the popup: the user clicks the thing that opened
// (or didn't), the page never sees that click, and we produce a plain-text
// diagnosis — DOM around the point, what the extractor saw, and what
// explainClick() decided and why — ready to paste into a bug report.

(function() {
  const HOST_ID = 'pictureframe-reporter';
  const ISSUES_URL = 'https://github.com/Spillebulle/Pictureframe/issues';
  const IS_TOP = window === window.top;

  const ISSUE_TITLES = {
    false_positive: 'Opens when it should not',
    false_negative: 'Does not open when it should'
  };

  const VERDICT_LABELS = {
    false_positive: 'Opened, but should not have.',
    false_negative: 'Should open, but did not.'
  };

  let picking = false;
  let verdictKind = null;
  let host = null;
  let shadow = null;
  let hoverRaf = null;
  let lastMove = null;

  // Same deliberate exception as the viewer: literal hexes, because this
  // renders inside arbitrary pages that cannot reach tokens.css.
  const REPORTER_STYLES = `
    :host { all: initial; }
    .pf-hl {
      position: fixed; pointer-events: none; z-index: 2147483646;
      border: 2px solid #6a4cce; background: rgba(106, 76, 206, 0.12);
      border-radius: 3px; box-sizing: border-box; display: none;
    }
    .pf-tag {
      position: fixed; pointer-events: none; z-index: 2147483647;
      background: #1B1C1F; color: #E6E7E9; border: 1px solid #2C2E32;
      border-radius: 5px; padding: 3px 7px; display: none; max-width: 420px;
      font: 500 11px/1.35 ui-monospace, "Cascadia Mono", monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      box-shadow: 0 8px 32px rgba(0,0,0,.6);
    }
    .pf-tag .yes { color: #7ee2a8; }
    .pf-tag .no { color: #f0a5a5; }
    .pf-bar, .pf-panel {
      position: fixed; z-index: 2147483647; box-sizing: border-box;
      background: #17181A; color: #C9CBCE; border: 1px solid #2C2E32;
      box-shadow: 0 16px 48px rgba(0,0,0,.7);
      font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .pf-bar {
      top: 12px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 10px;
      padding: 6px 6px 6px 12px; border-radius: 8px;
    }
    .pf-bar b { color: #E6E7E9; font-weight: 600; }
    .pf-panel {
      right: 16px; bottom: 16px; width: 440px; max-width: calc(100vw - 32px);
      border-radius: 10px; display: flex; flex-direction: column; color-scheme: dark;
    }
    .pf-head {
      height: 32px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 8px 0 12px; border-bottom: 1px solid #26282B;
      color: #E6E7E9; font-weight: 600; font-size: 13px;
    }
    .pf-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
    .pf-status { color: #9A9DA2; font-size: 11px; }
    .pf-status.ok { color: #7ee2a8; }
    textarea {
      all: unset; box-sizing: border-box; display: block; width: 100%; height: 220px;
      overflow: auto; white-space: pre; padding: 8px; border-radius: 5px;
      background: #111214; border: 1px solid #26282B; color: #C9CBCE;
      font: 10.5px/1.45 ui-monospace, "Cascadia Mono", monospace;
    }
    .pf-row { display: flex; justify-content: flex-end; gap: 6px; }
    button, a.pf-btn {
      all: unset; box-sizing: border-box; height: 26px; padding: 0 10px; border-radius: 5px;
      background: #1F2023; border: 1px solid #26282B; color: #E6E7E9; cursor: pointer;
      font: 500 11.5px/24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    button:hover, a.pf-btn:hover { background: #26282B; }
    .primary { background: #6a4cce !important; border-color: #6a4cce !important; color: #FFFFFF !important; }
    .primary:hover { background: #7a5ed8 !important; }
  `;

  const CURSOR_STYLE_ID = 'pictureframe-reporter-cursor';

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = HOST_ID;
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${REPORTER_STYLES}</style>
      <div class="pf-hl"></div><div class="pf-tag"></div>`;
    document.documentElement.appendChild(host);
  }

  function $(sel) { return shadow && shadow.querySelector(sel); }

  function isOurs(e) {
    return e.composedPath().some(n => n && (n.id === HOST_ID || n.id === 'pictureframe-root'));
  }

  // ── Pick mode ────────────────────────────────────────────────────────────
  function startPicking(kind) {
    verdictKind = kind;
    picking = true;
    ensureHost();
    closePanel();

    if (!document.getElementById(CURSOR_STYLE_ID)) {
      const st = document.createElement('style');
      st.id = CURSOR_STYLE_ID;
      st.textContent = '*, *::before, *::after { cursor: crosshair !important; }';
      (document.head || document.documentElement).appendChild(st);
    }

    if (IS_TOP && !$('.pf-bar')) {
      const bar = document.createElement('div');
      bar.className = 'pf-bar';
      bar.innerHTML = `<span><b>Report:</b> ${VERDICT_LABELS[kind]} Click the element.</span>
        <button type="button" data-act="cancel">Cancel</button>`;
      bar.querySelector('[data-act="cancel"]').addEventListener('click', () => stopPicking(true));
      shadow.appendChild(bar);
    }
  }

  function stopPicking(broadcast) {
    picking = false;
    const st = document.getElementById(CURSOR_STYLE_ID);
    if (st) st.remove();
    if (shadow) {
      const bar = $('.pf-bar');
      if (bar) bar.remove();
      $('.pf-hl').style.display = 'none';
      $('.pf-tag').style.display = 'none';
    }
    if (broadcast) chrome.runtime.sendMessage({ action: 'REPORT_PICK_DONE' });
  }

  function deepTarget(e) {
    const first = e.composedPath()[0];
    return first && first.nodeType === 1 ? first : e.target;
  }

  function plainClick() {
    return { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, defaultPrevented: false };
  }

  function renderHover() {
    hoverRaf = null;
    if (!picking || !lastMove) return;
    const el = lastMove.target;
    const r = el.getBoundingClientRect();
    const hl = $('.pf-hl');
    Object.assign(hl.style, {
      display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'
    });

    const res = window.__pictureframe_explainClick ? window.__pictureframe_explainClick(el, plainClick()) : null;
    const tag = $('.pf-tag');
    const name = el.tagName.toLowerCase();
    const size = `${Math.round(r.width)}×${Math.round(r.height)}`;
    const verdict = res
      ? (res.open ? '<span class="yes">opens</span>' : `<span class="no">no</span> · ${escapeHtml(res.reason)}`)
      : '';
    tag.innerHTML = `${escapeHtml(name)} ${size} · ${verdict}`;
    tag.style.display = 'block';
    const below = r.bottom + 6 + 24 < window.innerHeight;
    tag.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 430)) + 'px';
    tag.style.top = (below ? r.bottom + 6 : Math.max(4, r.top - 30)) + 'px';
  }

  // Registered at document_start, so these window-capture listeners run before
  // anything the page adds. Idle unless picking.
  function swallow(e) {
    if (!picking || isOurs(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'auxclick', 'touchstart', 'touchend']
    .forEach(type => window.addEventListener(type, swallow, { capture: true, passive: false }));

  window.addEventListener('click', (e) => {
    if (!picking || isOurs(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const target = deepTarget(e);
    stopPicking(true);
    showReport(buildReport(target, e.clientX, e.clientY));
  }, true);

  window.addEventListener('pointermove', (e) => {
    if (!picking || isOurs(e)) return;
    lastMove = { target: deepTarget(e), x: e.clientX, y: e.clientY };
    if (!hoverRaf) hoverRaf = requestAnimationFrame(renderHover);
  }, { capture: true, passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (picking) {
      e.preventDefault();
      e.stopImmediatePropagation();
      stopPicking(true);
    } else if ($('.pf-panel')) {
      closePanel();
    }
  }, true);

  // ── Report text ──────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function clip(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n) + `… (${s.length} chars)` : s;
  }

  function shortUrl(url) {
    if (!url) return '(none)';
    if (url.startsWith('data:')) return `${url.slice(0, url.indexOf(',') + 1)}… (${url.length} chars)`;
    return clip(url, 180);
  }

  function describe(el) {
    if (!el || el.nodeType !== 1) return String(el);
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + clip(el.id, 40);
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [];
    if (cls.length) {
      s += '.' + cls.slice(0, 4).map(c => clip(c, 32)).join('.');
      if (cls.length > 4) s += ` (+${cls.length - 4} classes)`;
    }
    const r = el.getBoundingClientRect();
    s += `  [${Math.round(r.width)}×${Math.round(r.height)}]`;

    const bits = [];
    for (const a of ['role', 'aria-label', 'tabindex', 'contenteditable', 'draggable', 'href', 'type', 'alt']) {
      const v = el.getAttribute(a);
      if (v !== null) bits.push(`${a}="${clip(v, 60)}"`);
    }
    const names = Array.from(el.attributes).map(a => a.name);
    const handlers = names.filter(n => n.startsWith('on'));
    if (handlers.length) bits.push('inline ' + handlers.join(','));
    const data = names.filter(n => n.startsWith('data-') || n.startsWith('js'));
    if (data.length) bits.push('attrs ' + clip(data.slice(0, 8).join(','), 120));
    try {
      const cs = window.getComputedStyle(el);
      if (cs.cursor && cs.cursor !== 'auto' && cs.cursor !== 'default') bits.push(`cursor:${cs.cursor}`);
      if (cs.pointerEvents === 'none') bits.push('pointer-events:none');
      if (cs.backgroundImage && cs.backgroundImage !== 'none') bits.push('bg-image ' + shortUrl(cs.backgroundImage));
      if (cs.opacity === '0') bits.push('opacity:0');
    } catch (e) {}
    if (el.shadowRoot) bits.push('has shadowRoot');
    if (bits.length) s += '  ' + bits.join('  ');
    return s;
  }

  function describeInfo(info) {
    if (!info) return '(none)';
    return `kind=${info.kind}  rendered=${info.renderedWidth}×${info.renderedHeight}  ` +
      `natural=${info.naturalWidth}×${info.naturalHeight}\n    url: ${shortUrl(info.url)}`;
  }

  function buildReport(target, x, y) {
    const L = [];
    const settings = window.__pictureframe_getSettings ? window.__pictureframe_getSettings() : {};
    const explain = window.__pictureframe_explainClick;
    const interactive = window.__pictureframe_interactiveReason || (() => null);

    L.push('### Pictureframe misfire report');
    L.push(`Verdict:    ${VERDICT_LABELS[verdictKind] || verdictKind}`);
    L.push(`Version:    ${chrome.runtime.getManifest().version}`);
    L.push(`Page:       ${location.origin}${location.pathname}  (query and hash stripped)`);
    L.push(`Frame:      ${IS_TOP ? 'top' : 'iframe'}`);
    L.push(`Browser:    ${navigator.userAgent}`);
    L.push(`Viewport:   ${window.innerWidth}×${window.innerHeight}, click at (${Math.round(x)}, ${Math.round(y)})`);
    L.push('Settings:   ' + ['enabled', 'smartClickEnabled', 'triggerMode', 'modifierKey', 'hoverIconEnabled', 'hoverIconMinSize', 'unblockRightClick']
      .map(k => `${k}=${settings[k]}`).join(' '));
    L.push('');

    L.push('## Decision for a plain click');
    if (explain) {
      const res = explain(target, plainClick());
      L.push(`  ${res.open ? 'OPENS' : 'does not open'}: ${res.reason}`);
      if (res.ancestor) L.push(`  matched: ${describe(res.ancestor.element)}`);
      L.push(`  extractor: ${describeInfo(res.imgInfo || (window.__pictureframe_extractImageInfo && window.__pictureframe_extractImageInfo(target)))}`);
    } else {
      L.push('  explainClick unavailable (content.js not loaded).');
    }
    L.push('  (Page handlers did not run; a page preventDefault() would also block a plain click.)');
    L.push('');

    if (window.__pictureframe_findImageUnderPoint) {
      const under = window.__pictureframe_findImageUnderPoint(x, y);
      L.push('## Shield penetration (image found under the point)');
      if (under && under.element !== target) {
        L.push(`  ${under.type}: ${describe(under.element)}`);
        L.push(`  extractor: ${describeInfo(window.__pictureframe_extractImageInfo(under.element))}`);
      } else {
        L.push(under ? '  Same as clicked element.' : '  Nothing.');
      }
      L.push('');
    }

    L.push('## Clicked element and ancestors (depth: interactive? · element)');
    let el = target;
    for (let d = 0; el && el.nodeType === 1 && d < 12; d++) {
      const why = interactive(el);
      L.push(`  ${String(d).padStart(2)}: ${why ? '[' + why + '] ' : ''}${describe(el)}`);
      el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
    }
    L.push('');

    L.push('## Stack under the point (topmost first)');
    try {
      const stack = (document.elementsFromPoint(x, y) || [])
        .filter(n => n.id !== HOST_ID && n.tagName !== 'HTML' && n.tagName !== 'BODY')
        .slice(0, 8);
      stack.forEach((n, i) => L.push(`  ${i}: ${describe(n)}`));
    } catch (e) {}

    return L.join('\n');
  }

  // ── Result panel ─────────────────────────────────────────────────────────
  function closePanel() {
    const p = $('.pf-panel');
    if (p) p.remove();
  }

  function showReport(text) {
    ensureHost();
    closePanel();
    const panel = document.createElement('div');
    panel.className = 'pf-panel';
    panel.innerHTML = `
      <div class="pf-head"><span>Pictureframe report</span><button type="button" data-act="close">Close</button></div>
      <div class="pf-body">
        <div class="pf-status">Copying…</div>
        <textarea readonly spellcheck="false"></textarea>
        <div class="pf-row">
          <button type="button" data-act="copy">Copy again</button>
          <a class="pf-btn primary" target="_blank" rel="noopener noreferrer">Open an issue on GitHub</a>
        </div>
      </div>`;
    const ta = panel.querySelector('textarea');
    const status = panel.querySelector('.pf-status');
    ta.value = text;
    const title = `${ISSUE_TITLES[verdictKind] || 'Misfire'} on ${location.hostname || location.protocol.replace(':', '')}`;
    panel.querySelector('a.pf-btn').href = `${ISSUES_URL}/new?title=${encodeURIComponent(title)}`;
    panel.querySelector('[data-act="close"]').addEventListener('click', closePanel);
    panel.querySelector('[data-act="copy"]').addEventListener('click', () => copy(text, ta, status));
    shadow.appendChild(panel);
    copy(text, ta, status);
  }

  async function copy(text, ta, status) {
    const done = (ok) => {
      status.textContent = ok ? 'Report copied. Open an issue on GitHub and paste it in.' : 'Could not copy automatically. Select the text, copy it, then open an issue on GitHub.';
      status.classList.toggle('ok', ok);
    };
    try {
      await navigator.clipboard.writeText(text);
      return done(true);
    } catch (e) {}
    try {
      ta.focus();
      ta.select();
      done(document.execCommand('copy'));
    } catch (e) {
      done(false);
    }
  }

  // ── Messages ─────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;
    if (message.action === 'START_REPORT') {
      startPicking(message.kind);
      if (IS_TOP) sendResponse({ ok: true });
    } else if (message.action === 'CANCEL_REPORT') {
      if (picking) stopPicking(false);
    }
  });
})();
