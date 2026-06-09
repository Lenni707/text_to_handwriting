/**
 * App Main Logic
 * Manages: editor view, live preview, slider controls, export, profile management.
 * Runs as an IIFE to avoid polluting the global scope.
 */

(() => {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let activeProfile = null;
  let renderDebounceTimer = null;
  let newProfileIntent = false;
  let _isNew = false;

  function _isNewProfileIntent() {
    return _isNew;
  }

  const DEFAULT_OPTIONS = {
    fontSize: 36,
    lineSpacing: 1.8,
    letterSpacing: 4,
    slantAngle: -5,
    jitter: 30,
    baselineJitter: 3,
    strokeWidth: 1.0,
    penStyle: 'digital',
    inkColor: '#1a2744',
    cursive: false,
  };

  let options = { ...DEFAULT_OPTIONS };

  // ─── DOM Refs ─────────────────────────────────────────────────────────────
  const textInput       = document.getElementById('textInput');
  const outputCanvas    = document.getElementById('outputCanvas');
  const profileSelect   = document.getElementById('profileSelect');
  const emptyState      = document.getElementById('emptyState');
  const editorMain      = document.getElementById('editorMain');
  const topBarControls  = document.getElementById('topBarControls');

  const sliders = {
    fontSize:      document.getElementById('sliderFontSize'),
    strokeWidth:   document.getElementById('sliderStrokeWidth'),
    lineSpacing:   document.getElementById('sliderLineSpacing'),
    letterSpacing: document.getElementById('sliderLetterSpacing'),
    slantAngle:    document.getElementById('sliderSlantAngle'),
    jitter:        document.getElementById('sliderJitter'),
    baselineJitter:document.getElementById('sliderBaselineJitter'),
  };

  const sliderValues = {
    fontSize:      document.getElementById('valFontSize'),
    strokeWidth:   document.getElementById('valStrokeWidth'),
    lineSpacing:   document.getElementById('valLineSpacing'),
    letterSpacing: document.getElementById('valLetterSpacing'),
    slantAngle:    document.getElementById('valSlantAngle'),
    jitter:        document.getElementById('valJitter'),
    baselineJitter:document.getElementById('valBaselineJitter'),
  };

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    _bindSliders();
    _bindButtons();
    _bindTextInput();
    _applySavedOptions();
    _loadState();

    // Expose render scheduler for window resize handler
    window._appScheduleRender = _scheduleRender;
    window._isNewProfileIntent = _isNewProfileIntent;
  }

  function _loadState() {
    if (!ProfileManager.hasAnyProfile()) {
      _showEmptyState();
    } else {
      activeProfile = ProfileManager.getActiveProfile();
      _populateProfileSelect();
      _showEditor();
      _scheduleRender();
    }
  }

  function _showEmptyState() {
    emptyState.style.display    = 'flex';
    editorMain.style.display    = 'none';
    topBarControls.style.opacity       = '0.4';
    topBarControls.style.pointerEvents = 'none';
  }

  function _showEditor() {
    emptyState.style.display    = 'none';
    editorMain.style.display    = 'flex';
    topBarControls.style.opacity       = '1';
    topBarControls.style.pointerEvents = 'auto';
  }

  // ─── Options persistence ──────────────────────────────────────────────────
  function _applySavedOptions() {
    try {
      const saved = JSON.parse(localStorage.getItem('hwp_options') || '{}');
      options = { ...DEFAULT_OPTIONS, ...saved };
    } catch { /* use defaults */ }

    // Sync slider elements to options
    const map = [
      ['fontSize',      v => `${v}px`],
      ['strokeWidth',   v => `${parseFloat(v).toFixed(1)}x`],
      ['lineSpacing',   v => parseFloat(v).toFixed(1)],
      ['letterSpacing', v => `${v}px`],
      ['slantAngle',    v => `${v}°`],
      ['jitter',        v => `${v}%`],
      ['baselineJitter',v => `${parseFloat(v).toFixed(1)}px`],
    ];
    for (const [key, fmt] of map) {
      if (sliders[key])      sliders[key].value         = options[key];
      if (sliderValues[key]) sliderValues[key].textContent = fmt(options[key]);
    }

    const cursiveToggle = document.getElementById('toggleCursive');
    if (cursiveToggle) cursiveToggle.checked = !!options.cursive;

    const penStyleSelect = document.getElementById('selectPenStyle');
    if (penStyleSelect) penStyleSelect.value = options.penStyle || 'digital';

    _updateInkColorUI(options.inkColor || '#1a2744');
  }

  function _updateInkColorUI(color, skipHexInput = false) {
    const presets = document.querySelectorAll('.color-preset[data-color]');
    let foundPreset = false;
    presets.forEach(p => {
      if (p.getAttribute('data-color').toLowerCase() === color.toLowerCase()) {
        p.classList.add('active');
        foundPreset = true;
      } else {
        p.classList.remove('active');
      }
    });

    const customTrigger = document.getElementById('btnCustomColor');
    const colorInput = document.getElementById('inputInkColor');
    if (colorInput) {
      colorInput.value = color;
    }

    if (customTrigger) {
      if (!foundPreset) {
        customTrigger.classList.add('active');
        customTrigger.style.background = color;
      } else {
        customTrigger.classList.remove('active');
        customTrigger.style.background = 'conic-gradient(red, yellow, green, cyan, blue, magenta, red)';
      }
    }

    if (!skipHexInput) {
      const hexInput = document.getElementById('inputInkColorHex');
      if (hexInput) {
        hexInput.value = color.toUpperCase();
      }
    }
  }

  function _saveOptions() {
    localStorage.setItem('hwp_options', JSON.stringify(options));
  }

  // ─── Slider Binding ────────────────────────────────────────────────────────
  function _bindSliders() {
    const map = [
      ['fontSize',      'fontSize',      v => `${Math.round(v)}px`,             parseFloat],
      ['strokeWidth',   'strokeWidth',   v => `${parseFloat(v).toFixed(1)}x`,   parseFloat],
      ['lineSpacing',   'lineSpacing',   v => parseFloat(v).toFixed(1),         parseFloat],
      ['letterSpacing', 'letterSpacing', v => `${Math.round(v)}px`,             parseInt],
      ['slantAngle',    'slantAngle',    v => `${Math.round(v)}°`,              parseInt],
      ['jitter',        'jitter',        v => `${Math.round(v)}%`,              parseInt],
      ['baselineJitter','baselineJitter', v => `${parseFloat(v).toFixed(1)}px`,  parseFloat],
    ];

    for (const [sliderKey, optionKey, fmt, parse] of map) {
      const slider = sliders[sliderKey];
      const label  = sliderValues[sliderKey];
      if (!slider) continue;

      slider.addEventListener('input', () => {
        const val = parse(slider.value);
        options[optionKey] = val;
        if (label) {
          label.textContent = fmt(val);
          label.classList.add('value-pop');
          clearTimeout(label._popTimer);
          label._popTimer = setTimeout(() => label.classList.remove('value-pop'), 300);
        }
        _saveOptions();
        _scheduleRender();
      });
    }

    // Cursive toggle
    const cursiveToggle = document.getElementById('toggleCursive');
    if (cursiveToggle) {
      cursiveToggle.addEventListener('change', () => {
        options.cursive = cursiveToggle.checked;
        _saveOptions();
        _scheduleRender();
      });
    }

    // Pen style select
    const penStyleSelect = document.getElementById('selectPenStyle');
    if (penStyleSelect) {
      penStyleSelect.addEventListener('change', () => {
        options.penStyle = penStyleSelect.value;
        _saveOptions();
        _scheduleRender();
      });
    }

    // Ink color presets
    const presets = document.querySelectorAll('.color-preset[data-color]');
    presets.forEach(p => {
      p.addEventListener('click', () => {
        const color = p.getAttribute('data-color');
        options.inkColor = color;
        _updateInkColorUI(color);
        _saveOptions();
        _scheduleRender();
      });
    });

    // Ink custom color picker
    const colorInput = document.getElementById('inputInkColor');
    if (colorInput) {
      const handleColorChange = () => {
        const color = colorInput.value;
        options.inkColor = color;
        _updateInkColorUI(color);
        _saveOptions();
        _scheduleRender();
      };
      colorInput.addEventListener('input', handleColorChange);
      colorInput.addEventListener('change', handleColorChange);
    }

    // Ink custom color HEX input field
    const hexInput = document.getElementById('inputInkColorHex');
    if (hexInput) {
      const handleHexChange = () => {
        let val = hexInput.value.trim();
        if (val && !val.startsWith('#')) {
          val = '#' + val;
        }
        // Match standard 3-char, 6-char, or 8-char HEX codes
        const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val);
        if (isValidHex) {
          options.inkColor = val;
          _updateInkColorUI(val, true); // skipHexInput = true to preserve user keyboard cursor/focus
          _saveOptions();
          _scheduleRender();
        }
      };
      hexInput.addEventListener('input', handleHexChange);
      hexInput.addEventListener('change', handleHexChange);
    }
  }

  // ─── Text Input ────────────────────────────────────────────────────────────
  function _bindTextInput() {
    if (!textInput) return;
    textInput.addEventListener('input', _scheduleRender);
  }

  // ─── Button Binding ────────────────────────────────────────────────────────
  function _bindButtons() {
    _on('btnEditHandwriting', 'click', () => { _openWizard(false); });
    _on('btnNewProfile',      'click', () => { _openWizard(true); });
    _on('btnGetStarted',      'click', () => { _openWizard(true); });
    _on('btnExportProfile',   'click', _exportProfile);
    _on('btnDeleteProfile',   'click', _deleteProfile);
    _on('btnDownloadPNG',     'click', () => _download('png'));
    _on('btnDownloadJPEG',    'click', () => _download('jpeg'));
    _on('btnCopyToClipboard', 'click', _copyToClipboard);
    _on('importProfileInput', 'change', _importProfileFromInput);

    if (profileSelect) {
      profileSelect.addEventListener('change', () => {
        const id = profileSelect.value;
        if (!id) return;
        ProfileManager.setActiveProfileId(id);
        activeProfile = ProfileManager.getProfile(id);
        _scheduleRender();
      });
    }
  }

  function _on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  function _scheduleRender() {
    clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(_render, 200);
  }

  function _render() {
    if (!activeProfile || !outputCanvas) return;
    const text = textInput ? textInput.value : '';

    // Size the canvas to the available scroll-wrap width
    const wrap = document.querySelector('.canvas-scroll-wrap');
    if (wrap) {
      const padding = 64;
      const maxW = Math.min(wrap.clientWidth - padding * 2, 900);
      const targetW = Math.floor(Math.max(maxW, 400));
      if (outputCanvas.style.width !== `${targetW}px`) {
        outputCanvas.style.width = `${targetW}px`;
      }
    }

    // Animate fade
    outputCanvas.style.opacity    = '0';
    outputCanvas.style.transition = 'opacity 0.15s ease';

    requestAnimationFrame(() => {
      HandwritingEngine.render(outputCanvas, text, activeProfile, options);
      requestAnimationFrame(() => {
        outputCanvas.style.opacity = '1';
      });
    });
  }

  // ─── Profile Select ────────────────────────────────────────────────────────
  function _populateProfileSelect() {
    if (!profileSelect) return;
    const profiles = ProfileManager.listProfiles();
    profileSelect.innerHTML = '';

    if (profiles.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No profiles';
      profileSelect.appendChild(opt);
      return;
    }

    for (const p of profiles) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (activeProfile && p.id === activeProfile.id) opt.selected = true;
      profileSelect.appendChild(opt);
    }
  }

  // ─── Wizard ────────────────────────────────────────────────────────────────
  function _openWizard(isNew) {
    _isNew = isNew;
    newProfileIntent = isNew;
    const editorView  = document.getElementById('editorView');
    const wizardView  = document.getElementById('wizardView');
    if (!editorView || !wizardView) return;

    editorView.style.display = 'none';
    wizardView.style.display = 'flex';
    wizardView.style.opacity = '0';

    requestAnimationFrame(() => {
      wizardView.style.transition = 'opacity 0.25s ease';
      wizardView.style.opacity    = '1';
    });

    const existingChars = (!_isNew && activeProfile)
      ? activeProfile.characters
      : {};

    const wizardContainer = document.getElementById('wizardContainer');
    SetupWizard.init(wizardContainer, _onWizardComplete, _onWizardCancel, existingChars);
  }

  function _onWizardComplete(characters, importedId) {
    if (importedId) {
      // Profile was imported inside the wizard
      activeProfile = ProfileManager.getProfile(importedId);
    } else if (characters && Object.keys(characters).length > 0) {
      // Build profile from drawn characters
      let profile;
      if (!_isNew && activeProfile) {
        // Update existing profile
        profile = { ...activeProfile, characters };
      } else {
        // Create new profile — prompt for name
        const name = window.prompt('Name your handwriting profile:', 'My Handwriting') || 'My Handwriting';
        profile = { name, characters };
      }
      const id = ProfileManager.saveProfile(profile);
      ProfileManager.setActiveProfileId(id);
      activeProfile = ProfileManager.getProfile(id);
    } else {
      showToast('No characters were drawn — profile not saved.', 'error');
      _closeWizard();
      return;
    }

    _closeWizard();
    _showEditor();
    _populateProfileSelect();
    _scheduleRender();
    showToast('Handwriting profile saved! ✓', 'success');
  }

  function _onWizardCancel() {
    _closeWizard();
    if (!ProfileManager.hasAnyProfile()) {
      _showEmptyState();
    } else {
      _showEditor();
    }
  }

  function _closeWizard() {
    const editorView = document.getElementById('editorView');
    const wizardView = document.getElementById('wizardView');
    if (!wizardView) return;

    wizardView.style.transition = 'opacity 0.25s ease';
    wizardView.style.opacity    = '0';

    setTimeout(() => {
      wizardView.style.display = 'none';
      if (editorView) {
        editorView.style.display   = 'flex';
        editorView.style.opacity   = '0';
        editorView.style.transition = 'opacity 0.25s ease';
        requestAnimationFrame(() => {
          editorView.style.opacity = '1';
        });
      }
    }, 260);
  }

  // ─── Profile Export/Import ─────────────────────────────────────────────────
  function _exportProfile() {
    if (!activeProfile) {
      showToast('No profile selected to export.', 'error');
      return;
    }
    const json = ProfileManager.exportProfileJSON(activeProfile.id);
    if (!json) { showToast('Export failed.', 'error'); return; }

    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${activeProfile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_handwriting.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Profile exported!', 'success');
  }

  function _importProfileFromInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const id = ProfileManager.importProfileJSON(ev.target.result);
        ProfileManager.setActiveProfileId(id);
        activeProfile = ProfileManager.getProfile(id);
        _showEditor();
        _populateProfileSelect();
        _scheduleRender();
        showToast(`Profile "${activeProfile.name}" imported!`, 'success');
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function _deleteProfile() {
    if (!activeProfile) return;
    const confirmed = window.confirm(
      `Delete profile "${activeProfile.name}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    ProfileManager.deleteProfile(activeProfile.id);
    activeProfile = ProfileManager.getActiveProfile();

    if (!activeProfile) {
      _showEmptyState();
      if (profileSelect) profileSelect.innerHTML = '<option value="">No profiles</option>';
    } else {
      _populateProfileSelect();
      _scheduleRender();
    }
    showToast('Profile deleted.', 'info');
  }

  function _drawPaperTexture(ctx, w, h) {
    const tileSize = 128;
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileSize;
    tileCanvas.height = tileSize;
    const tCtx = tileCanvas.getContext('2d');

    const imgData = tCtx.createImageData(tileSize, tileSize);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.floor(Math.random() * 255);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    tCtx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.08;
    const pattern = ctx.createPattern(tileCanvas, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ─── Download ──────────────────────────────────────────────────────────────
  function _download(format) {
    if (!outputCanvas) return;

    const originalShowRules = options.showRules !== false;
    const text = textInput ? textInput.value : '';

    if (format === 'png') {
      // Temporarily render without rules
      HandwritingEngine.render(outputCanvas, text, activeProfile, { ...options, showRules: false });

      outputCanvas.toBlob(blob => {
        _triggerDownload(blob, 'handwriting.png');
        // Restore
        HandwritingEngine.render(outputCanvas, text, activeProfile, { ...options, showRules: originalShowRules });
      }, 'image/png');
      showToast('PNG downloaded!', 'success');
      return;
    }

    if (format === 'jpeg') {
      // Temporarily render clean of rules
      HandwritingEngine.render(outputCanvas, text, activeProfile, { ...options, showRules: false });

      const temp  = document.createElement('canvas');
      temp.width  = outputCanvas.width;
      temp.height = outputCanvas.height;
      const tctx  = temp.getContext('2d');

      // White paper background
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, temp.width, temp.height);

      // Subtle paper grain (fast pattern overlay)
      _drawPaperTexture(tctx, temp.width, temp.height);

      // Draw handwriting on top
      tctx.drawImage(outputCanvas, 0, 0);

      // Restore rules on the main preview canvas
      HandwritingEngine.render(outputCanvas, text, activeProfile, { ...options, showRules: originalShowRules });

      temp.toBlob(blob => {
        _triggerDownload(blob, 'handwriting.jpg');
      }, 'image/jpeg', 0.94);
      showToast('JPEG downloaded!', 'success');
    }
  }

  function _copyToClipboard() {
    if (!outputCanvas) return;

    const originalShowRules = options.showRules !== false;
    const text = textInput ? textInput.value : '';

    // Temporarily render without ruled lines so we copy clean handwriting
    HandwritingEngine.render(outputCanvas, text, activeProfile, { ...options, showRules: false });

    outputCanvas.toBlob(blob => {
      // Restore ruled lines back on the preview canvas
      HandwritingEngine.render(outputCanvas, text, activeProfile, { ...options, showRules: originalShowRules });

      if (!blob) {
        showToast('Failed to generate image blob.', 'error');
        return;
      }

      // Check if navigator.clipboard.write is supported
      if (!navigator.clipboard || !navigator.clipboard.write) {
        showToast('Clipboard copy is not supported in this browser context.', 'error');
        return;
      }

      const item = new ClipboardItem({ [blob.type]: blob });
      navigator.clipboard.write([item])
        .then(() => {
          showToast('Copied handwriting image to clipboard! 📋', 'success');
        })
        .catch(err => {
          showToast('Failed to copy: ' + err.message, 'error');
        });
    }, 'image/png');
  }

  function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Toast ─────────────────────────────────────────────────────────────────
  window.showToast = function showToast(message, type = 'info') {
    // Remove any existing toast
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type] || ''}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('toast-show'));
    });

    // Animate out
    const timer = setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 400);
    }, 3000);

    // Allow click to dismiss
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 400);
    });
  };

  // ─── Start ─────────────────────────────────────────────────────────────────
  init();

})();
