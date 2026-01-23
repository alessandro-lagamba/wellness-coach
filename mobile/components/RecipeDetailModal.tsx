import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

interface RecipeDetailModalProps {
  visible: boolean;
  onClose: () => void;
  recipe: any | null;
  loading?: boolean;
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  visible,
  onClose,
  recipe,
  loading = false,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

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
                <Text style={[styles.modalTitle, { color: colors.text }]} allowFontScaling={false}>
                  {recipe ? recipe.title : t('analysis.food.recipes.loading')}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <FontAwesome name="times" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]} allowFontScaling={false}>
                    {t('analysis.food.recipes.generating')}
                  </Text>
                </View>
              ) : recipe ? (
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollViewContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Recipe Image */}
                  {recipe.image && (
                    <Image
                      source={{ uri: recipe.image }}
                      style={styles.recipeImage}
                      resizeMode="cover"
                    />
                  )}

                  {/* Recipe Meta */}
                  <View style={styles.recipeMeta}>
                    <View style={styles.recipeMetaItem}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.recipeMetaText, { color: colors.textSecondary }]} allowFontScaling={false}>
                        {recipe.readyInMinutes || recipe.ready_in_minutes || recipe.total_minutes || '?'} {t('analysis.food.fridge.minutes')}
                      </Text>
                    </View>
                    <View style={styles.recipeMetaItem}>
                      <MaterialCommunityIcons name="account-group" size={16} color={colors.textSecondary} />
                      <Text style={[styles.recipeMetaText, { color: colors.textSecondary }]} allowFontScaling={false}>
                        {recipe.servings} {t('analysis.food.fridge.servings')}
                      </Text>
                    </View>
                  </View>

                  {/* Macros Section - Handle both camelCase and snake_case field names */}
                  {(() => {
                    // Handle different field naming conventions
                    const calories = recipe.caloriesPerServing || recipe.calories_per_serving || 0;
                    const macros = recipe.macrosPerServing || recipe.macros || {};
                    const protein = macros?.protein || 0;
                    const carbs = macros?.carbs || 0;
                    const fat = macros?.fat || 0;

                    // Only show section if we have valid data
                    const hasNutrition = calories > 0 || protein > 0 || carbs > 0 || fat > 0;

                    if (!hasNutrition) return null;

                    return (
                      <View style={styles.macrosSection}>
                        <Text style={[styles.macrosTitle, { color: colors.text }]} allowFontScaling={false}>
                          {t('analysis.food.fridge.nutritionPerServing')}
                        </Text>
                        <View style={styles.macrosGrid}>
                          <View style={[styles.macroItem, { backgroundColor: colors.surfaceElevated }]}>
                            <Text style={[styles.macroValue, { color: colors.text }]}>
                              {Math.round(calories)}
                            </Text>
                            <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>kcal</Text>
                          </View>
                          <View style={[styles.macroItem, { backgroundColor: colors.surfaceElevated }]}>
                            <Text style={[styles.macroValue, { color: colors.text }]}>
                              {Math.round(protein)}g
                            </Text>
                            <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>
                              {t('analysis.food.metrics.proteins')}
                            </Text>
                          </View>
                          <View style={[styles.macroItem, { backgroundColor: colors.surfaceElevated }]}>
                            <Text style={[styles.macroValue, { color: colors.text }]}>
                              {Math.round(carbs)}g
                            </Text>
                            <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>
                              {t('analysis.food.metrics.carbohydrates')}
                            </Text>
                          </View>
                          <View style={[styles.macroItem, { backgroundColor: colors.surfaceElevated }]}>
                            <Text style={[styles.macroValue, { color: colors.text }]}>
                              {Math.round(fat)}g
                            </Text>
                            <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>
                              {t('analysis.food.metrics.fats')}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Ingredients Section */}
                  <View style={styles.ingredientsListSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]} allowFontScaling={false}>
                      {t('analysis.food.fridge.ingredients')}
                    </Text>
                    {recipe.ingredients && recipe.ingredients.map((ing: any, index: number) => (
                      <View key={index} style={styles.ingredientListItem}>
                        <MaterialCommunityIcons name="circle" size={6} color={colors.primary} />
                        <Text style={[styles.ingredientListItemText, { color: colors.text }]}>
                          {ing.quantity} {ing.unit} {ing.name}
                          {ing.optional && (
                            <Text style={[styles.optionalText, { color: colors.textTertiary }]}>
                              {' '}({t('analysis.food.fridge.optional')})
                            </Text>
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Steps Section */}
                  <View style={styles.stepsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]} allowFontScaling={false}>
                      {t('analysis.food.fridge.steps')}
                    </Text>
                    {recipe.steps && recipe.steps.map((step: string, index: number) => (
                      <View key={index} style={styles.stepItem}>
                        <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Tips Section */}
                  {recipe.tips && recipe.tips.length > 0 && (
                    <View style={styles.tipsSection}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]} allowFontScaling={false}>
                        {t('analysis.food.fridge.tips')}
                      </Text>
                      {recipe.tips.map((tip: string, index: number) => (
                        <View key={index} style={styles.tipItem}>
                          <MaterialCommunityIcons name="lightbulb" size={16} color={colors.accent} />
                          <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Shopping Gaps Section */}
                  {recipe.shoppingGaps && recipe.shoppingGaps.length > 0 && (
                    <View style={styles.shoppingGapsSection}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]} allowFontScaling={false}>
                        {t('analysis.food.fridge.missingIngredients')}
                      </Text>
                      {recipe.shoppingGaps.map((gap: string, index: number) => (
                        <View key={index} style={styles.shoppingGapItem}>
                          <MaterialCommunityIcons name="cart-outline" size={16} color={colors.warning} />
                          <Text style={[styles.shoppingGapText, { color: colors.textSecondary }]}>{gap}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              ) : null}

              {/* Close Button */}
              <View style={[styles.buttonContainer, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.closeButtonModal, { backgroundColor: colors.primary }]}
                  onPress={onClose}
                >
                  <Text style={[styles.closeButtonText, { color: colors.textInverse }]} allowFontScaling={false}>
                    {t('common.close')}
                  </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    fontFamily: 'Figtree_700Bold', // Was 700
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 10,
  },
  recipeImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  recipeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipeMetaText: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
  },
  macrosSection: {
    marginBottom: 20,
  },
  macrosTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold', // Was 600
    marginBottom: 12,
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroItem: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold', // Was 700
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium', // Was 500
  },
  ingredientsListSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold', // Was 700
    marginBottom: 16,
  },
  ingredientListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  ingredientListItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Figtree_500Medium',
  },
  optionalText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: 'Figtree_500Medium',
  },
  stepsSection: {
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontFamily: 'Figtree_700Bold', // Was 700
    color: '#ffffff',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Figtree_500Medium',
  },
  tipsSection: {
    marginBottom: 20,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Figtree_500Medium',
  },
  shoppingGapsSection: {
    marginBottom: 20,
  },
  shoppingGapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  shoppingGapText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  closeButtonModal: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold', // Was 700
  },
});





