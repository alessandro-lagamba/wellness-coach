import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, FlatList, ListRenderItemInfo } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

// -----------------------------------------------------
// Types
// -----------------------------------------------------
interface SkinCapture {
  id: string;
  timestamp: string;
  scores: {
    texture?: number;
    redness?: number;
    hydration?: number;
    oiliness?: number;
    overall?: number;
  };
  confidence?: number;
  quality?: {
    lighting?: number;
    focus?: number;
    roi_coverage?: number;
  };
}

// -----------------------------------------------------
// Metric definitions (testi sintetici, compatti)
// -----------------------------------------------------
const METRIC_DEFINITIONS = {
  smoothness: {
    label: 'analysis.skin.metrics.texture',
    whyItMatters: 'analysis.skin.metricExplainers.texture.why',
    howItWorks: 'analysis.skin.metricExplainers.texture.how',
    color: '#8b5cf6',
    icon: 'blur-linear' as const,
  },
  redness: {
    label: 'analysis.skin.metrics.redness',
    whyItMatters: 'analysis.skin.metricExplainers.redness.why',
    howItWorks: 'analysis.skin.metricExplainers.redness.how',
    color: '#ef4444',
    icon: 'local-fire-department' as const,
  },
  hydration: {
    label: 'analysis.skin.metrics.hydration',
    whyItMatters: 'analysis.skin.metricExplainers.hydration.why',
    howItWorks: 'analysis.skin.metricExplainers.hydration.how',
    color: '#06b6d4',
    icon: 'water-drop' as const,
  },
  oiliness: {
    label: 'analysis.skin.metrics.oiliness',
    whyItMatters: 'analysis.skin.metricExplainers.oiliness.why',
    howItWorks: 'analysis.skin.metricExplainers.oiliness.how',
    color: '#f59e0b',
    icon: 'oil-barrel' as const,
  },
  overall: {
    label: 'analysis.skin.metricExplainers.overall.label',
    whyItMatters: 'analysis.skin.metricExplainers.overall.why',
    howItWorks: 'analysis.skin.metricExplainers.overall.how',
    color: '#10b981',
    icon: 'medical-services' as const,
  },
};

// -----------------------------------------------------
// Utility: confidenza e colori
// -----------------------------------------------------
const getConfidenceLabel = (confidence: number, t: (k: string, o?: any)=>string) => {
  if (confidence >= 0.8) return t('rating.excellent');
  if (confidence >= 0.6) return t('rating.good');
  if (confidence >= 0.4) return t('rating.fair');
  return t('rating.poor');
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return '#10b981'; // green
  if (confidence >= 0.6) return '#f59e0b'; // amber
  if (confidence >= 0.4) return '#f97316'; // orange
  return '#ef4444'; // red
};

// -----------------------------------------------------
// Collapsible affidabile: misura contenuto invisibile + anima maxHeight
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

  const containerStyle = useAnimatedStyle(() => {
    return {
      maxHeight: withTiming(expanded ? measured.value : 0, { duration: 220 }),
      opacity: withTiming(expanded ? 1 : 0, { duration: 180 }),
    };
  });

  return (
    <>
      {/* Misuratore invisibile: non intercetta i tap */}
      <View
        style={{ position: 'absolute', opacity: 0, zIndex: -1, pointerEvents: 'none', width: '100%' }}
        onLayout={onLayout}
      >
        {children}
      </View>

      {/* Contenuto visibile con altezza animata */}
      <Animated.View style={[styles.expandedContent, { borderTopColor: colors.border }, containerStyle]}>
        {children}
      </Animated.View>
    </>
  );
};

// -----------------------------------------------------
// ScoreTile (card singola con header breve + collapsible)
// -----------------------------------------------------
type MetricKey = keyof typeof METRIC_DEFINITIONS;

const CARD_WIDTH = Math.round(width * 0.62);  // più strette
const SPACING = 10;
const SNAP_INTERVAL = CARD_WIDTH + SPACING;

const ScoreTile: React.FC<{
  metricKey: MetricKey;
  score: number;
  trend?: number;
}> = ({ metricKey, score, trend }) => {
  const def = METRIC_DEFINITIONS[metricKey];
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = () => setIsExpanded((v) => !v);

  const safeScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));

  return (
    <View style={[styles.scoreTile, { borderColor: `${def.color}22`, backgroundColor: colors.surface }]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.9} style={styles.scoreTileHeader}>
        <View style={styles.titleRowLeft}>
          <MaterialIcons name={def.icon} size={18} color={def.color} />
          <Text style={[styles.scoreLabel, { color: def.color }]}>{t(def.label).toUpperCase()}</Text>
        </View>

        <View style={styles.scoreRow}>
          <Text style={[styles.scoreValue, { color: def.color }]}>{safeScore}</Text>
          <Text style={[styles.scoreUnit, { color: colors.textSecondary }]}>/100</Text>

          {typeof trend === 'number' && (
            <View style={[styles.trendChip, { backgroundColor: `${def.color}15` }]}>
              <MaterialIcons
                name={trend > 0 ? 'trending-up' : trend < 0 ? 'trending-down' : 'trending-flat'}
                size={14}
                color={trend > 0 ? colors.success : trend < 0 ? colors.error : colors.textTertiary}
              />
              <Text style={[styles.trendChipText, { color: colors.text }]}>
                {trend > 0 ? '+' : trend < 0 ? '' : ''}{trend}
              </Text>
            </View>
          )}
        </View>

        {/* progress compatta */}
        <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
          <View style={[styles.progressFill, { width: `${safeScore}%`, backgroundColor: def.color }]} />
        </View>

        <View style={styles.tapRow}>
          <Text style={[styles.tapHint, { color: colors.primary }]}>{isExpanded ? t('ui.tapToCollapse') : t('ui.tapToExpand')}</Text>
          <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Collapsible vero */}
      <Collapsible expanded={isExpanded}>
        <View style={styles.definitionSection}>
          <Text style={[styles.definitionTitle, { color: colors.text }]}>{t('ui.whyItMatters')}</Text>
          <Text style={[styles.definitionText, { color: colors.textSecondary }]}>{t(def.whyItMatters)}</Text>
        </View>
        <View style={styles.definitionSection}>
          <Text style={[styles.definitionTitle, { color: colors.text }]}>{t('ui.howItWorks')}</Text>
          <Text style={[styles.definitionText, { color: colors.textSecondary }]}>{t(def.howItWorks)}</Text>
        </View>
      </Collapsible>
    </View>
  );
};

// -----------------------------------------------------
// SkinCaptureCard (componente principale)
// -----------------------------------------------------
interface SkinCaptureCardProps {
  capture: SkinCapture;
}

export const SkinCaptureCard: React.FC<SkinCaptureCardProps> = ({ capture }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const confidence = capture.confidence ?? 0.8;
  
  // Check if this is fallback data
  const isFallback = capture.id === 'fallback' || capture.id === 'error-fallback';

  // dati per la FlatList (fix hydration!)
  const data = useMemo(() => ([
    { key: 'smoothness' as MetricKey, score: capture.scores?.texture ?? 0 },
    { key: 'redness' as MetricKey,    score: capture.scores?.redness ?? 0 },
    { key: 'hydration' as MetricKey,  score: capture.scores?.hydration ?? 0 },
    { key: 'oiliness' as MetricKey,   score: capture.scores?.oiliness ?? 0 },
    { key: 'overall' as MetricKey,    score: capture.scores?.overall ?? 0 },
  ]), [capture]);

  const renderItem = ({ item }: ListRenderItemInfo<{ key: MetricKey; score: number }>) => {
    return (
      <View style={{ width: CARD_WIDTH, marginRight: SPACING }}>
        <ScoreTile metricKey={item.key} score={item.score} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isFallback ? t('analysis.skin.card.sampleTitle') : t('analysis.skin.card.lastTitle')}
          </Text>
          <View style={[styles.confidenceBadge, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(confidence) }]} />
            <Text style={[styles.confidenceText, { color: colors.text }]}>
              {isFallback ? t('analysis.common.sample') : getConfidenceLabel(confidence, t)} ({Math.round(confidence * 100)}%)
            </Text>
          </View>
        </View>
        {isFallback && (
          <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
            {t('analysis.skin.card.sampleHint')}
          </Text>
        )}
      </View>

      {/* Carousel */}
      <FlatList
        horizontal
        data={data}
        renderItem={renderItem}
        keyExtractor={(i) => i.key}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </View>
  );
};

// -----------------------------------------------------
// Stili (compatti, puliti, con focus su recap)
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
  header: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fallbackText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },

  scoreTile: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  scoreTileHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  titleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  scoreUnit: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  trendChip: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  tapRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '700',
  },

  expandedContent: {
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  definitionSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  definitionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  definitionText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
