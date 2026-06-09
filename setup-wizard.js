/**
 * Setup Wizard
 * Guides user through drawing each character to build a handwriting profile.
 * Uses PointerEvents for stylus pressure support. Stores normalized (0-1) stroke data.
 */

const SetupWizard = (() => {
  // Characters to draw in order
  const CHARACTER_SET = [
    ...'abcdefghijklmnopqrstuvwxyz'.split(''),
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    ...'0123456789'.split(''),
    ...['.',  ',', '!', '?', "'", '"', '-', '(', ')', ':'],
  ];

  let state = {
    currentIndex: 0,
    characters: {},      // { char: [[{x,y,pressure}]] } normalized
    isDrawing: false,
    currentStroke: [],   // current stroke in progress (canvas coords)
    allStrokes: [],      // all strokes for current char (canvas coords)
    animFrameId: null,
    onComplete: null,    // callback(characters)
    onCancel: null,
    penThickness: 3,     // base pen width in px (1-12)
  };

  let canvas = null;
  let ctx = null;
  let guideCanvas = null;
  let guideCtx = null;

  function init(containerEl, onComplete, onCancel, existingChars = {}) {
    state.currentIndex = 0;
    state.characters = { ...existingChars };
    state.onComplete = onComplete;
    state.onCancel = onCancel;
    state.isDrawing = false;
    state.currentStroke = [];
    state.allStrokes = [];
    _render(containerEl);
  }

  function _render(containerEl) {
    containerEl.innerHTML = '';
    containerEl.appendChild(_buildWizardDOM());
    _bindEvents();
    _updateUI();
  }

  function _buildWizardDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-wrap';
    wrapper.innerHTML = `
      <div class="wizard-card">
        <div class="wizard-header">
          <div class="wizard-title-group">
            <span class="wizard-icon">✍️</span>
            <div>
              <h2 class="wizard-title">Draw Your Handwriting</h2>
              <p class="wizard-subtitle">Draw each character in the canvas below</p>
            </div>
          </div>
          <button class="wizard-close-btn" id="wizardCancelBtn" aria-label="Cancel">✕</button>
        </div>

        <div class="wizard-progress-section">
          <div class="wizard-progress-labels">
            <span class="wizard-progress-text" id="wizardProgressText">1 of ${CHARACTER_SET.length}</span>
            <span class="wizard-progress-pct" id="wizardProgressPct">0%</span>
          </div>
          <div class="wizard-progress-track">
            <div class="wizard-progress-bar" id="wizardProgressBar"></div>
          </div>
        </div>

        <div class="wizard-char-display">
          <div class="wizard-char-info">
            <div class="wizard-char-label" id="wizardCharLabel">a</div>
            <div class="wizard-char-name" id="wizardCharName">lowercase a</div>
          </div>
          <div class="wizard-char-status" id="wizardCharStatus">
            <span class="status-dot status-pending"></span>
            <span>Not drawn</span>
          </div>
        </div>

        <div class="wizard-pen-controls">
          <label class="wizard-pen-label" for="wizardPenThickness">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Pen Thickness
          </label>
          <div class="wizard-pen-slider-wrap">
            <span class="wizard-pen-thin">Thin</span>
            <input type="range" id="wizardPenThickness" min="1" max="12" step="0.5" value="3" class="wizard-pen-slider">
            <span class="wizard-pen-thick">Thick</span>
          </div>
          <span class="wizard-pen-value" id="wizardPenValue">3 px</span>
        </div>

        <div class="wizard-canvas-wrap">
          <canvas class="wizard-guide-canvas" id="wizardGuideCanvas" width="400" height="300"></canvas>
          <canvas class="wizard-draw-canvas" id="wizardDrawCanvas" width="400" height="300" tabindex="0" role="img" aria-label="Drawing canvas"></canvas>
          <div class="wizard-canvas-hint" id="wizardCanvasHint">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Draw here
          </div>
        </div>

        <div class="wizard-actions">
          <button class="wizard-btn wizard-btn-ghost" id="wizardPrevBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="15,18 9,12 15,6"></polyline>
            </svg>
            Previous
          </button>
          <div class="wizard-center-actions">
            <button class="wizard-btn wizard-btn-danger" id="wizardClearBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="M19,6l-1,14H6L5,6"></path>
                <path d="M10,11v6M14,11v6"></path>
              </svg>
              Clear
            </button>
          </div>
          <div class="wizard-right-actions">
            <button class="wizard-btn wizard-btn-skip" id="wizardSkipBtn">Skip</button>
            <button class="wizard-btn wizard-btn-primary" id="wizardNextBtn">
              Next
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9,18 15,12 9,6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <div class="wizard-footer-actions">
          <button class="wizard-btn wizard-btn-finish" id="wizardFinishBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
            Save Profile
          </button>
          <div class="wizard-import-section">
            <label class="wizard-btn wizard-btn-ghost wizard-import-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import Profile
              <input type="file" accept=".json" id="wizardImportInput" style="display:none">
            </label>
          </div>
        </div>
      </div>
    `;
    return wrapper;
  }

  function _bindEvents() {
    canvas = document.getElementById('wizardDrawCanvas');
    ctx = canvas.getContext('2d');
    guideCanvas = document.getElementById('wizardGuideCanvas');
    guideCtx = guideCanvas.getContext('2d');

    // HiDPI / Retina support — scale canvas backing store
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayW = rect.width  || 400;
    const displayH = rect.height || 300;

    [canvas, guideCanvas].forEach(c => {
      c.width  = Math.round(displayW * dpr);
      c.height = Math.round(displayH * dpr);
      c.style.width  = displayW + 'px';
      c.style.height = displayH + 'px';
      const cctx = c.getContext('2d');
      cctx.scale(dpr, dpr);
    });

    // Drawing events (pointer)
    canvas.addEventListener('pointerdown', _onPointerDown);
    canvas.addEventListener('pointermove', _onPointerMove);
    canvas.addEventListener('pointerup', _onPointerUp);
    canvas.addEventListener('pointercancel', _onPointerUp);
    canvas.addEventListener('pointerleave', _onPointerUp);

    // Touch prevention
    canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    document.getElementById('wizardCancelBtn').addEventListener('click', () => {
      if (state.onCancel) state.onCancel();
    });
    document.getElementById('wizardPrevBtn').addEventListener('click', _prev);
    document.getElementById('wizardNextBtn').addEventListener('click', _saveAndNext);
    document.getElementById('wizardSkipBtn').addEventListener('click', _skip);
    document.getElementById('wizardClearBtn').addEventListener('click', _clearCanvas);
    document.getElementById('wizardFinishBtn').addEventListener('click', _finish);
    document.getElementById('wizardImportInput').addEventListener('change', _handleImport);

    // Pen thickness slider
    const penSlider = document.getElementById('wizardPenThickness');
    const penValueLabel = document.getElementById('wizardPenValue');
    penSlider.addEventListener('input', () => {
      state.penThickness = parseFloat(penSlider.value);
      penValueLabel.textContent = `${penSlider.value} px`;
    });
  }

  function _onPointerDown(e) {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    state.isDrawing = true;
    state.currentStroke = [];
    const pt = _getPoint(e);
    state.currentStroke.push(pt);
    _hideHint();
    ctx.beginPath();
    ctx.moveTo(pt.cx, pt.cy);
  }

  function _onPointerMove(e) {
    if (!state.isDrawing) return;
    e.preventDefault();
    const pt = _getPoint(e);
    state.currentStroke.push(pt);

    // Live draw
    const prev = state.currentStroke[state.currentStroke.length - 2];
    if (prev) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#1a2744';
      ctx.lineWidth = Math.max(1, state.penThickness * (pt.pressure || 0.5));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(prev.cx, prev.cy);
      ctx.lineTo(pt.cx, pt.cy);
      ctx.stroke();
      ctx.restore();
    }
  }

  function _onPointerUp(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore pointer capture release errors
    }
    if (state.currentStroke.length > 1) {
      state.allStrokes.push([...state.currentStroke]);
    } else if (state.currentStroke.length === 1) {
      state.allStrokes.push([...state.currentStroke]);
    }
    state.currentStroke = [];
    _updateCharStatus();
  }

  function _getPoint(e) {
    const rect = canvas.getBoundingClientRect();
    // Use CSS display dimensions for coordinates (ctx is already DPR-scaled)
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    return {
      cx, cy,
      x: cx / rect.width,    // normalized 0-1
      y: cy / rect.height,   // normalized 0-1
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  function _hideHint() {
    const hint = document.getElementById('wizardCanvasHint');
    if (hint) {
      hint.style.opacity = '0';
      hint.style.pointerEvents = 'none';
    }
  }

  function _clearCanvas() {
    const dispW = canvas.getBoundingClientRect().width  || 400;
    const dispH = canvas.getBoundingClientRect().height || 300;
    ctx.clearRect(0, 0, dispW, dispH);
    state.allStrokes = [];
    state.currentStroke = [];
    const ch = CHARACTER_SET[state.currentIndex];
    delete state.characters[ch];
    _updateCharStatus();
    const hint = document.getElementById('wizardCanvasHint');
    if (hint) {
      hint.style.opacity = '1';
      hint.style.pointerEvents = 'none';
    }
  }

  function _saveCurrentChar() {
    const ch = CHARACTER_SET[state.currentIndex];
    if (state.allStrokes.length > 0) {
      // Store normalized strokes (x, y already 0-1, filter cx/cy)
      state.characters[ch] = state.allStrokes.map(stroke =>
        stroke.map(pt => ({ x: pt.x, y: pt.y, pressure: pt.pressure }))
      );
    } else {
      delete state.characters[ch];
    }
  }

  function _saveAndNext() {
    _saveCurrentChar();
    if (state.currentIndex < CHARACTER_SET.length - 1) {
      state.currentIndex++;
      _loadChar();
    } else {
      _finish();
    }
  }

  function _skip() {
    if (state.currentIndex < CHARACTER_SET.length - 1) {
      state.currentIndex++;
      _loadChar();
    } else {
      _finish();
    }
  }

  function _prev() {
    _saveCurrentChar();
    if (state.currentIndex > 0) {
      state.currentIndex--;
      _loadChar();
    }
  }

  function _drawWizardStroke(ctx, stroke, dispW, dispH, color) {
    if (!stroke || stroke.length === 0) return;

    const baseWidth = state.penThickness;

    if (stroke.length === 1) {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = color;
      const pt = stroke[0];
      const px = pt.x * dispW;
      const py = pt.y * dispH;
      const r = Math.max(0.5, (baseWidth * (pt.pressure || 0.5)) / 2);
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.length === 2) {
      ctx.beginPath();
      ctx.lineWidth = Math.max(1, baseWidth * (stroke[0].pressure || 0.5));
      ctx.moveTo(stroke[0].x * dispW, stroke[0].y * dispH);
      ctx.lineTo(stroke[1].x * dispW, stroke[1].y * dispH);
      ctx.stroke();
      ctx.restore();
      return;
    }

    for (let i = 0; i < stroke.length - 1; i++) {
      const p0 = stroke[Math.max(0, i - 1)];
      const p1 = stroke[i];
      const p2 = stroke[i + 1];
      const p3 = stroke[Math.min(stroke.length - 1, i + 2)];

      const p0x = p0.x * dispW, p0y = p0.y * dispH;
      const p1x = p1.x * dispW, p1y = p1.y * dispH;
      const p2x = p2.x * dispW, p2y = p2.y * dispH;
      const p3x = p3.x * dispW, p3y = p3.y * dispH;

      const cp1x = p1x + (p2x - p0x) / 6;
      const cp1y = p1y + (p2y - p0y) / 6;
      const cp2x = p2x - (p3x - p1x) / 6;
      const cp2y = p2y - (p3y - p1y) / 6;

      const t = stroke.length > 2 ? i / (stroke.length - 2) : 0.5;
      const pressureBell = Math.sin(Math.PI * t);
      const p = (p1.pressure || 0.5);
      const pressure = p * 0.4 + pressureBell * p * 0.6;

      ctx.beginPath();
      ctx.lineWidth = Math.max(0.5, baseWidth * pressure);
      ctx.moveTo(p1x, p1y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function _loadChar() {
    const ch = CHARACTER_SET[state.currentIndex];
    // Use CSS display size for coordinate mapping (ctx is DPR-scaled)
    const dispW = canvas.getBoundingClientRect().width  || 400;
    const dispH = canvas.getBoundingClientRect().height || 300;
    ctx.clearRect(0, 0, dispW, dispH);
    state.allStrokes = [];
    state.currentStroke = [];

    // If this char was previously drawn, replay it
    if (state.characters[ch]) {
      const strokes = state.characters[ch];
      for (const stroke of strokes) {
        _drawWizardStroke(ctx, stroke, dispW, dispH, '#1a2744');
      }

      // Restore into allStrokes (CSS display coords)
      state.allStrokes = strokes.map(stroke =>
        stroke.map(pt => ({
          cx: pt.x * dispW,
          cy: pt.y * dispH,
          x: pt.x,
          y: pt.y,
          pressure: pt.pressure,
        }))
      );
    }

    _updateUI();
  }

  function _updateUI() {
    const ch = CHARACTER_SET[state.currentIndex];
    const total = CHARACTER_SET.length;
    const drawn = Object.keys(state.characters).length;
    const pct = Math.round((drawn / total) * 100);

    document.getElementById('wizardCharLabel').textContent = ch;
    document.getElementById('wizardCharName').textContent = _getCharName(ch);
    document.getElementById('wizardProgressText').textContent = `${state.currentIndex + 1} of ${total}`;
    document.getElementById('wizardProgressPct').textContent = `${pct}%`;
    document.getElementById('wizardProgressBar').style.width = `${pct}%`;

    // Prev button
    const prevBtn = document.getElementById('wizardPrevBtn');
    prevBtn.disabled = state.currentIndex === 0;

    // Next vs Finish
    const nextBtn = document.getElementById('wizardNextBtn');
    if (state.currentIndex === total - 1) {
      nextBtn.innerHTML = `Save & Finish <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"></polyline></svg>`;
    } else {
      nextBtn.innerHTML = `Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9,18 15,12 9,6"></polyline></svg>`;
    }

    // Hint visibility
    const hint = document.getElementById('wizardCanvasHint');
    if (hint) {
      const hasStrokes = state.allStrokes.length > 0;
      hint.style.opacity = hasStrokes ? '0' : '1';
    }

    _drawGuide(ch);
    _updateCharStatus();
  }

  function _updateCharStatus() {
    const ch = CHARACTER_SET[state.currentIndex];
    const hasStrokes = state.allStrokes.length > 0 || state.characters[ch];
    const statusEl = document.getElementById('wizardCharStatus');
    if (statusEl) {
      if (hasStrokes) {
        statusEl.innerHTML = `<span class="status-dot status-done"></span><span>Drawn ✓</span>`;
      } else {
        statusEl.innerHTML = `<span class="status-dot status-pending"></span><span>Not drawn</span>`;
      }
    }
  }

  function _drawGuide(ch) {
    const gDispW = guideCanvas.getBoundingClientRect().width  || 400;
    const gDispH = guideCanvas.getBoundingClientRect().height || 300;
    guideCtx.clearRect(0, 0, gDispW, gDispH);

    // Draw the character as a large faded guide
    const fontSize = Math.min(gDispW, gDispH) * 0.85;
    guideCtx.save();
    guideCtx.font = `bold ${fontSize}px Georgia, 'Times New Roman', serif`;
    guideCtx.fillStyle = 'rgba(37, 99, 235, 0.06)';
    guideCtx.textAlign = 'center';
    guideCtx.textBaseline = 'middle';
    guideCtx.fillText(ch, gDispW / 2, gDispH / 2);

    // Draw baseline
    guideCtx.strokeStyle = 'rgba(37, 99, 235, 0.12)';
    guideCtx.lineWidth = 1.5;
    guideCtx.setLineDash([6, 4]);
    const baselineY = gDispH * 0.7;
    guideCtx.beginPath();
    guideCtx.moveTo(gDispW * 0.05, baselineY);
    guideCtx.lineTo(gDispW * 0.95, baselineY);
    guideCtx.stroke();

    // Midline
    guideCtx.strokeStyle = 'rgba(37, 99, 235, 0.07)';
    guideCtx.setLineDash([4, 6]);
    const midY = gDispH * 0.45;
    guideCtx.beginPath();
    guideCtx.moveTo(gDispW * 0.05, midY);
    guideCtx.lineTo(gDispW * 0.95, midY);
    guideCtx.stroke();

    guideCtx.restore();
  }

  function _getCharName(ch) {
    if (ch >= 'a' && ch <= 'z') return `lowercase ${ch}`;
    if (ch >= 'A' && ch <= 'Z') return `uppercase ${ch}`;
    if (ch >= '0' && ch <= '9') return `digit ${ch}`;
    const names = {
      '.': 'period', ',': 'comma', '!': 'exclamation', '?': 'question mark',
      "'": 'apostrophe', '"': 'quotation mark', '-': 'hyphen',
      '(': 'open parenthesis', ')': 'close parenthesis', ':': 'colon',
    };
    return names[ch] || ch;
  }

  function _finish() {
    _saveCurrentChar();
    if (Object.keys(state.characters).length === 0) {
      _showToast('Please draw at least one character before saving.', 'error');
      return;
    }
    if (state.onComplete) {
      state.onComplete(state.characters);
    }
  }

  function _handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const id = ProfileManager.importProfileJSON(ev.target.result);
        ProfileManager.setActiveProfileId(id);
        if (state.onComplete) state.onComplete(null, id);
      } catch (err) {
        _showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function _showToast(msg, type = 'info') {
    // Delegate to global toast if available
    if (window.showToast) {
      window.showToast(msg, type);
    } else {
      alert(msg);
    }
  }

  return { init, CHARACTER_SET };
})();
