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

/**
 * Draws a royal crown (Queen theme).
 */
function drawCrown(ctx, cx, cy, size, mainColor, gemColor) {
  ctx.save();
  ctx.fillStyle = mainColor;
  // Spike silhouette
  ctx.beginPath();
  ctx.moveTo(cx - size,        cy);
  ctx.lineTo(cx - size * 0.72, cy - size * 0.9);
  ctx.lineTo(cx - size * 0.38, cy - size * 0.42);
  ctx.lineTo(cx,               cy - size * 1.15);
  ctx.lineTo(cx + size * 0.38, cy - size * 0.42);
  ctx.lineTo(cx + size * 0.72, cy - size * 0.9);
  ctx.lineTo(cx + size,        cy);
  ctx.closePath();
  ctx.fill();
  // Base band
  ctx.fillRect(cx - size, cy, size * 2, size * 0.52);
  // Dark outline
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - size,        cy);
  ctx.lineTo(cx - size * 0.72, cy - size * 0.9);
  ctx.lineTo(cx - size * 0.38, cy - size * 0.42);
  ctx.lineTo(cx,               cy - size * 1.15);
  ctx.lineTo(cx + size * 0.38, cy - size * 0.42);
  ctx.lineTo(cx + size * 0.72, cy - size * 0.9);
  ctx.lineTo(cx + size,        cy);
  ctx.stroke();
  // Gems
  [cx - size * 0.55, cx, cx + size * 0.55].forEach(gx => {
    ctx.beginPath();
    ctx.arc(gx, cy + size * 0.2, size * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = gemColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Draws a lightning bolt (Queen theme).
 */
function drawLightning(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.55, y);
  ctx.lineTo(x + w * 0.1,  y + h * 0.48);
  ctx.lineTo(x + w * 0.45, y + h * 0.48);
  ctx.lineTo(x - w * 0.05, y + h);
  ctx.lineTo(x + w * 0.9,  y + h * 0.52);
  ctx.lineTo(x + w * 0.55, y + h * 0.52);
  ctx.lineTo(x + w,        y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a soft bokeh glow circle (LANY neon theme).
 */
function drawBokeh(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0,   color);
  g.addColorStop(0.5, color + '80');
  g.addColorStop(1,   'transparent');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Draws a batik-inspired nested diamond (Band Perunggu theme).
 */
function drawBatikDiamond(ctx, cx, cy, size, strokeColor, fillColor) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx,               cy - size);
  ctx.lineTo(cx + size * 0.58, cy);
  ctx.lineTo(cx,               cy + size);
  ctx.lineTo(cx - size * 0.58, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Inner solid diamond
  ctx.fillStyle = strokeColor;
  ctx.beginPath();
  ctx.moveTo(cx,               cy - size * 0.44);
  ctx.lineTo(cx + size * 0.26, cy);
  ctx.lineTo(cx,               cy + size * 0.44);
  ctx.lineTo(cx - size * 0.26, cy);
  ctx.closePath();
  ctx.fill();
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

  const VALID = ['retro-glitter-pink', 'toy-sky-adventure', 'band-perunggu', 'queen-rock', 'lany-neon'];
  const theme = VALID.includes(frameTheme) ? frameTheme : 'retro-glitter-pink';

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
  } else if (theme === 'toy-sky-adventure') {
    ctx.fillStyle = '#4AA6FF';
    ctx.fillRect(0, 0, width, height);
    drawCloud(ctx, -20, 150, 40);
    drawCloud(ctx, 240, 320, 50);
    drawCloud(ctx, 50, 680, 45);
    drawCloud(ctx, 220, 920, 55);

  } else if (theme === 'band-perunggu') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0,    '#1A0E08');
    bgGrad.addColorStop(0.35, '#3D2010');
    bgGrad.addColorStop(0.65, '#5C3317');
    bgGrad.addColorStop(1,    '#3D2010');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    for (let gy = 100; gy < height - 100; gy += 60)
      for (let gx = 20; gx <= width; gx += 50)
        drawBatikDiamond(ctx, gx, gy, 8, 'rgba(205,127,50,0.15)', 'rgba(139,69,19,0.07)');

  } else if (theme === 'queen-rock') {
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.strokeStyle = 'rgba(184,134,11,0.06)';
    ctx.lineWidth = 1;
    for (let i = -height; i < width + height; i += 28) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke();
    }
    ctx.restore();

  } else if (theme === 'lany-neon') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0,   '#060612');
    bgGrad.addColorStop(0.5, '#0D0720');
    bgGrad.addColorStop(1,   '#060612');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    drawBokeh(ctx, 30,  180, 55, '#FF2D55', 0.08);
    drawBokeh(ctx, 370, 350, 45, '#7B2FFF', 0.07);
    drawBokeh(ctx, 50,  650, 50, '#00D4FF', 0.07);
    drawBokeh(ctx, 360, 900, 60, '#FF2D55', 0.06);
    drawBokeh(ctx, 200, 500, 38, '#7B2FFF', 0.05);
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

  } else if (theme === 'toy-sky-adventure') {
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
    drawStar(ctx, 16, 260, 5, 8, 3.5, '#FFD700');
    drawStar(ctx, 384, 860, 5, 8, 3.5, '#FFD700');
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#16151A';
    ctx.fillText('TOY BOOTH', width / 2 + 4, 1054);
    ctx.fillStyle = '#FF3333';
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeText('TOY BOOTH', width / 2, 1050);
    ctx.fillText('TOY BOOTH', width / 2, 1050);
    ctx.restore();

  } else if (theme === 'band-perunggu') {
    // Copper double border + batik corner diamonds
    slots.forEach(slot => {
      ctx.save();
      ctx.strokeStyle = '#B87333';
      ctx.lineWidth = 6;
      ctx.strokeRect(slot.x - 3, slot.y - 3, slot.w + 6, slot.h + 6);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2);
      [[slot.x, slot.y], [slot.x + slot.w, slot.y], [slot.x, slot.y + slot.h], [slot.x + slot.w, slot.y + slot.h]].forEach(([cx, cy]) => {
        drawBatikDiamond(ctx, cx, cy, 9, '#FFD700', '#B87333');
      });
      ctx.restore();
    });
    for (let dy = 120; dy < height - 120; dy += 80) {
      drawBatikDiamond(ctx, 12,          dy, 7, '#FFD700', '#B87333');
      drawBatikDiamond(ctx, width - 12,  dy, 7, '#FFD700', '#B87333');
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#3D1A08';
    ctx.fillText('PERUNGGU', width / 2 + 2, 54);
    const pGrad = ctx.createLinearGradient(width / 2 - 85, 0, width / 2 + 85, 0);
    pGrad.addColorStop(0,   '#B87333');
    pGrad.addColorStop(0.5, '#FFD700');
    pGrad.addColorStop(1,   '#B87333');
    ctx.fillStyle = pGrad;
    ctx.fillText('PERUNGGU', width / 2, 52);
    ctx.font = '11px "Space Mono", monospace';
    ctx.fillStyle = '#CD7F32';
    ctx.fillText('★  BERSAMA SELAMANYA  ★', width / 2, 78);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const btGrad = ctx.createLinearGradient(width / 2 - 75, 0, width / 2 + 75, 0);
    btGrad.addColorStop(0,   '#B87333');
    btGrad.addColorStop(0.5, '#FFD700');
    btGrad.addColorStop(1,   '#B87333');
    ctx.fillStyle = btGrad;
    ctx.font = 'bold 13px "Space Mono", monospace';
    ctx.fillText('✦ KENANGAN ABADI ✦', width / 2, 1078);
    ctx.restore();

  } else if (theme === 'queen-rock') {
    // Gold double border + ornate L-corner brackets
    slots.forEach(slot => {
      ctx.save();
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 5;
      ctx.strokeRect(slot.x - 4, slot.y - 4, slot.w + 8, slot.h + 8);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      const cLen = 14;
      [[slot.x, slot.y, 1, 1], [slot.x + slot.w, slot.y, -1, 1],
       [slot.x, slot.y + slot.h, 1, -1], [slot.x + slot.w, slot.y + slot.h, -1, -1]
      ].forEach(([cx, cy, sx, sy]) => {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + sx * cLen, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * cLen);
        ctx.stroke();
      });
      ctx.restore();
    });
    drawCrown(ctx, width / 2, 14, 30, '#FFD700', '#DC143C');
    drawLightning(ctx, 8,   290, 16, 28, '#FFD700');
    drawLightning(ctx, 376, 580, 16, 28, '#DC143C');
    drawLightning(ctx, 8,   790, 16, 28, '#DC143C');
    drawLightning(ctx, 376, 980, 16, 28, '#FFD700');
    drawStar(ctx, 18,  160, 5, 7, 3,   '#FFD700');
    drawStar(ctx, 382, 430, 5, 6, 2.5, '#DC143C');
    drawStar(ctx, 20,  660, 5, 5, 2,   '#FFD700');
    drawStar(ctx, 380, 860, 5, 7, 3,   '#DC143C');
    ctx.save();
    ctx.strokeStyle = '#DC143C';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, 100); ctx.lineTo(width - 30, 100); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, 1085); ctx.lineTo(width - 30, 1085); ctx.stroke();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, 104); ctx.lineTo(width - 30, 104); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, 1081); ctx.lineTo(width - 30, 1081); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 50px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#4A0000';
    ctx.fillText('QUEEN', width / 2 + 3, 73);
    const qGrad = ctx.createLinearGradient(width / 2 - 65, 0, width / 2 + 65, 0);
    qGrad.addColorStop(0,   '#B8860B');
    qGrad.addColorStop(0.5, '#FFD700');
    qGrad.addColorStop(1,   '#B8860B');
    ctx.fillStyle = qGrad;
    ctx.fillText('QUEEN', width / 2, 70);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px "Space Mono", monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('WE ARE THE CHAMPIONS', width / 2, 1060);
    ctx.font = '10px "Space Mono", monospace';
    ctx.fillStyle = '#B8860B';
    ctx.fillText('★  ★  ★', width / 2, 1080);
    ctx.restore();

  } else if (theme === 'lany-neon') {
    // Neon-glow photo borders
    slots.forEach(slot => {
      ctx.save();
      ctx.shadowColor = '#FF2D55';
      ctx.shadowBlur  = 18;
      ctx.strokeStyle = '#FF2D55';
      ctx.lineWidth   = 2.5;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = 'rgba(0,212,255,0.4)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(slot.x + 3, slot.y + 3, slot.w - 6, slot.h - 6);
      ctx.restore();
    });
    drawBokeh(ctx, 385, 155, 35, '#FF2D55', 0.14);
    drawBokeh(ctx, 12,  310, 28, '#00D4FF', 0.12);
    drawBokeh(ctx, 390, 710, 32, '#7B2FFF', 0.12);
    drawBokeh(ctx, 8,   960, 25, '#FF2D55', 0.10);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 58px "Bebas Neue", sans-serif';
    ctx.shadowColor = '#FF2D55';
    ctx.shadowBlur  = 30;
    ctx.fillStyle   = '#FF2D55';
    ctx.fillText('LANY', width / 2, 56);
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = '#FFFFFF';
    ctx.fillText('LANY', width / 2, 56);
    ctx.shadowBlur  = 0;
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '11px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(0,212,255,0.75)';
    ctx.fillText('los angeles → new york', width / 2, 82);
    ctx.restore();
    ctx.save();
    ['#FF2D55','#7B2FFF','#00D4FF','#7B2FFF','#FF2D55'].forEach((c, i) => {
      ctx.shadowColor = c; ctx.shadowBlur = 8;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(width / 2 - 32 + i * 16, 1075, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px "Space Mono", monospace';
    ctx.shadowColor = '#00D4FF'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#00D4FF';
    ctx.fillText('STAY', width / 2, 1055);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Common simple watermark
  ctx.save();
  ctx.font = 'bold 12px "Space Mono", monospace';
  ctx.fillStyle = ({ 'retro-glitter-pink': 'rgba(255,255,255,0.7)', 'band-perunggu': 'rgba(205,127,50,0.85)', 'queen-rock': '#FFD700', 'lany-neon': 'rgba(0,212,255,0.85)' })[theme] ?? '#FFFFFF';
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
  } else if (theme === 'toy-sky-adventure') {
    ctx.fillStyle = '#4AA6FF';
    ctx.fillRect(0, 0, width, height);
    drawCloud(ctx, 40, 120, 50);
    drawCloud(ctx, 480, 360, 60);

  } else if (theme === 'band-perunggu') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0,   '#1A0E08');
    bgGrad.addColorStop(0.5, '#5C3317');
    bgGrad.addColorStop(1,   '#1A0E08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    for (let gy = 100; gy < height - 60; gy += 55)
      for (let gx = 20; gx <= width; gx += 45)
        drawBatikDiamond(ctx, gx, gy, 7, 'rgba(205,127,50,0.15)', 'rgba(139,69,19,0.07)');

  } else if (theme === 'queen-rock') {
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.strokeStyle = 'rgba(184,134,11,0.06)';
    ctx.lineWidth = 1;
    for (let i = -height; i < width + height; i += 28) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke();
    }
    ctx.restore();

  } else if (theme === 'lany-neon') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0,   '#060612');
    bgGrad.addColorStop(0.5, '#0D0720');
    bgGrad.addColorStop(1,   '#060612');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    drawBokeh(ctx, 50,  180, 60, '#FF2D55', 0.08);
    drawBokeh(ctx, 520, 350, 50, '#7B2FFF', 0.07);
    drawBokeh(ctx, 80,  580, 55, '#00D4FF', 0.07);
    drawBokeh(ctx, 480, 620, 45, '#FF2D55', 0.06);
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
  } else if (theme === 'toy-sky-adventure') {
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

  } else if (theme === 'band-perunggu') {
    slots.forEach(slot => {
      ctx.save();
      ctx.strokeStyle = '#B87333';
      ctx.lineWidth = 6;
      ctx.strokeRect(slot.x - 3, slot.y - 3, slot.w + 6, slot.h + 6);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2);
      [[slot.x, slot.y], [slot.x + slot.w, slot.y], [slot.x, slot.y + slot.h], [slot.x + slot.w, slot.y + slot.h]].forEach(([cx, cy]) => {
        drawBatikDiamond(ctx, cx, cy, 9, '#FFD700', '#B87333');
      });
      ctx.restore();
    });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#3D1A08';
    ctx.fillText('PERUNGGU', width / 2 + 2, 84);
    const gpGrad = ctx.createLinearGradient(width / 2 - 90, 0, width / 2 + 90, 0);
    gpGrad.addColorStop(0,   '#B87333');
    gpGrad.addColorStop(0.5, '#FFD700');
    gpGrad.addColorStop(1,   '#B87333');
    ctx.fillStyle = gpGrad;
    ctx.fillText('PERUNGGU', width / 2, 82);
    ctx.font = '11px "Space Mono", monospace';
    ctx.fillStyle = '#CD7F32';
    ctx.fillText('★  BERSAMA SELAMANYA  ★', width / 2, 106);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Space Mono", monospace';
    const gbtGrad = ctx.createLinearGradient(width / 2 - 75, 0, width / 2 + 75, 0);
    gbtGrad.addColorStop(0,   '#B87333');
    gbtGrad.addColorStop(0.5, '#FFD700');
    gbtGrad.addColorStop(1,   '#B87333');
    ctx.fillStyle = gbtGrad;
    ctx.fillText('✦ KENANGAN ABADI ✦', width / 2, 720);
    ctx.restore();

  } else if (theme === 'queen-rock') {
    slots.forEach(slot => {
      ctx.save();
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 5;
      ctx.strokeRect(slot.x - 4, slot.y - 4, slot.w + 8, slot.h + 8);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      const cLen = 14;
      [[slot.x, slot.y, 1, 1], [slot.x + slot.w, slot.y, -1, 1],
       [slot.x, slot.y + slot.h, 1, -1], [slot.x + slot.w, slot.y + slot.h, -1, -1]
      ].forEach(([cx, cy, sx, sy]) => {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + sx * cLen, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * cLen);
        ctx.stroke();
      });
      ctx.restore();
    });
    drawCrown(ctx, width / 2, 14, 32, '#FFD700', '#DC143C');
    drawStar(ctx,  60, 80, 5, 8, 3, '#FFD700');
    drawStar(ctx, 540, 80, 5, 8, 3, '#DC143C');
    drawLightning(ctx, 14,  280, 16, 28, '#FFD700');
    drawLightning(ctx, 570, 480, 16, 28, '#DC143C');
    ctx.save();
    ctx.strokeStyle = '#DC143C';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(40, 120); ctx.lineTo(width - 40, 120); ctx.stroke();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 124); ctx.lineTo(width - 40, 124); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 54px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#4A0000';
    ctx.fillText('QUEEN', width / 2 + 3, 85);
    const gqGrad = ctx.createLinearGradient(width / 2 - 70, 0, width / 2 + 70, 0);
    gqGrad.addColorStop(0,   '#B8860B');
    gqGrad.addColorStop(0.5, '#FFD700');
    gqGrad.addColorStop(1,   '#B8860B');
    ctx.fillStyle = gqGrad;
    ctx.fillText('QUEEN', width / 2, 82);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "Space Mono", monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('WE ARE THE CHAMPIONS', width / 2, 720);
    ctx.restore();

  } else if (theme === 'lany-neon') {
    slots.forEach(slot => {
      ctx.save();
      ctx.shadowColor = '#FF2D55'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#FF2D55'; ctx.lineWidth = 2.5;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = 'rgba(0,212,255,0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(slot.x + 3, slot.y + 3, slot.w - 6, slot.h - 6);
      ctx.restore();
    });
    drawBokeh(ctx, 555, 180, 40, '#FF2D55', 0.13);
    drawBokeh(ctx, 20,  350, 35, '#00D4FF', 0.11);
    drawBokeh(ctx, 540, 580, 38, '#7B2FFF', 0.11);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 60px "Bebas Neue", sans-serif';
    ctx.shadowColor = '#FF2D55'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#FF2D55';
    ctx.fillText('LANY', width / 2, 72);
    ctx.shadowBlur = 8; ctx.fillStyle = '#FFFFFF';
    ctx.fillText('LANY', width / 2, 72);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '11px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(0,212,255,0.75)';
    ctx.fillText('los angeles → new york', width / 2, 100);
    ctx.restore();
    ctx.save();
    ['#FF2D55','#7B2FFF','#00D4FF','#7B2FFF','#FF2D55'].forEach((c, i) => {
      ctx.shadowColor = c; ctx.shadowBlur = 8; ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(width / 2 - 32 + i * 16, 726, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Space Mono", monospace';
    ctx.shadowColor = '#00D4FF'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#00D4FF';
    ctx.fillText('STAY', width / 2, 710);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  ctx.save();
  ctx.font = 'bold 12px "Space Mono", monospace';
  ctx.fillStyle = ({ 'retro-glitter-pink': 'rgba(255,255,255,0.7)', 'band-perunggu': 'rgba(205,127,50,0.85)', 'queen-rock': '#FFD700', 'lany-neon': 'rgba(0,212,255,0.85)' })[theme] ?? '#FFFFFF';
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
