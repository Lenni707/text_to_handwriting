# Project Plan & Status

> **IMPORTANT INSTRUCTION FOR ALL AGENTS**: You MUST update this file (`plan.md`) whenever you make changes to the repository, add features, or update the roadmap. Always document the current state, what has been completed, and what the next steps are.

## Current Repository State
- **Core Functionality**:
  - `index.html`: Shell application with main workspace and configuration views.
  - `app.js`: Connects settings, input updates, rendering cycles, and saving/handling profiles.
  - `handwriting-engine.js`: Handles character alignment, rendering, baseline distortion, slant, jitter noise, and connection strokes.
  - `setup-wizard.js`: Wizard for recording character drawings (PointerEvents, stylus support, normalized coordinates).
  - `profile-manager.js`: Handles loading/saving profiles to `localStorage` and JSON file exports/imports.
  - `style.css`: Premium layout using Inter, responsive panels, clean white theme.
  - `sample_profile.json`: A generated profile to quickly test application features.

- **Recent Updates**:
  - Fixed handwriting rendering blurriness by implementing High-DPI/Retina display scaling (using `window.devicePixelRatio` and canvas context transforms) on the preview canvas and downloaded image exports.
  - Added an **Ink Color** selection panel featuring 5 color presets, an interactive HSL-based **Color Wheel**, and a custom **Brightness Slider**, saving selections to `localStorage`.
  - Added a **Pen Thickness Slider** (range 1–12px) in the Setup Wizard to customize base pen width during handwriting recording.
  - Fixed stroke width rendering inside both live recording canvas and playback loops to honor the selected pen thickness.
  - Custom CSS rules added for the Pen Thickness slider.

---

## Active Plan & Roadmap

### Phase 1: Local Development & Tweaks (Current)
- [x] Initial app files created (HTML, CSS, JS, Engine).
- [x] Add Pen Thickness slider in drawing wizard.
- [x] Create a sample mock profile (`sample_profile.json`) for quick testing.
- [x] Fix critical character bounds render crash (`getCharBounds` array matching).
- [x] Draw full-page ruled college-block style lines (blue lines + red margin) on the preview canvas.
- [x] Refine rendering engine for "digital ink" feel (uniform stroke widths, smooth character-level transformations: rotation, scaling, offsets) instead of high-frequency shaky point jitter.
- [x] Add a **Baseline Jitter** slider to the editor to control how aligned or bouncy/wobbly individual letters are relative to the paper lines.
- [x] Add a **Pen Style** select dropdown allowing choice between **Digital Pen (Solid)**, **Fountain Pen (Smooth)**, and **Ballpoint Pen (Textured)**.
- [x] Add a **Stroke Weight** slider to the editor (multiplier range `0.3x` to `3.0x`) to dynamically adjust pen line thickness independently from the font size.
- [x] Rework the **Cursive Connectors** to smartly predict natural exit points (ignoring top accents/crossbars like in `t` or `f` and descender loops like in `g`) and natural entry points (leftmost points) of custom-drawn characters, adapting the connection curve shape based on connection height.
- [x] Fix handwriting rendering blurriness by implementing High-DPI/Retina display scaling.
- [x] Add an **Ink Color** selection panel (presets + custom color wheel and brightness slider).
- [x] Implement manual testing & validation of line wrap, slant, and spacing constraints locally.

### Phase 2: Deployment & Hosting
- [x] Initialize GitHub Repository.
- [x] Push local files to GitHub.
- [x] Configure GitHub Pages deployment (Static structure ready, deployment steps documented).

### Phase 3: Future Enhancements (Post-Launch)
- [ ] Multiple character variations (e.g., store 2-3 drawings for letter 'e' to cycle through for more organic look).
- [ ] Custom background paper selections (lined, grid, dot, blank parchment).
- [ ] Word-level connection heuristics for cursive styles.

---

## Instructions for Future Agents
1. Before performing any tasks, read this plan.
2. Update the checkboxes (`[ ]` -> `[x]`) and state descriptions in this file when your work is complete.
3. Commit this file along with your code modifications.
