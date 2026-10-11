// Pictureframe - Options Page Logic with Painted Dropdown (§7.7)

document.addEventListener('DOMContentLoaded', async () => {
  const fields = {
    smartClickEnabled: document.getElementById('smartClickEnabled'),
    modifierKey: document.getElementById('modifierKey'),
    hoverIconEnabled: document.getElementById('hoverIconEnabled'),
    hoverIconMinSize: document.getElementById('hoverIconMinSize'),
    unblockRightClick: document.getElementById('unblockRightClick'),
    zoomSpeed: document.getElementById('zoomSpeed'),
    invertZoom: document.getElementById('invertZoom'),
    backdropOpacity: document.getElementById('backdropOpacity'),
    closeOnBackdropClick: document.getElementById('closeOnBackdropClick')
  };

  const zoomSpeedLabel = document.getElementById('zoomSpeedLabel');
  const backdropOpacityLabel = document.getElementById('backdropOpacityLabel');
  const saveBtn = document.getElementById('saveBtn');
  const toast = document.getElementById('toast');

  // Painted Dropdown Elements
  const ddTrigger = document.getElementById('modifierKeyTrigger');
  const ddMenu = document.getElementById('modifierKeyMenu');
  const ddLabel = document.getElementById('modifierKeyLabel');
  const ddItems = ddMenu.querySelectorAll('.it');

  // Load existing settings
  const settings = await chrome.storage.sync.get({
    smartClickEnabled: true,
    modifierKey: 'Alt',
    hoverIconEnabled: true,
    hoverIconMinSize: 100,
    unblockRightClick: true,
    zoomSpeed: 1.18,
    invertZoom: false,
    backdropOpacity: 0.90,
    closeOnBackdropClick: true
  });

  fields.smartClickEnabled.checked = settings.smartClickEnabled;
  fields.hoverIconEnabled.checked = settings.hoverIconEnabled;
  fields.hoverIconMinSize.value = settings.hoverIconMinSize;
  fields.unblockRightClick.checked = settings.unblockRightClick;
  fields.zoomSpeed.value = settings.zoomSpeed;
  fields.invertZoom.checked = settings.invertZoom;
  fields.backdropOpacity.value = settings.backdropOpacity;
  fields.closeOnBackdropClick.checked = settings.closeOnBackdropClick;

  zoomSpeedLabel.textContent = parseFloat(settings.zoomSpeed).toFixed(2) + '×';
  backdropOpacityLabel.textContent = Math.round(settings.backdropOpacity * 100) + '%';

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

  fields.zoomSpeed.addEventListener('input', () => {
    zoomSpeedLabel.textContent = parseFloat(fields.zoomSpeed.value).toFixed(2) + '×';
  });

  fields.backdropOpacity.addEventListener('input', () => {
    backdropOpacityLabel.textContent = Math.round(fields.backdropOpacity.value * 100) + '%';
  });

  // Save changes
  saveBtn.addEventListener('click', async () => {
    const toSave = {
      smartClickEnabled: fields.smartClickEnabled.checked,
      modifierKey: fields.modifierKey.value,
      hoverIconEnabled: fields.hoverIconEnabled.checked,
      hoverIconMinSize: parseInt(fields.hoverIconMinSize.value, 10) || 100,
      unblockRightClick: fields.unblockRightClick.checked,
      zoomSpeed: parseFloat(fields.zoomSpeed.value),
      invertZoom: fields.invertZoom.checked,
      backdropOpacity: parseFloat(fields.backdropOpacity.value),
      closeOnBackdropClick: fields.closeOnBackdropClick.checked
    };

    await chrome.storage.sync.set(toSave);

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  });
});
