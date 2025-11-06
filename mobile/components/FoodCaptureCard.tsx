import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
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
interface FoodSession {
  id: string;
  timestamp: string | Date;
  macronutrients: {
    carbohydrates: number;
    proteins: number;
    fats: number;
    fiber?: number;
    calories: number;
  };
  meal_type?: string;
  health_score?: number;
  identified_foods?: string[];
}

// -----------------------------------------------------
// Metric definitions (testi sintetici, compatti)
// -----------------------------------------------------
const METRIC_DEFINITIONS = {
  calories: {
    label: 'analysis.food.metrics.calories',
    whyItMatters: 'analysis.food.metricExplainers.calories.why',
    howItWorks: 'analysis.food.metricExplainers.calories.how',
    color: '#10b981',
    icon: 'local-fire-department' as const,
  },
  carbohydrates: {
    label: 'analysis.food.metrics.carbohydrates',
    whyItMatters: 'analysis.food.metricExplainers.carbohydrates.why',
    howItWorks: 'analysis.food.metricExplainers.carbohydrates.how',
    color: '#f59e0b',
    icon: 'grain' as const,
  },
  proteins: {
    label: 'analysis.food.metrics.proteins',
    whyItMatters: 'analysis.food.metricExplainers.proteins.why',
    howItWorks: 'analysis.food.metricExplainers.proteins.how',
    color: '#ef4444',
    icon: 'egg' as const,
  },
  fats: {
    label: 'analysis.food.metrics.fats',
    whyItMatters: 'analysis.food.metricExplainers.fats.why',
    howItWorks: 'analysis.food.metricExplainers.fats.how',
    color: '#8b5cf6',
    icon: 'oil-barrel' as const,
  },
  health_score: {
    label: 'analysis.food.metrics.healthScore',
    whyItMatters: 'analysis.food.metricExplainers.healthScore.why',
    howItWorks: 'analysis.food.metricExplainers.healthScore.how',
    color: '#06b6d4',
    icon: 'medical-services' as const,
  },
};

// -----------------------------------------------------
// Utility: confidenza e colori
// -----------------------------------------------------
const getHealthScoreLabel = (score: number, t: (k: string, o?: any)=>string) => {
  if (score >= 80) return t('rating.excellent');
  if (score >= 60) return t('rating.good');
  if (score >= 40) return t('rating.fair');
  return t('rating.poor');
};

const getHealthScoreColor = (score: number) => {
  if (score >= 80) return '#10b981'; // green
  if (score >= 60) return '#f59e0b'; // amber
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
};

// -----------------------------------------------------
// Collapsible verticale: misura contenuto invisibile + anima maxHeight (si apre sotto)
// -----------------------------------------------------
const BottomCollapsible: React.FC<{ expanded: boolean; children: React.ReactNode }> = ({ expanded, children }) => {
  const measured = useSharedValue(0);

  const onLayout = (e: any) => {
    const h = e?.nativeEvent?.layout?.height ?? 0;
    if (h > 0 && Math.abs(measured.value - h) > 1) {
      measured.value = h;
    }
  };

  const style = useAnimatedStyle(() => ({
    maxHeight: withTiming(expanded ? measured.value : 0, { duration: 220 }),
    opacity: withTiming(expanded ? 1 : 0, { duration: 160 }),
  }));

  return (
    <>
      {/* misuratore invisibile */}
      <View style={{ position: 'absolute', opacity: 0, zIndex: -1, pointerEvents: 'none' }} onLayout={onLayout}>
        <View style={{ paddingTop: 8 }}>{children}</View>
      </View>
      {/* contenuto visibile */}
      <Animated.View style={style}>
        <View style={{ paddingTop: 8 }}>{children}</View>
      </Animated.View>
    </>
  );
};

// -----------------------------------------------------
// ScoreTile (card singola con header breve + collapsible verticale)
// -----------------------------------------------------
type MetricKey = keyof typeof METRIC_DEFINITIONS;

const ScoreTile: React.FC<{
  metricKey: MetricKey;
  value: number;
  maxValue?: number;
  unit?: string;
}> = ({ metricKey, value, maxValue = 100, unit }) => {
  const def = METRIC_DEFINITIONS[metricKey];
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = () => setIsExpanded((v) => !v);

  const safeValue = Math.max(0, Math.min(maxValue, Number.isFinite(value) ? value : 0));
  const percentage = maxValue > 0 ? (safeValue / maxValue) * 100 : 0;

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(isExpanded ? '90deg' : '0deg', { duration: 180 }) }],
  }));

  return (
    <View style={[styles.scoreTileContainer, { borderColor: `${def.color}22`, backgroundColor: colors.surface }]}> 
      {/* Header compatto */}
      <TouchableOpacity onPress={toggle} activeOpacity={0.9} style={[styles.scoreTile, { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 }]}> 
        <View style={[styles.titleRowLeft, { justifyContent: 'space-between' }]}> 
          <View style={[styles.titleRowLeft, { gap: 8 }]}> 
            <MaterialIcons name={def.icon} size={18} color={def.color} /> 
            <Text style={[styles.scoreLabel, { color: def.color }]}>{t(def.label).toUpperCase()}</Text> 
          </View>
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, chevronStyle]}> 
            <MaterialIcons name="chevron-right" size={18} color={colors.primary} /> 
          </Animated.View>
        </View>

        {/* Valore + progress compatti */}
        <View style={[styles.scoreRow, { marginTop: 4 }]}> 
          <Text style={[styles.scoreValue, { color: def.color }]}>{Math.round(safeValue)}</Text> 
          {unit ? (
            <Text style={[styles.scoreUnit, { color: colors.textSecondary }]}>{unit}</Text>
          ) : maxValue > 0 ? (
            <>
              <Text style={[styles.scoreUnit, { color: colors.textSecondary }]}>/</Text>
              <Text style={[styles.scoreUnit, { color: colors.textSecondary }]}>{Math.round(maxValue)}</Text>
            </>
          ) : null}
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.borderLight, marginTop: 6 }]}> 
          <View style={[styles.progressFill, { width: `${Math.min(100, percentage)}%`, backgroundColor: def.color }]} /> 
        </View>
      </TouchableOpacity>

      {/* Contenuto esteso sotto */}
      <BottomCollapsible expanded={isExpanded}> 
        <View style={[styles.definitionSection, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}> 
          <Text style={[styles.definitionTitle, { color: colors.text }]}>{t('ui.whyItMatters')}</Text> 
          <Text style={[styles.definitionText, { color: colors.textSecondary }]}>{t(def.whyItMatters)}</Text> 
        </View>
        <View style={styles.definitionSection}> 
          <Text style={[styles.definitionTitle, { color: colors.text }]}>{t('ui.howItWorks')}</Text> 
          <Text style={[styles.definitionText, { color: colors.textSecondary }]}>{t(def.howItWorks)}</Text> 
        </View>
      </BottomCollapsible>
    </View>
  );
};

// -----------------------------------------------------
// FoodCaptureCard (componente principale)
// -----------------------------------------------------
interface FoodCaptureCardProps {
  session: FoodSession;
}

export const FoodCaptureCard: React.FC<FoodCaptureCardProps> = ({ session }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const healthScore = session.health_score ?? 70;
  
  // Check if this is fallback data
  const isFallback = session.id === 'fallback' || session.id === 'error-fallback';

  // dati per la lista verticale
  const data = useMemo(() => {
    const items: Array<{ key: MetricKey; value: number; maxValue?: number; unit?: string }> = [
      { key: 'calories', value: session.macronutrients?.calories ?? 0, unit: 'kcal' },
      { key: 'carbohydrates', value: session.macronutrients?.carbohydrates ?? 0, unit: 'g' },
      { key: 'proteins', value: session.macronutrients?.proteins ?? 0, unit: 'g' },
      { key: 'fats', value: session.macronutrients?.fats ?? 0, unit: 'g' },
    ];
    
    if (healthScore > 0) {
      items.push({ key: 'health_score', value: healthScore, maxValue: 100 });
    }
    
    return items;
  }, [session, healthScore]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isFallback ? t('analysis.food.card.sampleTitle') : t('analysis.food.card.lastTitle')}
          </Text>
          <View style={[styles.healthBadge, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.healthDot, { backgroundColor: getHealthScoreColor(healthScore) }]} />
            <Text style={[styles.healthText, { color: colors.text }]}>
              {isFallback ? t('analysis.common.sample') : getHealthScoreLabel(healthScore, t)} ({Math.round(healthScore)}%)
            </Text>
          </View>
        </View>
        {session.meal_type && (
          <Text style={[styles.mealType, { color: colors.textSecondary }]}>
            {t(`analysis.food.mealTypes.${session.meal_type}`, { defaultValue: session.meal_type })}
          </Text>
        )}
        {isFallback && (
          <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
            {t('analysis.food.card.sampleHint')}
          </Text>
        )}
      </View>

      {/* Lista verticale */}
      <View style={styles.metricsList}>
        {data.map((item) => (
          <ScoreTile
            key={item.key}
            metricKey={item.key}
            value={item.value}
            maxValue={item.maxValue}
            unit={item.unit}
          />
        ))}
      </View>
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
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mealType: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  fallbackText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },

  metricsList: {
    gap: 12,
  },
  scoreTileContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  scoreTile: {
    borderRadius: 14,
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
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  scoreUnit: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 1,
  },
  progressTrack: {
    height: 5,
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

  definitionSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
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

