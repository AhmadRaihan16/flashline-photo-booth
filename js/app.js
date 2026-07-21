/**
 * app.js
 * ---------------------------------------------------------------------------
 * Wires every module together: reactive store -> DOM render, WebRTC camera,
 * countdown-driven burst capture, canvas composition, download/share, and a
 * localStorage-backed gallery of past sessions.
 */

import { createStore } from './store.js';
import { startCamera, stopCamera, CameraError } from './camera.js';
import { FILTERS, getFilter } from './filters.js';
import { runCountdown, wait } from './countdown.js';
import { composeLayout, downloadDataUrl } from './canvasEngine.js';

const GALLERY_KEY  = 'flashline.gallery.v1';

const FRAME_THEMES = [
  { id: 'retro-glitter-pink', label: 'Glitter Pink' },
  { id: 'toy-sky-adventure',  label: 'Toy Sky' },
  { id: 'band-perunggu',      label: 'Perunggu' },
  { id: 'queen-rock',          label: 'Queen' },
  { id: 'lany-neon',          label: 'LANY' }
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const store = createStore({
  currentScreen:  'landing',
  activeFilter:   'none',
  countdownTime:  3,
  capturedImages: [],
  selectedLayout: 'strip',
  frameTheme:     'retro-glitter-pink',
  cameraStream:   null,
  cameraError:    null,
  isCapturing:    false,
  compositeImage: null,
  gallery:        loadGallery(),
});

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const els = {
  screens:          document.querySelectorAll('.screen'),
  btnStart:         document.getElementById('btn-start'),
  landingError:     document.getElementById('landing-error'),
  video:            document.getElementById('video-feed'),
  captureCanvas:    document.getElementById('capture-canvas'),
  filterBar:        document.getElementById('filter-bar'),
  layoutBtns:       document.querySelectorAll('.layout-btn'),
  frameThemePicker: document.getElementById('frame-theme-picker'),
  btnCapture:       document.getElementById('btn-capture'),
  countdownOverlay: document.getElementById('countdown-overlay'),
  countdownNumber:  document.getElementById('countdown-number'),
  shotProgress:     document.getElementById('shot-progress'),
  cameraErrorPanel: document.getElementById('camera-error'),
  cameraErrorDetail:document.getElementById('camera-error-detail'),
  btnRetryCamera:   document.getElementById('btn-retry-camera'),
  outputCanvas:     document.getElementById('output-canvas'),
  btnDownload:      document.getElementById('btn-download'),
  btnShare:         document.getElementById('btn-share'),
  btnRetake:        document.getElementById('btn-retake'),
  qrSlot:           document.getElementById('qr-slot'),
  galleryGrid:      document.getElementById('gallery-grid'),
  galleryEmpty:     document.getElementById('gallery-empty'),
  btnNewSession:    document.getElementById('btn-new-session'),
  screenNav:        document.getElementById('screen-nav'),
  sfxBeep:          document.getElementById('sfx-beep'),
  sfxShutter:       document.getElementById('sfx-shutter'),
};

// ---------------------------------------------------------------------------
// Static UI: filter chips & frame themes (built once)
// ---------------------------------------------------------------------------
FILTERS.forEach((f) => {
  const chip = document.createElement('button');
  chip.className = 'filter-chip';
  chip.textContent = f.label;
  chip.dataset.filter = f.id;
  chip.setAttribute('role', 'tab');
  chip.addEventListener('click', () => {
    store.state.activeFilter = f.id;
  });
  els.filterBar.appendChild(chip);
});

// Dynamic frame theme buttons
FRAME_THEMES.forEach((theme) => {
  const btn = document.createElement('button');
  btn.className = 'font-mono text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl border border-surface/10 bg-surface/5 hover:bg-surface/10 hover:border-surface/20 transition-all text-center';
  btn.dataset.theme = theme.id;
  btn.textContent = theme.label;
  btn.addEventListener('click', () => {
    store.state.frameTheme = theme.id;
  });
  els.frameThemePicker.appendChild(btn);
});

// ---------------------------------------------------------------------------
// Render — the single function that reflects store.state onto the DOM
// ---------------------------------------------------------------------------
function render() {
  const s = store.state;

  // Screens
  els.screens.forEach((section) => {
    section.classList.toggle('hidden', section.dataset.screen !== s.currentScreen);
  });
  els.screenNav.classList.toggle('hidden', s.currentScreen === 'landing');

  // Live filter preview on the video feed
  const filterClass = getFilter(s.activeFilter).cssClass;
  els.video.className = `w-full h-full object-cover mirrored ${filterClass}`;
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.filter === s.activeFilter);
  });

  // Layout buttons
  els.layoutBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.layout === s.selectedLayout);
  });

  // Highlight active theme button
  els.frameThemePicker.querySelectorAll('button').forEach((btn) => {
    const isActive = btn.dataset.theme === s.frameTheme;
    btn.classList.toggle('border-gold', isActive);
    btn.classList.toggle('text-gold', isActive);
    btn.classList.toggle('bg-surface/10', isActive);
  });

  // Shot progress dots
  els.shotProgress.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('span');
    dot.className = `shot-dot ${i < s.capturedImages.length ? 'filled' : ''}`;
    els.shotProgress.appendChild(dot);
  }

  // Capture button state
  els.btnCapture.disabled = s.isCapturing;
  els.btnCapture.textContent = s.isCapturing ? 'Session in progress…' : 'Start Session';
  els.btnCapture.classList.toggle('opacity-60', s.isCapturing);

  // Camera error panel
  els.cameraErrorPanel.classList.toggle('hidden', !s.cameraError);
  els.cameraErrorPanel.classList.toggle('flex', !!s.cameraError);
  if (s.cameraError) els.cameraErrorDetail.textContent = s.cameraError;

  // Gallery
  renderGallery(s.gallery);
}

function renderGallery(gallery) {
  els.galleryGrid.innerHTML = '';
  els.galleryEmpty.classList.toggle('hidden', gallery.length > 0);
  gallery.slice().reverse().forEach((item) => {
    const card = document.createElement('div');
    card.className = 'strip-card';
    card.innerHTML = `<img src="${item.dataUrl}" alt="Photo strip from ${item.date}" loading="lazy" />`;
    card.addEventListener('click', () => downloadDataUrl(item.dataUrl, `flashline-${item.date}.png`));
    els.galleryGrid.appendChild(card);
  });
}

// Subscribe to render
store.subscribe(render);
render();

// Reactive preview update: layout changes (selectedLayout) & frame theme changes
// immediately trigger finalizeComposite(true) for instant real-time updates.
store.subscribe((key, value, state) => {
  if (state.currentScreen === 'preview' && ['selectedLayout', 'frameTheme'].includes(key)) {
    finalizeComposite(true);
  }
});

// ---------------------------------------------------------------------------
// Camera lifecycle
// ---------------------------------------------------------------------------
async function enterCameraScreen() {
  // FIX #3 — stop any live stream BEFORE requesting a new one.
  // Covers: Back-to-booth after preview, New Session from gallery, and
  // Retry-camera after a partial error where getUserMedia succeeded but
  // a later step failed (stream would otherwise keep the camera light on).
  if (store.state.cameraStream) {
    stopCamera(store.state.cameraStream, els.video);
  }

  // FIX #4 — batch the screen transition reset so render() fires once,
  // not four times, and stale compositeImage never flashes on preview.
  store.batch((s) => {
    s.currentScreen    = 'camera';
    s.cameraError      = null;
    s.capturedImages   = [];
    s.compositeImage   = null;
    s.cameraStream     = null;  // clear stale ref immediately; updated below
    s.isCapturing      = false; // defensive: reset if previous burst was aborted
  });

  // Reset QR slot so it doesn't bleed across sessions.
  els.qrSlot.classList.add('hidden');
  els.qrSlot.innerHTML = '';

  try {
    const stream = await startCamera(els.video);
    store.state.cameraStream = stream;
  } catch (err) {
    // FIX #4 cont. — CameraError messages are already human-readable;
    // unknown errors get a safe fallback so the app never shows a raw
    // browser stack trace in the UI.
    const message = err instanceof CameraError
      ? err.message
      : 'Something went wrong starting the camera. Please try again.';
    store.state.cameraError = message;
  }
}

els.btnStart.addEventListener('click', enterCameraScreen);
els.btnRetryCamera.addEventListener('click', enterCameraScreen);

els.layoutBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    store.state.selectedLayout = btn.dataset.layout;
  });
});

// ---------------------------------------------------------------------------
// Burst capture session (4 shots, countdown between each)
// ---------------------------------------------------------------------------
els.btnCapture.addEventListener('click', runBurstSession);

async function runBurstSession() {
  // FIX #2 — double-guard: isCapturing blocks re-entry; cameraStream must
  // be live *and* have actual video dimensions before we start.
  if (store.state.isCapturing || !store.state.cameraStream) return;
  if (!els.video.videoWidth) {
    store.state.cameraError = 'Camera stream is not ready yet. Please wait a moment and try again.';
    return;
  }

  store.batch((s) => {
    s.isCapturing    = true;
    s.capturedImages = [];   // reset dots to 0 filled in one render pass
  });

  const shots = [];

  try {
    for (let i = 0; i < 4; i++) {
      // Show overlay — direct DOM is intentional here; overlay is ephemeral
      // UI state that doesn't need to survive a full render() cycle.
      els.countdownOverlay.classList.remove('hidden');
      els.countdownOverlay.classList.add('flex');

      // FIX #2 — await guarantees the shutter fires only AFTER the promise
      // resolves (including the 180 ms "0" visibility pause inside countdown).
      // No race: setInterval ticks are serialised inside the Promise chain.
      await runCountdown(
        store.state.countdownTime,
        (n) => { els.countdownNumber.textContent = n === 0 ? '📸' : String(n); },
        () => playSfx(els.sfxBeep),
        () => playSfx(els.sfxShutter)
      );

      els.countdownOverlay.classList.add('hidden');
      els.countdownOverlay.classList.remove('flex');

      shots.push(captureFrame());
      // Spread into a new array so the Proxy set() detects a reference change
      // and fires notify() → render() → repaints the progress dots.
      store.state.capturedImages = [...shots];

      if (i < 3) await wait(600);
    }
  } catch (err) {
    // FIX #3 cont. — if anything throws mid-burst (e.g. canvas OOM),
    // we still tear down the stream so the camera light goes off.
    store.state.cameraError = 'An error occurred during capture. Please try again.';
  } finally {
    // FIX #3 — capture the ref BEFORE zeroing it in state, then stop.
    // Order matters: stopCamera(null) is a no-op in camera.js but we want
    // the actual stream so the hardware light turns off correctly.
    const streamToStop = store.state.cameraStream;
    store.batch((s) => {
      s.isCapturing  = false;
      s.cameraStream = null;
    });
    stopCamera(streamToStop, els.video);
  }

  // Only finalise if all 4 shots were captured successfully.
  if (shots.length === 4) {
    await finalizeComposite();
  }
}

/**
 * FIX #1 — CAMERA MIRROR RESOLUTION
 * The live <video> feed is CSS-flipped via the `.mirrored` class
 * (transform: scaleX(-1)), but the raw MediaStream track is NOT mirrored.
 * We replicate the flip on the canvas so the exported image matches exactly
 * what the user saw on screen — no backward text or clothing.
 *
 * Implementation: translate the origin to the right edge, then scale X by -1.
 * This maps pixel (0,0) of the draw call to pixel (w,0) on the canvas,
 * effectively producing a horizontal flip with zero quality loss.
 */
function captureFrame() {
  const video  = els.video;
  const canvas = els.captureCanvas;

  // Use live dimensions; fall back only if videoWidth is genuinely 0
  // (which the videoWidth guard above already prevents in practice).
  const w = video.videoWidth  || 1280;
  const h = video.videoHeight || 960;

  canvas.width  = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/** Silently no-ops if no audio src has been provided (placeholder hooks). */
function playSfx(audioEl) {
  if (!audioEl.getAttribute('src')) return;
  audioEl.currentTime = 0;
  audioEl.play().catch(() => {});
}

// ---------------------------------------------------------------------------
// Composite export
// ---------------------------------------------------------------------------

// Guard: prevent concurrent composeLayout calls (e.g. rapid frame clicks).
let _compositeInFlight = false;

/**
 * @param {boolean} [skipNavigate=false] — true when re-rendering from preview
 *   so we don't double-save to gallery or navigate away.
 */
async function finalizeComposite(skipNavigate = false) {
  if (_compositeInFlight) return;        // drop concurrent calls
  _compositeInFlight = true;

  try {
    const dateStr      = new Date().toISOString().slice(0, 10);

    const dataUrl = await composeLayout({
      images:        store.state.capturedImages,
      layout:        store.state.selectedLayout,
      frameTheme:    store.state.frameTheme,
      filterId:      store.state.activeFilter,
      watermarkText: `FLASHLINE · ${dateStr}`,
      targetCanvas:  els.outputCanvas,
    });

    store.state.compositeImage = dataUrl;

    if (!skipNavigate) {
      saveToGallery(dataUrl, dateStr);
      store.state.currentScreen = 'preview';
    }
  } catch (err) {
    console.error('[Flashline] composeLayout failed:', err);
    // Show a non-blocking inline error instead of crashing silently.
    const msg = err?.message ?? 'Unknown render error';
    // Re-use the existing camera error panel text approach but in preview:
    const panel = document.createElement('p');
    panel.className = 'font-mono text-xs text-flash mt-2';
    panel.textContent = `⚠ Canvas render error: ${msg}`;
    els.outputCanvas.insertAdjacentElement('afterend', panel);
    setTimeout(() => panel.remove(), 5000);
  } finally {
    _compositeInFlight = false;
  }
}

els.btnDownload.addEventListener('click', () => {
  if (!store.state.compositeImage) return;
  downloadDataUrl(store.state.compositeImage, `flashline-strip-${Date.now()}.png`);
});

els.btnRetake.addEventListener('click', enterCameraScreen);

els.btnNewSession.addEventListener('click', enterCameraScreen);

document.getElementById('screen-nav').querySelector('[data-nav="gallery"]').addEventListener('click', () => {
  store.state.currentScreen = 'gallery';
});

// ---------------------------------------------------------------------------
// Share / QR — placeholder wiring point for a real cloud-upload backend.
// This demo has no server, so it "uploads" to a local Blob URL and encodes
// THAT in a QR code purely to demonstrate the flow end-to-end. Swap
// `uploadToCloud()` for a real call to S3 / Supabase Storage / Cloudinary /
// your own API to make the QR scannable from other devices.
// ---------------------------------------------------------------------------
els.btnShare.addEventListener('click', async () => {
  if (!store.state.compositeImage) return;
  els.btnShare.disabled = true;
  els.btnShare.textContent = 'Preparing…';

  try {
    const shareUrl = await uploadToCloud(store.state.compositeImage);
    renderQrPlaceholder(shareUrl);
  } finally {
    els.btnShare.disabled = false;
    els.btnShare.textContent = 'Share via QR Code';
  }
});

/** PLACEHOLDER — replace with a real upload call in production. */
async function uploadToCloud(dataUrl) {
  await wait(400); // simulate network latency
  const blob = await (await fetch(dataUrl)).blob();
  return URL.createObjectURL(blob); // local-only URL; not shareable off-device
}

function renderQrPlaceholder(url) {
  els.qrSlot.classList.remove('hidden');
  els.qrSlot.innerHTML = `
    <div class="border border-surface/15 rounded-xl p-4 text-left">
      <p class="font-mono text-[11px] uppercase tracking-widest text-gold mb-2">Demo mode</p>
      <p class="font-mono text-xs text-muted leading-relaxed">
        This build has no backend, so the link below only works on this device/tab.
        Wire <code>uploadToCloud()</code> in app.js to your storage provider to
        get a link a real QR code can point to.
      </p>
      <a href="${url}" target="_blank" class="block mt-3 text-xs font-mono text-gold underline break-all">${url}</a>
    </div>`;
}

// ---------------------------------------------------------------------------
// Gallery persistence
// ---------------------------------------------------------------------------
function loadGallery() {
  try {
    return JSON.parse(localStorage.getItem(GALLERY_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveToGallery(dataUrl, dateStr) {
  const gallery = [...store.state.gallery, { dataUrl, date: dateStr }].slice(-24); // cap history
  store.state.gallery = gallery;
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery));
  } catch {
    // Storage full or unavailable (private browsing) — non-fatal, just
    // means the session's strip won't persist across reloads.
  }
}
