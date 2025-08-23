(() => {
  // --------------- CONFIG ----------------
  const DISPLAY_SIZE = 600;
  const RES = 1200;
  const dpr = window.devicePixelRatio || 1;
  const BACKING_SIZE = Math.floor(RES * dpr);
  const BACK_W = BACKING_SIZE, BACK_H = BACKING_SIZE;

  // --------------- DOM ----------------
  const imageCanvas = document.getElementById('imageCanvas');
  const workCanvas = document.getElementById('workCanvas');
  const imgCtx = imageCanvas.getContext('2d', { alpha: false });
  const wCtx = workCanvas.getContext('2d', { alpha: false });

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d', { alpha: false });

  // Controls
  const fileInput = document.getElementById('fileInput');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const resetBtn = document.getElementById('resetBtn');
  const exportSeqBtn = document.getElementById('exportSeqBtn');
  const exportPNGBtn = document.getElementById('exportPNGBtn');

  const nailCountInput = document.getElementById('nailCount');
  const maxLinesInput = document.getElementById('maxLines');
  const thicknessInput = document.getElementById('thickness');
  const addAmountInput = document.getElementById('addAmount');
  const downscaleInput = document.getElementById('downscale');
  const topKInput = document.getElementById('topK');
  const globalIntervalInput = document.getElementById('globalInterval');
  const noFearInput = document.getElementById('noFear');
  const noFearTolInput = document.getElementById('noFearTol');
  const noFearTolGroup = document.getElementById('noFearTolGroup');

  const modeSelect = document.getElementById('modeSelect');
  const activeModeSpan = document.getElementById('activeMode');
  const precomputeStatus = document.getElementById('precomputeStatus');
  const recomputeBtn = document.getElementById('recomputeBtn');

  const ovalW = document.getElementById('ovalW');
  const ovalH = document.getElementById('ovalH');

  const nailCountVal = document.getElementById('nailCountVal');
  const maxLinesVal = document.getElementById('maxLinesVal');
  const thicknessVal = document.getElementById('thicknessVal');
  const ovalWval = document.getElementById('ovalWval');
  const ovalHval = document.getElementById('ovalHval');
  const addVal = document.getElementById('addVal');
  const downscaleVal = document.getElementById('downscaleVal');
  const topKVal = document.getElementById('topKVal');
  const globalIntervalVal = document.getElementById('globalIntervalVal');
  const noFearTolVal = document.getElementById('noFearTolVal');

  const connectionsCountEl = document.getElementById('connectionsCount');

  // --------------- backing sizes ----------------
  [imageCanvas, workCanvas, offscreen].forEach(c => {
    c.width = BACK_W;
    c.height = BACK_H;
    c.style.width = DISPLAY_SIZE + 'px';
    c.style.height = DISPLAY_SIZE + 'px';
  });

  // --------------- state buffers ----------------
  let targetBuffer = new Float32Array(BACK_W * BACK_H);
  let blackBuffer = new Float32Array(BACK_W * BACK_H);
  let nails = [];
  let nailsCount = parseInt(nailCountInput.value, 10);
  let thickness = parseFloat(thicknessInput.value);
  let ADD = parseInt(addAmountInput.value, 10);

  // small-res
  let PREFILTER_DOWNSCALE = parseInt(downscaleInput.value, 10) || 6;
  let smallW = Math.max(4, Math.floor(BACK_W / PREFILTER_DOWNSCALE));
  let smallH = Math.max(4, Math.floor(BACK_H / PREFILTER_DOWNSCALE));
  let targetSmall = null;
  let renderSmall = null;

  // precomputed lines
  let linePixels = null;
  let precomputeInProgress = false;

  // generator state
  let threadSequence = [];
  let running = false;
  let maxLines = parseInt(maxLinesInput.value, 10);

  // controls (dynamic)
  let TOP_K = parseInt(topKInput.value, 10) || 32;
  let GLOBAL_INTERVAL = parseInt(globalIntervalInput.value, 10) || 500;
  let NO_FEAR = !!noFearInput.checked;
  let NO_FEAR_TOL = parseInt(noFearTolInput.value, 10) || -100;

  // display multiplier (visual only)
  const brightnessValElem = document.getElementById('brightnessVal');
  let displayMultiplier = 1 + ((brightnessValElem ? parseInt(brightnessValElem.textContent || '15', 10) : 15) / 255.0) * 15.0;

  function updateUIValues() {
    nailCountVal.textContent = nailCountInput.value;
    maxLinesVal.textContent = maxLinesInput.value;
    thicknessVal.textContent = thicknessInput.value;
    ovalWval.textContent = ovalW.value;
    ovalHval.textContent = ovalH.value;
    addVal.textContent = addAmountInput.value;
    downscaleVal.textContent = downscaleInput.value;
    topKVal.textContent = topKInput.value;
    globalIntervalVal.textContent = globalIntervalInput.value;
    noFearTolVal.textContent = noFearTolInput.value;
    activeModeSpan.textContent = modeSelect.options[modeSelect.selectedIndex].text;
  }
  updateUIValues();

  // --------------- Image placement state (drag + zoom) ---------------
  let imageObj = new Image();
  let imgLoaded = false;
  let imageScale = 1;
  let imageOffsetX = 0;
  let imageOffsetY = 0;

  // drag state
  let dragging = false;
  let dragStart = null;

  // helper: convert client coords to backing canvas coords
  function clientToBacking(evt, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = (evt.clientX !== undefined) ? evt.clientX : evt.touches[0].clientX;
    const clientY = (evt.clientY !== undefined) ? evt.clientY : evt.touches[0].clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  }

  // ---------------- image load ----------------
  fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (rEv) => {
      imageObj = new Image();
      imageObj.onload = () => {
        // fit into backing canvas initially
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
        targetBuffer = new Float32Array(BACK_W * BACK_H);
        blackBuffer = new Float32Array(BACK_W * BACK_H);
        for (let i = 0, j = 0; i < id.data.length; i += 4, j++) {
          const r = id.data[i], g = id.data[i + 1], b = id.data[i + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          targetBuffer[j] = lum;
          blackBuffer[j] = 0;
        }

        PREFILTER_DOWNSCALE = parseInt(downscaleInput.value, 10);
        updateSmallResMaps();

        imgLoaded = true;
        threadSequence = [];
        computeNails();
        schedulePrecomputeLines();
        drawAll();
      };
      imageObj.src = rEv.target.result;
    };
    reader.readAsDataURL(f);
  });

  // redraw offscreen target based on current imageScale & offsets
  function redrawOffscreenToTarget() {
    if (!imageObj || !imgLoaded) return;
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, BACK_W, BACK_H);
    const iw = Math.round(imageObj.width * imageScale);
    const ih = Math.round(imageObj.height * imageScale);
    offCtx.drawImage(imageObj, 0, 0, imageObj.width, imageObj.height, imageOffsetX, imageOffsetY, iw, ih);
    const id = offCtx.getImageData(0, 0, BACK_W, BACK_H);
    for (let i = 0, j = 0; i < id.data.length; i += 4, j++) {
      const r = id.data[i], g = id.data[i + 1], b = id.data[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      targetBuffer[j] = lum;
    }
    // keep blackBuffer state reset when repositioning (recommended)
  }

  // ---------------- small-res mapping ----------------
  function updateSmallResMaps() {
    PREFILTER_DOWNSCALE = Math.max(2, Math.floor(parseInt(downscaleInput.value, 10) || 6));
    smallW = Math.max(4, Math.floor(BACK_W / PREFILTER_DOWNSCALE));
    smallH = Math.max(4, Math.floor(BACK_H / PREFILTER_DOWNSCALE));
    targetSmall = new Float32Array(smallW * smallH);
    renderSmall = new Float32Array(smallW * smallH);
    const sx = BACK_W / smallW, sy = BACK_H / smallH;
    for (let syi = 0; syi < smallH; syi++) {
      for (let sxi = 0; sxi < smallW; sxi++) {
        const x0 = Math.floor(sxi * sx);
        const y0 = Math.floor(syi * sy);
        const x1 = Math.floor((sxi + 1) * sx);
        const y1 = Math.floor((syi + 1) * sy);
        let sumT = 0, sumR = 0, count = 0;
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const idx = yy * BACK_W + xx;
            sumT += targetBuffer[idx];
            sumR += Math.max(0, Math.min(255, 255 - blackBuffer[idx]));
            count++;
          }
        }
        const si = syi * smallW + sxi;
        targetSmall[si] = count ? (sumT / count) : 255;
        renderSmall[si] = count ? (sumR / count) : 255;
      }
    }
  }

  // ---------------- precompute line pixel lists ----------------
  function schedulePrecomputeLines() {
    if (!imgLoaded) return;
    if (precomputeInProgress) return;
    precomputeInProgress = true;
    linePixels = null; // clear stale cache immediately
    precomputeStatus.textContent = 'Starting precompute...';
    setTimeout(() => computeLinePixelsBatched(), 20);
  }

  recomputeBtn.addEventListener('click', () => {
    computeNails();
    schedulePrecomputeLines();
  });

  function computeLinePixelsBatched() {
    const n = nails.length;
    linePixels = Array.from({ length: n }, () => new Array(n));
    precomputeStatus.textContent = 'Precomputing lines (this may take some time)...';
    const pairs = [];
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        pairs.push([a, b]);
      }
    }

    let pairIndex = 0;
    const batchSize = 40;
    function processBatch() {
      const end = Math.min(pairIndex + batchSize, pairs.length);
      for (let p = pairIndex; p < end; p++) {
        const [a, b] = pairs[p];
        const entry = computeLinePixelsForPair(a, b);
        linePixels[a][b] = entry;
        linePixels[b][a] = entry;
      }
      pairIndex = end;
      precomputeStatus.textContent = `Precomputing lines: ${pairIndex}/${pairs.length}`;
      if (pairIndex < pairs.length) setTimeout(processBatch, 10);
      else {
        precomputeInProgress = false;
        precomputeStatus.textContent = `Precompute done (${pairs.length} pairs).`;
        updateSmallResMaps();
        drawAll();
      }
    }
    processBatch();
  }

  function computeLinePixelsForPair(a, b) {
    const A = nails[a], B = nails[b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const dist = Math.hypot(dx, dy);
    const radiusPx = Math.max(0.5, thicknessToBackingRadius(thickness) / 2.0);
    const spacing = Math.max(1.0, radiusPx * 0.6);
    const steps = Math.max(2, Math.ceil(dist / spacing));
    const set = new Set();
    let x0 = BACK_W, y0 = BACK_H, x1 = 0, y1 = 0;
    for (let s = 0; s < steps; s++) {
      const t = s / (steps - 1);
      const cx = A.x + dx * t, cy = A.y + dy * t;
      const r = Math.ceil(radiusPx);
      const ix0 = Math.max(0, Math.floor(cx) - r);
      const iy0 = Math.max(0, Math.floor(cy) - r);
      const ix1 = Math.min(BACK_W - 1, Math.floor(cx) + r);
      const iy1 = Math.min(BACK_H - 1, Math.floor(cy) + r);
      const rr2 = radiusPx * radiusPx;
      for (let yy = iy0; yy <= iy1; yy++) {
        const dy2 = (yy - cy) * (yy - cy);
        for (let xx = ix0; xx <= ix1; xx++) {
          const dx2 = (xx - cx) * (xx - cx);
          if (dx2 + dy2 <= rr2) {
            const idx = yy * BACK_W + xx;
            set.add(idx);
            if (xx < x0) x0 = xx;
            if (yy < y0) y0 = yy;
            if (xx > x1) x1 = xx;
            if (yy > y1) y1 = yy;
          }
        }
      }
    }
    const indices = new Uint32Array(set.size);
    let i = 0;
    for (const v of set) { indices[i++] = v; }
    const smallSet = new Set();
    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k];
      const yy = Math.floor(idx / BACK_W);
      const xx = idx % BACK_W;
      const sx = Math.floor(xx / (BACK_W / smallW));
      const sy = Math.floor(yy / (BACK_H / smallH));
      const sidx = Math.max(0, Math.min(sy * smallW + sx, smallW * smallH - 1));
      smallSet.add(sidx);
    }
    const smallIndices = new Uint32Array(smallSet.size);
    i = 0;
    for (const v of smallSet) { smallIndices[i++] = v; }
    return { indices, bbox: { x0, y0, x1, y1 }, smallIndices };
  }

  function thicknessToBackingRadius(cssThickness) {
    const scale = (BACK_W / DISPLAY_SIZE);
    return Math.max(0.5, cssThickness * scale * 0.6);
  }

  // --------------- compute nails (correct ry using BACK_H) ----------------
  function computeEllipse() {
    const cx = BACK_W / 2;
    const cy = BACK_H / 2;
    const rx = (parseFloat(ovalW.value) / 100) * (BACK_W / 2);
    const ry = (parseFloat(ovalH.value) / 100) * (BACK_H / 2); // <-- use BACK_H for vertical radius
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

  // --------------- drawing ----------------
  function drawImageCanvas() {
    const id = imgCtx.createImageData(BACK_W, BACK_H);
    const d = id.data;
    for (let i = 0, j = 0; j < targetBuffer.length; i += 4, j++) {
      const v = Math.max(0, Math.min(255, Math.round(targetBuffer[j])));
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

  function drawWorkCanvas() {
    const id = wCtx.createImageData(BACK_W, BACK_H);
    const d = id.data;
    const displayMul = displayMultiplier;
    for (let i = 0, j = 0; j < blackBuffer.length; i += 4, j++) {
      const t = Math.max(0, Math.min(255, Math.round(blackBuffer[j])));
      const disp = Math.min(255, Math.round(t * displayMul));
      const col = 255 - disp;
      d[i] = d[i + 1] = d[i + 2] = col;
      d[i + 3] = 255;
    }
    wCtx.putImageData(id, 0, 0);
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

  function drawAll() {
    drawImageCanvas();
    drawWorkCanvas();
    updateConnectionsDisplay();
  }

  function updateConnectionsDisplay() {
    if (!connectionsCountEl) return;
    const connections = Math.max(0, threadSequence.length - 1);
    connectionsCountEl.textContent = connections;
  }

  // ---------------- small-res L2 proxy ----------------
  function computeSmallDeltaL2(smallIndices) {
    let delta = 0.0;
    for (let k = 0; k < smallIndices.length; k++) {
      const si = smallIndices[k];
      const before = renderSmall[si];
      const after = Math.max(0, Math.min(255, before - ADD));
      const t = targetSmall[si];
      const eBefore = t - before;
      const eAfter = t - after;
      delta += (eBefore * eBefore - eAfter * eAfter);
    }
    return delta;
  }

  // ---------------- full-res L2 delta ----------------
  function computeDeltaL2ForLine(indices) {
    let delta = 0.0;
    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k];
      const before = Math.max(0, Math.min(255, 255 - blackBuffer[idx]));
      const after = Math.max(0, Math.min(255, 255 - (blackBuffer[idx] + ADD)));
      const errB = targetBuffer[idx] - before;
      const errA = targetBuffer[idx] - after;
      delta += (errB * errB - errA * errA);
    }
    return delta;
  }

  // ---------------- selection (no index skip) ----------------
  let commitCounter = 0;
  function findBestNextIndex(currentIndex) {
    if (!linePixels || precomputeInProgress) {
      // fallback random while precompute is active
      let r = Math.floor(Math.random() * nails.length);
      while (r === currentIndex) r = Math.floor(Math.random() * nails.length);
      return r;
    }

    const candidates = [];
    for (let i = 0; i < nails.length; i++) {
      if (i === currentIndex) continue;
      const entry = linePixels[currentIndex][i];
      if (!entry) continue;
      const smallDelta = computeSmallDeltaL2(entry.smallIndices);
      candidates.push({ i, smallDelta, entry });
    }
    if (!candidates.length) {
      let r = Math.floor(Math.random() * nails.length);
      while (r === currentIndex) r = Math.floor(Math.random() * nails.length);
      return r;
    }

    GLOBAL_INTERVAL = parseInt(globalIntervalInput.value, 10) || GLOBAL_INTERVAL;
    const doGlobal = (commitCounter > 0 && (commitCounter % GLOBAL_INTERVAL) === 0);

    if (doGlobal) {
      let bestDelta = -Infinity;
      let bestIdx = null;
      for (let c = 0; c < candidates.length; c++) {
        const cand = candidates[c];
        const delta = computeDeltaL2ForLine(cand.entry.indices);
        if (delta > bestDelta) { bestDelta = delta; bestIdx = cand.i; }
      }
      return applyNoFearAndFallback(bestIdx, bestDelta, candidates);
    }

    candidates.sort((a, b) => b.smallDelta - a.smallDelta);
    TOP_K = Math.min(candidates.length, parseInt(topKInput.value, 10) || 32);
    const shortlist = candidates.slice(0, TOP_K);

    let bestDelta = -Infinity;
    let bestIdx = null;
    for (let c = 0; c < shortlist.length; c++) {
      const cand = shortlist[c];
      const delta = computeDeltaL2ForLine(cand.entry.indices);
      if (delta > bestDelta) { bestDelta = delta; bestIdx = cand.i; }
    }

    return applyNoFearAndFallback(bestIdx, bestDelta, candidates);
  }

  function applyNoFearAndFallback(bestIdx, bestDelta, candidates) {
    NO_FEAR = !!noFearInput.checked;
    NO_FEAR_TOL = parseInt(noFearTolInput.value, 10) || NO_FEAR_TOL;
    if (bestIdx !== null && bestDelta > 0) return bestIdx;
    if (bestIdx !== null && NO_FEAR && bestDelta >= NO_FEAR_TOL) {
      return bestIdx;
    }
    // fallback pick best smallDelta
    candidates.sort((a, b) => b.smallDelta - a.smallDelta);
    if (candidates.length) return candidates[0].i;
    let r = Math.floor(Math.random() * nails.length);
    while (r === null || r < 0) r = Math.floor(Math.random() * nails.length);
    return r;
  }

  // ---------------- commit ----------------
  function commitLine(currentIdx, nextIdx) {
    const entry = linePixels[currentIdx][nextIdx];
    if (!entry) return;
    const inds = entry.indices;
    for (let k = 0; k < inds.length; k++) {
      const idx = inds[k];
      blackBuffer[idx] = Math.min(255, blackBuffer[idx] + ADD);
    }
    for (let s = 0; s < entry.smallIndices.length; s++) {
      const si = entry.smallIndices[s];
      const sx = si % smallW;
      const sy = Math.floor(si / smallW);
      const x0 = Math.floor(sx * (BACK_W / smallW));
      const y0 = Math.floor(sy * (BACK_H / smallH));
      const x1 = Math.floor((sx + 1) * (BACK_W / smallW));
      const y1 = Math.floor((sy + 1) * (BACK_H / smallH));
      let sumR = 0, count = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const idx = yy * BACK_W + xx;
          sumR += Math.max(0, Math.min(255, 255 - blackBuffer[idx]));
          count++;
        }
      }
      renderSmall[si] = count ? (sumR / count) : 255;
    }
    threadSequence.push(nextIdx);
    commitCounter++;
  }

  // ---------------- step & loop ----------------
  function stepOnce() {
    if (!imgLoaded) return false;
    if (!threadSequence.length) {
      threadSequence.push(Math.floor(Math.random() * nails.length));
      return true;
    }
    const cur = threadSequence[threadSequence.length - 1];
    const next = findBestNextIndex(cur);
    if (next == null) return false;
    commitLine(cur, next);
    return true;
  }

  let loopHandle = null;
  function runLoop() {
    if (!running) return;
    const stepsPerFrame = 1;
    for (let s = 0; s < stepsPerFrame; s++) {
      if (threadSequence.length >= maxLines) { running = false; break; }
      const ok = stepOnce();
      if (!ok) { running = false; break; }
    }
    drawAll();
    if (running && threadSequence.length < maxLines) loopHandle = requestAnimationFrame(runLoop);
    else running = false;
  }

  // --------------- UI wiring ----------------
  startBtn.addEventListener('click', () => {
    if (!imgLoaded) { alert('Load an image first'); return; }
    if (precomputeInProgress) { alert('Precompute still running — please wait or click Recompute.'); return; }
    if (!linePixels) { alert('Line map not available; recompute lines first.'); return; }
    if (running) return;
    maxLines = parseInt(maxLinesInput.value, 10);
    nailsCount = parseInt(nailCountInput.value, 10);
    thickness = parseFloat(thicknessInput.value);
    ADD = parseInt(addAmountInput.value, 10);
    TOP_K = parseInt(topKInput.value, 10);
    PREFILTER_DOWNSCALE = parseInt(downscaleInput.value, 10);
    GLOBAL_INTERVAL = parseInt(globalIntervalInput.value, 10) || GLOBAL_INTERVAL;
    NO_FEAR = !!noFearInput.checked;
    NO_FEAR_TOL = parseInt(noFearTolInput.value, 10) || NO_FEAR_TOL;
    running = true;
    loopHandle = requestAnimationFrame(runLoop);
  });

  stopBtn.addEventListener('click', () => { running = false; if (loopHandle) cancelAnimationFrame(loopHandle); });

  resetBtn.addEventListener('click', () => {
    if (imgLoaded) {
      blackBuffer.fill(0);
      threadSequence = [];
      updateRenderSmallFromBlack();
      drawAll();
    }
  });

  exportSeqBtn.addEventListener('click', () => {
    if (!threadSequence.length) { alert('No sequence to export'); return; }
    const txt = threadSequence.join('\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'threadSequence.txt'; a.click(); URL.revokeObjectURL(url);
  });

  exportPNGBtn.addEventListener('click', () => {
    const url = workCanvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = 'string_art.png'; a.click();
  });

  [nailCountInput, maxLinesInput, thicknessInput, addAmountInput, downscaleInput, topKInput, globalIntervalInput, noFearInput, noFearTolInput, ovalW, ovalH].forEach(el => {
    el.addEventListener('input', () => {
      updateUIValues();
      // recompute caches on geometry/size changes
      if (el === nailCountInput || el === ovalW || el === ovalH) {
        computeNails();
        schedulePrecomputeLines();
      }
      if (el === thicknessInput) {
        thickness = parseFloat(thicknessInput.value);
        schedulePrecomputeLines();
      }
      if (el === downscaleInput) {
        PREFILTER_DOWNSCALE = parseInt(downscaleInput.value, 10);
        updateSmallResMaps();
      }
      ADD = parseInt(addAmountInput.value, 10);
      TOP_K = parseInt(topKInput.value, 10);
      GLOBAL_INTERVAL = parseInt(globalIntervalInput.value, 10) || GLOBAL_INTERVAL;
      NO_FEAR = !!noFearInput.checked;
      NO_FEAR_TOL = parseInt(noFearTolInput.value, 10) || NO_FEAR_TOL;
      drawAll();
    });
  });

  modeSelect.addEventListener('change', () => {
    updateUIValues();
    if (modeSelect.value !== 'black') {
      alert('Only Black-only mode is implemented in this version. Other modes coming soon.');
      modeSelect.value = 'black';
      updateUIValues();
    }
  });

  // show/hide tolerance control when No-Fear toggles
  function toggleNoFearTolVisibility() {
    if (!noFearTolGroup) return;
    noFearTolGroup.style.display = noFearInput.checked ? 'block' : 'none';
  }
  toggleNoFearTolVisibility();
  noFearInput.addEventListener('change', toggleNoFearTolVisibility);

  // --------------- helpers ---------------
  function updateRenderSmallFromBlack() {
    if (!targetSmall) return;
    const sx = BACK_W / smallW, sy = BACK_H / smallH;
    for (let syi = 0; syi < smallH; syi++) {
      for (let sxi = 0; sxi < smallW; sxi++) {
        const x0 = Math.floor(sxi * sx), y0 = Math.floor(syi * sy);
        const x1 = Math.floor((sxi + 1) * sx), y1 = Math.floor((syi + 1) * sy);
        let sumR = 0, count = 0;
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const idx = yy * BACK_W + xx;
            sumR += Math.max(0, Math.min(255, 255 - blackBuffer[idx]));
            count++;
          }
        }
        const si = syi * smallW + sxi;
        renderSmall[si] = count ? (sumR / count) : 255;
      }
    }
  }

  function thicknessToBackingRadius(cssThickness) {
    const scale = (BACK_W / DISPLAY_SIZE);
    return Math.max(0.5, cssThickness * scale * 0.6);
  }

  // --------------- drag & zoom handlers ---------------
  // drag start
  imageCanvas.addEventListener('mousedown', (ev) => {
    if (!imgLoaded) return;
    dragging = true;
    dragStart = clientToBacking(ev, imageCanvas);
    dragStart.ox = imageOffsetX;
    dragStart.oy = imageOffsetY;
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
    // update target & reset threads
    redrawOffscreenToTarget();
    blackBuffer.fill(0);
    threadSequence = [];
    computeNails();
    schedulePrecomputeLines();
    drawAll();
  });

  // touch drag / pinch
  let lastTouchDist = null;
  imageCanvas.addEventListener('touchstart', (ev) => {
    if (!imgLoaded) return;
    if (ev.touches.length === 1) {
      dragging = true;
      dragStart = clientToBacking(ev.touches[0], imageCanvas);
      dragStart.ox = imageOffsetX; dragStart.oy = imageOffsetY;
    } else if (ev.touches.length === 2) {
      lastTouchDist = Math.hypot(
        ev.touches[0].clientX - ev.touches[1].clientX,
        ev.touches[0].clientY - ev.touches[1].clientY
      );
    }
    ev.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (ev) => {
    if (!imgLoaded) return;
    if (ev.touches.length === 1 && dragging) {
      const pt = clientToBacking(ev.touches[0], imageCanvas);
      const dx = pt.x - dragStart.x;
      const dy = pt.y - dragStart.y;
      imageOffsetX = dragStart.ox + dx;
      imageOffsetY = dragStart.oy + dy;
      redrawOffscreenToTarget();
      blackBuffer.fill(0);
      threadSequence = [];
      computeNails();
      schedulePrecomputeLines();
      drawAll();
    } else if (ev.touches.length === 2) {
      // pinch zoom
      const d = Math.hypot(
        ev.touches[0].clientX - ev.touches[1].clientX,
        ev.touches[0].clientY - ev.touches[1].clientY
      );
      if (lastTouchDist) {
        const factor = d / lastTouchDist;
        // center point
        const cx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
        const cy = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
        const before = clientToBacking({ clientX: cx, clientY: cy }, imageCanvas);
        imageScale *= factor;
        imageScale = Math.max(0.05, Math.min(10, imageScale));
        // maintain center
        const after = clientToBacking({ clientX: cx, clientY: cy }, imageCanvas);
        // adjust offset so the point under fingers remains roughly same
        imageOffsetX += (before.x - after.x);
        imageOffsetY += (before.y - after.y);
        redrawOffscreenToTarget();
        blackBuffer.fill(0);
        threadSequence = [];
        computeNails();
        schedulePrecomputeLines();
        drawAll();
      }
      lastTouchDist = d;
    }
    ev.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', (ev) => {
    dragging = false;
    lastTouchDist = null;
  });

  // mouse wheel zoom centered on cursor
  imageCanvas.addEventListener('wheel', (ev) => {
    if (!imgLoaded) return;
    ev.preventDefault();
    const rect = imageCanvas.getBoundingClientRect();
    const clientX = ev.clientX;
    const clientY = ev.clientY;
    // backing coords of cursor before zoom
    const before = clientToBacking(ev, imageCanvas);
    // compute factor
    const zoomSpeed = 0.0018;
    const factor = Math.exp(-ev.deltaY * zoomSpeed);
    imageScale *= factor;
    imageScale = Math.max(0.05, Math.min(10, imageScale));
    // compute new backing coords of cursor after scale
    // we keep point under cursor stationary by adjusting offset:
    const iw = Math.round(imageObj.width * imageScale);
    const ih = Math.round(imageObj.height * imageScale);
    // adjust offsets so point under cursor remains in place
    const after = before; // note: clientToBacking uses DOM rect -> ratio; with scale change, mapping of image->backing handled by redrawing
    // simple approach: recenter offsets with factor relative to cursor:
    imageOffsetX = before.x - (before.x - imageOffsetX) * factor;
    imageOffsetY = before.y - (before.y - imageOffsetY) * factor;
    // clamp offsets so image doesn't drift too far (optional)
    redrawOffscreenToTarget();
    blackBuffer.fill(0);
    threadSequence = [];
    computeNails();
    schedulePrecomputeLines();
    drawAll();
  }, { passive: false });

  // --------------- selection & generation already defined above ---------------
  // (small-res L2 proxy, computeDeltaL2ForLine, findBestNextIndex, commitLine, etc.)
  // They are declared later in the file where they depend on linePixels/blackBuffer and remain unchanged (see earlier version).
  // For code clarity we keep the full functions here (they were declared earlier in the previous app.js version)
  // ... (the rest of the functions defined above remain unchanged)
  // (To keep this file concise in this message, the selection/commit functions are the identical ones from the previous version.)
  // But we still need them here — they are included above in previous code blocks. (No runtime truncation.)

  // For safety, ensure we compute nails and do an initial draw
  computeNails();
  imgCtx.fillStyle = '#ffffff'; imgCtx.fillRect(0, 0, BACK_W, BACK_H);
  wCtx.fillStyle = '#ffffff'; wCtx.fillRect(0, 0, BACK_W, BACK_H);
  drawAll();

  // expose internals
  window.__stringArt = { targetBuffer, blackBuffer, nails, linePixels, threadSequence, BACK_W, BACK_H };
})();
