import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, LayoutAnimation, UIManager, DimensionValue } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { EmotionSession } from '../stores/analysis.store';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// -----------------------------------------------------
// Radial Glow Component using SVG for true radial gradient
// -----------------------------------------------------
interface RadialGlowProps {
  color: string;
  size?: number;
}

const RadialGlow: React.FC<RadialGlowProps> = ({ color, size = 220 }) => {
  return (
    <Svg width={size} height={size} style={styles.radialGlowSvg}>
      <Defs>
        <SvgRadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <Stop offset="40%" stopColor={color} stopOpacity={0.2} />
          <Stop offset="70%" stopColor={color} stopOpacity={0.08} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </SvgRadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
};

// -----------------------------------------------------
// Emotion Theme Configuration
// -----------------------------------------------------
interface EmotionTheme {
  color: string;
  lightColor: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  stateIT: string;
  stateEN: string;
  descIT: string;
  descEN: string;
}

const EMOTION_THEMES: Record<string, EmotionTheme> = {
  neutral: {
    color: '#f59e0b',
    lightColor: '#fbbf24',
    icon: 'circle-outline',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Uno stato di potenziale in evoluzione',
    descEN: 'A state of potential in evolution',
  },
  joy: {
    color: '#22c55e',
    lightColor: '#4ade80',
    icon: 'emoticon-happy-outline',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Energia vibrante e connessione',
    descEN: 'Vibrant energy and connection',
  },
  happy: {
    color: '#22c55e',
    lightColor: '#4ade80',
    icon: 'emoticon-happy-outline',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Energia vibrante e connessione',
    descEN: 'Vibrant energy and connection',
  },
  sadness: {
    color: '#f43f5e',
    lightColor: '#fb7185',
    icon: 'weather-cloudy',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Riflessione profonda e introspezione',
    descEN: 'Deep reflection and introspection',
  },
  sad: {
    color: '#f43f5e',
    lightColor: '#fb7185',
    icon: 'weather-cloudy',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Riflessione profonda e introspezione',
    descEN: 'Deep reflection and introspection',
  },
  anger: {
    color: '#ef4444',
    lightColor: '#f87171',
    icon: 'emoticon-angry-outline',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Energia intensa che cerca espressione',
    descEN: 'Intense energy seeking expression',
  },
  fear: {
    color: '#8b5cf6',
    lightColor: '#a78bfa',
    icon: 'emoticon-confused-outline',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Stato di allerta e attenzione',
    descEN: 'State of alertness and attention',
  },
  surprise: {
    color: '#06b6d4',
    lightColor: '#22d3ee',
    icon: 'emoticon-excited-outline',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Apertura a nuove esperienze',
    descEN: 'Openness to new experiences',
  },
  disgust: {
    color: '#84cc16',
    lightColor: '#a3e635',
    icon: 'emoticon-sad-outline',
    stateIT: 'Emozione Dominante',
    stateEN: 'Dominant Emotion',
    descIT: 'Risposta protettiva naturale',
    descEN: 'Natural protective response',
  },
};

// Props
interface EmotionSessionCardProps {
  session: EmotionSession;
}

// Get emotion theme
const getEmotionTheme = (emotion?: string): EmotionTheme => {
  const key = (emotion || 'neutral').toLowerCase();
  return EMOTION_THEMES[key] || EMOTION_THEMES.neutral;
};

// Get translated emotion name
const getEmotionName = (emotion?: string, t?: (k: string) => string): string => {
  if (!t) return (emotion || 'neutral').charAt(0).toUpperCase() + (emotion || 'neutral').slice(1);
  const key = (emotion || 'neutral').toLowerCase();
  let translationKey = `analysis.emotion.names.${key}`;
  let translated = t(translationKey);

  if (translated === translationKey) {
    const variantMap: Record<string, string> = { 'happy': 'joy', 'sad': 'sadness' };
    const variant = variantMap[key];
    if (variant) {
      translationKey = `analysis.emotion.names.${variant}`;
      translated = t(translationKey);
    }
  }

  return translated !== translationKey ? translated : (emotion || 'neutral').charAt(0).toUpperCase() + (emotion || 'neutral').slice(1);
};

// Neutral Icon - Dynamic ripple circles
const NeutralIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={styles.neutralIconContainer}>
    <View style={[styles.rippleOuter, { borderColor: color }]} />
    <View style={[styles.rippleMiddle, { borderColor: color }]} />
    <View style={[styles.rippleInner, { backgroundColor: color }]} />
  </View>
);

// Expandable Metric Tile Component with Progress Bar
interface MetricTileProps {
  metricKey: 'valence' | 'arousal';
  value: number;
  color: string;
  isDark: boolean;
}

const MetricTile: React.FC<MetricTileProps> = ({ metricKey, value, color, isDark }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const isValence = metricKey === 'valence';
  // Use number for width to avoid TypeScript issues with DimensionValue
  const progressPercent = Math.min(100, Math.max(0, value));

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const label = t(`analysis.emotion.metrics.${metricKey}`);
  const whyItMatters = t(`analysis.emotion.sessionCard.${metricKey}WhyItMatters`);
  const howItWorks = t(`analysis.emotion.sessionCard.${metricKey}HowItWorks`);

  return (
    <View style={[
      styles.metricTile,
      {
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.85)',
        borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
      }
    ]}>
      {/* Header with icon and label */}
      <View style={styles.metricHeader}>
        <MaterialCommunityIcons
          name={isValence ? 'emoticon-happy-outline' : 'lightning-bolt'}
          size={14}
          color={color}
        />
        <Text style={[styles.metricLabel, { color }]}>
          {label.toUpperCase()}
        </Text>
      </View>

      {/* Value */}
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        <Text style={[styles.metricMax, { color: isDark ? '#475569' : '#cbd5e1' }]}>/100</Text>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progressPercent}%` as DimensionValue,
              backgroundColor: color,
            }
          ]}
        />
      </View>

      {/* Expand Toggle Button */}
      <TouchableOpacity
        onPress={toggleExpand}
        style={styles.expandButton}
        activeOpacity={0.7}
      >
        <Text style={[styles.expandText, { color: colors.textSecondary }]}>
          {expanded ? (t('common.close') || 'Chiudi') : (t('analysis.emotion.sessionCard.expand') || 'Espandi')}
        </Text>
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* Expanded Content */}
      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: isDark ? '#334155' : '#e2e8f0' }]}>
          <View style={styles.expandedSection}>
            <Text style={[styles.expandedTitle, { color: colors.text }]}>
              {t('ui.whyItMatters') || 'Perché è importante'}
            </Text>
            <Text style={[styles.expandedText, { color: colors.textSecondary }]}>
              {whyItMatters}
            </Text>
          </View>
          <View style={styles.expandedSection}>
            <Text style={[styles.expandedTitle, { color: colors.text }]}>
              {t('ui.howItWorks') || 'Come funziona'}
            </Text>
            <Text style={[styles.expandedText, { color: colors.textSecondary }]}>
              {howItWorks}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// Main EmotionSessionCard - Memoized to prevent unnecessary re-renders
const EmotionSessionCardComponent: React.FC<EmotionSessionCardProps> = ({ session }) => {
  const { t, language } = useTranslation();
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';

  const theme = getEmotionTheme(session.dominant);
  const emotionName = getEmotionName(session.dominant, t);
  const isNeutral = (session.dominant || '').toLowerCase() === 'neutral';

  // Normalize values from [-1,1] to 0-100
  const valenceValue = Math.round(((session.avg_valence ?? 0) + 1) / 2 * 100);
  const arousalValue = Math.round(((session.avg_arousal ?? 0) + 1) / 2 * 100);

  // Get localized strings
  const stateLabel = language === 'it' ? theme.stateIT : theme.stateEN;
  const description = language === 'it' ? theme.descIT : theme.descEN;

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#f1f5f9',
      }
    ]}>
      {/* Emotion Header Section */}
      <View style={styles.emotionHeader}>
        {/* Radial Gradient Glow using SVG - true radial fade */}
        <View style={styles.glowWrapper}>
          <RadialGlow color={theme.lightColor} size={220} />
        </View>

        {/* Icon Orb */}
        <View style={[
          styles.iconOrb,
          {
            backgroundColor: isDark ? '#334155' : '#ffffff',
            borderColor: isDark ? '#475569' : `${theme.lightColor}40`,
            shadowColor: theme.color,
          }
        ]}>
          <LinearGradient
            colors={isDark ? ['#475569', '#334155'] : ['#ffffff', `${theme.lightColor}20`]}
            style={styles.iconOrbInner}
          >
            {isNeutral ? (
              <NeutralIcon color={theme.color} />
            ) : (
              <MaterialCommunityIcons
                name={theme.icon}
                size={36}
                color={theme.color}
              />
            )}
          </LinearGradient>
        </View>

        {/* State Label */}
        <Text style={[styles.stateLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>
          {stateLabel.toUpperCase()}
        </Text>

        {/* Emotion Name - Large with standard bold font */}
        <Text style={[styles.emotionName, { color: isDark ? '#f8fafc' : '#1e293b' }]}>
          {emotionName}
        </Text>

        {/* Description - Italic serif */}
        <Text style={[styles.description, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          {description}
        </Text>
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        <MetricTile
          metricKey="valence"
          value={valenceValue}
          color={theme.color}
          isDark={isDark}
        />
        <MetricTile
          metricKey="arousal"
          value={arousalValue}
          color={theme.color}
          isDark={isDark}
        />
      </View>
    </View>
  );
};

// 🔥 PERF: Memoized to prevent re-renders when switching between screens
// Only re-renders when session data actually changes
export const EmotionSessionCard = memo(EmotionSessionCardComponent, (prevProps, nextProps) => {
  // Deep comparison of session properties that affect rendering
  const prev = prevProps.session;
  const next = nextProps.session;

  return (
    prev.id === next.id &&
    prev.dominant === next.dominant &&
    prev.avg_valence === next.avg_valence &&
    prev.avg_arousal === next.avg_arousal &&
    prev.confidence === next.confidence
  );
});

// Styles
const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 30,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  emotionHeader: {
    alignItems: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  glowWrapper: {
    position: 'absolute',
    top: -60,
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialGlowSvg: {
    position: 'absolute',
  },
  iconOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  iconOrbInner: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neutralIconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleOuter: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    opacity: 0.25,
  },
  rippleMiddle: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    opacity: 0.5,
  },
  rippleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.9,
  },
  stateLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 8,
  },
  emotionName: {
    fontSize: 38,
    fontWeight: '300',
    letterSpacing: -0.5,
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
  },
  description: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'normal' }),
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricTile: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '700', // Bold like GaugeChart
  },
  metricMax: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    marginTop: 12,
    paddingTop: 4,
  },
  expandText: {
    fontSize: 12,
    fontWeight: '500',
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  expandedSection: {
    marginBottom: 12,
  },
  expandedTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  expandedText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
