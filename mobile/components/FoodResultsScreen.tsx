// @ts-nocheck
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { ResultHero } from './ResultHero';
import { EnhancedMetricTile } from './EnhancedMetricTile';
import { IntelligentInsightsSection } from './IntelligentInsightsSection';
import { ActionCard } from './ActionCard';
import { MetricsService } from '../services/metrics.service';

const { width } = Dimensions.get('window');

interface FoodResultsScreenProps {
  results: {
    calories: number;
    carbohydrates: number;
    proteins: number;
    fats: number;
    fiber?: number;
    healthScore: number;
    recommendations: string[];
    identifiedFoods?: string[];
    mealType?: string;
  };
  fullAnalysisResult?: any; // Full analysis result from backend
  onRetake: () => void;
  onDone: () => void;
}

// Video URI per Food Analysis
const heroVideoUri = require('../assets/videos/food-analysis-video.mp4');

export const FoodResultsScreen: React.FC<FoodResultsScreenProps> = ({
  results,
  fullAnalysisResult,
  onRetake,
  onDone,
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const { t } = useTranslation();

  // Extract identified foods from fullAnalysisResult if available
  const identifiedFoods = fullAnalysisResult?.identified_foods || results.identifiedFoods || [];

  // Calculate derived metrics
  const totalMacros = results.carbohydrates + results.proteins + results.fats;
  const carbsPct = totalMacros > 0 ? Math.round((results.carbohydrates / totalMacros) * 100) : 0;
  const proteinPct = totalMacros > 0 ? Math.round((results.proteins / totalMacros) * 100) : 0;
  const fatsPct = totalMacros > 0 ? Math.round((results.fats / totalMacros) * 100) : 0;

  // Mock daily goals for context (in a real app, these would come from user profile)
  const dailyGoals = {
    calories: 2000,
    carbohydrates: 250,
    proteins: 150,
    fats: 65,
    fiber: 25,
  };

  // Calculate buckets for metrics
  const getProteinBucket = (value: number) => {
    const pct = (value / dailyGoals.proteins) * 100;
    if (pct < 50) return { label: 'Low', color: '#ef4444', icon: '⚠️', description: 'Below recommended' };
    if (pct < 80) return { label: 'Moderate', color: '#f59e0b', icon: '📊', description: 'Getting there' };
    if (pct < 120) return { label: 'Optimal', color: '#10b981', icon: '✅', description: 'Good protein balance' };
    return { label: 'High', color: '#3b82f6', icon: '💪', description: 'Excellent protein intake' };
  };

  const getCarbsBucket = (value: number) => {
    const pct = (value / dailyGoals.carbohydrates) * 100;
    if (pct < 50) return { label: 'Low', color: '#f59e0b', icon: '📉', description: 'Low carb intake' };
    if (pct < 100) return { label: 'Moderate', color: '#10b981', icon: '📊', description: 'Balanced carbs' };
    return { label: 'High', color: '#3b82f6', icon: '⚡', description: 'High energy source' };
  };

  const getFatsBucket = (value: number) => {
    const pct = (value / dailyGoals.fats) * 100;
    if (pct < 50) return { label: 'Low', color: '#f59e0b', icon: '📉', description: 'Low fat intake' };
    if (pct < 100) return { label: 'Moderate', color: '#10b981', icon: '📊', description: 'Balanced fats' };
    return { label: 'High', color: '#3b82f6', icon: '🥑', description: 'Good fat content' };
  };

  const getFiberBucket = (value: number) => {
    if (!value) return { label: 'N/A', color: '#6b7280', icon: '—', description: 'Not detected' };
    const pct = (value / dailyGoals.fiber) * 100;
    if (pct < 50) return { label: 'Low', color: '#ef4444', icon: '⚠️', description: 'Eat more fiber' };
    if (pct < 100) return { label: 'Moderate', color: '#f59e0b', icon: '📊', description: 'Getting there' };
    return { label: 'Optimal', color: '#10b981', icon: '✅', description: 'Good fiber intake' };
  };

  // Prepare data for IntelligentInsightsSection
  const insightsData = useMemo(() => ({
    healthScore: results.healthScore,
    macros: {
      carbs: results.carbohydrates,
      protein: results.proteins,
      fat: results.fats,
      fiber: results.fiber || 0,
    },
    calories: results.calories,
    mealType: results.mealType || fullAnalysisResult?.meal_type || 'meal',
    identifiedFoods,
    observations: fullAnalysisResult?.observations || [],
  }), [results, fullAnalysisResult, identifiedFoods]);

  // Generate actions from recommendations
  const actions = useMemo(() => {
    return results.recommendations.map((rec, index) => ({
      id: `rec-${index}`,
      title: 'Dietary Recommendation',
      description: rec,
      category: 'nutrition',
      priority: index === 0 ? 'high' : 'medium',
      actionable: true,
      estimatedTime: '5 min',
    }));
  }, [results.recommendations]);

  return (
    <LinearGradient
      colors={isDark ? ['#111827', '#1f2937'] : ['#f8fafc', '#e2e8f0']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <ResultHero
          title={t('analysis.food.healthScore') || 'Health Score'}
          subtitle={results.healthScore >= 70 
            ? t('analysis.food.excellent') || 'Excellent Nutrition'
            : results.healthScore >= 40 
            ? t('analysis.food.good') || 'Good Nutrition'
            : t('analysis.food.needsImprovement') || 'Needs Improvement'}
          score={results.healthScore}
          color={results.healthScore > 70 ? '#10b981' : results.healthScore > 40 ? '#f59e0b' : '#ef4444'}
          style={styles.hero}
        />

        <View style={styles.contentContainer}>
          {/* Intelligent Insights */}
          <IntelligentInsightsSection
            category="food"
            data={insightsData}
            showTitle={true}
            maxInsights={2}
          />

          {/* Metrics Grid */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('analysis.food.nutritionalBreakdown') || 'NUTRITIONAL BREAKDOWN'}
          </Text>

          <View style={styles.metricsGrid}>
            {/* Calories */}
            <EnhancedMetricTile
              metric="calories"
              value={results.calories}
              label={t('analysis.food.calories') || 'Calories'}
              color="#ef4444"
              icon="fire"
              bucket={{
                label: 'Intake',
                color: '#ef4444',
                icon: '🔥',
                description: `${Math.round((results.calories / dailyGoals.calories) * 100)}% of daily goal`
              }}
              expanded={true}
            />

            {/* Protein */}
            <EnhancedMetricTile
              metric="protein"
              value={results.proteins}
              label={t('analysis.food.protein') || 'Protein'}
              color="#3b82f6"
              icon="food-steak"
              bucket={getProteinBucket(results.proteins)}
            />

            {/* Carbs */}
            <EnhancedMetricTile
              metric="carbs"
              value={results.carbohydrates}
              label={t('analysis.food.carbs') || 'Carbs'}
              color="#f97316"
              icon="noodles"
              bucket={getCarbsBucket(results.carbohydrates)}
            />

            {/* Fats */}
            <EnhancedMetricTile
              metric="fats"
              value={results.fats}
              label={t('analysis.food.fat') || 'Fats'}
              color="#fbbf24"
              icon="oil"
              bucket={getFatsBucket(results.fats)}
            />

            {/* Fiber (if available) */}
            {(results.fiber !== undefined || fullAnalysisResult?.macronutrients?.fiber) && (
              <EnhancedMetricTile
                metric="fiber"
                value={results.fiber || fullAnalysisResult?.macronutrients?.fiber || 0}
                label={t('analysis.food.fiber') || 'Fiber'}
                color="#10b981"
                icon="leaf"
                bucket={getFiberBucket(results.fiber || fullAnalysisResult?.macronutrients?.fiber || 0)}
              />
            )}
          </View>

          {/* Identified Foods */}
          {identifiedFoods.length > 0 && (
            <View style={styles.foodsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('analysis.food.identifiedFoods') || 'IDENTIFIED FOODS'}
              </Text>
              <View style={styles.foodsList}>
                {identifiedFoods.map((food: string, index: number) => (
                  <View key={index} style={[styles.foodChip, { backgroundColor: colors.surface }]}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} />
                    <Text style={[styles.foodText, { color: colors.text }]}>{food}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Actions / Recommendations */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
            {t('analysis.food.recommendations') || 'RECOMMENDATIONS'}
          </Text>

          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onComplete={() => { }}
              onDismiss={() => { }}
            />
          ))}

          {/* Bottom spacer for FAB */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.bottomBar}>
        <View style={styles.bottomBarContent}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={onRetake}
          >
            <MaterialCommunityIcons name="camera-retake" size={20} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {t('common.retake') || 'Retake'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.primaryButtonText}>
                {t('common.done') || 'Done'}
              </Text>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </BlurView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  hero: {
    height: 300,
    width: '100%',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  contentContainer: {
    padding: 20,
    marginTop: -40, // Overlap with hero
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    opacity: 0.7,
    marginTop: 16,
  },
  metricsGrid: {
    gap: 12,
  },
  foodsSection: {
    marginTop: 24,
  },
  foodsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  foodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  foodText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  bottomBarContent: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 16,
  },
  secondaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    height: 54,
    borderRadius: 27,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    flex: 1,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FoodResultsScreen;
