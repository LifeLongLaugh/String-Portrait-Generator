# String Portrait Generator
A small browser-based tool that generates string-art portraits

**Version:** v1.0  
**Author:** Vishal Kolekar (project owner)  
**License:** MIT

---

## Project overview

This is a small browser-based tool (plain HTML/CSS/vanilla JavaScript) that generates **string-art portraits** from user-uploaded images. The entire app runs locally in the browser using `<canvas>` — no server, no libraries.

This repository contains the initial, **physically-accurate black-thread** implementation (v1.0).

---

## What’s in v1.0

- `index.html` — landing / introduction page (this file).
- `layout.html` — the string-art app page (rename your current app `index.html` → `layout.html` before pushing).
- `styles.css` — styles used by the app (and lightweight styling for the landing page if present).
- `app.js` — the physically-accurate black-thread string-art implementation (high-res backing buffers).

**Core features (v1.0):**
- Load image from disk and position inside an oval by dragging.
- Configure oval axes, nail count, thread thickness, stroke limit.
- Physically-accurate buffers: `brightnessBuffer` and `threadBuffer`.
- Per-sample kernel stamping guarantees numeric parity between removed image brightness and displayed thread darkness.
- Export thread sequence (text) and final PNG.
- Simple UI (no external libraries).
