// app.js -- Physically-accurate Oval String Art (vanilla JS)
// Improved: continuous (non-dotted) threads and stronger "solid black" rendering
// - Ensures sample spacing <= kernel diameter so stamped kernels overlap
// - Renders threadBuffer as grayscale (RGB) rather than alpha mask
// - Uses threadBrightness slider as a display multiplier to control perceived darkness
(() => {
  // ----------------- CONFIG -----------------
  const DISPLAY_SIZE = 600;     // CSS pixels the canvases are shown at
  const RES = 1200;             // internal resolution (change to 1200/1500)
  const dpr = window.devicePixelRatio || 1;
  const BACKING_SIZE = Math.floor(RES * dpr);
  const SAMPLE_STEPS_DEFAULT = 120;
  const LIGHTEN_BY = 10;        // per-sample increment (unchanged physical update)
  // ------------------------------------------------

  // --- DOM & canvases ---
  const imageCanvas = document.getElementById('imageCanvas');
  const workCanvas = document.getElementById('workCanvas');
  const imgCtx = imageCanvas.getContext('2d', { alpha: false });
  const wCtx = workCanvas.getContext('2d', { alpha: true });

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d', { alpha: false });

  // UI elements that exist in HTML
  const fileInput = document.getElementById('fileInput');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const resetBtn = document.getElementById('resetBtn');
  const exportSeqBtn = document.getElementById('exportSeqBtn');
  const exportPNGBtn = document.getElementById('exportPNGBtn');
  const connectionsCountEl = document.getElementById('connectionsCount');

  const nailCountInput = document.getElementById('nailCount');
  const maxLinesInput = document.getElementById('maxLines');
  const thicknessInput = document.getElementById('thickness');
  const threadBrightnessInput = document.getElementById('brightness');
  const ovalW = document.getElementById('ovalW');
  const ovalH = document.getElementById('ovalH');

  const nailCountVal = document.getElementById('nailCountVal');
  const maxLinesVal = document.getElementById('maxLinesVal');
  const thicknessVal = document.getElementById('thicknessVal');
  const ovalWval = document.getElementById('ovalWval');
  const ovalHval = document.getElementById('ovalHval');
  const threadBrightnessVal = document.getElementById('brightnessVal');

  // --- backing sizes & DPI handling ---
  [imageCanvas, workCanvas, offscreen].forEach(c => {
    c.width = BACKING_SIZE;
    c.height = BACKING_SIZE;
    c.style.width = DISPLAY_SIZE + 'px';
    c.style.height = DISPLAY_SIZE + 'px';
  });

  const BACK_W = imageCanvas.width;
  const BACK_H = imageCanvas.height;

  // --- state ---
  let imageObj = new Image();
  let imgLoaded = false;
  let imageScale = 1;
  let imageOffsetX = 0;
  let imageOffsetY = 0;

  let brightnessBuffer = new Float32Array(BACK_W * BACK_H);
  let threadBuffer = new Float32Array(BACK_W * BACK_H);

  let nails = [];
  let threadSequence = [];
  let running = false;

  let nailsCount = parseInt(nailCountInput.value, 10);
  let maxLines = parseInt(maxLinesInput.value, 10);
  let thickness = parseFloat(thicknessInput.value);
  let SAMPLE_STEPS = SAMPLE_STEPS_DEFAULT;

  // thread brightness (used as display multiplier)
  let threadBrightness = parseInt(threadBrightnessInput.value, 10); // 0..255

  function updateUIValues(){
    nailCountVal.textContent = nailCountInput.value;
    maxLinesVal.textContent = maxLinesInput.value;
    thicknessVal.textContent = thicknessInput.value;
    ovalWval.textContent = ovalW.value;
    ovalHval.textContent = ovalH.value;
    threadBrightnessVal.textContent = threadBrightnessInput.value;
  }
  updateUIValues();

  // --- helpers ---
  function clientToBacking(evt, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = (evt.clientX !== undefined) ? evt.clientX : evt.touches[0].clientX;
    const clientY = (evt.clientY !== undefined) ? evt.clientY : evt.touches[0].clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  }

  function xyToIndex(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || xi >= BACK_W || yi < 0 || yi >= BACK_H) return -1;
    return yi * BACK_W + xi;
  }

  // ellipse & nails
  function computeEllipse() {
    const cx = BACK_W / 2;
    const cy = BACK_H / 2;
    const rx = (parseFloat(ovalW.value) / 100) * (BACK_W / 2);
    const ry = (parseFloat(ovalH.value) / 100) * (BACK_W / 2);
    return { cx, cy, rx, ry };
  }

  function computeNails() {
    nails = [];
    nailsCount = parseInt(nailCountInput.value, 10);
    const { cx, cy, rx, ry } = computeEllipse();
    for (let i = 0; i < nailsCount; i++) {
      const angle = (Math.PI * 2 / nailsCount) * i;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      nails.push({ x, y });
    }
  }

  function updateConnectionsDisplay() {
    if (!connectionsCountEl) return;
    // number of actual thread connections is number of segments = threadSequence.length - 1
    const connections = Math.max(0, threadSequence.length - 1);
    connectionsCountEl.textContent = connections;
}

  // --- image load ---
  fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (rEv) => {
      imageObj = new Image();
      imageObj.onload = () => {
        const sx = BACK_W / imageObj.width;
        const sy = BACK_H / imageObj.height;
        imageScale = Math.min(sx, sy);
        const iw = Math.round(imageObj.width * imageScale);
        const ih = Math.round(imageObj.height * imageScale);
        imageOffsetX = Math.round((BACK_W - iw) / 2);
        imageOffsetY = Math.round((BACK_H - ih) / 2);

        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, BACK_W, BACK_H);
        offCtx.drawImage(imageObj, 0, 0, imageObj.width, imageObj.height, imageOffsetX, imageOffsetY, iw, ih);
        const id = offCtx.getImageData(0, 0, BACK_W, BACK_H);
        for (let i = 0, j = 0; i < id.data.length; i += 4, j++) {
          const r = id.data[i], g = id.data[i + 1], b = id.data[i + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          brightnessBuffer[j] = lum;
          threadBuffer[j] = 0;
        }
        imgLoaded = true;
        threadSequence = [];
        computeNails();
        drawAll();
      };
      imageObj.src = rEv.target.result;
    };
    reader.readAsDataURL(f);
  });

  // --- drawing ---
  function drawImageCanvas() {
    const id = imgCtx.createImageData(BACK_W, BACK_H);
    const d = id.data;
    for (let i = 0, j = 0; j < brightnessBuffer.length; i += 4, j++) {
      const v = Math.max(0, Math.min(255, Math.round(brightnessBuffer[j])));
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    imgCtx.putImageData(id, 0, 0);

    const { cx, cy, rx, ry } = computeEllipse();
    imgCtx.save();
    imgCtx.strokeStyle = 'rgba(0,0,0,0.9)';
    imgCtx.lineWidth = Math.max(1, Math.floor(2 * dpr));
    imgCtx.beginPath();
    imgCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    imgCtx.stroke();
    imgCtx.restore();
  }

  // NEW: render threadBuffer to grayscale (solid black possible)
  function drawWorkCanvas() {
    const id = wCtx.createImageData(BACK_W, BACK_H);
    const d = id.data;
    // map threadBuffer via multiplier controlled by threadBrightness slider
    // displayMultiplier range: 0.0 .. ~16.0 (empirically adjustable)
    const displayMultiplier = 1 + (threadBrightness / 255.0) * 15.0; // 1..16
    for (let i = 0, j = 0; j < threadBuffer.length; i += 4, j++) {
      const t = Math.max(0, Math.min(255, Math.round(threadBuffer[j])));
      const disp = Math.min(255, Math.round(t * displayMultiplier)); // scaled darkness
      const col = 255 - disp; // 255 = white, 0 = black
      d[i] = d[i + 1] = d[i + 2] = col;
      d[i + 3] = 255;
    }
    wCtx.putImageData(id, 0, 0);

    // draw nails and ellipse on top
    wCtx.save();
    wCtx.fillStyle = '#000';
    const nailRad = Math.max(1, Math.round(2 * dpr));
    for (let i = 0; i < nails.length; i++) {
      const p = nails[i];
      wCtx.beginPath();
      wCtx.arc(p.x, p.y, nailRad, 0, Math.PI * 2);
      wCtx.fill();
    }
    wCtx.restore();

    const { cx, cy, rx, ry } = computeEllipse();
    wCtx.save();
    wCtx.strokeStyle = 'rgba(0,0,0,0.9)';
    wCtx.lineWidth = Math.max(1, Math.round(2 * dpr));
    wCtx.beginPath();
    wCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    wCtx.stroke();
    wCtx.restore();
  }

  function drawAll() { drawImageCanvas(); drawWorkCanvas(); updateConnectionsDisplay();}

  // --- dragging ---
  let dragging = false;
  let dragStart = null;
  imageCanvas.addEventListener('mousedown', (ev) => {
    if (!imgLoaded) return;
    dragging = true;
    dragStart = clientToBacking(ev, imageCanvas);
    dragStart.ox = imageOffsetX; dragStart.oy = imageOffsetY;
    imageCanvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => { dragging = false; imageCanvas.style.cursor = 'grab'; });
  window.addEventListener('mousemove', (ev) => {
    if (!dragging || !imgLoaded) return;
    const pt = clientToBacking(ev, imageCanvas);
    const dx = pt.x - dragStart.x;
    const dy = pt.y - dragStart.y;
    imageOffsetX = dragStart.ox + dx;
    imageOffsetY = dragStart.oy + dy;
    redrawOffscreenToBrightness();
    threadSequence = [];
    computeNails();
    drawAll();
  });

  // touch support
  imageCanvas.addEventListener('touchstart', (ev) => {
    if (!imgLoaded) return;
    dragging = true;
    dragStart = clientToBacking(ev.touches[0], imageCanvas);
    dragStart.ox = imageOffsetX; dragStart.oy = imageOffsetY;
    ev.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', () => { dragging = false; });
  window.addEventListener('touchmove', (ev) => {
    if (!dragging || !imgLoaded) return;
    const pt = clientToBacking(ev.touches[0], imageCanvas);
    const dx = pt.x - dragStart.x;
    const dy = pt.y - dragStart.y;
    imageOffsetX = dragStart.ox + dx;
    imageOffsetY = dragStart.oy + dy;
    redrawOffscreenToBrightness();
    threadSequence = [];
    computeNails();
    drawAll();
    ev.preventDefault();
  }, { passive: false });

  function redrawOffscreenToBrightness() {
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, BACK_W, BACK_H);
    const iw = Math.round(imageObj.width * imageScale);
    const ih = Math.round(imageObj.height * imageScale);
    offCtx.drawImage(imageObj, 0, 0, imageObj.width, imageObj.height, imageOffsetX, imageOffsetY, iw, ih);
    const id = offCtx.getImageData(0, 0, BACK_W, BACK_H);
    for (let i = 0, j = 0; i < id.data.length; i += 4, j++) {
      const r = id.data[i], g = id.data[i + 1], b = id.data[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      brightnessBuffer[j] = lum;
      // keep threadBuffer until user resets
    }
  }

  // --- improved painting kernel & line stamping for continuous stroke ---
  function thicknessToBackingRadius(cssThickness) {
    const scale = (BACK_W / DISPLAY_SIZE);
    return Math.max(0.5, cssThickness * scale * 0.6);
  }

  // paint circular kernel (same as before)
  function paintKernelAt(xc, yc, addValue, radiusPx) {
    const r = Math.ceil(radiusPx);
    const x0 = Math.max(0, Math.floor(xc) - r);
    const y0 = Math.max(0, Math.floor(yc) - r);
    const x1 = Math.min(BACK_W - 1, Math.floor(xc) + r);
    const y1 = Math.min(BACK_H - 1, Math.floor(yc) + r);
    const r2 = radiusPx * radiusPx;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy - yc; const dy2 = dy * dy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - xc; const dx2 = dx * dx;
        if (dx2 + dy2 <= r2) {
          const idx = yy * BACK_W + xx;
          brightnessBuffer[idx] = Math.min(255, brightnessBuffer[idx] + addValue);
          threadBuffer[idx] = Math.min(255, threadBuffer[idx] + addValue);
        }
      }
    }
  }

  // UPDATE: use step spacing based on kernel radius so stamps overlap and create continuous stroke
  function updateImageAlongLine(i1, i2) {
    const a = nails[i1], b = nails[i2];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const radiusPx = Math.max(0.5, thicknessToBackingRadius(thickness) / 2.0);
    // choose spacing smaller than kernel diameter so stamps overlap:
    const spacing = Math.max(1.0, radiusPx * 0.6); // smaller -> more overlap, continuous
    const steps = Math.max(2, Math.ceil(dist / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / (steps - 1);
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      paintKernelAt(x, y, LIGHTEN_BY, radiusPx);
    }
  }

  // contrast evaluation (same principle)
  function evaluateContrast(i1, i2) {
    const a = nails[i1], b = nails[i2];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    // sample density high enough for accuracy
    const steps = Math.min(Math.max(Math.floor(dist), 20), SAMPLE_STEPS);
    let tot = 0;
    for (let s = 0; s < steps; s++) {
      const t = s / (steps - 1);
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      const idx = xyToIndex(x, y);
      if (idx >= 0) tot += (255 - brightnessBuffer[idx]);
    }
    return tot / steps;
  }

  function findNextNailIndex(currentIndex) {
    let best = -1; let bestIdx = null;
    for (let i = 0; i < nails.length; i++) {
      if (i === currentIndex) continue;
      const contrast = evaluateContrast(currentIndex, i);
      if (contrast > best) { best = contrast; bestIdx = i; }
    }
    if (bestIdx === null) bestIdx = Math.floor(Math.random() * nails.length);
    return bestIdx;
  }

  function stepOnce() {
    if (!imgLoaded) return false;
    if (!threadSequence.length) {
      threadSequence.push(Math.floor(Math.random() * nails.length));
      return true;
    }
    const cur = threadSequence[threadSequence.length - 1];
    const next = findNextNailIndex(cur);
    if (next === null) return false;
    threadSequence.push(next);
    updateImageAlongLine(cur, next);
    return true;
  }

  // main loop
  let loopHandle = null;
  function runLoop() {
    if (!running) return;
    const stepsPerFrame = 1;
    for (let k = 0; k < stepsPerFrame; k++) {
      if (threadSequence.length >= maxLines) { running = false; break; }
      const ok = stepOnce();
      if (!ok) { running = false; break; }
    }
    drawAll();
    if (running && threadSequence.length < maxLines) loopHandle = requestAnimationFrame(runLoop);
    else running = false;
  }

  // --- UI wiring ---
  startBtn.addEventListener('click', () => {
    if (!imgLoaded) { alert('Load an image first'); return; }
    if (running) return;
    computeNails();
    maxLines = parseInt(maxLinesInput.value, 10);
    nailsCount = parseInt(nailCountInput.value, 10);
    thickness = parseFloat(thicknessInput.value);
    SAMPLE_STEPS = SAMPLE_STEPS_DEFAULT;
    running = true;
    loopHandle = requestAnimationFrame(runLoop);
  });

  stopBtn.addEventListener('click', () => {
    running = false;
    if (loopHandle) cancelAnimationFrame(loopHandle);
  });

  resetBtn.addEventListener('click', () => {
    if (imgLoaded) redrawOffscreenToBrightness();
    for (let i = 0; i < threadBuffer.length; i++) threadBuffer[i] = 0;
    threadSequence = [];
    running = false;
    if (loopHandle) cancelAnimationFrame(loopHandle);
    computeNails();
    drawAll();
  });

  exportSeqBtn.addEventListener('click', () => {
    if (!threadSequence.length) { alert('No sequence to export'); return; }
    const txt = threadSequence.join('\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'threadSequence.txt'; a.click();
    URL.revokeObjectURL(url);
  });

  exportPNGBtn.addEventListener('click', () => {
    const url = workCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'string_art.png'; a.click();
  });

  [nailCountInput, maxLinesInput, thicknessInput, ovalW, ovalH].forEach(el => {
    el.addEventListener('input', () => {
      updateUIValues();
      if (el === nailCountInput || el === ovalW || el === ovalH) computeNails();
      nailsCount = parseInt(nailCountInput.value, 10);
      thickness = parseFloat(thicknessInput.value);
      drawAll();
    });
  });

  threadBrightnessInput.addEventListener('input', () => {
    threadBrightness = parseInt(threadBrightnessInput.value, 10);
    updateUIValues();
    drawAll();
  });

  // init
  computeNails();
  imgCtx.fillStyle = '#ffffff'; imgCtx.fillRect(0, 0, BACK_W, BACK_H);
  wCtx.fillStyle = '#ffffff'; wCtx.fillRect(0, 0, BACK_W, BACK_H);
  drawAll();

  // debug export
  window.__stringArt = { brightnessBuffer, threadBuffer, nails, threadSequence, BACK_W, BACK_H, RES, dpr, BACKING_SIZE };
})();
