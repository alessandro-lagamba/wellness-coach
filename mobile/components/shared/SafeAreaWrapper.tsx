import React from 'react';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

/**
 * Wrapper per SafeAreaView che gestisce automaticamente gli insets bottom
 * per i tasti di navigazione Android.
 * 
 * Questo componente garantisce che il contenuto non venga coperto dai
 * tasti di navigazione Android in basso, sia che siano tasti fisici/software
 * che gesture navigation.
 * 
 * Come funziona:
 * - Su Android con tasti di navigazione: `insets.bottom` sarà > 0 (es. 48px)
 * - Su Android con gesture navigation: `insets.bottom` sarà 0 o molto piccolo
 * - Su iOS: `insets.bottom` è gestito automaticamente se necessario
 * 
 * Il componente `react-native-safe-area-context` rileva automaticamente
 * quale tipo di navigazione è attiva e calcola gli insets di conseguenza.
 * 
 * @example
 * ```tsx
 * <SafeAreaWrapper style={styles.container}>
 *   <YourContent />
 * </SafeAreaWrapper>
 * ```
 */
export const SafeAreaWrapper: React.FC<SafeAreaViewProps> = ({ 
  children, 
  edges,
  style,
  ...props 
}) => {
  // 🔥 FIX: Su Android, includi sempre 'bottom' per rispettare i tasti di navigazione
  // react-native-safe-area-context rileva automaticamente se ci sono tasti fisici
  // o gesture navigation e calcola insets.bottom di conseguenza:
  // - Tasti fisici/software: insets.bottom > 0 (es. 48px)
  // - Gesture navigation: insets.bottom = 0 o molto piccolo
  // Su iOS, 'bottom' è opzionale (gestito automaticamente se necessario)
  const defaultEdges = Platform.OS === 'android' 
    ? ['top', 'left', 'right', 'bottom'] as const
    : ['top', 'left', 'right'] as const;

  const finalEdges = edges || defaultEdges;

  return (
    <SafeAreaView
      edges={finalEdges}
      style={style}
      {...props}
    >
      {children}
    </SafeAreaView>
  );
};

