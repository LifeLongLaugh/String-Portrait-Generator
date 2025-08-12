# String Portrait Generator
## 🎨 Create beautiful string art portraits in your browser

[![Live Application](https://img.shields.io/badge/demo-live-success?style=for-the-badge&logo=github)](https://lifelonglaugh.github.io/String-Portrait-Generator/)
[![MIT License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<div align="center">
	<a href="https://lifelonglaugh.github.io/String-Portrait-Generator/">
		<img src="https://placehold.co/600x400/1a1a2e/ffffff?text=String+Portrait+Application" alt="String Art Example" width="600">
	</a>
	<br>
	<em>Click the image above to try the live Application!</em>
</div>

**Version:** v1.0
**Author:** Vishal Kolekar	
**Live Application:** [https://lifelonglaugh.github.io/String-Portrait-Generator/](https://lifelonglaugh.github.io/String-Portrait-Generator/)

---

## Project Overview

This is a small browser-based tool (plain HTML/CSS/vanilla JavaScript) that generates **string-art portraits** from user-uploaded images. The entire app runs locally in the browser using `<canvas>` — no server, no libraries.

**Try it now → [Live Application](https://lifelonglaugh.github.io/String-Portrait-Generator/)**

This repository contains the initial, **physically-accurate black-thread** implementation (v1.0).

---

## Features

✅ **Completely client-side** - runs entirely in your browser	
✅ **No dependencies** - pure vanilla JavaScript	
✅ **Physically-accurate rendering** with high-res buffers	
✅ **Export results** as PNG or thread sequence	
✅ **Responsive design** works on mobile & desktop	
✅ **MIT Licensed** - free to use and modify

---

## How to Use

1. Visit the **[Live Demo](https://lifelonglaugh.github.io/String-Portrait-Generator/)**
2. Upload your image
3. Position it inside the oval
4. Configure nail count and thread settings
5. Generate your string portrait!

[![Try it Now](https://img.shields.io/badge/-Try%20it%20Now!-success?style=for-the-badge)](https://lifelonglaugh.github.io/String-Portrait-Generator/)

---

## What's in v1.0

- `index.html` - landing/introduction page
- `layout.html` - the string-art application
- `styles.css` - styles for both pages
- `app.js` - physically-accurate implementation

**Core features:**
- Load and position images with drag-to-move
- Configure oval dimensions, nail count, thread thickness
- Physically-accurate buffers (brightnessBuffer and threadBuffer)
- Numeric parity between image brightness and thread darkness
- Export thread sequence (text) and final PNG
- Simple UI with no external dependencies

---

## Contribution

Contributions are welcome! Please read the [contribution guidelines](Live Application >> CONTRIBUTION) before submitting a PR.