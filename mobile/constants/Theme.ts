/**
 * Unified Theme System
 * Sistema centralizzato per gestire light/dark mode con palette completa
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Primary colors (brand)
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryMuted: string;
  
  // Secondary colors
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  
  // Accent colors
  accent: string;
  accentLight: string;
  accentDark: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Borders & dividers
  border: string;
  borderLight: string;
  divider: string;
  
  // Shadows
  shadowColor: string;
  
  // Special colors (emotion, skin, etc.)
  emotion: {
    joy: string;
    sadness: string;
    anger: string;
    fear: string;
    surprise: string;
    neutral: string;
  };
  skin: {
    excellent: string;
    good: string;
    fair: string;
    poor: string;
  };
}

const lightTheme: ThemeColors = {
  // Backgrounds
  background: '#f8fafc',
  backgroundSecondary: '#ffffff',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  surfaceMuted: '#f1f5f9',
  
  // Text
  text: '#0f172a',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  textInverse: '#ffffff',
  
  // Primary
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryMuted: '#eef2ff',
  
  // Secondary
  secondary: '#14b8a6',
  secondaryLight: '#5eead4',
  secondaryDark: '#0d9488',
  
  // Accent
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  accentDark: '#d97706',
  
  // Status
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  divider: '#e2e8f0',
  
  // Shadows
  shadowColor: '#000000',
  
  // Emotion colors
  emotion: {
    joy: '#10b981',
    sadness: '#3b82f6',
    anger: '#ef4444',
    fear: '#8b5cf6',
    surprise: '#f59e0b',
    neutral: '#64748b',
  },
  
  // Skin colors
  skin: {
    excellent: '#10b981',
    good: '#34d399',
    fair: '#f59e0b',
    poor: '#ef4444',
  },
};

const darkTheme: ThemeColors = {
  // Backgrounds - Viola scuro elegante come base
  background: '#1a1625',           // Viola scuro profondo (base)
  backgroundSecondary: '#251f35',  // Viola scuro più chiaro
  surface: '#2d2542',              // Viola scuro per card/surface
  surfaceElevated: '#3a2f4f',      // Viola scuro elevato per modali
  surfaceMuted: '#251f35',         // Viola scuro smorzato
  
  // Text - Contrasti ottimizzati per leggibilità
  text: '#f5f3ff',                 // Bianco violaceo chiaro (massimo contrasto)
  textSecondary: '#c4b5fd',        // Viola chiaro per testo secondario
  textTertiary: '#a78bfa',         // Viola medio per testo terziario
  textInverse: '#1a1625',          // Viola scuro per testo su sfondo chiaro
  
  // Primary - Viola brillante ma elegante
  primary: '#8b5cf6',              // Viola indaco brillante (main brand)
  primaryLight: '#a78bfa',         // Viola più chiaro per hover/stati attivi
  primaryDark: '#7c3aed',          // Viola più scuro per deep states
  primaryMuted: '#4c1d95',         // Viola scuro per background muted
  
  // Secondary - Teal/Turchese per contrasto
  secondary: '#14b8a6',
  secondaryLight: '#5eead4',
  secondaryDark: '#0d9488',
  
  // Accent - Arancione/dorato per highlights
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  accentDark: '#d97706',
  
  // Status - Colori vivaci ma leggibili su viola scuro
  success: '#34d399',              // Verde più chiaro per visibilità
  warning: '#fbbf24',               // Giallo/arancione per warning
  error: '#f87171',                // Rosso più chiaro per errori
  info: '#60a5fa',                 // Blu chiaro per info
  
  // Borders - Bordi sottili con viola scuro
  border: '#3a2f4f',               // Viola scuro per bordi principali
  borderLight: '#2d2542',          // Viola più scuro per bordi leggeri
  divider: '#3a2f4f',              // Viola scuro per divider
  
  // Shadows - Ombre più scure per profondità
  shadowColor: '#000000',
  
  // Emotion colors - Manteniamo colori vivaci per emozioni
  emotion: {
    joy: '#34d399',                // Verde più chiaro
    sadness: '#60a5fa',            // Blu più chiaro
    anger: '#f87171',              // Rosso più chiaro
    fear: '#a78bfa',               // Viola per paura
    surprise: '#fbbf24',           // Giallo per sorpresa
    neutral: '#a78bfa',            // Viola neutro
  },
  
  // Skin colors - Manteniamo colori vivaci
  skin: {
    excellent: '#34d399',
    good: '#60a5fa',
    fair: '#fbbf24',
    poor: '#f87171',
  },
};

export const themes: Record<ThemeMode, ThemeColors> = {
  light: lightTheme,
  dark: darkTheme,
};

// Helper per ottenere il tema corrente (export per compatibilità)
export const getTheme = (mode: ThemeMode): ThemeColors => themes[mode];

export default themes;


