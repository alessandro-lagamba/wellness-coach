// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { FoodAnalysisResult } from '../types/analysis.types';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

interface FoodResultsScreenProps {
  results: FoodAnalysisResult | null;
  fullAnalysisResult?: any;
  onGoBack: () => void;
  onRetake: () => void;
}

export const FoodResultsScreen: React.FC<FoodResultsScreenProps> = ({
  results,
  fullAnalysisResult,
  onGoBack,
  onRetake,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (!results) {
    return null;
  }

  const getHealthScore = () => {
    return results.health_score || fullAnalysisResult?.health_score || 70;
  };

  const getHealthLevel = (score: number) => {
    if (score >= 80) return { level: t('rating.excellent'), color: colors.success, description: t('analysis.food.health.excellent') };
    if (score >= 60) return { level: t('rating.good'), color: colors.info, description: t('analysis.food.health.good') };
    if (score >= 40) return { level: t('rating.fair'), color: colors.accent, description: t('analysis.food.health.fair') };
    return { level: t('rating.poor'), color: colors.error, description: t('analysis.food.health.poor') };
  };

  const healthScore = getHealthScore();
  const healthLevel = getHealthLevel(healthScore);
  const macronutrients = results.macronutrients || fullAnalysisResult?.macronutrients || {
    carbohydrates: 0,
    proteins: 0,
    fats: 0,
    calories: 0,
    fiber: 0,
  };

  const identifiedFoods = results.identified_foods || fullAnalysisResult?.identified_foods || [];
  const recommendations = results.recommendations || fullAnalysisResult?.recommendations || [];
  const observations = results.observations || fullAnalysisResult?.observations || [];
  const vitamins = results.vitamins || fullAnalysisResult?.vitamins || {};
  const minerals = results.minerals || fullAnalysisResult?.minerals || {};

  const mealTypeLabels: Record<string, string> = {
    breakfast: t('analysis.food.mealType.breakfast'),
    lunch: t('analysis.food.mealType.lunch'),
    dinner: t('analysis.food.mealType.dinner'),
    snack: t('analysis.food.mealType.snack'),
    other: t('analysis.food.mealType.other'),
  };

  const mealType = results.meal_type || fullAnalysisResult?.meal_type || 'other';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analysis.food.results.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{t('analysis.food.results.subtitle')}</Text>
        </View>

        {/* Main Health Score Card */}
        <View style={styles.healthCard}>
          <LinearGradient
            colors={[healthLevel.color, `${healthLevel.color}80`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.healthGradient}
          >
            <View style={styles.healthIconContainer}>
              <FontAwesome name="cutlery" size={48} color={colors.textInverse} />
            </View>
            <Text style={[styles.healthTitle, { color: colors.textInverse }]}>{healthLevel.level} {t('analysis.food.results.nutrition')}</Text>
            <Text style={[styles.healthDescription, { color: 'rgba(255,255,255,0.9)' }]}>{healthLevel.description}</Text>
            
            <View style={styles.healthMetricsRow}>
              <View style={styles.healthMetricItem}>
                <Text style={[styles.healthMetricLabel, { color: 'rgba(255,255,255,0.8)' }]}>{t('analysis.food.header.healthScore')}</Text>
                <Text style={[styles.healthMetricValue, { color: colors.textInverse }]}>{healthScore}/100</Text>
              </View>
              <View style={styles.healthMetricItem}>
                <Text style={[styles.healthMetricLabel, { color: 'rgba(255,255,255,0.8)' }]}>{t('analysis.food.results.mealType')}</Text>
                <Text style={[styles.healthMetricValue, { color: colors.textInverse }]}>{mealTypeLabels[mealType]}</Text>
              </View>
              <View style={styles.healthMetricItem}>
                <Text style={[styles.healthMetricLabel, { color: 'rgba(255,255,255,0.8)' }]}>{t('analysis.food.metrics.calories')}</Text>
                <Text style={[styles.healthMetricValue, { color: colors.textInverse }]}>{Math.round(macronutrients.calories)}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Identified Foods */}
        {identifiedFoods.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.results.identifiedFoods')}</Text>
            <View style={styles.foodsList}>
              {identifiedFoods.map((food, index) => (
                <View key={index} style={[styles.foodItem, { backgroundColor: colors.surfaceMuted }]}>
                  <FontAwesome name="circle" size={8} color={colors.accent} style={styles.foodBullet} />
                  <Text style={[styles.foodText, { color: colors.text }]}>{food}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Macronutrients Section */}
        <LinearGradient
          colors={[colors.surface, colors.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.metricsCard, { borderColor: colors.border }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.results.macronutrients')}</Text>
          <View style={styles.macrosGrid}>
            {/* Calories */}
            <View style={styles.macroCard}>
              <LinearGradient colors={[colors.accentLight + '40', colors.accent + '20']} style={styles.macroCardInner}>
                <View style={styles.macroCardHeader}>
                  <View style={[styles.macroIconContainer, { backgroundColor: colors.accent + '20' }]}>
                    <FontAwesome name="fire" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.macroInfo}>
                    <Text style={[styles.macroName, { color: colors.text }]}>{t('analysis.food.metrics.calories')}</Text>
                    <Text style={[styles.macroValue, { color: colors.accent }]}>
                      {Math.round(macronutrients.calories)} kcal
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Carbohydrates */}
            <View style={styles.macroCard}>
              <LinearGradient colors={[colors.success + '20', colors.success + '10']} style={styles.macroCardInner}>
                <View style={styles.macroCardHeader}>
                  <View style={[styles.macroIconContainer, { backgroundColor: colors.success + '20' }]}>
                    <FontAwesome name="leaf" size={20} color={colors.success} />
                  </View>
                  <View style={styles.macroInfo}>
                    <Text style={[styles.macroName, { color: colors.text }]}>{t('analysis.food.metrics.carbohydrates')}</Text>
                    <Text style={[styles.macroValue, { color: colors.success }]}>
                      {Math.round(macronutrients.carbohydrates)}g
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Proteins */}
            <View style={styles.macroCard}>
              <LinearGradient colors={[colors.error + '20', colors.error + '10']} style={styles.macroCardInner}>
                <View style={styles.macroCardHeader}>
                  <View style={[styles.macroIconContainer, { backgroundColor: colors.error + '20' }]}>
                    <FontAwesome name="heart" size={20} color={colors.error} />
                  </View>
                  <View style={styles.macroInfo}>
                    <Text style={[styles.macroName, { color: colors.text }]}>{t('analysis.food.metrics.proteins')}</Text>
                    <Text style={[styles.macroValue, { color: colors.error }]}>
                      {Math.round(macronutrients.proteins)}g
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Fats */}
            <View style={styles.macroCard}>
                <LinearGradient colors={[colors.accentLight + '40', colors.accent + '20']} style={styles.macroCardInner}>
                  <View style={styles.macroCardHeader}>
                    <View style={[styles.macroIconContainer, { backgroundColor: colors.accent + '20' }]}>
                      <FontAwesome name="circle" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.macroInfo}>
                    <Text style={[styles.macroName, { color: colors.text }]}>{t('analysis.food.metrics.fats')}</Text>
                      <Text style={[styles.macroValue, { color: colors.accent }]}>
                        {Math.round(macronutrients.fats)}g
                      </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Fiber */}
            {macronutrients.fiber !== undefined && macronutrients.fiber > 0 && (
              <View style={styles.macroCard}>
                <LinearGradient colors={[colors.success + '20', colors.success + '10']} style={styles.macroCardInner}>
                  <View style={styles.macroCardHeader}>
                    <View style={[styles.macroIconContainer, { backgroundColor: colors.success + '20' }]}>
                      <FontAwesome name="leaf" size={20} color={colors.success} />
                    </View>
                    <View style={styles.macroInfo}>
                      <Text style={[styles.macroName, { color: colors.text }]}>{t('analysis.food.metrics.fiber')}</Text>
                      <Text style={[styles.macroValue, { color: colors.success }]}>
                        {Math.round(macronutrients.fiber)}g
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Vitamins & Minerals Section */}
        {(Object.keys(vitamins).length > 0 || Object.keys(minerals).length > 0) && (
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.results.vitaminsMinerals')}</Text>
            
            {Object.keys(vitamins).length > 0 && (
              <View style={styles.nutrientsSection}>
                <Text style={[styles.nutrientsSubtitle, { color: colors.textSecondary }]}>{t('analysis.food.results.vitamins')}</Text>
                <View style={styles.nutrientsList}>
                  {Object.entries(vitamins).slice(0, 6).map(([key, value]) => (
                    <View key={key} style={styles.nutrientItem}>
                      <Text style={[styles.nutrientName, { color: colors.text }]}>
                        {key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                      <Text style={[styles.nutrientValue, { color: colors.textSecondary }]}>
                        {typeof value === 'number' ? value.toFixed(1) : value} {key.includes('vitamin') ? 'IU' : 'mg'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {Object.keys(minerals).length > 0 && (
              <View style={styles.nutrientsSection}>
                <Text style={[styles.nutrientsSubtitle, { color: colors.textSecondary }]}>{t('analysis.food.results.minerals')}</Text>
                <View style={styles.nutrientsList}>
                  {Object.entries(minerals).slice(0, 6).map(([key, value]) => (
                    <View key={key} style={styles.nutrientItem}>
                      <Text style={[styles.nutrientName, { color: colors.text }]}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Text>
                      <Text style={[styles.nutrientValue, { color: colors.textSecondary }]}>
                        {typeof value === 'number' ? value.toFixed(1) : value} mg
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.results.recommendations')}</Text>
            <View style={styles.recommendationsList}>
              {recommendations.map((recommendation, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <View style={[styles.recommendationIcon, { backgroundColor: `${healthLevel.color}20` }]}>
                    <FontAwesome name="check-circle" size={16} color={healthLevel.color} />
                  </View>
                  <Text style={[styles.recommendationText, { color: colors.text }]}>{recommendation}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Observations */}
        {observations.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.results.observations')}</Text>
            <View style={styles.observationsList}>
              {observations.map((observation, index) => (
                <View key={index} style={styles.observationItem}>
                  <FontAwesome name="info-circle" size={14} color={colors.textSecondary} style={styles.observationIcon} />
                  <Text style={[styles.observationText, { color: colors.textSecondary }]}>{observation}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.backButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            onPress={onGoBack}
            activeOpacity={0.7}
          >
            <FontAwesome name="arrow-left" size={16} color={colors.text} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.retakeButton]}
            onPress={onRetake}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.accent, colors.accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.retakeButtonGradient}
            >
              <FontAwesome name="camera" size={16} color={colors.textInverse} />
              <Text style={[styles.retakeButtonText, { color: colors.textInverse }]}>{t('analysis.food.startAnalysis')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  healthCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  healthGradient: {
    padding: 24,
    alignItems: 'center',
  },
  healthIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  healthTitle: {
    fontSize: 22,
    fontWeight: '700',
    // Color will be set inline with colors.textInverse
    marginBottom: 8,
  },
  healthDescription: {
    fontSize: 14,
    // Color will be set inline with rgba(255,255,255,0.9)
    textAlign: 'center',
    marginBottom: 20,
  },
  healthMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
  },
  healthMetricItem: {
    alignItems: 'center',
  },
  healthMetricLabel: {
    fontSize: 12,
    // Color will be set inline with rgba(255,255,255,0.8)
    marginBottom: 4,
  },
  healthMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    // Color will be set inline with colors.textInverse
  },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  foodsList: {
    gap: 12,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  foodBullet: {
    marginRight: 12,
  },
  foodText: {
    fontSize: 14,
    flex: 1,
  },
  metricsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  macroCardInner: {
    padding: 16,
  },
  macroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  macroInfo: {
    flex: 1,
  },
  macroName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  nutrientsSection: {
    marginBottom: 20,
  },
  nutrientsSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  nutrientsList: {
    gap: 10,
  },
  nutrientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  nutrientName: {
    fontSize: 14,
    flex: 1,
  },
  nutrientValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  recommendationsList: {
    gap: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recommendationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  observationsList: {
    gap: 10,
  },
  observationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  observationIcon: {
    marginTop: 2,
  },
  observationText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  backButton: {
    borderWidth: 1,
  },
  retakeButton: {
    overflow: 'hidden',
  },
  retakeButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  retakeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    // Color will be set inline with colors.textInverse
  },
});

