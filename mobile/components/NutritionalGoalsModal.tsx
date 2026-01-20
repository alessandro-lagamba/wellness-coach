import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { AuthService } from '../services/auth.service';
import UnifiedAnalysisService from '../services/unified-analysis.service';

export type DietGoal = 'maintenance' | 'weight_loss' | 'bulk' | 'custom';

interface NutritionalGoals {
  daily_calories: number;
  carbs_percentage: number;
  proteins_percentage: number;
  fats_percentage: number;
  source: 'manual' | 'ai_suggested' | 'nutritionist';
  diet_goal?: DietGoal;
}

interface NutritionalGoalsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (goals: NutritionalGoals) => void;
  currentGoals?: NutritionalGoals | null;
}

export const NutritionalGoalsModal: React.FC<NutritionalGoalsModalProps> = ({
  visible,
  onClose,
  onSave,
  currentGoals,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [mode, setMode] = useState<'input' | 'ai'>('input');
  const [dietGoal, setDietGoal] = useState<DietGoal>(currentGoals?.diet_goal ?? 'maintenance');
  const [currentBMI, setCurrentBMI] = useState<{ value: number; category: string; color: string } | null>(null);

  // Store base TDEE calories separately
  const [baseCalories, setBaseCalories] = useState<number>(2000);

  const [goals, setGoals] = useState<NutritionalGoals>({
    daily_calories: currentGoals?.daily_calories ?? 2000,
    carbs_percentage: currentGoals?.carbs_percentage ?? 50,
    proteins_percentage: currentGoals?.proteins_percentage ?? 30,
    fats_percentage: currentGoals?.fats_percentage ?? 20,
    source: currentGoals?.source ?? 'manual',
    diet_goal: currentGoals?.diet_goal ?? 'maintenance',
  });

  useEffect(() => {
    if (currentGoals) {
      setGoals({
        daily_calories: currentGoals.daily_calories ?? 2000,
        carbs_percentage: currentGoals.carbs_percentage ?? 50,
        proteins_percentage: currentGoals.proteins_percentage ?? 30,
        fats_percentage: currentGoals.fats_percentage ?? 20,
        source: currentGoals.source ?? 'manual',
        diet_goal: currentGoals.diet_goal ?? 'maintenance',
      });
      setDietGoal(currentGoals.diet_goal ?? 'maintenance');
    }

    // Always fetch profile to get accurate TDEE and BMI
    fetchProfileData();
  }, [currentGoals, visible]);

  const fetchProfileData = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        const profile = await AuthService.getUserProfile(currentUser.id);
        if (profile) {
          // Calculate TDEE
          const tdee = calculateCalories(profile);
          setBaseCalories(tdee);

          // Calculate BMI
          if (profile.weight && profile.height) {
            const heightM = profile.height / 100;
            const bmi = profile.weight / (heightM * heightM);
            let category = '';
            let color = colors.text;

            if (bmi < 18.5) { category = t('analysis.food.goals.bmi.underweight'); color = '#3b82f6'; }
            else if (bmi < 25) { category = t('analysis.food.goals.bmi.normal'); color = '#10b981'; }
            else if (bmi < 30) { category = t('analysis.food.goals.bmi.overweight'); color = '#f59e0b'; }
            else { category = t('analysis.food.goals.bmi.obese'); color = '#ef4444'; }

            setCurrentBMI({ value: parseFloat(bmi.toFixed(1)), category, color });
          }
        }
      }
    } catch (error) {
      console.warn('Error fetching profile for goals:', error);
    }
  };

  // 🔥 FIX: Auto-calculate TDEE when modal opens if no goals are set
  useEffect(() => {
    const autoCalculate = async () => {
      if (!visible || currentGoals) return;

      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          const profile = await AuthService.getUserProfile(currentUser.id);
          if (profile?.age && profile?.weight && profile?.height && profile?.gender && profile.gender !== 'prefer_not_to_say') {
            const calculatedCalories = calculateCalories(profile);
            setBaseCalories(calculatedCalories);
            setGoals(prev => ({
              ...prev,
              daily_calories: calculatedCalories,
            }));
          }
        }
      } catch (error) {
        console.warn('Auto-calculate TDEE failed:', error);
      }
    };

    autoCalculate();
  }, [visible]);

  // 🔥 FIX: Apply diet goal presets based on BASE calories, not current adjusted calories
  const applyDietGoal = (goal: DietGoal) => {
    setDietGoal(goal);

    // Always use base calories (TDEE) as the reference point
    const tdee = baseCalories || 2000;
    let adjustedCalories = tdee;
    let carbs = 50;
    let proteins = 30;
    let fats = 20;

    switch (goal) {
      case 'weight_loss':
        // 🔥 FIX: Apply 20% deficit from TDEE (safe calorie deficit for weight loss)
        adjustedCalories = Math.max(1200, Math.round(tdee * 0.80)); // -20% deficit, minimum 1200
        carbs = 40;
        proteins = 35; // Higher protein to preserve muscle
        fats = 25;
        break;
      case 'bulk':
        // 🔥 FIX: Apply 15% surplus from TDEE
        adjustedCalories = Math.round(tdee * 1.15); // +15% surplus
        carbs = 50;
        proteins = 30;
        fats = 20;
        break;
      case 'maintenance':
        // 🔥 FIX: Use exact TDEE
        adjustedCalories = tdee;
        carbs = 50;
        proteins = 30;
        fats = 20;
        break;
      case 'custom':
        // Don't change anything
        return;
    }

    setGoals({
      ...goals,
      daily_calories: adjustedCalories,
      carbs_percentage: carbs,
      proteins_percentage: proteins,
      fats_percentage: fats,
      diet_goal: goal,
    });
  };

  const handleAISuggestion = async () => {
    try {
      setAiLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        Alert.alert(t('common.error'), t('analysis.food.goals.noUser'));
        return;
      }

      const profile = await AuthService.getUserProfile(currentUser.id);
      if (!profile) {
        Alert.alert(t('common.error'), t('analysis.food.goals.noProfile'));
        return;
      }

      // Check if all required data is available
      if (!profile.age || !profile.weight || !profile.height || !profile.gender || profile.gender === 'prefer_not_to_say') {
        Alert.alert(
          t('analysis.food.goals.missingData'),
          t('analysis.food.goals.missingDataDesc')
        );
        return;
      }

      // Check if activity level is set
      if (!profile.activity_level) {
        Alert.alert(
          t('analysis.food.goals.missingActivityLevel'),
          t('analysis.food.goals.missingActivityLevelDesc'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('analysis.food.goals.setActivityLevel'),
              onPress: () => {
                // Show activity level selector
                Alert.alert(
                  t('analysis.food.goals.selectActivityLevel'),
                  t('analysis.food.goals.selectActivityLevelDesc'),
                  [
                    { text: t('analysis.food.goals.activityLevels.sedentary'), onPress: () => saveActivityLevelAndCalculate('sedentary', profile) },
                    { text: t('analysis.food.goals.activityLevels.lightlyActive'), onPress: () => saveActivityLevelAndCalculate('lightly_active', profile) },
                    { text: t('analysis.food.goals.activityLevels.moderatelyActive'), onPress: () => saveActivityLevelAndCalculate('moderately_active', profile) },
                    { text: t('analysis.food.goals.activityLevels.veryActive'), onPress: () => saveActivityLevelAndCalculate('very_active', profile) },
                    { text: t('analysis.food.goals.activityLevels.extremelyActive'), onPress: () => saveActivityLevelAndCalculate('extremely_active', profile) },
                    { text: t('common.cancel'), style: 'cancel' }
                  ]
                );
              }
            }
          ]
        );
        return;
      }

      // Calculate suggested calories using BMR + activity level
      const suggestedCalories = calculateCalories(profile);

      // 🔥 FIX: Store base calories for diet goal calculations
      setBaseCalories(suggestedCalories);

      const suggestedGoals: NutritionalGoals = {
        daily_calories: suggestedCalories,
        carbs_percentage: 50,
        proteins_percentage: 30,
        fats_percentage: 20,
        source: 'ai_suggested',
        diet_goal: 'maintenance',
      };

      setGoals(suggestedGoals);
      setDietGoal('maintenance');
      setMode('input');
      Alert.alert(t('analysis.food.goals.aiSuggestionReady'), t('analysis.food.goals.aiSuggestionDesc'));
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      Alert.alert(t('common.error'), t('analysis.food.goals.aiError'));
    } finally {
      setAiLoading(false);
    }
  };

  const saveActivityLevelAndCalculate = async (activityLevel: string, profile: any) => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        await AuthService.updateUserProfile(currentUser.id, {
          activity_level: activityLevel as any,
        });

        // Update profile with new activity level
        const updatedProfile = { ...profile, activity_level: activityLevel };

        // Calculate suggested calories
        const suggestedCalories = calculateCalories(updatedProfile);

        // 🔥 FIX: Store base calories for diet goal calculations
        setBaseCalories(suggestedCalories);

        const suggestedGoals: NutritionalGoals = {
          daily_calories: suggestedCalories,
          carbs_percentage: 50,
          proteins_percentage: 30,
          fats_percentage: 20,
          source: 'ai_suggested',
          diet_goal: 'maintenance',
        };

        setGoals(suggestedGoals);
        setDietGoal('maintenance');
        setMode('input');
        Alert.alert(t('analysis.food.goals.aiSuggestionReady'), t('analysis.food.goals.aiSuggestionDesc'));
      }
    } catch (error) {
      console.error('Error saving activity level:', error);
      Alert.alert(t('common.error'), t('analysis.food.goals.saveError'));
    }
  };

  const calculateCalories = (profile: any): number => {
    // BMR calculation (Mifflin-St Jeor Equation)
    if (!profile.weight || !profile.height || !profile.age || !profile.gender || profile.gender === 'prefer_not_to_say') {
      return 2000; // Default
    }

    const weight = profile.weight;
    const height = profile.height;
    const age = profile.age;

    // BMR calculation (Mifflin-St Jeor Equation)
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    if (profile.gender === 'male') {
      bmr += 5;
    } else if (profile.gender === 'female') {
      bmr -= 161;
    }

    // Activity multipliers (Harris-Benedict / TDEE factors)
    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,              // Little or no exercise
      lightly_active: 1.375,       // Light exercise 1-3 days/week
      moderately_active: 1.55,     // Moderate exercise 3-5 days/week
      very_active: 1.725,          // Hard exercise 6-7 days/week
      extremely_active: 1.9,       // Very hard exercise, physical job
    };

    // Get activity multiplier (default to sedentary if not specified)
    const activityMultiplier = activityMultipliers[profile.activity_level || 'sedentary'] || 1.2;

    // Calculate TDEE (Total Daily Energy Expenditure) = BMR × Activity Multiplier
    return Math.round(bmr * activityMultiplier);
  };

  const handleSave = () => {
    // Validate percentages sum to 100
    const total = (goals.carbs_percentage ?? 50) + (goals.proteins_percentage ?? 30) + (goals.fats_percentage ?? 20);
    if (Math.abs(total - 100) > 1) {
      Alert.alert(t('common.error'), t('analysis.food.goals.percentagesError'));
      return;
    }

    if ((goals.daily_calories ?? 2000) <= 0) {
      Alert.alert(t('common.error'), t('analysis.food.goals.caloriesError'));
      return;
    }

    onSave({ ...goals, diet_goal: dietGoal });
  };

  const updatePercentage = (field: 'carbs_percentage' | 'proteins_percentage' | 'fats_percentage', value: number) => {
    const newValue = Math.max(0, Math.min(100, value));

    // Aggiorna solo il campo modificato, senza toccare gli altri
    setGoals(prev => ({
      ...prev,
      [field]: newValue
    }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['bottom']} style={styles.safeArea}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('analysis.food.goals.title')}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <FontAwesome name="times" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollViewContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >

                {/* Daily Calories */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('analysis.food.goals.dailyCalories')}</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={(goals.daily_calories ?? 2000).toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 0;
                        setGoals({ ...goals, daily_calories: num });
                      }}
                      keyboardType="numeric"
                      placeholder="2000"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={[styles.unitText, { color: colors.textSecondary }]}>kcal</Text>
                  </View>
                </View>

                {/* Macronutrient Percentages */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.goals.macronutrients')}</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('analysis.food.goals.macronutrientsDesc')}</Text>

                {/* Carbohydrates */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('analysis.food.metrics.carbohydrates')}</Text>
                    <Text style={[styles.percentageDisplay, { color: colors.primary }]}>{goals.carbs_percentage ?? 50}%</Text>
                  </View>
                  <View style={[styles.sliderContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      defaultValue={(goals.carbs_percentage ?? 50).toString()}
                      onEndEditing={(e) => {
                        const num = parseFloat(e.nativeEvent.text) || 0;
                        updatePercentage('carbs_percentage', num);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="50"
                      placeholderTextColor={colors.textTertiary}
                      returnKeyType="done"
                    />
                    <Text style={[styles.unitText, { color: colors.textSecondary }]}>%</Text>
                  </View>
                  <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                    {t('analysis.food.goals.carbsDesc')}
                  </Text>
                </View>

                {/* Proteins */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('analysis.food.metrics.proteins')}</Text>
                    <Text style={[styles.percentageDisplay, { color: colors.error }]}>{goals.proteins_percentage ?? 30}%</Text>
                  </View>
                  <View style={[styles.sliderContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      defaultValue={(goals.proteins_percentage ?? 30).toString()}
                      onEndEditing={(e) => {
                        const num = parseFloat(e.nativeEvent.text) || 0;
                        updatePercentage('proteins_percentage', num);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="30"
                      placeholderTextColor={colors.textTertiary}
                      returnKeyType="done"
                    />
                    <Text style={[styles.unitText, { color: colors.textSecondary }]}>%</Text>
                  </View>
                  <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                    {t('analysis.food.goals.proteinsDesc')}
                  </Text>
                </View>

                {/* Fats */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('analysis.food.metrics.fats')}</Text>
                    <Text style={[styles.percentageDisplay, { color: colors.accent }]}>{goals.fats_percentage ?? 20}%</Text>
                  </View>
                  <View style={[styles.sliderContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      defaultValue={(goals.fats_percentage ?? 20).toString()}
                      onEndEditing={(e) => {
                        const num = parseFloat(e.nativeEvent.text) || 0;
                        updatePercentage('fats_percentage', num);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="20"
                      placeholderTextColor={colors.textTertiary}
                      returnKeyType="done"
                    />
                    <Text style={[styles.unitText, { color: colors.textSecondary }]}>%</Text>
                  </View>
                  <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                    {t('analysis.food.goals.fatsDesc')}
                  </Text>
                </View>

                {/* Total Percentage Display */}
                <View style={[styles.totalDisplay, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <Text style={[styles.totalLabel, { color: colors.text }]}>{t('analysis.food.goals.total')}</Text>
                  <Text style={[
                    styles.totalValue,
                    { color: Math.abs(((goals.carbs_percentage ?? 50) + (goals.proteins_percentage ?? 30) + (goals.fats_percentage ?? 20)) - 100) < 1 ? colors.success : colors.error }
                  ]}>
                    {(goals.carbs_percentage ?? 50) + (goals.proteins_percentage ?? 30) + (goals.fats_percentage ?? 20)}%
                  </Text>
                </View>

                {/* Nutritionist Option */}
                <View style={[styles.nutritionistSection, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="doctor" size={24} color={colors.info} />
                  <Text style={[styles.nutritionistTitle, { color: colors.text }]}>{t('analysis.food.goals.nutritionistTitle')}</Text>
                  <Text style={[styles.nutritionistDesc, { color: colors.textSecondary }]}>{t('analysis.food.goals.nutritionistDesc')}</Text>
                  <TouchableOpacity
                    style={[styles.nutritionistButton, { borderColor: colors.info }]}
                    onPress={() => {
                      setGoals({ ...goals, source: 'nutritionist' });
                      Alert.alert(t('analysis.food.goals.nutritionistSet'), t('analysis.food.goals.nutritionistSetDesc'));
                    }}
                  >
                    <FontAwesome name="check" size={14} color={colors.info} />
                    <Text style={[styles.nutritionistButtonText, { color: colors.info }]}>
                      {t('analysis.food.goals.markAsNutritionist')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* BMI Section - Moved to bottom */}
                {currentBMI && (
                  <View style={[styles.bmiSection, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <View style={styles.bmiHeader}>
                      <View>
                        <Text style={[styles.bmiTitle, { color: colors.text }]}>BMI</Text>
                        <Text style={[styles.bmiValue, { color: currentBMI.color }]}>
                          {currentBMI.value} <Text style={{ fontSize: 16, fontWeight: '600' }}>- {currentBMI.category}</Text>
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="human-male-height" size={32} color={colors.primary} />
                    </View>

                    <View style={styles.bmiTable}>
                      <View style={styles.bmiRow}>
                        <Text style={[styles.bmiRowLabel, { color: colors.textSecondary }]}>&lt; 18.5</Text>
                        <Text style={[styles.bmiRowValue, { color: '#3b82f6' }]}>{t('analysis.food.goals.bmi.underweight')}</Text>
                      </View>
                      <View style={styles.bmiRow}>
                        <Text style={[styles.bmiRowLabel, { color: colors.textSecondary }]}>18.5 - 24.9</Text>
                        <Text style={[styles.bmiRowValue, { color: '#10b981' }]}>{t('analysis.food.goals.bmi.normal')}</Text>
                      </View>
                      <View style={styles.bmiRow}>
                        <Text style={[styles.bmiRowLabel, { color: colors.textSecondary }]}>25 - 29.9</Text>
                        <Text style={[styles.bmiRowValue, { color: '#f59e0b' }]}>{t('analysis.food.goals.bmi.overweight')}</Text>
                      </View>
                      <View style={styles.bmiRow}>
                        <Text style={[styles.bmiRowLabel, { color: colors.textSecondary }]}>&gt; 30</Text>
                        <Text style={[styles.bmiRowValue, { color: '#ef4444' }]}>{t('analysis.food.goals.bmi.obese')}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Save Button */}
              <View style={[styles.buttonContainer, { borderTopColor: colors.border }]}>
                {/* Calcolo la validità direttamente qui */}
                {(() => {
                  const currentTotal = (goals.carbs_percentage ?? 0) + (goals.proteins_percentage ?? 0) + (goals.fats_percentage ?? 0);
                  const isValid = Math.abs(currentTotal - 100) < 1;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        {
                          backgroundColor: colors.primary,
                          opacity: isValid ? 1 : 0.5 // Sbiadisce il pulsante se non valido
                        }
                      ]}
                      onPress={handleSave}
                      disabled={loading || !isValid} // Blocca il click se non valido
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                      ) : (
                        <>
                          <FontAwesome name="save" size={16} color={colors.textInverse} />
                          <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>
                            {isValid ? t('common.save') : `Totale: ${currentTotal}%`}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    maxHeight: '90%',
    width: '100%',
    alignSelf: 'stretch',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    flex: 1,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 10,
  },
  dietGoalSection: {
    marginBottom: 24,
  },
  dietGoalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  dietGoalCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
  },
  dietGoalText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiSection: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  aiSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  aiSectionDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  percentageDisplay: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  unitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bmiSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  bmiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bmiTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  bmiValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  bmiTable: {
    gap: 8,
  },
  bmiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  bmiRowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  bmiRowValue: {
    fontSize: 13,
    fontWeight: '600',
  },

  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  totalDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  nutritionistSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  nutritionistTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  nutritionistDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  nutritionistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  nutritionistButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
