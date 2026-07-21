/**
 * canvasEngine.js
 * ---------------------------------------------------------------------------
 * Compiles 4 captured frames into a single PNG composite using pure HTML5
 * Canvas drawing APIs (shapes, gradients, paths, and text).
 * Supports two dynamic illustrated themes:
 * - 'retro-glitter-pink': Pastel pink gradient, gold/silver stars, metallic top clip,
 *   and custom typography.
 * - 'toy-sky-adventure': Sky blue background, fluffy clouds, robotic crane claw,
 *   geometric block ornaments, and a thick blocky text logo.
 */

import { getFilter } from './filters.js';

// ---------------------------------------------------------------------------
// Illustrated Helpers
// ---------------------------------------------------------------------------

/**
 * Draws a multi-spiked star shape.
 */
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a fluffy cloud shape using overlapping circles.
 */
function drawCloud(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  // Add subtle shadow to the clouds
  ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.arc(x + size * 0.6, y - size * 0.2, size * 0.8, 0, Math.PI * 2);
  ctx.arc(x + size * 1.2, y, size * 0.7, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y + size * 0.3, size * 0.7, 0, Math.PI * 2);
  ctx.arc(x + size * 0.9, y + size * 0.3, size * 0.6, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a metallic binder clip at the top center.
 */
function drawMetallicClip(ctx, x, y) {
  ctx.save();
  // Clip body
  const grad = ctx.createLinearGradient(x - 20, y, x + 20, y);
  grad.addColorStop(0, '#7f8c8d');
  grad.addColorStop(0.3, '#bdc3c7');
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(0.7, '#bdc3c7');
  grad.addColorStop(1, '#7f8c8d');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x - 20, y, 40, 25, 4);
  ctx.fill();

  // Draw wire loop
  ctx.strokeStyle = '#95a5a6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y - 8, 12, Math.PI, 0, false);
  ctx.lineTo(x + 12, y);
  ctx.moveTo(x - 12, y - 8);
  ctx.lineTo(x - 12, y);
  ctx.stroke();

  // Clip shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(x - 18, y + 25, 36, 4);
  ctx.restore();
}

/**
 * Draws a toy claw bracket hanging down from the top edge.
 */
function drawToyClaw(ctx, x, y) {
  ctx.save();
  // Draw the drop wire/cable
  ctx.strokeStyle = '#7f8c8d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, y - 20);
  ctx.stroke();

  // Claw bracket joint
  const jointGrad = ctx.createRadialGradient(x, y - 20, 2, x, y - 20, 10);
  jointGrad.addColorStop(0, '#f1c40f');
  jointGrad.addColorStop(1, '#d35400');
  ctx.fillStyle = jointGrad;
  ctx.beginPath();
  ctx.arc(x, y - 20, 10, 0, Math.PI * 2);
  ctx.fill();

  // Left claw arm
  ctx.strokeStyle = '#bdc3c7';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x - 15, y - 10, 15, Math.PI * 1.2, Math.PI * 0.5, true);
  ctx.stroke();

  // Right claw arm
  ctx.beginPath();
  ctx.arc(x + 15, y - 10, 15, Math.PI * 1.8, Math.PI * 0.5, false);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param {object}  opts
 * @param {string[]} opts.images        4 dataURLs (raw captured frames)
 * @param {'strip'|'grid'} opts.layout
 * @param {string}  opts.frameTheme     theme id (retro-glitter-pink, toy-sky-adventure)
 * @param {string}  opts.filterId       filter id from filters.js
 * @param {string}  opts.watermarkText  e.g. "FLASHLINE · JUL 20 2026"
 * @param {HTMLCanvasElement} opts.targetCanvas
 * @returns {Promise<string>} dataURL of the finished composite (image/png)
 */
export async function composeLayout({ images, layout, frameTheme, filterId, watermarkText, targetCanvas }) {
  const loaded = await Promise.all(images.map(loadImage));
  const filter = getFilter(filterId);

  // Default to retro-glitter-pink if undefined
  const theme = frameTheme === 'toy-sky-adventure' ? 'toy-sky-adventure' : 'retro-glitter-pink';

  return layout === 'grid'
    ? renderGrid(loaded, { theme, filter, watermarkText, targetCanvas })
    : renderStrip(loaded, { theme, filter, watermarkText, targetCanvas });
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderStrip(images, { theme, filter, watermarkText, targetCanvas }) {
  // Standardised high-res strip dimensions: 400 width, 1200 height.
  const width = 400;
  const height = 1200;

  const canvas = targetCanvas;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Step 1: Draw the base background layer
  if (theme === 'retro-glitter-pink') {
    // Pastel Pink Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#FFD1DC');
    bgGrad.addColorStop(0.5, '#FFA6C9');
    bgGrad.addColorStop(1, '#FF85A1');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Dynamic background stars (underneath photos)
    drawStar(ctx, 40, 200, 4, 15, 6, 'rgba(255, 255, 255, 0.3)');
    drawStar(ctx, 360, 500, 4, 12, 5, 'rgba(255, 255, 255, 0.3)');
    drawStar(ctx, 35, 800, 4, 18, 7, 'rgba(255, 255, 255, 0.3)');
  } else {
    // Sky Blue Background with Clouds
    ctx.fillStyle = '#4AA6FF';
    ctx.fillRect(0, 0, width, height);

    // Draw clouds on the background
    drawCloud(ctx, -20, 150, 40);
    drawCloud(ctx, 240, 320, 50);
    drawCloud(ctx, 50, 680, 45);
    drawCloud(ctx, 220, 920, 55);
  }

  // Step 2: Calculate symmetrical photo slots
  const padX = 32;
  const slotW = width - padX * 2; // 336px
  const slotH = 210;
  const gap = 24;
  const topPad = 110;

  const slots = [];
  for (let i = 0; i < 4; i++) {
    slots.push({
      x: padX,
      y: topPad + i * (slotH + gap),
      w: slotW,
      h: slotH
    });
  }

  // Draw photos cover-cropped inside slots
  images.forEach((img, i) => {
    const slot = slots[i];
    ctx.save();
    ctx.filter = filter.canvasFilter;
    drawCover(ctx, img, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  });

  // Step 3: Draw dynamic top-layer illustrated ornaments (ON TOP of photos)
  if (theme === 'retro-glitter-pink') {
    // Draw white photo frame borders
    slots.forEach((slot) => {
      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    });

    // Glittery Header & Footer Stars (Gold and Silver)
    drawStar(ctx, 60, 45, 5, 20, 8, '#FFD700'); // Gold
    drawStar(ctx, 330, 65, 4, 16, 6, '#E6E6FA'); // Silver
    drawStar(ctx, 100, 90, 4, 10, 4, '#FFD700');

    drawStar(ctx, 80, 1080, 5, 18, 7, '#FFD700');
    drawStar(ctx, 310, 1050, 5, 22, 9, '#E6E6FA');
    drawStar(ctx, 320, 1110, 4, 12, 5, '#FFD700');

    // Metallic clip at top center
    drawMetallicClip(ctx, width / 2, 20);

    // Custom Typography
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Subtitle
    ctx.font = 'bold 18px "Space Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('★ ME & MY FRIENDS ★', width / 2, 1010);

    // Main header
    ctx.font = 'bold 36px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#D81B60';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.strokeText('PARTY TIME', width / 2, 1050);
    ctx.fillText('PARTY TIME', width / 2, 1050);
    ctx.restore();

  } else {
    // toy-sky-adventure
    // Draw yellow photo borders with red offset drop lines
    slots.forEach((slot) => {
      ctx.save();
      // Red offset line
      ctx.strokeStyle = '#FF3333';
      ctx.lineWidth = 4;
      ctx.strokeRect(slot.x + 3, slot.y + 3, slot.w, slot.h);

      // Yellow primary border
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 4;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    });

    // Robotic claw/crane coming down
    drawToyClaw(ctx, width / 2, 85);

    // Playful geometric blocks flanking margins
    ctx.save();
    const drawBlock = (bx, by, label, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, 18, 18);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, 18, 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + 9, by + 9);
    };

    drawBlock(8, 380, 'A', '#FF3333');
    drawBlock(374, 580, 'B', '#33FF33');
    drawBlock(8, 780, 'C', '#3333FF');

    // Sheriff badges (stars)
    drawStar(ctx, 16, 260, 5, 8, 3.5, '#FFD700');
    drawStar(ctx, 384, 860, 5, 8, 3.5, '#FFD700');
    ctx.restore();

    // Stylized Toy Booth Logo at bottom
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Black drop shadow
    ctx.font = 'bold 44px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#16151A';
    ctx.fillText('TOY BOOTH', width / 2 + 4, 1054);

    // Thick Red front text with Yellow borders
    ctx.fillStyle = '#FF3333';
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeText('TOY BOOTH', width / 2, 1050);
    ctx.fillText('TOY BOOTH', width / 2, 1050);
    ctx.restore();
  }

  // Common simple watermark
  ctx.save();
  ctx.font = 'bold 12px "Space Mono", monospace';
  ctx.fillStyle = theme === 'retro-glitter-pink' ? 'rgba(255, 255, 255, 0.7)' : '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(watermarkText, width / 2, height - 40);
  ctx.restore();

  return canvas.toDataURL('image/png', 1.0);
}

function renderGrid(images, { theme, filter, watermarkText, targetCanvas }) {
  // Standardised Grid dimensions: 600 width, 800 height.
  const width = 600;
  const height = 800;

  const canvas = targetCanvas;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Step 1: Draw background
  if (theme === 'retro-glitter-pink') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#FFD1DC');
    bgGrad.addColorStop(1, '#FF85A1');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawStar(ctx, 50, 150, 4, 15, 6, 'rgba(255, 255, 255, 0.3)');
    drawStar(ctx, 550, 450, 4, 12, 5, 'rgba(255, 255, 255, 0.3)');
  } else {
    ctx.fillStyle = '#4AA6FF';
    ctx.fillRect(0, 0, width, height);

    drawCloud(ctx, 40, 120, 50);
    drawCloud(ctx, 480, 360, 60);
  }

  // Step 2: Slot layout
  const slotW = 240;
  const slotH = 240;
  const padX = 40;
  const padY = 140;
  const gapX = 40;
  const gapY = 40;

  const slots = [
    { x: padX, y: padY, w: slotW, h: slotH },
    { x: padX + slotW + gapX, y: padY, w: slotW, h: slotH },
    { x: padX, y: padY + slotH + gapY, w: slotW, h: slotH },
    { x: padX + slotW + gapX, y: padY + slotH + gapY, w: slotW, h: slotH }
  ];

  // Draw photos cover-cropped
  images.forEach((img, i) => {
    const slot = slots[i];
    ctx.save();
    ctx.filter = filter.canvasFilter;
    drawCover(ctx, img, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  });

  // Step 3: Draw illustrated ornaments
  if (theme === 'retro-glitter-pink') {
    slots.forEach((slot) => {
      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    });

    drawStar(ctx, 80, 50, 5, 22, 9, '#FFD700');
    drawStar(ctx, 520, 70, 4, 16, 6, '#E6E6FA');
    drawMetallicClip(ctx, width / 2, 20);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 36px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#D81B60';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.strokeText('PARTY TIME', width / 2, 700);
    ctx.fillText('PARTY TIME', width / 2, 700);
    ctx.restore();
  } else {
    slots.forEach((slot) => {
      ctx.save();
      ctx.strokeStyle = '#FF3333';
      ctx.lineWidth = 4;
      ctx.strokeRect(slot.x + 3, slot.y + 3, slot.w, slot.h);

      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 4;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    });

    drawToyClaw(ctx, width / 2, 85);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#16151A';
    ctx.fillText('TOY BOOTH', width / 2 + 4, 704);

    ctx.fillStyle = '#FF3333';
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeText('TOY BOOTH', width / 2, 700);
    ctx.fillText('TOY BOOTH', width / 2, 700);
    ctx.restore();
  }

  ctx.save();
  ctx.font = 'bold 12px "Space Mono", monospace';
  ctx.fillStyle = theme === 'retro-glitter-pink' ? 'rgba(255, 255, 255, 0.7)' : '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(watermarkText, width / 2, height - 40);
  ctx.restore();

  return canvas.toDataURL('image/png', 1.0);
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${String(src).slice(0, 80)} (${e.type})`));
    img.src = src;
  });
}

function drawCover(ctx, img, dx, dy, dw, dh) {
  const imgRatio = img.width / img.height;
  const boxRatio = dw / dh;
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

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Triggers a browser download of a dataURL without opening a new tab. */
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href     = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
