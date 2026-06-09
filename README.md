# ✍️ Handscript — Text to Handwriting Converter

Transform any text into your own personalized handwriting, rendered on a beautiful paper canvas. Export as PNG or JPEG and use anywhere.

---

## ✨ Features

- **Custom handwriting profiles** — draw each character once, use forever
- **Natural rendering** — pressure variation, baseline jitter, slant, and naturalness controls
- **Cursive connectors** — optional linking strokes between letters
- **Live preview** — see changes instantly as you type or adjust sliders
- **Export** — transparent PNG or white-background JPEG
- **Profile import/export** — share your handwriting style as a JSON file
- **Touch & stylus friendly** — uses Pointer Events API for pressure-sensitive drawing

---

## 🚀 Quick Start

### 1. Open the App
Just open `index.html` in any modern browser — no server or build step required.

### 2. Create Your Handwriting Profile
Click **Start Drawing** (first run) or **Edit Handwriting** (any time).

The setup wizard will walk you through drawing:
- All lowercase letters (a–z)
- All uppercase letters (A–Z)
- Digits (0–9)
- Common punctuation: `. , ! ? ' " - ( ) :`

**Tips for best results:**
- Draw slowly and naturally, as if writing on paper
- Use a stylus/tablet for best pressure sensitivity
- You can skip characters you don't need
- Use the **Clear** button to redo a character
- Click **Previous** to go back and fix earlier characters

### 3. Type Your Text
In the left panel, type any text into the input area. The handwriting preview updates live (with a 200ms debounce).

### 4. Adjust Settings
Use the sliders to fine-tune the output:
| Slider | Effect |
|--------|--------|
| **Font Size** | Character height (16–72px) |
| **Line Spacing** | Space between lines (1.0–3.0×) |
| **Letter Spacing** | Space between characters |
| **Slant** | Italic lean (−30° to +30°) |
| **Naturalness** | Amount of random variation/wobble |

Toggle **Cursive connectors** to add linking strokes between letters.

### 5. Export
- **PNG** — transparent background, ideal for overlaying on designs
- **JPEG** — white paper background with subtle grain texture

---

## 👤 Profile Management

### Save a Profile
After drawing your characters in the setup wizard, click **Save Profile**. You'll be prompted to name it.

### Switch Profiles
Use the dropdown in the top bar to switch between saved profiles.

### Export Profile (JSON)
Click **Export** in the top bar. A `.json` file will be downloaded containing all your stroke data.

### Import Profile (JSON)
Click **Import** in the top bar and select a previously exported `.json` file. The profile will be added to your library immediately.

### Delete Profile
Click the trash icon next to the profile dropdown to delete the current profile.

---

## 🌐 Deploy to GitHub Pages

1. Push this entire folder to a GitHub repository's `main` branch
2. Go to **Settings → Pages**
3. Set source to **"Deploy from a branch"** → `main` → `/ (root)`
4. Click **Save**
5. Your app will be live at `https://yourusername.github.io/your-repo-name/`

> **Note:** All data (profiles) is stored in the browser's `localStorage`. Data does not sync between devices — use Export/Import to transfer profiles.

---

## 🛠 Technical Notes

- **No dependencies** — pure HTML, CSS, and vanilla JavaScript
- **No build step** — works by opening `index.html` directly in a browser
- **Storage** — profiles saved to `localStorage` under key `hwp_profiles`
- **Stroke data** — stored as normalized (0–1) coordinates for resolution independence
- **Rendering** — uses HTML5 Canvas 2D API with cardinal spline interpolation
- **Pressure** — uses `PointerEvent.pressure` (stylus/pen) or defaults to 0.5 (mouse)

---

## 📁 File Structure

```
text_to_handwriting/
├── index.html           # Main app page
├── style.css            # All styles (Inter font, premium UI)
├── app.js               # Main app logic & editor controls
├── handwriting-engine.js # Canvas rendering engine
├── profile-manager.js   # localStorage profile CRUD
├── setup-wizard.js      # Character drawing wizard
└── README.md            # This file
```

---

## 📄 License

MIT — free to use, modify, and share.
