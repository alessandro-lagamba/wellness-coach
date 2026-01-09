import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { EmotionSession } from '../stores/analysis.store';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

// -----------------------------------------------------
// Props
// -----------------------------------------------------
interface EmotionSessionCardProps {
  session: EmotionSession;
}

// -----------------------------------------------------
// Emotion definitions
// -----------------------------------------------------
const getEmotionDefinitions = (t: (k: string) => string) => ({
  valence: {
    label: 'analysis.emotion.metrics.valence',
    whyItMatters: t('analysis.emotion.sessionCard.valenceWhyItMatters'),
    howItWorks: t('analysis.emotion.sessionCard.valenceHowItWorks'),
    color: '#10b981',
    icon: 'sentiment-very-satisfied' as const,
  },
  arousal: {
    label: 'analysis.emotion.metrics.arousal',
    whyItMatters: t('analysis.emotion.sessionCard.arousalWhyItMatters'),
    howItWorks: t('analysis.emotion.sessionCard.arousalHowItWorks'),
    color: '#f59e0b',
    icon: 'trending-up' as const,
  },
});

// Colori/icône per la dominante (più espressive con MaterialCommunityIcons)
const EMOTION_COLORS: Record<string, string> = {
  joy: '#10b981',
  happy: '#10b981',
  sadness: '#3b82f6',
  sad: '#3b82f6',
  anger: '#ef4444',
  fear: '#8b5cf6',
  surprise: '#f59e0b',
  disgust: '#84cc16',
  neutral: '#6b7280',
};

const EMOTION_MC_ICONS: Record<string, string> = {
  joy: 'emoticon-happy-outline',
  happy: 'emoticon-happy-outline',
  sadness: 'emoticon-sad-outline',
  sad: 'emoticon-sad-outline',
  anger: 'emoticon-angry-outline',
  fear: 'emoticon-confused-outline',
  surprise: 'emoticon-excited-outline',
  disgust: 'emoticon-sick-outline',
  neutral: 'emoticon-neutral-outline',
};

// -----------------------------------------------------
// Utility
// -----------------------------------------------------
const getConfidenceLabel = (confidence: number, t: (k: string) => string) => {
  if (confidence >= 0.8) return t('rating.excellent');
  if (confidence >= 0.6) return t('rating.good');
  if (confidence >= 0.4) return t('rating.fair');
  return t('rating.poor');
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return '#10b981';
  if (confidence >= 0.6) return '#f59e0b';
  if (confidence >= 0.4) return '#f97316';
  return '#ef4444';
};

const prettyEmotion = (e?: string, t?: (k: string) => string) => {
  if (!t) return (e || 'neutral').charAt(0).toUpperCase() + (e || 'neutral').slice(1);
  const key = (e || 'neutral').toLowerCase();
  // Prova prima con la chiave esatta, poi con varianti comuni
  let translationKey = `analysis.emotion.names.${key}`;
  let translated = t(translationKey);

  // Se la traduzione non esiste, prova con varianti
  if (translated === translationKey) {
    // Mappa varianti comuni
    const variantMap: Record<string, string> = {
      'happy': 'joy',
      'sad': 'sadness',
    };
    const variant = variantMap[key];
    if (variant) {
      translationKey = `analysis.emotion.names.${variant}`;
      translated = t(translationKey);
    }
  }

  // Se ancora non esiste, fallback al nome capitalizzato
  return translated !== translationKey ? translated : (e || 'neutral').charAt(0).toUpperCase() + (e || 'neutral').slice(1);
};

// -----------------------------------------------------
// Collapsible (misura invisibile + maxHeight animata)
// -----------------------------------------------------
const Collapsible: React.FC<{ expanded: boolean; children: React.ReactNode }> = ({ expanded, children }) => {
  const { colors } = useTheme();
  const measured = useSharedValue(0);

  const onLayout = (e: any) => {
    const h = e?.nativeEvent?.layout?.height ?? 0;
    if (h > 0 && Math.abs(measured.value - h) > 1) {
      measured.value = h;
    }
  };

  const style = useAnimatedStyle(() => ({
    maxHeight: withTiming(expanded ? measured.value : 0, { duration: 220 }),
    opacity: withTiming(expanded ? 1 : 0, { duration: 180 }),
  }));

  return (
    <>
      <View
        style={{ position: 'absolute', opacity: 0, zIndex: -1, pointerEvents: 'none', width: '100%' }}
        onLayout={onLayout}
      >
        {children}
      </View>
      <Animated.View style={[styles.expandedContent, { borderTopColor: colors.border }, style]}>{children}</Animated.View>
    </>
  );
};

// -----------------------------------------------------
// Tile (riusato per Valence e Arousal) — 2 colonne uguali
// -----------------------------------------------------
type EmotionKey = 'valence' | 'arousal';

const GRID_GAP = 12;

const MetricTile: React.FC<{
  metricKey: EmotionKey;
  value: number;
}> = ({ metricKey, value }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const EMOTION_DEFINITIONS = getEmotionDefinitions(t);
  const def = EMOTION_DEFINITIONS[metricKey];

  const valueColor =
    metricKey === 'valence'
      ? value >= 0 ? '#10b981' : '#ef4444'
      : value >= 0.5
        ? '#f59e0b'
        : '#3b82f6';

  // 🆕 Normalize valence [-1..1] → 0..100, arousal [-1..1] → 0..100 (SAME FORMULA!)
  const normalizedValue =
    metricKey === 'valence'
      ? Math.round(((value + 1) / 2) * 100)
      : Math.round(((value + 1) / 2) * 100); // Arousal is also -1 to 1!
  const display = String(normalizedValue);

  // percentuale barra: both valence and arousal are [-1..1] → 0..100
  const percent =
    metricKey === 'valence'
      ? Math.max(0, Math.min(100, ((value + 1) / 2) * 100))
      : Math.max(0, Math.min(100, ((value + 1) / 2) * 100));

  return (
    <View style={[styles.tile, { borderColor: `${valueColor}22`, backgroundColor: colors.surface }]}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.9} style={styles.tileHeader}>
        <View style={styles.titleRowLeft}>
          <MaterialIcons name={def.icon} size={18} color={valueColor} />
          <Text style={[styles.tileLabel, { color: valueColor }]}>{t(def.label).toUpperCase()}</Text>
        </View>

        <View style={styles.valueRow}>
          <Text style={[styles.tileValue, { color: valueColor }]}>{display}</Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
          <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: valueColor }]} />
        </View>

        <View style={[styles.tapRow, { backgroundColor: `${valueColor}15` }]}>
          <Text style={[styles.tapHint, { color: valueColor }]}>{expanded ? t('common.close') : t('analysis.emotion.sessionCard.tapToExpand')}</Text>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={16} color={valueColor} />
        </View>
      </TouchableOpacity>

      <Collapsible expanded={expanded}>
        <View style={styles.definitionSection}>
          <Text style={[styles.definitionTitle, { color: colors.text }]}>{t('ui.whyItMatters')}</Text>
          <Text style={[styles.definitionText, { color: colors.textSecondary }]}>{def.whyItMatters}</Text>
        </View>
        <View style={styles.definitionSection}>
          <Text style={[styles.definitionTitle, { color: colors.text }]}>{t('ui.howItWorks')}</Text>
          <Text style={[styles.definitionText, { color: colors.textSecondary }]}>{def.howItWorks}</Text>
        </View>
      </Collapsible>
    </View>
  );
};

// -----------------------------------------------------
// Banner emozione dominante (migliorato)
// -----------------------------------------------------
const DominantBanner: React.FC<{ emotion?: string }> = ({ emotion }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const key = (emotion || 'neutral').toLowerCase();
  const color = EMOTION_COLORS[key] ?? '#6b7280';
  const iconName = (EMOTION_MC_ICONS[key] ?? 'emoticon-neutral-outline') as any;

  return (
    <LinearGradient
      colors={[`${color}15`, `${color}05`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.banner, { borderColor: `${color}20` }]}
    >
      {/* Enhanced icon with glow */}
      <View style={[styles.bannerIconWrap, { backgroundColor: colors.surface, shadowColor: color }]}>
        <MaterialCommunityIcons name={iconName} size={32} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerEyebrow, { color: colors.textSecondary }]}>{t('analysis.emotion.sessionCard.dominantEmotion').toUpperCase()}</Text>
        <Text style={[styles.bannerEmotion, { color }]}>{prettyEmotion(emotion, t)}</Text>
        <Text style={[styles.bannerSubtitle, { color: colors.textSecondary }]}>{t('analysis.emotion.sessionCard.detectedInLastSession')}</Text>
      </View>

      {/* Decorative emoji badge */}
      <View style={[styles.emojiDecor, { backgroundColor: `${color}10` }]}>
        <Text style={styles.emojiText}>✨</Text>
      </View>
    </LinearGradient>
  );
};

// -----------------------------------------------------
// EmotionSessionCard (principale)
// -----------------------------------------------------
export const EmotionSessionCard: React.FC<EmotionSessionCardProps> = ({ session }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Check if this is fallback data
  const isFallback = session.id === 'fallback' || session.id === 'error-fallback';

  const data = useMemo(
    () => [
      { key: 'valence' as EmotionKey, value: session.avg_valence ?? 0 },
      { key: 'arousal' as EmotionKey, value: session.avg_arousal ?? 0 },
    ],
    [session]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isFallback ? t('analysis.emotion.card.sampleTitle') : t('analysis.emotion.card.lastTitle')}
          </Text>
        </View>
        {isFallback && (
          <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
            {t('analysis.emotion.card.sampleHint')}
          </Text>
        )}
      </View>

      {/* Banner Dominant Emotion */}
      <DominantBanner emotion={session.dominant} />

      {/* Griglia 2 colonne: Valence + Arousal (uguale larghezza) */}
      <View style={styles.gridRow}>
        {data.map((item) => (
          <View key={item.key} style={styles.gridCol}>
            <MetricTile metricKey={item.key} value={item.value} />
          </View>
        ))}
      </View>
    </View>
  );
};

// -----------------------------------------------------
// Stili
// -----------------------------------------------------
const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
  },
  header: { marginBottom: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  confidenceDot: { width: 8, height: 8, borderRadius: 4 },
  confidenceText: { fontSize: 12, fontWeight: '600' },
  fallbackText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
    gap: 16,
  },
  bannerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emojiDecor: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 18,
  },
  bannerEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2, opacity: 0.8 },
  bannerEmotion: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 0 },
  bannerSubtitle: { fontSize: 12, marginTop: 2, opacity: 0.7 },

  // Grid 2 colonne uguali
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  gridCol: {
    flex: 1,          // <-- colonne uguali
    minWidth: 0,      // evita overflow su schermi piccoli
  },

  // Tile
  tile: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  tileHeader: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  titleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  tileValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.2 },
  progressTrack: {
    height: 6,
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  tapRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tapHint: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  expandedContent: {
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  definitionSection: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  definitionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  definitionText: { fontSize: 12.5, lineHeight: 18 },
});
