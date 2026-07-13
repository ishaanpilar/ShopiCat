import type { CSSProperties } from 'react';
import type { Theme } from '../types';

/**
 * Themes are skin-only: they swap ~7 color tokens + two font families, never
 * the page structure (cover/contents/product/back, the bento photo grid). The
 * blueprint's core lesson — every color in the catalog CSS references a token,
 * zero raw hex — so re-theming is "change these values," nothing else.
 *
 * One theme ships today ("Stencil Spec-Sheet", the Prad4x4 design language).
 * Adding another is: append an object here + its fonts to index.html.
 */
export const THEMES: Theme[] = [
  {
    id: 'stencil',
    name: 'Stencil Spec-Sheet',
    description: 'Dark, technical, industrial. Stencil display face over a clean spec grid.',
    tokens: {
      bg: '#131417',
      panel: '#1B1C20',
      ink: '#ECEAE4',
      grey: '#98958D',
      accent: '#D93A32',
      hairline: 'rgba(236,234,228,.16)',
      hairlineSoft: 'rgba(236,234,228,.08)',
    },
    displayFont: "'Saira Stencil One', sans-serif",
    bodyFont: "'Saira', sans-serif",
  },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Inline CSS custom properties for a catalog root, accent overridden by config. */
export function themeVars(theme: Theme, accent: string): CSSProperties {
  return {
    ['--bg' as string]: theme.tokens.bg,
    ['--panel' as string]: theme.tokens.panel,
    ['--ink' as string]: theme.tokens.ink,
    ['--grey' as string]: theme.tokens.grey,
    ['--red' as string]: accent || theme.tokens.accent,
    ['--hairline' as string]: theme.tokens.hairline,
    ['--hairline-soft' as string]: theme.tokens.hairlineSoft,
    ['--display' as string]: theme.displayFont,
    ['--body' as string]: theme.bodyFont,
  } as CSSProperties;
}
