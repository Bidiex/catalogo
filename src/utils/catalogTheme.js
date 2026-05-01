/**
 * Catalog Theme Utility
 * Generates CSS variables based on background color luminance for WCAG compliance.
 */

/**
 * Calculates the relative luminance of a hex color (WCAG 2.1)
 * @param {string} hex 
 * @returns {number} 0 (darkest) to 1 (lightest)
 */
export function getRelativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const [rl, gl, bl] = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * Lightens a hex color
 * @param {string} hex 
 * @param {number} amount 0 to 1
 */
export function lighten(hex, amount) {
  let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  r = Math.round(Math.min(255, r + (255 - r) * amount));
  g = Math.round(Math.min(255, g + (255 - g) * amount));
  b = Math.round(Math.min(255, b + (255 - b) * amount));
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Darkens a hex color
 * @param {string} hex 
 * @param {number} amount 0 to 1
 */
export function darken(hex, amount) {
  let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  r = Math.round(Math.max(0, r * (1 - amount)));
  g = Math.round(Math.max(0, g * (1 - amount)));
  b = Math.round(Math.max(0, b * (1 - amount)));
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Given a background hex color and an optional primary accent color, 
 * returns an object with CSS variables for the catalog.
 * @param {string} bgHex 
 * @param {string} primaryColor
 */
export function buildCatalogTheme(bgHex = '#FFFFFF', primaryColor = '#F97316') {
  const luminance = getRelativeLuminance(bgHex);
  const isDark = luminance < 0.35; // Umbral ajustable para decidir tema claro/oscuro

  // Calcular contraste para el texto sobre el color primario (pills activas)
  const primaryLuminance = getRelativeLuminance(primaryColor);
  const pillActiveText = primaryLuminance < 0.45 ? '#FFFFFF' : '#111111';

  return {
    '--cat-bg':           bgHex,
    '--cat-surface':      '#FFFFFF',
    '--cat-surface-2':    '#F5F5F5',
    '--cat-card-text-primary': '#111111',
    '--cat-card-text-secondary': '#6B7280',
    '--cat-text-primary': isDark ? '#FFFFFF' : '#111111',
    '--cat-text-secondary': isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
    '--cat-border':       isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    '--cat-tag-bg':       isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
    '--cat-tag-text':     isDark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.80)',
    '--cat-input-bg':     isDark ? lighten(bgHex, 0.12) : '#FFFFFF',
    '--cat-shadow':       isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.12)',
    '--cat-pill-active-bg':   primaryColor,
    '--cat-pill-active-text': pillActiveText,
  };
}
