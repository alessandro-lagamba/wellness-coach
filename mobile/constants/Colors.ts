/**
 * Centralized color palette for the Wellness Coach app.
 */

const palette = {
  primary: '#6d28d9',
  primaryBright: '#8b5cf6',
  secondary: '#14b8a6',
  surface: '#ffffff',
  surfaceMuted: '#f7f9ff',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  accent: '#f97316',
};

export default {
  palette,
  light: {
    text: palette.textPrimary,
    background: palette.surfaceMuted,
    tint: palette.primary,
    tabIconDefault: '#9ca3af',
    tabIconSelected: palette.primary,
  },
  dark: {
    text: '#f5f3ff',
    background: '#0f172a',
    tint: palette.primaryBright,
    tabIconDefault: '#4b5563',
    tabIconSelected: palette.primaryBright,
  },
};
