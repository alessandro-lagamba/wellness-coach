import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
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
import { NutritionService } from '../services/nutrition.service';
import { fridgeItemsService } from '../services/fridge-items.service';

const MIN_INGREDIENTS_FOR_GENERATION = 3;
interface IngredientRow {
  name: string;
  expiry?: string; // YYYY-MM-DD opzionale
  quantity?: number;
  unit?: 'g' | 'ml' | 'pcs' | 'serving';
}

interface ParsedIngredientChip {
  name: string;
  quantity?: number;
  unit?: 'g' | 'ml' | 'pcs' | 'serving';
  expiry?: string;
  confidence: number;
  id: string; // per key in map
}

interface FridgeIngredientsModalProps {
  visible: boolean;
  onClose: () => void;
  onRecipeGenerated?: (recipe: any) => void;
}

export const FridgeIngredientsModal: React.FC<FridgeIngredientsModalProps> = ({
  visible,
  onClose,
  onRecipeGenerated,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ name: '' }]);
  const [loading, setLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [bulkText, setBulkText] = useState('');
  const bulkInputRef = useRef<TextInput | null>(null);
  
  const [parsingTranscript, setParsingTranscript] = useState(false);
  const [parsedChips, setParsedChips] = useState<ParsedIngredientChip[]>([]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: 'name' | 'expiry', value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  // Parsing veloce "dettatura": accetta input del tipo "pomodori, latte, uova 10 pezzi"
  const parseBulkInput = async () => {
    if (!bulkText.trim()) return;
    
    try {
      setParsingTranscript(true);
      const result = await NutritionService.parseIngredients(bulkText.trim(), 'it-IT');
      
      if (result.success && result.data) {
        // Converti parsed ingredients in chips
        const chips: ParsedIngredientChip[] = result.data.ingredients.map((ing, idx) => ({
          id: `chip-${Date.now()}-${idx}`,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          expiry: ing.expiry,
          confidence: ing.confidence,
        }));
        
        setParsedChips(chips);
        setBulkText('');
        
        // Gestisci comandi vocali se presenti
        if (result.data.commands && result.data.commands.length > 0) {
          handleVoiceCommands(result.data.commands);
        }
        
        // Gestisci ambiguità se presenti
        if (result.data.ambiguous && result.data.ambiguous.length > 0) {
          handleAmbiguity(result.data.ambiguous);
        }
      } else {
        // Fallback: parsing semplice come prima
        const parts = bulkText
          .split(/[,\n]+/)
          .map(s => s.trim())
          .filter(Boolean);
        if (parts.length > 0) {
          const newRows: IngredientRow[] = parts.map((p) => ({ name: p }));
          setIngredients((prev) => {
            const base = prev.length === 1 && !prev[0].name ? [] : prev;
            return [...base, ...newRows];
          });
          setBulkText('');
        }
      }
    } catch (error) {
      console.error('Error parsing ingredients:', error);
      // Fallback semplice
      const parts = bulkText
        .split(/[,\n]+/)
        .map(s => s.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        const newRows: IngredientRow[] = parts.map((p) => ({ name: p }));
        setIngredients((prev) => {
          const base = prev.length === 1 && !prev[0].name ? [] : prev;
          return [...base, ...newRows];
        });
        setBulkText('');
      }
    } finally {
      setParsingTranscript(false);
    }
  };

  // Gestisci comandi vocali
  const handleVoiceCommands = (commands: Array<{ type: string; ingredientName?: string; expiry?: string }>) => {
    commands.forEach(cmd => {
      if (cmd.type === 'remove' && cmd.ingredientName) {
        setIngredients(prev => prev.filter(ing => ing.name.toLowerCase() !== cmd.ingredientName!.toLowerCase()));
        setParsedChips(prev => prev.filter(chip => chip.name.toLowerCase() !== cmd.ingredientName!.toLowerCase()));
      } else if (cmd.type === 'update_expiry' && cmd.ingredientName && cmd.expiry) {
        setIngredients(prev => prev.map(ing => 
          ing.name.toLowerCase() === cmd.ingredientName!.toLowerCase() 
            ? { ...ing, expiry: cmd.expiry } 
            : ing
        ));
        setParsedChips(prev => prev.map(chip => 
          chip.name.toLowerCase() === cmd.ingredientName!.toLowerCase() 
            ? { ...chip, expiry: cmd.expiry } 
            : chip
        ));
      } else if (cmd.type === 'mark_finished' && cmd.ingredientName) {
        // Rimuovi ingrediente segnato come finito
        setIngredients(prev => prev.filter(ing => ing.name.toLowerCase() !== cmd.ingredientName!.toLowerCase()));
        setParsedChips(prev => prev.filter(chip => chip.name.toLowerCase() !== cmd.ingredientName!.toLowerCase()));
      }
    });
  };

  // Gestisci ambiguità
  const handleAmbiguity = (ambiguous: Array<{ text: string; suggestions: string[] }>) => {
    ambiguous.forEach(amb => {
      Alert.alert(
        t('analysis.food.fridge.ambiguousTitle', { text: amb.text }),
        t('analysis.food.fridge.ambiguousMessage', { suggestions: amb.suggestions.join(', ') }),
        amb.suggestions.map(suggestion => ({
          text: suggestion,
          onPress: () => {
            // Aggiungi la scelta dell'utente
            const chip: ParsedIngredientChip = {
              id: `chip-${Date.now()}`,
              name: suggestion,
              confidence: 0.8,
            };
            setParsedChips(prev => [...prev, chip]);
          },
        })),
        { cancelable: true }
      );
    });
  };

  // Aggiungi chips confermati alla lista ingredienti e salva su Supabase
  const confirmChips = async () => {
    const confirmed: IngredientRow[] = parsedChips.map(chip => ({
      name: chip.name,
      quantity: chip.quantity,
      unit: chip.unit,
      expiry: chip.expiry,
    }));
    
    setIngredients((prev) => {
      const base = prev.length === 1 && !prev[0].name ? [] : prev;
      return [...base, ...confirmed];
    });
    
    // Salva su Supabase (scadenza opzionale)
    try {
      await fridgeItemsService.addFridgeItems(
        parsedChips.map(chip => ({
          name: chip.name,
          quantity: chip.quantity,
          unit: chip.unit,
          expiry_date: chip.expiry || undefined, // Scadenza opzionale
        }))
      );
    } catch (error) {
      console.error('Error saving to fridge:', error);
      // Non bloccare l'utente se il salvataggio fallisce
    }
    
    setParsedChips([]);
    setTranscript('');
  };

  // Salva ingredienti senza generare ricetta (scadenza opzionale)
  const handleSaveIngredients = async () => {
    // Valida: solo nome non vuoto, scadenza opzionale
    const validIngredients = ingredients
      .map(ing => ({ 
        name: ing.name.trim(), 
        expiry: (ing.expiry || '').trim() || undefined,
        quantity: ing.quantity,
        unit: ing.unit,
      }))
      .filter(ing => ing.name.length > 0);
    
    if (validIngredients.length === 0) {
      Alert.alert(t('common.error'), t('analysis.food.fridge.noIngredients'));
      return;
    }

    try {
      setLoading(true);
      await fridgeItemsService.addFridgeItems(
        validIngredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          expiry_date: ing.expiry || undefined, // Scadenza opzionale
        }))
      );
      Alert.alert(
        t('common.success'),
        t('analysis.food.fridge.ingredientsSaved')
      );
      // Reset form
      setIngredients([{ name: '' }]);
      setBulkText('');
      setTranscript('');
      setParsedChips([]);
    } catch (error) {
      console.error('Error saving ingredients:', error);
      Alert.alert(
        t('common.error'),
        t('analysis.food.fridge.saveError') || 'Errore durante il salvataggio degli ingredienti'
      );
    } finally {
      setLoading(false);
    }
  };

  // Rimuovi chip
  const removeChip = (chipId: string) => {
    setParsedChips(prev => prev.filter(chip => chip.id !== chipId));
  };


  const handleGenerateRecipe = async () => {
    // Valida: nome non vuoto, data in formato YYYY-MM-DD se presente
    const validIngredients = ingredients
      .map(ing => ({ name: ing.name.trim(), expiry: (ing.expiry || '').trim() }))
      .filter(ing => ing.name.length > 0);
    
    if (validIngredients.length === 0) {
      Alert.alert(t('common.error'), t('analysis.food.fridge.noIngredients'));
      return;
    }

    if (validIngredients.length < MIN_INGREDIENTS_FOR_GENERATION) {
      Alert.alert(
        t('common.error'),
        t('analysis.food.fridge.needMoreIngredients', { count: MIN_INGREDIENTS_FOR_GENERATION })
      );
      return;
    }

    // Salva ingredienti su Supabase prima di generare ricetta
    try {
      await fridgeItemsService.addFridgeItems(
        validIngredients.map(ing => ({
          name: ing.name,
          expiry_date: ing.expiry || undefined,
        }))
      );
    } catch (error) {
      console.error('Error saving ingredients to fridge:', error);
      // Continua comunque con la generazione ricetta
    }

    // Ordina per scadenza (se presente) → priorità agli ingredienti che scadono prima
    const sorted = [...validIngredients].sort((a, b) => {
      if (!a.expiry && !b.expiry) return 0;
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    });

    try {
      setLoading(true);
      const result = await NutritionService.generateRecipe({
        // Passiamo solo i nomi come richiesto dal backend, ma includiamo un hint per la priorità
        ingredients: sorted.map(i => i.name),
        cuisineHint: sorted
          .filter(i => i.expiry)
          .slice(0, 3)
          .map(i => `${i.name} exp:${i.expiry}`)
          .join(', ')
          || undefined,
        servings: 2,
        maxReadyInMinutes: 30,
      });

      if (result.success && result.data) {
        setGeneratedRecipe(result.data);
        if (onRecipeGenerated) {
          onRecipeGenerated(result.data);
        }
      } else {
        Alert.alert(t('common.error'), result.error || t('analysis.food.fridge.generateError'));
      }
    } catch (error) {
      console.error('Error generating recipe:', error);
      Alert.alert(t('common.error'), t('analysis.food.fridge.generateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset all state
    setIngredients([{ name: '' }]);
    setGeneratedRecipe(null);
    setBulkText('');
    setParsedChips([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['bottom']} style={styles.safeArea}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {generatedRecipe ? t('analysis.food.fridge.recipeGenerated') : t('analysis.food.fridge.title')}
                </Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <FontAwesome name="times" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.scrollView} 
                contentContainerStyle={styles.scrollViewContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
            {!generatedRecipe ? (
              <>
                <View style={styles.infoSection}>
                  <MaterialCommunityIcons name="information" size={24} color={colors.accent} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    {t('analysis.food.fridge.modalDesc')}
                  </Text>
                </View>

                {/* Inserimento rapido */}
                <View style={styles.quickAddSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('analysis.food.fridge.quickAdd')}
                  </Text>
                  
                  {/* Chips confermabili */}
                  {parsedChips.length > 0 && (
                    <View style={styles.chipsSection}>
                      <Text style={[styles.chipsLabel, { color: colors.text }]}>
                        {t('analysis.food.fridge.confirmIngredients')}:
                      </Text>
                      <View style={styles.chipsContainer}>
                        {parsedChips.map((chip) => (
                          <View
                            key={chip.id}
                            style={[styles.chip, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                          >
                            <View style={styles.chipContent}>
                              <Text style={[styles.chipText, { color: colors.text }]}>
                                {chip.name}
                                {chip.quantity && ` ${chip.quantity}${chip.unit || ''}`}
                                {chip.expiry && ` (${t('analysis.food.fridge.expires')}: ${chip.expiry})`}
                              </Text>
                              {chip.confidence < 0.7 && (
                                <MaterialCommunityIcons name="alert-circle" size={14} color={colors.warning} />
                              )}
                            </View>
                            <TouchableOpacity
                              onPress={() => removeChip(chip.id)}
                              style={styles.chipRemove}
                            >
                              <FontAwesome name="times" size={12} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                      <TouchableOpacity
                        onPress={confirmChips}
                        style={[styles.confirmChipsButton, { backgroundColor: colors.primary }]}
                      >
                        <FontAwesome name="check" size={14} color={colors.textInverse} />
                        <Text style={[styles.confirmChipsText, { color: colors.textInverse }]}>
                          {t('analysis.food.fridge.addAll')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}> 
                    <TextInput
                      ref={bulkInputRef}
                      style={[styles.input, { color: colors.text }]}
                      value={bulkText}
                      onChangeText={setBulkText}
                      placeholder={t('analysis.food.fridge.quickAddPlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                      multiline
                    />
                  </View>
                  <TouchableOpacity onPress={parseBulkInput} style={[styles.addButton, { borderColor: colors.border }]}> 
                    <FontAwesome name="plus" size={14} color={colors.primary} />
                    <Text style={[styles.addButtonText, { color: colors.primary }]}>
                      {t('analysis.food.fridge.parseAndAdd')}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                    {t('analysis.food.fridge.dictationHint')}
                  </Text>
                </View>

                <View style={styles.ingredientsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('analysis.food.fridge.ingredientsList')}
                  </Text>
                  
                  {ingredients.map((ingredient, index) => (
                    <View key={index} style={styles.ingredientRow}>
                      <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                        <TextInput
                          style={[styles.input, { color: colors.text }]}
                          value={ingredient.name}
                          onChangeText={(value) => updateIngredient(index, 'name', value)}
                          placeholder={t('analysis.food.fridge.ingredientPlaceholder', { number: index + 1 })}
                          placeholderTextColor={colors.textTertiary}
                          autoCapitalize="words"
                        />
                      </View>
                      <View style={[styles.expiryWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}> 
                        <MaterialCommunityIcons name="calendar" size={14} color={colors.textTertiary} />
                        <TextInput
                          style={[styles.expiryInput, { color: colors.text }]}
                          value={ingredient.expiry || ''}
                          onChangeText={(value) => updateIngredient(index, 'expiry', value)}
                          placeholder={t('analysis.food.fridge.expiryPlaceholder')}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numbers-and-punctuation"
                        />
                      </View>
                      {ingredients.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeIngredient(index)}
                          style={[styles.removeButton, { backgroundColor: colors.error + '20' }]}
                        >
                          <FontAwesome name="trash" size={14} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={addIngredient}
                    style={[styles.addButton, { borderColor: colors.border }]}
                  >
                    <FontAwesome name="plus" size={14} color={colors.primary} />
                    <Text style={[styles.addButtonText, { color: colors.primary }]}>
                      {t('analysis.food.fridge.addMore')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.recipeSection}>
                <Text style={[styles.recipeTitle, { color: colors.text }]}>
                  {generatedRecipe.title}
                </Text>
                
                <View style={styles.recipeMeta}>
                  <View style={styles.recipeMetaItem}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.recipeMetaText, { color: colors.textSecondary }]}>
                      {generatedRecipe.readyInMinutes} {t('analysis.food.fridge.minutes')}
                    </Text>
                  </View>
                  <View style={styles.recipeMetaItem}>
                    <MaterialCommunityIcons name="account-group" size={16} color={colors.textSecondary} />
                    <Text style={[styles.recipeMetaText, { color: colors.textSecondary }]}>
                      {generatedRecipe.servings} {t('analysis.food.fridge.servings')}
                    </Text>
                  </View>
                </View>

                <View style={styles.macrosSection}>
                  <Text style={[styles.macrosTitle, { color: colors.text }]}>
                    {t('analysis.food.fridge.nutritionPerServing')}
                  </Text>
                  <View style={styles.macrosGrid}>
                    <View style={[styles.macroItem, { backgroundColor: colors.surfaceElevated }]}>
                      <Text style={[styles.macroValue, { color: colors.text }]}>
                        {Math.round(generatedRecipe.caloriesPerServing)}
                      </Text>
                      <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>kcal</Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.surfaceElevated }]}>
                      <Text style={[styles.macroValue, { color: colors.text }]}>
                        {Math.round(generatedRecipe.macrosPerServing.protein)}g
                      </Text>
                      <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>
                        {t('analysis.food.metrics.proteins')}
                      </Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.surfaceElevated }]}>
                      <Text style={[styles.macroValue, { color: colors.text }]}>
                        {Math.round(generatedRecipe.macrosPerServing.carbs)}g
                      </Text>
                      <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>
                        {t('analysis.food.metrics.carbohydrates')}
                      </Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.surfaceElevated }]}>
                      <Text style={[styles.macroValue, { color: colors.text }]}>
                        {Math.round(generatedRecipe.macrosPerServing.fat)}g
                      </Text>
                      <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>
                        {t('analysis.food.metrics.fats')}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.ingredientsListSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('analysis.food.fridge.ingredients')}
                  </Text>
                  {generatedRecipe.ingredients.map((ing: any, index: number) => (
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

                <View style={styles.stepsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('analysis.food.fridge.steps')}
                  </Text>
                  {generatedRecipe.steps.map((step: string, index: number) => (
                    <View key={index} style={styles.stepItem}>
                      <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                        <Text style={styles.stepNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
                    </View>
                  ))}
                </View>

                {generatedRecipe.tips && generatedRecipe.tips.length > 0 && (
                  <View style={styles.tipsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('analysis.food.fridge.tips')}
                    </Text>
                    {generatedRecipe.tips.map((tip: string, index: number) => (
                      <View key={index} style={styles.tipItem}>
                        <MaterialCommunityIcons name="lightbulb" size={16} color={colors.accent} />
                        <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {generatedRecipe.shoppingGaps && generatedRecipe.shoppingGaps.length > 0 && (
                  <View style={styles.shoppingGapsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('analysis.food.fridge.missingIngredients')}
                    </Text>
                    {generatedRecipe.shoppingGaps.map((gap: string, index: number) => (
                      <View key={index} style={styles.shoppingGapItem}>
                        <MaterialCommunityIcons name="cart-outline" size={16} color={colors.warning} />
                        <Text style={[styles.shoppingGapText, { color: colors.textSecondary }]}>{gap}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
              </ScrollView>

              <View style={[styles.buttonContainer, { borderTopColor: colors.border }]}>
                {!generatedRecipe ? (
                  <View style={styles.ingredientsActions}>
                    <TouchableOpacity
                      style={[styles.saveButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={handleSaveIngredients}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <FontAwesome name="save" size={16} color={colors.primary} />
                          <Text style={[styles.saveButtonText, { color: colors.primary }]}>
                            {t('analysis.food.fridge.saveIngredients') || 'Salva Ingredienti'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.generateButton, { backgroundColor: colors.primary }]}
                      onPress={handleGenerateRecipe}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="chef-hat" size={18} color={colors.textInverse} />
                          <Text style={[styles.generateButtonText, { color: colors.textInverse }]}>
                            {t('analysis.food.fridge.generateRecipe')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.recipeActions}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.border }]}
                      onPress={() => {
                        setGeneratedRecipe(null);
                        setIngredients(['']);
                      }}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                        {t('analysis.food.fridge.newRecipe')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                      onPress={handleClose}
                    >
                      <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
                        {t('common.close')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
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
    fontWeight: '700',
    flex: 1,
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
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginBottom: 24,
    gap: 12,
  },
  quickAddSection: {
    marginBottom: 20,
  },
  micButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  micButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipsSection: {
    marginTop: 16,
  },
  chipsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipRemove: {
    padding: 4,
  },
  confirmChipsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  confirmChipsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  ingredientsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiryWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  expiryInput: {
    minWidth: 110,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recipeSection: {
    gap: 20,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  recipeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipeMetaText: {
    fontSize: 14,
  },
  macrosSection: {
    marginBottom: 20,
  },
  macrosTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '700',
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  ingredientsListSection: {
    marginBottom: 20,
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
  },
  optionalText: {
    fontSize: 12,
    fontStyle: 'italic',
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
    fontWeight: '700',
    color: '#ffffff',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
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
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  ingredientsActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  recipeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

