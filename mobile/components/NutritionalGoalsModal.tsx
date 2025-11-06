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
  }, [currentGoals]);

  // Apply diet goal presets
  const applyDietGoal = (goal: DietGoal) => {
    setDietGoal(goal);
    let adjustedCalories = goals.daily_calories ?? 2000;
    let carbs = 50;
    let proteins = 30;
    let fats = 20;

    switch (goal) {
      case 'weight_loss':
        adjustedCalories = Math.round(adjustedCalories * 0.85); // -15% deficit
        carbs = 40;
        proteins = 35;
        fats = 25;
        break;
      case 'bulk':
        adjustedCalories = Math.round(adjustedCalories * 1.15); // +15% surplus
        carbs = 50;
        proteins = 30;
        fats = 20;
        break;
      case 'maintenance':
        // Keep current calories, balanced macros
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
      const suggestedGoals: NutritionalGoals = {
        daily_calories: suggestedCalories,
        carbs_percentage: 50,
        proteins_percentage: 30,
        fats_percentage: 20,
        source: 'ai_suggested',
      };

      setGoals(suggestedGoals);
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
        const suggestedGoals: NutritionalGoals = {
          daily_calories: suggestedCalories,
          carbs_percentage: 50,
          proteins_percentage: 30,
          fats_percentage: 20,
          source: 'ai_suggested',
        };

        setGoals(suggestedGoals);
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
    
    // Calculate current total without the field being changed
    const otherFields = ['carbs_percentage', 'proteins_percentage', 'fats_percentage'].filter(f => f !== field) as Array<'carbs_percentage' | 'proteins_percentage' | 'fats_percentage'>;
    const defaultValue1 = otherFields[0] === 'carbs_percentage' ? 50 : otherFields[0] === 'proteins_percentage' ? 30 : 20;
    const defaultValue2 = otherFields[1] === 'carbs_percentage' ? 50 : otherFields[1] === 'proteins_percentage' ? 30 : 20;
    const currentOtherTotal = (goals[otherFields[0]] ?? defaultValue1) + (goals[otherFields[1]] ?? defaultValue2);
    const remainingTotal = 100 - newValue;
    
    // Distribute remaining percentage proportionally
    const ratio = currentOtherTotal > 0 ? remainingTotal / currentOtherTotal : 0.5;
    
    setGoals(prev => {
      const updated = { ...prev, [field]: newValue };
      updated[otherFields[0]] = Math.max(0, Math.min(100, Math.round(prev[otherFields[0]] * ratio)));
      updated[otherFields[1]] = Math.max(0, Math.min(100, Math.round(prev[otherFields[1]] * ratio)));
      
      // Ensure total is exactly 100
      const total = updated[field] + updated[otherFields[0]] + updated[otherFields[1]];
      if (total !== 100) {
        const diff = 100 - total;
        updated[otherFields[0]] = Math.max(0, Math.min(100, updated[otherFields[0]] + diff));
      }
      
      return updated;
    });
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
            {/* Diet Goal Selector */}
            <View style={styles.dietGoalSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('analysis.food.goals.dietGoal')}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {t('analysis.food.goals.dietGoalDesc')}
              </Text>
              <View style={styles.dietGoalGrid}>
                {(['maintenance', 'weight_loss', 'bulk', 'custom'] as DietGoal[]).map((goal) => (
                  <TouchableOpacity
                    key={goal}
                    style={[
                      styles.dietGoalCard,
                      dietGoal === goal && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                      { borderColor: colors.border, backgroundColor: colors.surfaceElevated }
                    ]}
                    onPress={() => applyDietGoal(goal)}
                  >
                    <MaterialCommunityIcons
                      name={
                        goal === 'maintenance' ? 'scale-balance' :
                        goal === 'weight_loss' ? 'trending-down' :
                        goal === 'bulk' ? 'trending-up' :
                        'tune'
                      }
                      size={24}
                      color={dietGoal === goal ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[
                      styles.dietGoalText,
                      { color: dietGoal === goal ? colors.primary : colors.text }
                    ]}>
                      {t(`analysis.food.goals.dietGoals.${goal}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Mode Selector */}
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'input' && { backgroundColor: colors.primary + '20' },
                  { borderColor: colors.border }
                ]}
                onPress={() => setMode('input')}
              >
                <FontAwesome name="edit" size={16} color={mode === 'input' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.modeButtonText, { color: mode === 'input' ? colors.primary : colors.textSecondary }]}>
                  {t('analysis.food.goals.manual')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'ai' && { backgroundColor: colors.accent + '20' },
                  { borderColor: colors.border }
                ]}
                onPress={() => setMode('ai')}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <FontAwesome name="magic" size={16} color={mode === 'ai' ? colors.accent : colors.textSecondary} />
                )}
                <Text style={[styles.modeButtonText, { color: mode === 'ai' ? colors.accent : colors.textSecondary }]}>
                  {t('analysis.food.goals.aiSuggestion')}
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'ai' && (
              <View style={[styles.aiSection, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="robot" size={32} color={colors.accent} />
                <Text style={[styles.aiSectionTitle, { color: colors.text }]}>{t('analysis.food.goals.aiTitle')}</Text>
                <Text style={[styles.aiSectionDesc, { color: colors.textSecondary }]}>{t('analysis.food.goals.aiDesc')}</Text>
                <TouchableOpacity
                  style={[styles.aiButton, { backgroundColor: colors.accent }]}
                  onPress={handleAISuggestion}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <>
                      <FontAwesome name="magic" size={16} color={colors.textInverse} />
                      <Text style={[styles.aiButtonText, { color: colors.textInverse }]}>
                        {t('analysis.food.goals.getAISuggestion')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

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
                  value={(goals.carbs_percentage ?? 50).toString()}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    updatePercentage('carbs_percentage', num);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="50"
                  placeholderTextColor={colors.textTertiary}
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
                  value={(goals.proteins_percentage ?? 30).toString()}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    updatePercentage('proteins_percentage', num);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="30"
                  placeholderTextColor={colors.textTertiary}
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
                  value={(goals.fats_percentage ?? 20).toString()}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    updatePercentage('fats_percentage', num);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="20"
                  placeholderTextColor={colors.textTertiary}
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
              </ScrollView>

              {/* Save Button */}
              <View style={[styles.buttonContainer, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <>
                      <FontAwesome name="save" size={16} color={colors.textInverse} />
                      <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>
                        {t('common.save')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
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
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
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
