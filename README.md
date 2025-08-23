# String Portrait Generator
## 🎨 Create beautiful string art portraits in your browser

[![Live Application](https://img.shields.io/badge/demo-live-success?style=for-the-badge&logo=github)](https://lifelonglaugh.github.io/String-Portrait-Generator/)
[![MIT License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2-blue?style=for-the-badge)](https://github.com/LifeLongLaugh/String-Portrait-Generator)

<div align="center">
	<a href="https://lifelonglaugh.github.io/String-Portrait-Generator/">
		<img src="https://placehold.co/600x400/1a1a2e/ffffff?text=String+Portrait+Application" alt="String Art Example" width="600">
	</a>
	<br>
	<em>Click the image above to try the live Application!</em>
</div>

**Version:** v1.2 — Optimized Black-only engine  
**Author:** Vishal Kolekar	
**Live Application:** [https://lifelonglaugh.github.io/String-Portrait-Generator/](https://lifelonglaugh.github.io/String-Portrait-Generator/)

---

## Project Overview

This is a browser-based tool (plain HTML/CSS/vanilla JavaScript) that generates **string-art portraits** from user-uploaded images. The entire app runs locally in the browser using `<canvas>` — no server, no libraries.

**Try it now → [Live Application](https://lifelonglaugh.github.io/String-Portrait-Generator/)**

### Special Thanks
This project was inspired by and builds upon the work of:
- **Patt Vira** ([pattvira.com](https://pattvira.com/coding-tutorials/v/string-art))
- **Michael Crum** ([michael-crum.com](https://michael-crum.com/string_art_generator))

---

## What's New in v1.2

### Major Optimizations
- **Precomputed line pixel maps** for fast, memory-efficient full-resolution scoring
- **Small-resolution L2 proxy prefilter** for candidate shortlisting
- **Top-K shortlist + full-res L2 scoring** for high-quality decisions with manageable CPU cost
- **Occasional full global pass** to recover good moves filtered by the proxy
- **No-Fear acceptance policy** to escape local minima
- **Continuous stroke rendering** with overlapping circular kernels

### Enhanced UI
- Mode selector and advanced controls (ADD, downscale, top-K, global pass, No-Fear)
- Precompute status with progress indicator
- Recompute button for parameter changes
- Improved connections counter
- Drag + wheel/pinch zoom for precise image placement

### Technical Improvements
- Removed index-skip heuristic to avoid ellipse artifacts
- Numerical parity preserved between simulation and rendering
- Batched precompute with setTimeout for non-blocking UI
- Robust image handling with reset on reposition

---

## Features

✅ **Completely client-side** - runs entirely in your browser	
✅ **No dependencies** - pure vanilla JavaScript	
✅ **Physically-accurate rendering** with high-res buffers	
✅ **Export results** as PNG or thread sequence	
✅ **Responsive design** works on mobile & desktop	
✅ **MIT Licensed** - free to use and modify
✅ **Advanced optimization** - precomputed line maps and efficient scoring
✅ **Precise image placement** - drag and zoom functionality

---

## How to Use

1. Visit the **[Live Application](https://lifelonglaugh.github.io/String-Portrait-Generator/)**
2. Upload your image and position it with drag/zoom
3. Configure nail count, thread thickness, and advanced parameters
4. Generate your string portrait with real-time progress

[![Try it Now](https://img.shields.io/badge/-Try%20v1.2%20Now!-success?style=for-the-badge)](https://lifelonglaugh.github.io/String-Portrait-Generator/)

---

## Technical Details

### Key Files
- `index.html` - Project introduction and documentation
- `layout.html` - The string-art application (v1.2)
- `styles.css` - Styling for both pages
- `app.js` - Optimized physically-accurate implementation

### Core Features
- Load and position images with intuitive drag-to-move and zoom
- Physically-accurate buffers with numerical parity
- Export thread sequence (text) and final PNG
- Responsive UI with no external dependencies
- Advanced tuning parameters for quality/performance balance

### Performance Notes
- **RES**: Internal working resolution (default 1200, can increase to 1500 for finer detail)
- **Memory**: Precomputed linePixels can use tens of MB for high nail counts
- **Precompute**: May take seconds for high nail counts & thickness (batched with progress UI)
- **Run time**: Scoring optimized with Top-K shortlist and small-resolution prefilter

---

## Contribution

Contributions are welcome! Please keep new features opt-in (toggleable) and preserve the original behavior behind flags so v1.2 behavior is reproducible.

### Future Directions
- Black & White and color mode support
- Memory optimization for very high nail counts (≥300)
- WebWorker offloading for intensive computations
- Machine instruction export format

---

## Version History

- **v1.2** - Optimized Black-only engine with precomputed line maps and advanced UI
- **v1.1** - Layout updates and minor bug fixes
- **v1.0** - Initial physically-accurate black-thread implementation