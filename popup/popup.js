// Pictureframe - Popup Settings Script with Painted Dropdown (§7.7)

document.addEventListener('DOMContentLoaded', async () => {
  const fields = {
    enabled: document.getElementById('enabled'),
    smartClickEnabled: document.getElementById('smartClickEnabled'),
    modifierKey: document.getElementById('modifierKey'),
    hoverIconEnabled: document.getElementById('hoverIconEnabled'),
    unblockRightClick: document.getElementById('unblockRightClick'),
    zoomSpeed: document.getElementById('zoomSpeed')
  };

  const zoomSpeedVal = document.getElementById('zoomSpeedVal');
  const openOptions = document.getElementById('openOptions');

  // Painted Dropdown Elements
  const ddTrigger = document.getElementById('modifierKeyTrigger');
  const ddMenu = document.getElementById('modifierKeyMenu');
  const ddLabel = document.getElementById('modifierKeyLabel');
  const ddItems = ddMenu.querySelectorAll('.it');

  // Load current values
  const settings = await chrome.storage.sync.get({
    enabled: true,
    smartClickEnabled: true,
    modifierKey: 'Alt',
    hoverIconEnabled: true,
    unblockRightClick: true,
    zoomSpeed: 1.18
  });

  fields.enabled.checked = settings.enabled;
  fields.smartClickEnabled.checked = settings.smartClickEnabled;
  fields.hoverIconEnabled.checked = settings.hoverIconEnabled;
  fields.unblockRightClick.checked = settings.unblockRightClick;
  fields.zoomSpeed.value = settings.zoomSpeed;
  zoomSpeedVal.textContent = parseFloat(settings.zoomSpeed).toFixed(2) + '×';

  // Set initial painted dropdown state
  setDropdownValue(settings.modifierKey);

  function setDropdownValue(val) {
    fields.modifierKey.value = val;
    ddItems.forEach(item => {
      const match = item.getAttribute('data-value') === val;
      item.classList.toggle('cur', match);
      const chk = item.querySelector('.chk');
      if (chk) chk.style.display = match ? 'block' : 'none';
      if (match) {
        ddLabel.textContent = item.querySelector('span').textContent;
      }
    });
  }

  // Dropdown open/close interactions (§7.7)
  function toggleDropdown(show) {
    const isOpening = show !== undefined ? show : ddMenu.style.display === 'none';
    ddMenu.style.display = isOpening ? 'flex' : 'none';
    ddTrigger.classList.toggle('open', isOpening);
    ddTrigger.setAttribute('aria-expanded', isOpening ? 'true' : 'false');
  }

  ddTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  ddTrigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDropdown();
    } else if (e.key === 'Escape') {
      toggleDropdown(false);
    }
  });

  ddItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.getAttribute('data-value');
      setDropdownValue(val);
      toggleDropdown(false);
      chrome.storage.sync.set({ modifierKey: val });
    });
  });

  document.addEventListener('click', (e) => {
    if (!ddTrigger.contains(e.target) && !ddMenu.contains(e.target)) {
      toggleDropdown(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleDropdown(false);
    }
  });

  // Checkbox and slider listeners
  fields.enabled.addEventListener('change', () => {
    chrome.storage.sync.set({ enabled: fields.enabled.checked });
  });

  fields.smartClickEnabled.addEventListener('change', () => {
    chrome.storage.sync.set({ smartClickEnabled: fields.smartClickEnabled.checked });
  });

  fields.hoverIconEnabled.addEventListener('change', () => {
    chrome.storage.sync.set({ hoverIconEnabled: fields.hoverIconEnabled.checked });
  });

  fields.unblockRightClick.addEventListener('change', () => {
    chrome.storage.sync.set({ unblockRightClick: fields.unblockRightClick.checked });
  });

  fields.zoomSpeed.addEventListener('input', () => {
    const val = parseFloat(fields.zoomSpeed.value);
    zoomSpeedVal.textContent = val.toFixed(2) + '×';
    chrome.storage.sync.set({ zoomSpeed: val });
  });

  // Misfire reporter: hand off to reporter.js in the active tab, then get out
  // of the way so the next click lands on the page.
  const reportError = document.getElementById('reportError');
  document.querySelectorAll('[data-report]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, { action: 'START_REPORT', kind: btn.dataset.report }, () => {
        if (chrome.runtime.lastError) {
          reportError.textContent = 'Not available here. Reload the page, or this page blocks extensions.';
          reportError.hidden = false;
          return;
        }
        window.close();
      });
    });
  });

  openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });
});
