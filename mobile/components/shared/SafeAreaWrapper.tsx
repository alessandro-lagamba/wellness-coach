import React from 'react';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

/**
 * Wrapper per SafeAreaView che gestisce automaticamente gli insets bottom
 * per i tasti di navigazione Android.
 * 
 * Questo componente garantisce che il contenuto non venga coperto dai
 * tasti di navigazione Android in basso.
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

