// Pictureframe - Image URL & Metadata Extractor
// Intelligently retrieves high-resolution image sources from any DOM element.

(function() {
  const HIGH_RES_ATTRS = [
    'data-highres',
    'data-high-res',
    'data-original',
    'data-zoom-image',
    'data-zoom-src',
    'data-full-url',
    'data-large-file',
    'data-large',
    'data-src-large',
    'data-original-src',
    'data-orig',
    'data-full',
    'data-super-full-decoding',
    'data-src',
    'data-srcset'
  ];

  // Parse srcset string and return the highest resolution URL
  function getBestUrlFromSrcset(srcsetString) {
    if (!srcsetString || typeof srcsetString !== 'string') return null;
    
    const candidates = srcsetString.split(',').map(item => {
      const parts = item.trim().split(/\s+/);
      const url = parts[0];
      let value = 1;
      let unit = 'x';

      if (parts[1]) {
        const match = parts[1].match(/^(\d+(?:\.\d+)?)(w|x)$/i);
        if (match) {
          value = parseFloat(match[1]);
          unit = match[2].toLowerCase();
        }
      }
      return { url, value, unit };
    });

    if (candidates.length === 0) return null;

    // Prefer width descriptors over density descriptors, sort descending
    candidates.sort((a, b) => {
      if (a.unit === 'w' && b.unit === 'w') return b.value - a.value;
      if (a.unit === 'x' && b.unit === 'x') return b.value - a.value;
      if (a.unit === 'w') return -1;
      return 1;
    });

    return candidates[0].url;
  }

  // Parse CSS background-image
  function extractBackgroundImageUrl(el) {
    if (!el) return null;
    const style = window.getComputedStyle(el);
    if (!style || !style.backgroundImage || style.backgroundImage === 'none') return null;

    const bg = style.backgroundImage;
    const match = bg.match(/url\((?:['"]?)(.*?)(?:['"]?)\)/i);
    if (match && match[1] && !match[1].startsWith('data:image/svg+xml')) {
      return match[1];
    }
    return null;
  }

  // Convert SVG element to Data URL
  function extractSvgDataUrl(svgElement) {
    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgElement);
      if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    } catch (e) {
      return null;
    }
  }

  // Convert Canvas to Data URL
  function extractCanvasDataUrl(canvasElement) {
    try {
      return canvasElement.toDataURL('image/png');
    } catch (e) {
      return null; // Tainted canvas
    }
  }

  // Main extractor function
  function extractImageInfo(target) {
    if (!target) return null;

    let el = target;
    let url = null;
    let title = '';
    let alt = '';
    let naturalWidth = 0;
    let naturalHeight = 0;
    let kind = null;              // 'img' | 'canvas' | 'svg' | 'video' | 'background'

    // Check if target is an IMG
    if (el.tagName === 'IMG') {
      kind = 'img';
      alt = el.alt || '';
      title = el.title || alt;
      naturalWidth = el.naturalWidth || el.width || 0;
      naturalHeight = el.naturalHeight || el.height || 0;

      // Check high-res data attributes first
      for (const attr of HIGH_RES_ATTRS) {
        const val = el.getAttribute(attr);
        if (val) {
          if (attr === 'data-srcset') {
            const best = getBestUrlFromSrcset(val);
            if (best) { url = best; break; }
          } else {
            url = val;
            break;
          }
        }
      }

      // If no data attr, check srcset
      if (!url && el.srcset) {
        url = getBestUrlFromSrcset(el.srcset);
      }

      // Check parent <picture> for <source> tags
      if (!url && el.parentElement && el.parentElement.tagName === 'PICTURE') {
        const sources = el.parentElement.querySelectorAll('source');
        for (const s of sources) {
          const sSrcset = s.getAttribute('srcset');
          if (sSrcset) {
            const best = getBestUrlFromSrcset(sSrcset);
            if (best) { url = best; break; }
          }
        }
      }

      // Fallback to currentSrc or src
      if (!url) {
        url = el.currentSrc || el.src;
      }
    } 
    // Check if target is a CANVAS
    else if (el.tagName === 'CANVAS') {
      kind = 'canvas';
      url = extractCanvasDataUrl(el);
      naturalWidth = el.width || 0;
      naturalHeight = el.height || 0;
      title = el.title || 'Canvas Image';
    } 
    // Check if target is an SVG
    // tagName is lowercase 'svg' in HTML documents
    else if (el.tagName.toUpperCase() === 'SVG' || (el.ownerSVGElement && (el = el.ownerSVGElement))) {
      kind = 'svg';
      url = extractSvgDataUrl(el);
      const bbox = el.getBoundingClientRect();
      naturalWidth = Math.round(bbox.width);
      naturalHeight = Math.round(bbox.height);
      title = el.getAttribute('aria-label') || 'SVG Image';
    }
    // Check if target is VIDEO poster
    else if (el.tagName === 'VIDEO') {
      kind = 'video';
      url = el.poster;
      title = el.title || 'Video Poster';
    }

    // Check for CSS background-image on element or direct children
    if (!url) {
      url = extractBackgroundImageUrl(el);
      if (!url && el.children && el.children.length === 1) {
        url = extractBackgroundImageUrl(el.children[0]);
      }
      if (url) kind = 'background';
    }

    // Resolve relative URL
    if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
      try {
        url = new URL(url, window.location.href).href;
      } catch (e) {}
    }

    if (!url) return null;

    return {
      element: el,
      kind: kind,
      url: url,
      title: title || alt || '',
      alt: alt,
      naturalWidth: naturalWidth,
      naturalHeight: naturalHeight,
      renderedWidth: el.getBoundingClientRect ? Math.round(el.getBoundingClientRect().width) : 0,
      renderedHeight: el.getBoundingClientRect ? Math.round(el.getBoundingClientRect().height) : 0
    };
  }

  // Expose globally
  window.__pictureframe_extractImageInfo = extractImageInfo;
})();
