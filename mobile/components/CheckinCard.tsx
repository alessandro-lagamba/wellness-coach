import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  tint: 'mint' | 'indigo';
  rightPill?: React.ReactNode;      // es. "Check-in" / "Done"
  headerIcon?: React.ReactNode;     // emoji o icona
  children: React.ReactNode;        // contenuto della card
  onPress?: () => void;             // intera card tappabile (facolt.)
  /** NEW: forza la stessa altezza tra card */
  minHeight?: number;
  /** NEW: altezza minima del body, utile per pareggiare le card */
  bodyMinHeight?: number;
  /** (opz.) override stile esterno */
  style?: StyleProp<ViewStyle>;
};

export default function CheckinCard({
  title, subtitle, tint, rightPill, headerIcon, children, onPress,
  minHeight, bodyMinHeight, style,
}: Props) {
  const { mode, colors: themeColors } = useTheme();
  
  // 🆕 Gradient temato: usa colori scuri per dark mode
  const gradient: [string, string] =
    tint === 'mint'
      ? mode === 'dark'
        ? [themeColors.surface, themeColors.surfaceElevated]
        : ['#ECFDF5', '#D1FAE5']
      : mode === 'dark'
        ? [themeColors.surface, themeColors.surfaceElevated]
        : ['#EFF6FF', '#DBEAFE'];

  return (
    <Pressable onPress={onPress} style={({pressed}) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <LinearGradient colors={gradient} start={{x:0,y:0}} end={{x:1,y:1}} style={[s.card, minHeight && {minHeight}, { borderColor: themeColors.border }, style]}>
        {/* Glass layer - solo in light mode */}
        {mode === 'light' && <BlurView intensity={15} tint="light" style={s.glass} />}

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={[s.headerIcon, { backgroundColor: mode === 'dark' ? themeColors.surfaceElevated : 'rgba(255,255,255,0.8)' }]}>{headerIcon}</View>
            <View>
              <Text style={[s.title, { color: themeColors.text }]}>{title}</Text>
              {!!subtitle && <Text style={[s.subtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text>}
            </View>
          </View>
          {rightPill}
        </View>

        {/* Body */}
        <View style={[s.body, bodyMinHeight && { minHeight: bodyMinHeight }]}>{children}</View>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 16,
    minHeight: 280,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8,
  },
  glass: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  body: { flex: 1 },
});
