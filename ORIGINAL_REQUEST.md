# Original User Request

## Initial Request — 2026-06-09T23:53:27+02:00

A browser-based, fully client-side text-to-handwriting converter where users draw each character of the alphabet to create a custom cursive handwriting font, then type text and export it as natural-looking PNG/JPEG images. No server required — deployable to GitHub Pages and usable on tablet.

Working directory: /Users/lenni/programming/vibe_code/text_to_handwriting

Integrity mode: development

---

## Requirements

### R1. Character Drawing Setup Wizard
When the app first loads (or the user requests a new profile), a wizard guides the user through drawing each character on a canvas with their finger, stylus, or mouse. Characters include: a–z, A–Z, 0–9, and common punctuation (. , ! ? ' " - ( ) :). Each drawn character's stroke data is stored. The user can navigate back/forward through characters, skip characters they don't want to draw, and name the resulting profile.

### R2. Natural Handwriting Rendering Engine
Given typed text and a saved handwriting profile, the app renders the text onto an HTML5 Canvas using the stored character strokes. The rendering must look natural, not mechanical: it must apply baseline variation (slight vertical jitter per character), simulated pen pressure (stroke width varies along each stroke), optional slant (horizontal shear), and a configurable noise/jitter amount. For cursive feel, thin connecting strokes are drawn between adjacent letters where possible. The output canvas background is transparent.

### R3. User Controls
The editor provides a text input and real-time preview of the rendered handwriting. Users can adjust: font size, line spacing, letter spacing, slant angle, and naturalness/jitter amount via sliders. Changes trigger a live re-render (debounced).

### R4. Profile Management
Multiple named handwriting profiles can be saved to browser localStorage and switched between via a dropdown. Users can export a profile as a downloadable JSON file and import a JSON file to restore a profile — enabling sharing between devices. Profiles persist across browser sessions.

### R5. Export
The user can export the rendered handwriting as PNG (transparent background) or JPEG (white background). Exports use the current canvas content including all applied settings.

### R6. UI and Compatibility
The app is pure HTML/CSS/JS (no build step), works when `index.html` is opened directly in a browser or served via GitHub Pages. The interface is touch-friendly and usable on a tablet. Design is clean, modern, and white (no warm/yellow tones) with Inter font, blue accent color (`#2563eb`), and smooth micro-animations.

---

## Acceptance Criteria

### Setup Wizard
- [ ] Drawing each of the 72 characters (a–z, A–Z, 0–9, . , ! ? ' " - ( ) :) is possible via the wizard
- [ ] Drawn strokes are captured using PointerEvents (supports both mouse and stylus/touch)
- [ ] Wizard allows navigating back, skipping characters, and completing without drawing all characters
- [ ] Completing the wizard saves the profile with a user-chosen name to localStorage

### Rendering
- [ ] Typed text is rendered to canvas using the stored stroke data for each character
- [ ] Characters not in the profile are visibly skipped or replaced with a fallback (e.g., space)
- [ ] Output visually differs from a mechanical printout: baseline jitter, stroke width variation, and optional slant are all visible
- [ ] Connecting strokes between letters are drawn when cursive mode is enabled
- [ ] Rendered output canvas has a transparent background

### Controls
- [ ] All five sliders (size, line spacing, letter spacing, slant, jitter) affect the rendered output
- [ ] Changes to text or sliders trigger a re-render within ~500ms

### Profile Management
- [ ] Multiple profiles can be saved and switched between without page reload
- [ ] A profile can be exported as a valid JSON file and re-imported to restore all character stroke data
- [ ] Profiles persist after closing and reopening the browser tab

### Export
- [ ] "Download PNG" produces a PNG file with a transparent background
- [ ] "Download JPEG" produces a JPEG file with a white background
- [ ] Exported images reflect the current canvas content (sliders, text, profile all applied)

### Compatibility
- [ ] `index.html` opens and runs correctly in Chrome/Safari without a local server
- [ ] All interactive elements (drawing canvas, sliders, buttons) respond to touch events on a tablet
- [ ] No external server or build step required
