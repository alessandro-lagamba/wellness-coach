import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { EmotionSession } from '../stores/analysis.store';

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
const EMOTION_DEFINITIONS = {
  valence: {
    label: 'Valence',
    whyItMatters: 'Misura la positività/negatività del tuo stato emotivo.',
    howItWorks: "Stima basata su segnali facciali (bocca/occhi/sopracciglia).",
    color: '#10b981',
    icon: 'sentiment-very-satisfied' as const,
  },
  arousal: {
    label: 'Arousal',
    whyItMatters: "Indica quanta attivazione/energia emotiva c'è in questo momento.",
    howItWorks: "Valutazione dell'intensità dei segnali espressivi.",
    color: '#f59e0b',
    icon: 'trending-up' as const,
  },
};

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
const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return 'Excellent';
  if (confidence >= 0.6) return 'Good';
  if (confidence >= 0.4) return 'Fair';
  return 'Poor';
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return '#10b981';
  if (confidence >= 0.6) return '#f59e0b';
  if (confidence >= 0.4) return '#f97316';
  return '#ef4444';
};

const prettyEmotion = (e?: string) =>
  (e || 'neutral').charAt(0).toUpperCase() + (e || 'neutral').slice(1);

// -----------------------------------------------------
// Collapsible (misura invisibile + maxHeight animata)
// -----------------------------------------------------
const Collapsible: React.FC<{ expanded: boolean; children: React.ReactNode }> = ({ expanded, children }) => {
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
      <Animated.View style={[styles.expandedContent, style]}>{children}</Animated.View>
    </>
  );
};

// -----------------------------------------------------
// Tile (riusato per Valence e Arousal) — 2 colonne uguali
// -----------------------------------------------------
type EmotionKey = keyof typeof EMOTION_DEFINITIONS;

const GRID_GAP = 12;

const MetricTile: React.FC<{
  metricKey: EmotionKey;
  value: number;
}> = ({ metricKey, value }) => {
  const def = EMOTION_DEFINITIONS[metricKey];
  const [expanded, setExpanded] = useState(false);

  const valueColor =
    metricKey === 'valence'
      ? value >= 0 ? '#10b981' : '#ef4444'
      : value >= 0.5
      ? '#f59e0b'
      : '#3b82f6';

  const display = value.toFixed(2);

  // percentuale barra: valence [-1..1] → 0..100, arousal [0..1] → 0..100
  const percent =
    metricKey === 'valence'
      ? Math.max(0, Math.min(100, ((value + 1) / 2) * 100))
      : Math.max(0, Math.min(100, value * 100));

  return (
    <View style={[styles.tile, { borderColor: `${valueColor}22` }]}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.9} style={styles.tileHeader}>
        <View style={styles.titleRowLeft}>
          <MaterialIcons name={def.icon} size={18} color={valueColor} />
          <Text style={[styles.tileLabel, { color: valueColor }]}>{def.label.toUpperCase()}</Text>
        </View>

        <View style={styles.valueRow}>
          <Text style={[styles.tileValue, { color: valueColor }]}>{display}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: valueColor }]} />
        </View>

        <View style={styles.tapRow}>
          <Text style={styles.tapHint}>{expanded ? 'Tap to collapse' : 'Tap to expand'}</Text>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color="#6366f1" />
        </View>
      </TouchableOpacity>

      <Collapsible expanded={expanded}>
        <View style={styles.definitionSection}>
          <Text style={styles.definitionTitle}>Why it matters</Text>
          <Text style={styles.definitionText}>{def.whyItMatters}</Text>
        </View>
        <View style={styles.definitionSection}>
          <Text style={styles.definitionTitle}>How it works</Text>
          <Text style={styles.definitionText}>{def.howItWorks}</Text>
        </View>
      </Collapsible>
    </View>
  );
};

// -----------------------------------------------------
// Banner emozione dominante (migliorato)
// -----------------------------------------------------
const DominantBanner: React.FC<{ emotion?: string }> = ({ emotion }) => {
  const key = (emotion || 'neutral').toLowerCase();
  const color = EMOTION_COLORS[key] ?? '#6b7280';
  const iconName = (EMOTION_MC_ICONS[key] ?? 'emoticon-neutral-outline') as any;

  return (
    <View style={[styles.banner, { borderColor: `${color}30`, backgroundColor: `${color}10` }]}>
      <View style={[styles.bannerIconWrap, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={iconName} size={30} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerEyebrow}>DOMINANT EMOTION</Text>
        <Text style={[styles.bannerEmotion, { color }]}>{prettyEmotion(emotion)}</Text>
        <Text style={styles.bannerSubtitle}>Rilevata nell’ultima sessione</Text>
      </View>
    </View>
  );
};

// -----------------------------------------------------
// EmotionSessionCard (principale)
// -----------------------------------------------------
export const EmotionSessionCard: React.FC<EmotionSessionCardProps> = ({ session }) => {
  const confidence = session.confidence ?? 0.8;
  
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {isFallback ? 'Sample emotion analysis' : 'Last emotion analysis'}
          </Text>
          <View style={styles.confidenceBadge}>
            <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(confidence) }]} />
            <Text style={styles.confidenceText}>
              {isFallback ? 'Sample' : getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
            </Text>
          </View>
        </View>
        {isFallback && (
          <Text style={styles.fallbackText}>
            Complete your first emotion analysis to see your real results
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
    backgroundColor: '#ffffff',
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
    borderColor: 'rgba(99, 102, 241, 0.06)',
  },
  header: { marginBottom: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  confidenceDot: { width: 8, height: 8, borderRadius: 4 },
  confidenceText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  fallbackText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 12,
    gap: 12,
  },
  bannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerEyebrow: { fontSize: 12, fontWeight: '800', color: '#111827', letterSpacing: 0.2 },
  bannerEmotion: { fontSize: 22, fontWeight: '900', letterSpacing: -0.2, marginTop: 2 },
  bannerSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },

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
    backgroundColor: '#fff',
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
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  tapRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  tapHint: { fontSize: 11, fontWeight: '700', color: '#6366f1' },

  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  definitionSection: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  definitionTitle: { fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 4 },
  definitionText: { fontSize: 12.5, color: '#4b5563', lineHeight: 18 },
});
