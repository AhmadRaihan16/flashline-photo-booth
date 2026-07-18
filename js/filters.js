/**
 * filters.js
 * ---------------------------------------------------------------------------
 * Single source of truth for every filter: its label, the CSS class used for
 * the live <video> preview, and the equivalent canvas `ctx.filter` string
 * used when compositing the final export (canvas filters accept the same
 * syntax as CSS `filter`, so we only have to define each look once).
 */

export const FILTERS = [
  { id: 'none', label: 'Natural', cssClass: 'fx-none', canvasFilter: 'none' },
  { id: 'grayscale', label: 'Grayscale', cssClass: 'fx-grayscale', canvasFilter: 'grayscale(1) contrast(1.05)' },
  { id: 'sepia', label: 'Sepia', cssClass: 'fx-sepia', canvasFilter: 'sepia(0.75) contrast(1.05) saturate(1.2)' },
  { id: 'vintage', label: 'Vintage', cssClass: 'fx-vintage', canvasFilter: 'sepia(0.35) saturate(1.4) contrast(0.95) brightness(1.05) hue-rotate(-8deg)' },
  { id: 'cyberpunk', label: 'Cyberpunk', cssClass: 'fx-cyberpunk', canvasFilter: 'saturate(1.8) contrast(1.25) hue-rotate(280deg) brightness(0.95)' },
  { id: 'noir', label: 'High-Contrast B&W', cssClass: 'fx-noir', canvasFilter: 'grayscale(1) contrast(1.6) brightness(0.95)' },
];

export function getFilter(id) {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}
