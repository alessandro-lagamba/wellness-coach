// @ts-nocheck
import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaWrapper } from './shared/SafeAreaWrapper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';
import { ResultHero } from './ResultHero';
import { EnhancedMetricTile } from './EnhancedMetricTile';
import { IntelligentInsightsSection } from './IntelligentInsightsSection';
import { NutritionRecommendationCard } from './NutritionRecommendationCard';

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
  const { t, language } = useTranslation();
  const { hideTabBar, showTabBar } = useTabBarVisibility();
  const insets = useSafeAreaInsets(); // 🔥 FIX: Per gestire bottom insets nelle bottom bars

  useEffect(() => {
    hideTabBar();
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);

  // 🔥 FIX: Gestisci il tasto indietro del sistema per tornare alla schermata overview
  useEffect(() => {
    const onBackPress = () => {
      onDone();
      return true; // Previeni il comportamento di default (navigare via dalla schermata)
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => subscription.remove();
  }, [onDone]);

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

  const macroGoals = useMemo(() => ({
    protein: dailyGoals.proteins,
    carbs: dailyGoals.carbohydrates,
    fats: dailyGoals.fats,
    fiber: dailyGoals.fiber,
  }), []);

  const macroEnergyFactors = {
    protein: 4,
    carbs: 4,
    fats: 9,
    fiber: 2,
  };

  const metricNames = language === 'it'
    ? { protein: 'proteine', carbs: 'carboidrati', fats: 'grassi', fiber: 'fibre' }
    : { protein: 'protein', carbs: 'carbs', fats: 'fat', fiber: 'fiber' };

  const statusLabels = language === 'it'
    ? { low: 'BASSO', moderate: 'MEDIO', good: 'ADEGUATO', high: 'ALTO' }
    : { low: 'LOW', moderate: 'MODERATE', good: 'BALANCED', high: 'HIGH' };

  const metricSuggestions = language === 'it'
    ? {
        protein: {
          low: 'Aggiungi legumi, pesce o carne bianca per bilanciare il piatto.',
          moderate: 'Una piccola porzione di proteine magre completerà il pasto.',
          good: 'Quota proteica in linea con l’obiettivo giornaliero.',
          high: 'Le proteine sono già abbondanti, accompagna con verdure o cereali integrali.',
        },
        carbs: {
          low: 'Integra cereali integrali o pane per avere energia a rilascio lento.',
          moderate: 'Apporto di carboidrati discreto, abbinalo a fibre per stabilizzare la glicemia.',
          good: 'Energia ben distribuita, continua così.',
          high: 'Molti carboidrati: aggiungi proteine o verdure per bilanciare il piatto.',
        },
        fats: {
          low: 'Grassi molto bassi: usa olio extravergine o frutta secca per assorbire vitamine.',
          moderate: 'Grassi nella norma, ottimo per un pasto leggero.',
          good: 'Grassi equilibrati rispetto all’obiettivo.',
          high: 'Grassi elevati: riduci condimenti o salumi e aggiungi verdure fresche.',
        },
        fiber: {
          low: 'Abbina insalata, verdure o legumi per supportare digestione e sazietà.',
          moderate: 'Puoi aumentare ancora la fibra con frutta o cereali integrali.',
          good: 'Ottimo apporto di fibre per un pasto completo.',
          high: 'Fibra abbondante: bevi acqua per favorire la digestione.',
        },
      }
    : {
        protein: {
          low: 'Add lean protein (fish, legumes, chicken) to balance the plate.',
          moderate: 'A small protein side will complete the meal.',
          good: 'Protein intake is aligned with your daily target.',
          high: 'Protein load is already high, pair with veggies or whole grains.',
        },
        carbs: {
          low: 'Add whole grains or bread to keep energy stable.',
          moderate: 'Decent carb intake, pair with fiber to stabilise glucose.',
          good: 'Energy is well distributed across carbs.',
          high: 'High carbs: add proteins or veggies to balance the plate.',
        },
        fats: {
          low: 'Very low fat: add olive oil or nuts to absorb fat-soluble vitamins.',
          moderate: 'Fats are within a good range for a light meal.',
          good: 'Fat intake is balanced with your target.',
          high: 'High fat: reduce dressings or cured meats and add fresh veggies.',
        },
        fiber: {
          low: 'Pair with salad, veggies or legumes to support digestion and satiety.',
          moderate: 'You can boost fiber further with fruit or whole grains.',
          good: 'Great fiber intake for a complete meal.',
          high: 'Fiber is high: remember to drink water to aid digestion.',
        },
      };

  const buildMacroBucket = (metricKey: 'protein' | 'carbs' | 'fats' | 'fiber', value: number) => {
    const goal = macroGoals[metricKey] || 1;
    const ratio = goal > 0 ? value / goal : 0;
    const ratioPercent = Math.round(ratio * 100);
    const energyFactor = macroEnergyFactors[metricKey] || 4;
    const mealShare = results.calories > 0
      ? Math.round(((value * energyFactor) / results.calories) * 100)
      : null;

    let status: 'low' | 'moderate' | 'good' | 'high';
    if (ratio < 0.35) status = 'low';
    else if (ratio < 0.75) status = 'moderate';
    else if (ratio <= 1.2) status = 'good';
    else status = 'high';

    const colors = {
      low: '#ef4444',
      moderate: '#f59e0b',
      good: '#10b981',
      high: '#3b82f6',
    };

    const baseText = language === 'it'
      ? `Questo piatto copre circa il ${ratioPercent}% del tuo obiettivo giornaliero di ${metricNames[metricKey]}${mealShare !== null ? ` (${mealShare}% delle calorie del pasto).` : '.'}`
      : `This meal covers about ${ratioPercent}% of your daily ${metricNames[metricKey]} target${mealShare !== null ? ` (${mealShare}% of the meal calories).` : '.'}`;

    const suggestion = metricSuggestions[metricKey][status];

    return {
      label: statusLabels[status],
      color: colors[status],
      icon: '',
      description: `${baseText} ${suggestion}`,
      status,
    };
  };


  // Calculate buckets for metrics
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

  const fiberValue = results.fiber || fullAnalysisResult?.macronutrients?.fiber || 0;

  const proteinBucket = useMemo(
    () => buildMacroBucket('protein', results.proteins),
    [results.proteins, results.calories, language],
  );

  const carbsBucket = useMemo(
    () => buildMacroBucket('carbs', results.carbohydrates),
    [results.carbohydrates, results.calories, language],
  );

  const fatsBucket = useMemo(
    () => buildMacroBucket('fats', results.fats),
    [results.fats, results.calories, language],
  );

  const fiberBucket = useMemo(
    () => buildMacroBucket('fiber', fiberValue),
    [fiberValue, results.calories, language],
  );

  const caloriesBucket = useMemo(() => {
    const percent = Math.round((results.calories / dailyGoals.calories) * 100);
    return {
      label: language === 'it' ? 'APPORTO' : 'INTAKE',
      color: '#ef4444',
      icon: '🔥',
      description: language === 'it'
        ? `Questo pasto copre circa il ${percent}% del tuo obiettivo calorico quotidiano.`
        : `This meal provides roughly ${percent}% of your daily calorie goal.`,
    };
  }, [results.calories, language]);

  const personalizedRecommendations = useMemo(() => {
    const tips: { id: string; title: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];
    const mainDish = identifiedFoods[0] || (language === 'it' ? 'questo pasto' : 'this meal');

    const pushTip = (priority: 'high' | 'medium' | 'low', titleIt: string, titleEn: string, descIt: string, descEn: string) => {
      tips.push({
        id: `rec-${tips.length}`,
        title: language === 'it' ? titleIt : titleEn,
        description: language === 'it' ? descIt : descEn,
        priority,
      });
    };

    if (proteinBucket.status === 'low') {
      pushTip(
        'high',
        'Alza le proteine',
        'Boost protein',
        `Aggiungi legumi, pesce o carni bianche per rendere ${mainDish} più saziante e bilanciato.`,
        `Add legumes, fish or lean meat to make ${mainDish} more filling and balanced.`,
      );
    }

    if (fiberBucket.status === 'low') {
      pushTip(
        'high',
        'Aggiungi Verdure',
        'Add vegetables',
        `Abbina ${mainDish} a insalata, verdure cotte o legumi per aumentare la fibra e migliorare la digestione.`,
        `Pair ${mainDish} with salad, cooked veggies or legumes to boost fiber and digestion.`,
      );
    }

    if (fatsBucket.status === 'high') {
      pushTip(
        'medium',
        'Alleggerisci i condimenti',
        'Lighten dressings',
        `Riduci salse e formaggi e aggiungi verdure fresche per equilibrare i grassi del piatto.`,
        `Reduce sauces and cheese and add fresh veggies to balance the fat load of this dish.`,
      );
    }

    if (carbsBucket.status === 'high') {
      pushTip(
        'medium',
        'Porzioni di carboidrati',
        'Carb portions',
        `Dividi la porzione di carboidrati e completa con proteine magre per un rilascio energetico più stabile.`,
        `Split the carb portion and add lean proteins for steadier energy.`,
      );
    }

    if (results.calories > 750) {
      pushTip(
        'medium',
        'Pasto Sostanzioso',
        'Hearty meal',
        'Considera di spezzare il piatto in due momenti o aggiungi una fonte proteica più leggera per evitare picchi energetici.',
        'Consider splitting this meal in two moments or adding a lighter protein to avoid energy peaks.',
      );
    }

    if (tips.length === 0) {
      pushTip(
        'low',
        'Mantieni l’equilibrio',
        'Keep the balance',
        'Il profilo nutrizionale è già ben distribuito. Mantieni idratazione e abbina verdure per un pasto completo.',
        'The nutritional profile is already well distributed. Stay hydrated and add veggies for a complete meal.',
      );
    }

    return tips;
  }, [
    identifiedFoods,
    language,
    proteinBucket.status,
    fiberBucket.status,
    fatsBucket.status,
    carbsBucket.status,
    results.calories,
  ]);

  const recommendations = personalizedRecommendations;

  // Determine hero color based on health score
  const heroColor = results.healthScore > 70 ? '#10b981' : results.healthScore > 40 ? '#f59e0b' : '#ef4444';
  
  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          {/* Metrics Grid */}
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 32 }]} numberOfLines={2} ellipsizeMode="tail">
            {t('analysis.food.nutritionalBreakdown') || 'NUTRITIONAL BREAKDOWN'}
          </Text>

          <View style={styles.metricsGrid}>
            {/* Calories */}
            <EnhancedMetricTile
              metric="calories"
              value={results.calories}
              label={t('analysis.food.metrics.calories') || 'Calories'}
              color="#ef4444"
              icon="fire"
              bucket={caloriesBucket}
              expanded={true}
            />

            {/* Protein */}
            <EnhancedMetricTile
              metric="protein"
              value={results.proteins}
              label={t('analysis.food.metrics.proteins') || 'Protein'}
              color="#3b82f6"
              icon="food-steak"
              bucket={proteinBucket}
            />

            {/* Carbs */}
            <EnhancedMetricTile
              metric="carbs"
              value={results.carbohydrates}
              label={t('analysis.food.metrics.carbohydrates') || 'Carbs'}
              color="#f97316"
              icon="noodles"
              bucket={carbsBucket}
            />

            {/* Fats */}
            <EnhancedMetricTile
              metric="fats"
              value={results.fats}
              label={t('analysis.food.metrics.fats') || 'Fats'}
              color="#fbbf24"
              icon="oil"
              bucket={fatsBucket}
            />

            {/* Fiber (if available) */}
            {(results.fiber !== undefined || fullAnalysisResult?.macronutrients?.fiber) && (
              <EnhancedMetricTile
                metric="fiber"
                value={fiberValue}
                label={t('analysis.food.metrics.fiber') || 'Fiber'}
                color="#10b981"
                icon="leaf"
                bucket={fiberBucket}
              />
            )}
          </View>

          {/* Identified Foods */}
          {identifiedFoods.length > 0 && (
            <View style={styles.foodsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">
                {t('analysis.food.results.identifiedFoods') || 'IDENTIFIED FOODS'}
              </Text>
              <View style={styles.foodsList}>
                {identifiedFoods.map((food: string, index: number) => (
                  <View key={index} style={[styles.foodChip, { backgroundColor: colors.surface }]}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} />
                    <Text style={[styles.foodText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{food}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Intelligent Insights */}
          <IntelligentInsightsSection
            category="food"
            data={insightsData}
            showTitle={true}
            maxInsights={3}
            compact={false}
          />

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]} numberOfLines={2} ellipsizeMode="tail">
                {t('analysis.food.results.recommendations') || 'RACCOMANDAZIONI'}
          </Text>

              {recommendations.map((rec) => (
                <NutritionRecommendationCard
                  key={rec.id}
                  title={rec.title}
                  description={rec.description}
                  priority={rec.priority}
                  index={parseInt(rec.id.split('-')[1])}
            />
          ))}
            </>
          )}

          {/* Bottom spacer for FAB */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomBar,
          { 
            backgroundColor: colors.background, 
            borderTopColor: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)',
          },
        ]}
      >
        <View
          style={[
            styles.bottomBarInner,
            {
              backgroundColor: colors.background,
              borderColor: isDark ? 'rgba(148,163,184,0.25)' : 'rgba(15,23,42,0.08)',
            },
          ]}
        >
          <View style={styles.bottomBarContent}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={onRetake}
            >
              <MaterialCommunityIcons name="camera-retake" size={18} color={colors.text} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {language === 'it' ? 'Ripeti' : 'Retake'}
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
        </View>
      </SafeAreaView>
    </View>
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
  mealInsightCard: {
    marginTop: 24,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  mealInsightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  mealInsightTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  mealInsightSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  mealInsightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mealInsightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mealInsightRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  mealInsightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInsightRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  mealInsightRowText: {
    fontSize: 13,
    lineHeight: 18,
  },
  mealInsightPriority: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  mealInsightPriorityText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
  },
  bottomBarInner: {
    borderRadius: 30,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  bottomBarContent: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
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
