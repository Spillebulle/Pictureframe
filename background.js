// Pictureframe - Background Service Worker (Manifest V3)

const DEFAULT_SETTINGS = {
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
  closeOnBackdropClick: true,
  smoothPanning: true
};

// Initialize settings on installation
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(null);
  const toSet = {};
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[key] === undefined) {
      toSet[key] = val;
    }
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.sync.set(toSet);
  }

  // Create Context Menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'pictureframe_open',
      title: 'Inspect in Pictureframe',
      contexts: ['image', 'link', 'page', 'video']
    });

    chrome.contextMenus.create({
      id: 'pictureframe_download',
      title: 'Download with Pictureframe',
      contexts: ['image']
    });

    chrome.contextMenus.create({
      id: 'pictureframe_copy_url',
      title: 'Copy Clean Image Link',
      contexts: ['image']
    });
  });
});

// Handle Context Menu actions
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'pictureframe_open') {
    const imageUrl = info.srcUrl || info.linkUrl || null;
    chrome.tabs.sendMessage(tab.id, {
      action: 'OPEN_FROM_CONTEXT_MENU',
      url: imageUrl
    });
  } else if (info.menuItemId === 'pictureframe_download') {
    if (info.srcUrl) {
      downloadImage(info.srcUrl);
    } else {
      chrome.tabs.sendMessage(tab.id, { action: 'DOWNLOAD_LAST_TARGET' });
    }
  } else if (info.menuItemId === 'pictureframe_copy_url') {
    if (info.srcUrl) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'COPY_TEXT',
        text: info.srcUrl
      });
    }
  }
});

// Helper: Download image using chrome.downloads
async function downloadImage(url, suggestedFilename) {
  try {
    let filename = suggestedFilename;
    if (!filename) {
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/');
        filename = parts.pop() || 'image';
        if (!filename.includes('.')) filename += '.jpg';
      } catch (e) {
        filename = 'pictureframe_image.jpg';
      }
    }
    // Clean filename
    filename = filename.replace(/[/\\?%*:|"<>]/g, '_');

    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    });
  } catch (err) {
    console.error('[Pictureframe] Download failed:', err);
  }
}

// Handle runtime messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;

  if (message.action === 'DOWNLOAD_IMAGE') {
    downloadImage(message.url, message.filename).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Async response
  }

  // One frame picked an element for a misfire report; end pick mode in the rest.
  if (message.action === 'REPORT_PICK_DONE') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { action: 'CANCEL_REPORT' });
    }
    return;
  }

  if (message.action === 'FETCH_BLOB_BASE64') {
    fetch(message.url)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, dataUrl: reader.result, mimeType: blob.type });
        };
        reader.onerror = () => sendResponse({ success: false, error: 'Read failed' });
        reader.readAsDataURL(blob);
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Async response
  }
});
