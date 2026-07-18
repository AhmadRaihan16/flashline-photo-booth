/**
 * canvasEngine.js
 * ---------------------------------------------------------------------------
 * Takes 4 captured frames (as HTMLImageElement-ready dataURLs) and compiles
 * them into a single high-resolution composite: either a classic vertical
 * 4-strip or a 2x2 grid, with a colored frame, perforated "sprocket" edge
 * on the strip layout, and a watermark/date stamp along the bottom.
 */

import { getFilter } from './filters.js';

const EXPORT_SCALE = 2; // renders at 2x for crisp downloads on retina screens

/**
 * @param {object} opts
 * @param {string[]} opts.images       4 dataURLs (raw, unfiltered captures)
 * @param {'strip'|'grid'} opts.layout
 * @param {string} opts.frameColor     hex color for the frame/background (classic mode)
 * @param {string} opts.filterId       filter id from filters.js, baked in at export time
 * @param {string} opts.watermarkText  e.g. "FLASHLINE · JUL 18 2026"
 * @param {HTMLCanvasElement} opts.targetCanvas  canvas to draw the result into
 * @param {object|null} opts.framePreset  FRAME_PRESETS entry, or null for classic mode
 * @returns {Promise<string>} dataURL of the finished composite (image/png)
 */
export async function composeLayout({ images, layout, frameColor, filterId, watermarkText, targetCanvas, framePreset = null }) {
  const loaded = await Promise.all(images.map(loadImage));
  const filter = getFilter(filterId);

  // PNG overlay mode: ignore layout/color, use preset slot coordinates
  if (framePreset) {
    return renderPreset(loaded, { framePreset, filter, targetCanvas });
  }

  return layout === 'grid'
    ? renderGrid(loaded, { frameColor, filter, watermarkText, targetCanvas })
    : renderStrip(loaded, { frameColor, filter, watermarkText, targetCanvas });
}

/**
 * Renders the PNG-overlay composite:
 *   1. Size canvas to match the frame PNG exactly.
 *   2. Fill with black (shows through if a slot coord is wrong).
 *   3. Draw each captured photo into its declared slot rect (cover-fit + filter).
 *   4. Load the frame PNG asynchronously, then draw it on top at full canvas size.
 *   5. Return the dataURL — only called after the overlay image has fully loaded.
 */
async function renderPreset(images, { framePreset, filter, targetCanvas }) {
  const { canvasW, canvasH, slots, src } = framePreset;

  const canvas = targetCanvas;
  canvas.width  = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // Dark base so unoccupied canvas area is black, not white
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Draw photos into their slots (with filter, cover-cropped)
  images.forEach((img, i) => {
    const slot = slots[i];
    if (!slot) return;
    ctx.save();
    ctx.filter = filter.canvasFilter;
    drawCover(ctx, img, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  });

  // Load + overlay the PNG frame ON TOP of the photos.
  // Awaiting here is critical: toDataURL must not run until this resolves.
  const frameImg = await loadImage(src);
  ctx.drawImage(frameImg, 0, 0, canvasW, canvasH);

  return canvas.toDataURL('image/png', 1.0);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Cover-fit draw: fills the target box, cropping overflow, no distortion. */
function drawCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;

  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function renderStrip(images, { frameColor, filter, watermarkText, targetCanvas }) {
  const cellW = 420 * EXPORT_SCALE;
  const cellH = 300 * EXPORT_SCALE;
  const pad = 18 * EXPORT_SCALE;
  const footer = 70 * EXPORT_SCALE;
  const width = cellW + pad * 2;
  const height = pad + (cellH + pad) * images.length + footer;

  const canvas = targetCanvas;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Frame background
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, width, height);

  // Sprocket holes down both edges (signature photobooth-strip detail)
  drawSprocketEdge(ctx, width, height, pad);

  images.forEach((img, i) => {
    const y = pad + i * (cellH + pad);
    ctx.save();
    ctx.filter = filter.canvasFilter;
    drawCover(ctx, img, pad, y, cellW, cellH);
    ctx.restore();
    // thin inner border per frame
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, y, cellW, cellH);
  });

  drawWatermark(ctx, width, height, footer, watermarkText);

  return canvas.toDataURL('image/png', 1.0);
}

function renderGrid(images, { frameColor, filter, watermarkText, targetCanvas }) {
  const cellW = 340 * EXPORT_SCALE;
  const cellH = 255 * EXPORT_SCALE;
  const gap = 14 * EXPORT_SCALE;
  const pad = 20 * EXPORT_SCALE;
  const footer = 60 * EXPORT_SCALE;
  const width = cellW * 2 + gap + pad * 2;
  const height = cellH * 2 + gap + pad * 2 + footer;

  const canvas = targetCanvas;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, width, height);

  const positions = [
    [pad, pad],
    [pad + cellW + gap, pad],
    [pad, pad + cellH + gap],
    [pad + cellW + gap, pad + cellH + gap],
  ];

  images.forEach((img, i) => {
    const [x, y] = positions[i];
    ctx.save();
    ctx.filter = filter.canvasFilter;
    drawCover(ctx, img, x, y, cellW, cellH);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cellW, cellH);
  });

  drawWatermark(ctx, width, height, footer, watermarkText);

  return canvas.toDataURL('image/png', 1.0);
}

function drawSprocketEdge(ctx, width, height, pad) {
  const holeR = 3 * EXPORT_SCALE;
  const step = 22 * EXPORT_SCALE;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = step; y < height - step; y += step) {
    ctx.beginPath();
    ctx.arc(pad / 2, y, holeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width - pad / 2, y, holeR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWatermark(ctx, width, height, footer, text) {
  const y = height - footer / 2;
  ctx.font = `${16 * EXPORT_SCALE}px "Space Mono", monospace`;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, y);
}

/** Triggers a browser download of a dataURL without opening a new tab. */
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
