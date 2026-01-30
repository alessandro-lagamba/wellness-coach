import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
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
    color: '#f59e0b',
    icon: 'fire' as const,
    iconLibrary: 'MaterialCommunityIcons' as const,
  },
  carbohydrates: {
    label: 'analysis.food.metrics.carbohydrates',
    whyItMatters: 'analysis.food.metricExplainers.carbohydrates.why',
    howItWorks: 'analysis.food.metricExplainers.carbohydrates.how',
    color: '#2a7f55',
    icon: 'wheat-awn' as const,
    iconLibrary: 'FontAwesome6' as const,
  },
  proteins: {
    label: 'analysis.food.metrics.proteins',
    whyItMatters: 'analysis.food.metricExplainers.proteins.why',
    howItWorks: 'analysis.food.metricExplainers.proteins.how',
    color: '#d51616',
    icon: 'food-steak' as const,
    iconLibrary: 'MaterialCommunityIcons' as const,
  },
  fats: {
    label: 'analysis.food.metrics.fats',
    whyItMatters: 'analysis.food.metricExplainers.fats.why',
    howItWorks: 'analysis.food.metricExplainers.fats.how',
    color: '#7F2CCB',
    icon: 'water' as const,
    iconLibrary: 'MaterialCommunityIcons' as const,
  },
  health_score: {
    label: 'analysis.food.metrics.healthScore',
    whyItMatters: 'analysis.food.metricExplainers.healthScore.why',
    howItWorks: 'analysis.food.metricExplainers.healthScore.how',
    color: '#06b6d4',
    icon: 'medical-bag' as const,
    iconLibrary: 'MaterialCommunityIcons' as const,
  },
};

// -----------------------------------------------------
// Utility: confidenza e colori
// -----------------------------------------------------
const getHealthScoreLabel = (score: number, t: (k: string, o?: any) => string) => {
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

// ScoreTile (card singola con header breve)
// -----------------------------------------------------

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
  // ScoreTile simplified: no more collapsible info as requested.
  const rawValue = Number.isFinite(value) ? value : 0;
  const safeValue = Math.max(0, rawValue);
  const effectiveMax = maxValue && maxValue > 0 ? maxValue : safeValue || 1;
  const percentage = effectiveMax > 0 ? Math.min(100, (safeValue / effectiveMax) * 100) : 0;

  return (
    <View style={[styles.scoreTileContainer, { borderColor: `${def.color}22`, backgroundColor: colors.surface }]}>
      {/* Header compatto - Non più cliccabile per info */}
      <View style={[styles.scoreTile, { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }]}>
        <View style={[styles.titleRowLeft, { justifyContent: 'space-between' }]}>
          <View style={[styles.titleRowLeft, { gap: 8 }]}>
            {def.iconLibrary === 'FontAwesome6' ? (
              <FontAwesome6 name={def.icon as any} size={15} color={def.color} />
            ) : (
              <MaterialCommunityIcons name={def.icon as any} size={18} color={def.color} />
            )}
            <Text style={[styles.scoreLabel, { color: def.color }]} allowFontScaling={false}>{t(def.label).toUpperCase()}</Text>
          </View>
        </View>

        {/* Valore + progress compatti */}
        <View style={[styles.scoreRow, { marginTop: 4 }]}>
          <Text style={[styles.scoreValue, { color: def.color }]} allowFontScaling={false}>{Math.round(safeValue)}</Text>
          {unit ? (
            <Text style={[styles.scoreUnit, { color: def.color, opacity: 0.8 }]} allowFontScaling={false}>{unit}</Text>
          ) : maxValue > 0 ? (
            <>
              <Text style={[styles.scoreUnit, { color: colors.textSecondary }]} allowFontScaling={false}>/</Text>
              <Text style={[styles.scoreUnit, { color: colors.textSecondary }]} allowFontScaling={false}>{Math.round(maxValue)}</Text>
            </>
          ) : null}
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.borderLight, marginTop: 8 }]}>
          <View style={[styles.progressFill, { width: `${Math.min(100, percentage)}%`, backgroundColor: def.color }]} />
        </View>
      </View>

      {/* Contenuto informativo rimosso come richiesto */}
    </View>
  );
};

// -----------------------------------------------------
// FoodCaptureCard (componente principale)
// -----------------------------------------------------
interface FoodCaptureCardProps {
  session: FoodSession;
  dailyCaloriesGoal?: number;
}

export const FoodCaptureCard: React.FC<FoodCaptureCardProps> = ({ session, dailyCaloriesGoal }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const healthScore = session.health_score ?? 70;

  // Check if this is fallback data
  const isFallback = session.id === 'fallback' || session.id === 'error-fallback';

  // dati per la lista verticale
  const data = useMemo(() => {
    // ✅ FIX: Assicurati che i valori vengano letti correttamente, senza fallback a 0 se il valore esiste
    const calories =
      typeof session.macronutrients?.calories === 'number'
        ? session.macronutrients.calories
        : 0;
    const carbohydrates = typeof session.macronutrients?.carbohydrates === 'number'
      ? session.macronutrients.carbohydrates
      : 0;
    const proteins = typeof session.macronutrients?.proteins === 'number'
      ? session.macronutrients.proteins
      : 0;
    const fats = typeof session.macronutrients?.fats === 'number'
      ? session.macronutrients.fats
      : 0;

    const mealType = session.meal_type || 'other';
    const dailyGoal = dailyCaloriesGoal && dailyCaloriesGoal > 0 ? dailyCaloriesGoal : 2000;
    const mealShare =
      mealType === 'breakfast'
        ? 0.15
        : mealType === 'lunch'
          ? 0.35
          : mealType === 'snack'
            ? 0.15
            : 0.35; // dinner / other
    const caloriesTarget = Math.max(100, Math.round(dailyGoal * mealShare));

    const items: Array<{ key: MetricKey; value: number; maxValue?: number; unit?: string }> = [
      { key: 'calories', value: calories, unit: 'kcal', maxValue: caloriesTarget },
      { key: 'carbohydrates', value: carbohydrates, unit: 'g' },
      { key: 'proteins', value: proteins, unit: 'g' },
      { key: 'fats', value: fats, unit: 'g' },
    ];

    if (healthScore > 0) {
      items.push({ key: 'health_score', value: healthScore, maxValue: 100 });
    }

    return items;
  }, [session.macronutrients, healthScore]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
    marginVertical: 3,
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
    fontFamily: 'Figtree_700Bold', // Was 700
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
    fontFamily: 'Figtree_700Bold', // Was 600
  },
  mealType: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium', // Was 500
    marginTop: 4,
  },
  fallbackText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'Figtree_500Medium',
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
    fontFamily: 'Figtree_700Bold', // Was 800
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  scoreValue: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold', // Was 800
    letterSpacing: -0.2,
  },
  scoreUnit: {
    fontSize: 14,
    fontFamily: 'Figtree_700Bold',
    marginLeft: 2,
  },
  progressTrack: {
    height: 4,
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
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
    fontFamily: 'Figtree_700Bold', // Was 700
  },
});

