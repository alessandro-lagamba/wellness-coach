import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import recipeLibraryService, { MealType, UserRecipe } from '../services/recipe-library.service';
import { NutritionService } from '../services/nutrition.service';

import { SafeAreaView } from 'react-native-safe-area-context';
interface RecipeEditorModalProps {
  visible: boolean;
  recipe: UserRecipe | null;
  onClose: () => void;
  onSaved: (recipe: UserRecipe) => void;
  onDeleted?: (recipeId: string) => void;
  mode?: 'edit' | 'create';
  initialDraft?: Partial<UserRecipe> | null;
  aiContext?: {
    identifiedFoods: string[];
    macrosEstimate?: {
      protein?: number;
      carbs?: number;
      fat?: number;
      fiber?: number;
      sugar?: number;
      calories?: number;
    };
    contextNotes?: string;
  } | null;
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const RecipeEditorModal: React.FC<RecipeEditorModalProps> = ({
  visible,
  recipe,
  onClose,
  onSaved,
  onDeleted,
  mode = 'edit',
  initialDraft = null,
  aiContext = null,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isCreateMode = mode === 'create';
  const [form, setForm] = useState({
    title: '',
    description: '',
    servings: 1,
    readyMinutes: '',
    mealTypes: new Set<MealType>(['dinner']),
    favorite: false,
    tags: '',
    notes: '',
    ingredients: '',
    steps: '',
  });
  const [saving, setSaving] = useState(false);
  const canUseAiComplete = !!aiContext && mode === 'create';

  const hydrateForm = (source?: Partial<UserRecipe> | null) => {
    const mealTypesValue =
      source?.meal_types && source.meal_types.length
        ? (source.meal_types as MealType[])
        : ['dinner'];
    const ingredientsValue = Array.isArray(source?.ingredients)
      ? source!.ingredients
          .map((ing) => {
            const quantity = ing.quantity ? `${ing.quantity} ` : '';
            const unit = ing.unit ? `${ing.unit} ` : '';
            return `${quantity}${unit}${ing.name}`.trim();
          })
          .join('\n')
      : '';
    const stepsValue = Array.isArray(source?.steps) ? source!.steps.join('\n') : '';

    setForm({
      title: source?.title || '',
      description: source?.description || '',
      servings: source?.servings || 1,
      readyMinutes: source?.ready_in_minutes
        ? String(source.ready_in_minutes)
        : source?.total_minutes
        ? String(source.total_minutes)
        : '',
      mealTypes: new Set<MealType>(mealTypesValue),
      favorite: source?.favorite ?? false,
      tags: source?.tags?.join(', ') || '',
      notes: source?.notes || '',
      ingredients: ingredientsValue,
      steps: stepsValue,
    });
  };

  useEffect(() => {
    if (!visible) {
      setSaving(false);
      return;
    }

    if (isCreateMode) {
      hydrateForm(initialDraft);
    } else if (recipe) {
      hydrateForm(recipe);
    }
  }, [visible, recipe, initialDraft, isCreateMode]);

  const handleToggleMealType = (type: MealType) => {
    setForm((prev) => {
      const updated = new Set(prev.mealTypes);
      if (updated.has(type)) {
        updated.delete(type);
      } else {
        updated.add(type);
      }
      if (updated.size === 0) {
        updated.add('dinner');
      }
      return { ...prev, mealTypes: updated };
    });
  };

  const buildPayload = () => {
    const ingredients = form.ingredients
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    const steps = form.steps
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const mealTypeArray = Array.from(form.mealTypes);

    return {
      title: form.title.trim(),
      description: form.description?.trim(),
      servings: form.servings,
      ready_in_minutes: form.readyMinutes ? Number(form.readyMinutes) : undefined,
      meal_types: mealTypeArray,
      favorite: form.favorite,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: form.notes?.trim(),
      ingredients,
      steps,
    };
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert(t('common.error'), t('analysis.food.recipes.editor.titleRequired'));
      return;
    }
    try {
      setSaving(true);
      const payload = buildPayload();

      if (isCreateMode) {
        const created = await recipeLibraryService.save(payload);
        onSaved(created);
      } else if (recipe) {
        const updated = await recipeLibraryService.update(recipe.id, payload);
        onSaved(updated);
      }
    } catch (error) {
      console.error('[RecipeEditorModal] save error', error);
      Alert.alert(t('common.error'), t('analysis.food.recipes.editor.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!recipe) return;
    Alert.alert(
      t('analysis.food.recipes.editor.deleteTitle'),
      t('analysis.food.recipes.editor.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await recipeLibraryService.delete(recipe.id);
              onDeleted?.(recipe.id);
            } catch (error) {
              console.error('[RecipeEditorModal] delete error', error);
              Alert.alert(t('common.error'), t('analysis.food.recipes.editor.deleteError'));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleAiComplete = async () => {
    if (!aiContext) return;
    try {
      setSaving(true);
      const response = await NutritionService.generateRestaurantRecipe({
        dishName: form.title || aiContext.identifiedFoods[0] || 'Pasto analizzato',
        identifiedFoods: aiContext.identifiedFoods,
        macrosEstimate: aiContext.macrosEstimate,
        contextNotes: aiContext.contextNotes,
      });

      if (!response.success || !response.data) {
        Alert.alert(t('common.error'), t('analysis.food.recipes.editor.aiCompleteError'));
        return;
      }

      const generated = response.data;
      const ingredientsText = (generated.ingredients || [])
        .map((ing: any) => {
          const qty = typeof ing.quantity === 'number' ? `${ing.quantity} ` : '';
          const unit = ing.unit ? `${ing.unit} ` : '';
          return `${qty}${unit}${ing.name}`.trim();
        })
        .join('\n');
      const stepsText = (generated.steps || []).join('\n');
      const tipsText = (generated.tips || []).join('\n');

      setForm((prev) => ({
        ...prev,
        title: prev.title || generated.title || prev.title,
        servings: generated.servings || prev.servings,
        readyMinutes: generated.readyInMinutes
          ? String(generated.readyInMinutes)
          : prev.readyMinutes,
        ingredients: ingredientsText || prev.ingredients,
        steps: stepsText || prev.steps,
        notes: prev.notes || tipsText,
      }));
    } catch (error) {
      console.error('[RecipeEditorModal] ai complete error', error);
      Alert.alert(t('common.error'), t('analysis.food.recipes.editor.aiCompleteError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isCreateMode
              ? t('analysis.food.recipes.editor.createTitle') ||
                t('analysis.food.recipes.editor.title')
              : t('analysis.food.recipes.editor.title')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.field, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('analysis.food.recipes.editor.recipeName')}
            </Text>
            <TextInput
              value={form.title}
              onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
              style={[styles.input, { color: colors.text }]}
              placeholder={t('analysis.food.recipes.editor.recipeNamePlaceholder')}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={[styles.field, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('analysis.food.recipes.editor.description')}
            </Text>
            <TextInput
              value={form.description}
              onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
              style={[styles.input, styles.textarea, { color: colors.text }]}
              multiline
              placeholder={t('analysis.food.recipes.editor.descriptionPlaceholder')}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.smallField, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('analysis.food.recipes.editor.servings')}
              </Text>
              <TextInput
                value={String(form.servings)}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, servings: Number(value) || 1 }))
                }
                keyboardType="numeric"
                style={[styles.input, { color: colors.text }]}
              />
            </View>
            <View style={[styles.smallField, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('analysis.food.recipes.editor.readyMinutes') || t('analysis.food.fridge.minutes')}
              </Text>
              <TextInput
                value={form.readyMinutes}
                onChangeText={(value) => setForm((prev) => ({ ...prev, readyMinutes: value }))}
                keyboardType="numeric"
                style={[styles.input, { color: colors.text }]}
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('analysis.food.recipes.editor.mealType')}
          </Text>
          <View style={styles.chipsRow}>
            {mealTypes.map((type) => {
              const active = form.mealTypes.has(type);
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleToggleMealType(type)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.textInverse : colors.text },
                    ]}
                  >
                    {t(`analysis.food.mealTypes.${type}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

  <TouchableOpacity
    style={[
      styles.favoriteToggle,
      {
        borderColor: form.favorite ? colors.primary : colors.border,
        backgroundColor: form.favorite ? colors.primary + '1A' : 'transparent',
      },
    ]}
    onPress={() => setForm((prev) => ({ ...prev, favorite: !prev.favorite }))}
  >
    <MaterialCommunityIcons
      name={form.favorite ? 'star' : 'star-outline'}
      size={18}
      color={form.favorite ? colors.primary : colors.textSecondary}
    />
    <Text
      style={[
        styles.favoriteToggleText,
        { color: form.favorite ? colors.primary : colors.text },
      ]}
    >
      {t('analysis.food.recipes.editor.favoriteToggle')}
    </Text>
  </TouchableOpacity>

          <View style={[styles.field, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('analysis.food.recipes.editor.tags')}
            </Text>
            <TextInput
              value={form.tags}
              onChangeText={(value) => setForm((prev) => ({ ...prev, tags: value }))}
              style={[styles.input, { color: colors.text }]}
              placeholder={t('analysis.food.fridge.tagsPlaceholder')}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={[styles.field, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('analysis.food.recipes.editor.notes')}
            </Text>
            <TextInput
              value={form.notes}
              onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
              style={[styles.input, styles.textarea, { color: colors.text }]}
              multiline
              placeholder={t('analysis.food.fridge.notesPlaceholder')}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={[styles.field, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('analysis.food.recipes.editor.ingredients')}
            </Text>
            <TextInput
              value={form.ingredients}
              onChangeText={(value) => setForm((prev) => ({ ...prev, ingredients: value }))}
              multiline
              style={[styles.input, styles.textarea, { color: colors.text }]}
              placeholder={t('analysis.food.recipes.editor.ingredientsPlaceholder')}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={[styles.field, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('analysis.food.recipes.editor.steps')}
            </Text>
            <TextInput
              value={form.steps}
              onChangeText={(value) => setForm((prev) => ({ ...prev, steps: value }))}
              multiline
              style={[styles.input, styles.textarea, { color: colors.text }]}
              placeholder={t('analysis.food.recipes.editor.stepsPlaceholder')}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {!isCreateMode && (
            <TouchableOpacity
              style={[styles.deleteButton, { borderColor: colors.error }]}
              onPress={confirmDelete}
            >
              <Text style={[styles.deleteButtonText, { color: colors.error }]}>
                {t('common.delete')}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
            {canUseAiComplete && (
              <TouchableOpacity
                style={[styles.aiButton, { borderColor: colors.primary }]}
                onPress={handleAiComplete}
                disabled={saving}
              >
                <Text style={[styles.aiButtonText, { color: colors.primary }]}>
                  {t('analysis.food.recipes.editor.aiComplete')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>
                  {t('common.save')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  field: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    fontSize: 14,
    fontWeight: '500',
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  smallField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  favoriteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  favoriteToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  aiButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default RecipeEditorModal;


