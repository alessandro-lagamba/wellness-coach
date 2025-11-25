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
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { NutritionService } from '../services/nutrition.service';
import { fridgeItemsService } from '../services/fridge-items.service';
import {
  nutritionPreferencesService,
  NutritionPreferences,
  CuisinePreference,
} from '../services/nutrition-preferences.service';
import recipeLibraryService, { MealType, UserRecipe } from '../services/recipe-library.service';
import RecipeEditorModal from './RecipeEditorModal';

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
  onRecipeSaved?: (recipe: UserRecipe) => void;
}

const CUISINE_OPTIONS: { id: CuisinePreference; labelKey: string }[] = [
  { id: 'none', labelKey: 'analysis.food.preferences.cuisines.none' },
  { id: 'italian', labelKey: 'analysis.food.preferences.cuisines.italian' },
  { id: 'mediterranean', labelKey: 'analysis.food.preferences.cuisines.mediterranean' },
  { id: 'asian', labelKey: 'analysis.food.preferences.cuisines.asian' },
  { id: 'latin', labelKey: 'analysis.food.preferences.cuisines.latin' },
  { id: 'middle-eastern', labelKey: 'analysis.food.preferences.cuisines.middleEastern' },
  { id: 'american', labelKey: 'analysis.food.preferences.cuisines.american' },
  { id: 'vegetarian', labelKey: 'analysis.food.preferences.cuisines.vegetarian' },
];

export const FridgeIngredientsModal: React.FC<FridgeIngredientsModalProps> = ({
  visible,
  onClose,
  onRecipeGenerated,
  onRecipeSaved,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ name: '' }]);
  const [savedIngredients, setSavedIngredients] = useState<Array<{ id: string; name: string; expiry_date?: string; quantity?: number; unit?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [bulkText, setBulkText] = useState('');
  const bulkInputRef = useRef<TextInput | null>(null);
  
  const [parsingTranscript, setParsingTranscript] = useState(false);
  const [parsedChips, setParsedChips] = useState<ParsedIngredientChip[]>([]);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [preferences, setPreferences] = useState<NutritionPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [newFavorite, setNewFavorite] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [excludedIngredientIds, setExcludedIngredientIds] = useState<Record<string, boolean>>({});
  const [recipeEditorVisible, setRecipeEditorVisible] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<Partial<UserRecipe> | null>(null);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const inferMealTypeFromRecipe = (recipe: any): MealType => {
    const direct = recipe?.meal_type || recipe?.mealType;
    const allowed: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (direct && allowed.includes(direct)) {
      return direct as MealType;
    }

    const lowerTitle = (recipe?.title || '').toLowerCase();
    if (lowerTitle.includes('colazione') || lowerTitle.includes('breakfast')) return 'breakfast';
    if (lowerTitle.includes('pranzo') || lowerTitle.includes('lunch')) return 'lunch';
    if (lowerTitle.includes('cena') || lowerTitle.includes('dinner')) return 'dinner';
    if (lowerTitle.includes('spuntino') || lowerTitle.includes('snack')) return 'snack';

    const minutes = recipe?.readyInMinutes || recipe?.ready_in_minutes || 0;
    if (minutes > 0 && minutes <= 15) return 'snack';
    if (minutes > 15 && minutes <= 25) return 'lunch';
    return 'dinner';
  };

  const buildDraftFromGenerated = (recipe: any): Partial<UserRecipe> => {
    const ingredients = Array.isArray(recipe?.ingredients)
      ? recipe.ingredients.map((ing: any) => ({
          name: ing.name || ing.title || '',
          quantity: ing.quantity,
          unit: ing.unit,
          optional: ing.optional,
        }))
      : [];

    return {
      title: recipe?.title || '',
      description: recipe?.description,
      servings: recipe?.servings ?? 1,
      ready_in_minutes: recipe?.readyInMinutes || recipe?.ready_in_minutes,
      meal_types: recipe?.meal_type ? [recipe.meal_type] : recipe?.meal_types || [],
      favorite: false,
      notes: recipe?.notes,
      tags: recipe?.tags || [],
      ingredients,
      steps: Array.isArray(recipe?.steps) ? recipe.steps : [],
      // ✅ Aggiungi informazioni nutrizionali
      calories_per_serving: recipe?.caloriesPerServing || recipe?.calories_per_serving || null,
      macros: recipe?.macrosPerServing ? {
        protein: recipe.macrosPerServing.protein,
        carbs: recipe.macrosPerServing.carbs,
        fat: recipe.macrosPerServing.fat,
        fiber: recipe.macrosPerServing.fiber,
        sugar: recipe.macrosPerServing.sugar,
      } : null,
    };
  };

  const openRecipeEditorForGenerated = () => {
    if (!generatedRecipe) return;
    const draft = buildDraftFromGenerated(generatedRecipe);
    if (!draft.meal_types || draft.meal_types.length === 0) {
      draft.meal_types = [inferMealTypeFromRecipe(generatedRecipe)];
    }
    setRecipeDraft(draft);
    setRecipeEditorVisible(true);
  };

  const handleRecipeEditorSavedFromFridge = (recipe: UserRecipe) => {
    setRecipeEditorVisible(false);
    setRecipeDraft(null);
    Alert.alert(t('analysis.food.fridge.recipeSavedTitle'), t('analysis.food.fridge.recipeSavedMessage'));
    onRecipeSaved?.(recipe);
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
    // Ricarica ingredienti salvati dopo la conferma
    await loadSavedIngredients();
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
      // Ricarica ingredienti salvati invece di resettare il form
      await loadSavedIngredients();
      // Reset solo i campi di input nuovi (non quelli salvati)
      setIngredients([{ name: '' }]);
      setBulkText('');
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

  // Carica ingredienti salvati dal database
  const loadPreferences = useCallback(async () => {
    try {
      setPreferencesLoading(true);
      const prefs = await nutritionPreferencesService.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading nutrition preferences:', error);
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  const loadSavedIngredients = useCallback(async () => {
    try {
      const items = await fridgeItemsService.getFridgeItems();
      setSavedIngredients(
        items.map((item) => ({
          id: item.id || '',
          name: item.name,
          expiry_date: item.expiry_date,
          quantity: item.quantity,
          unit: item.unit,
        })),
      );
      setExcludedIngredientIds((prev) => {
        const next = { ...prev };
        const ids = new Set(items.map((item) => item.id || ''));
        Object.keys(next).forEach((key) => {
          if (!ids.has(key)) {
            delete next[key];
          }
        });
        return next;
      });
    } catch (error) {
      console.error('Error loading saved ingredients:', error);
    }
  }, []);

  // Elimina ingrediente salvato
  const removeSavedIngredient = async (itemId: string) => {
    try {
      await fridgeItemsService.removeFridgeItem(itemId);
      await loadSavedIngredients(); // Ricarica la lista
    } catch (error) {
      console.error('Error removing ingredient:', error);
      Alert.alert(t('common.error'), t('analysis.food.fridge.removeError') || 'Errore durante la rimozione dell\'ingrediente');
    }
  };

  // Carica ingredienti quando il modal si apre
  useEffect(() => {
    if (visible) {
      loadSavedIngredients();
      loadPreferences();
    }
  }, [visible, loadSavedIngredients, loadPreferences]);

  const updatePreferencesAsync = useCallback(
    async (
      updater:
        | NutritionPreferences
        | ((prev: NutritionPreferences) => NutritionPreferences),
    ) => {
      try {
        const updated = await nutritionPreferencesService.savePreferences(updater);
        setPreferences(updated);
      } catch (error) {
        console.error('Error saving preferences:', error);
        Alert.alert(
          t('common.error'),
          t('analysis.food.preferences.saveError') || 'Errore durante il salvataggio delle preferenze',
        );
      }
    },
    [t],
  );

  const handleCuisineSelect = (cuisine: CuisinePreference) => {
    updatePreferencesAsync((prev) => ({
      ...prev,
      cuisinePreference: cuisine,
    }));
  };

  const handleAddFavorite = () => {
    const value = newFavorite.trim();
    if (!value) return;
    if (preferences?.favoriteIngredients?.some((fav) => fav.toLowerCase() === value.toLowerCase())) {
      setNewFavorite('');
      return;
    }
    updatePreferencesAsync((prev) => ({
      ...prev,
      favoriteIngredients: [...prev.favoriteIngredients, value],
    }));
    setNewFavorite('');
  };

  const handleRemoveFavorite = (value: string) => {
    updatePreferencesAsync((prev) => ({
      ...prev,
      favoriteIngredients: prev.favoriteIngredients.filter(
        (fav) => fav.toLowerCase() !== value.toLowerCase(),
      ),
    }));
  };

  const handleAddFavoriteFromSaved = (value: string) => {
    if (!value) return;
    updatePreferencesAsync((prev) => {
      if (prev.favoriteIngredients.some((fav) => fav.toLowerCase() === value.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        favoriteIngredients: [...prev.favoriteIngredients, value],
      };
    });
  };

  const handleAddAllergy = () => {
    const value = newAllergy.trim();
    if (!value) return;
    if (preferences?.allergies?.some((allergy) => allergy.toLowerCase() === value.toLowerCase())) {
      setNewAllergy('');
      return;
    }
    updatePreferencesAsync((prev) => ({
      ...prev,
      allergies: [...prev.allergies, value],
    }));
    setNewAllergy('');
  };

  const handleRemoveAllergy = (value: string) => {
    updatePreferencesAsync((prev) => ({
      ...prev,
      allergies: prev.allergies.filter(
        (allergy) => allergy.toLowerCase() !== value.toLowerCase(),
      ),
    }));
  };

  const toggleExcludeIngredient = (itemId: string) => {
    setExcludedIngredientIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Analizza foto per estrarre ingredienti
  const handlePhotoAnalysis = async () => {
    try {
      // Richiedi permessi
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('analysis.food.errors.mediaLibraryPermission') || 'Permesso galleria negato');
        return;
      }

      // Seleziona/scatta foto
      // ✅ FIX: Crop libero per foto frigo
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // ✅ Rimossa aspect ratio fissa per permettere crop libero
        quality: 0.9,
        base64: true,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const asset = pickerResult.assets[0];
      if (!asset.base64) {
        Alert.alert(t('common.error'), 'Impossibile leggere la foto');
        return;
      }

      setAnalyzingPhoto(true);

      // Converti in base64 data URL
      const imageBase64 = asset.base64.startsWith('data:') 
        ? asset.base64 
        : `data:image/jpeg;base64,${asset.base64}`;

      // Chiama API analyze-image
      const { getBackendURL } = await import('../constants/env');
      const backendURL = await getBackendURL();

      const response = await fetch(`${backendURL}/api/nutrition/analyze-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
          locale: 'it-IT',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante l\'analisi della foto');
      }

      const data = await response.json();

      if (!data.success || !data.data || !data.data.items) {
        throw new Error('Nessun ingrediente trovato nella foto');
      }

      // Converti items in ingredienti per il frigo
      const extractedIngredients: ParsedIngredientChip[] = data.data.items.map((item: any, idx: number) => ({
        id: `photo-${Date.now()}-${idx}`,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        confidence: item.confidence || 0.7,
      }));

      if (extractedIngredients.length === 0) {
        Alert.alert(t('common.info'), 'Nessun ingrediente identificato nella foto');
        return;
      }

      // Mostra i chips estratti per conferma
      setParsedChips(prev => [...prev, ...extractedIngredients]);
      
      Alert.alert(
        t('common.success'),
        `${extractedIngredients.length} ingrediente/i identificato/i. Conferma per aggiungerli al frigo.`
      );

    } catch (error) {
      console.error('Error analyzing photo:', error);
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : 'Errore durante l\'analisi della foto'
      );
    } finally {
      setAnalyzingPhoto(false);
    }
  };


  const handleGenerateRecipe = async () => {
    // Combina ingredienti nuovi e salvati
    const newIngredients = ingredients
      .map(ing => ({ name: ing.name.trim(), expiry: (ing.expiry || '').trim() }))
      .filter(ing => ing.name.length > 0);
    
    const allIngredients = [
      ...savedIngredients.map(item => item.name),
      ...newIngredients.map(ing => ing.name),
    ];

    // Rimuovi duplicati (case-insensitive)
    const uniqueIngredients = Array.from(new Set(allIngredients.map(name => name.toLowerCase())))
      .map(lowerName => {
        const original = allIngredients.find(ing => ing.toLowerCase() === lowerName);
        return original || lowerName;
      });

    const excludedNamesSet = new Set(
      savedIngredients
        .filter((item) => excludedIngredientIds[item.id])
        .map((item) => item.name.toLowerCase()),
    );

    const filteredIngredients = uniqueIngredients.filter(
      (name) => !excludedNamesSet.has(name.toLowerCase()),
    );

    if (filteredIngredients.length === 0) {
      Alert.alert(t('common.error'), t('analysis.food.fridge.noIngredients'));
      return;
    }

    if (filteredIngredients.length < MIN_INGREDIENTS_FOR_GENERATION) {
      Alert.alert(
        t('common.error'),
        t('analysis.food.fridge.needMoreIngredients', { count: MIN_INGREDIENTS_FOR_GENERATION })
      );
      return;
    }

    // Salva ingredienti nuovi su Supabase prima di generare ricetta
    if (newIngredients.length > 0) {
      try {
        await fridgeItemsService.addFridgeItems(
          newIngredients.map((ing) => ({
            name: ing.name,
            expiry_date: ing.expiry || undefined,
          })),
        );
        await loadSavedIngredients(); // Ricarica dopo il salvataggio
      } catch (error) {
        console.error('Error saving ingredients to fridge:', error);
        // Continua comunque con la generazione ricetta
      }
    }

    // Ordina ingredienti salvati per scadenza (se presente) → priorità agli ingredienti che scadono prima
    const sortedSaved = [...savedIngredients].sort((a, b) => {
      if (!a.expiry_date && !b.expiry_date) return 0;
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

    try {
      setLoading(true);
      const activePrefs =
        preferences ||
        (await nutritionPreferencesService.getPreferences().catch(() => null));
      const favoriteList = activePrefs?.favoriteIngredients || [];
      const allergyList = activePrefs?.allergies || [];
      const cuisinePreference =
        activePrefs?.cuisinePreference && activePrefs.cuisinePreference !== 'none'
          ? activePrefs.cuisinePreference
          : undefined;

      const requestPayload = {
        ingredients: filteredIngredients,
        cuisineHint:
          sortedSaved
            .filter((i) => i.expiry_date)
            .slice(0, 3)
            .map((i) => `${i.name} exp:${i.expiry_date}`)
            .join(', ') || undefined,
        servings: 2,
        maxReadyInMinutes: 30,
        favoriteIngredients: favoriteList.length ? favoriteList : undefined,
        allergies: allergyList.length ? allergyList : undefined,
        cuisinePreference,
        avoidIngredients:
          excludedNamesSet.size > 0 ? Array.from(excludedNamesSet) : undefined,
        prefs: favoriteList.length ? favoriteList : undefined,
      };

      const result = await NutritionService.generateRecipe(requestPayload);

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
    setSavedIngredients([]);
    setExcludedIngredientIds({});
    setNewFavorite('');
    setNewAllergy('');
    onClose();
  };

  return (
    <>
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

                <View style={[styles.preferencesSection, { borderColor: colors.border }]}>
                  <View style={styles.preferencesHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('analysis.food.preferences.title')}
                    </Text>
                    {preferencesLoading && <ActivityIndicator size="small" color={colors.primary} />}
                  </View>
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    {t('analysis.food.preferences.subtitle')}
                  </Text>

                  <Text style={[styles.preferencesLabel, { color: colors.text }]}>
                    {t('analysis.food.preferences.cuisineLabel')}
                  </Text>
                  <View style={styles.cuisineOptionsRow}>
                    {CUISINE_OPTIONS.map((option) => {
                      const isActive = preferences?.cuisinePreference === option.id;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.cuisineOption,
                            {
                              backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
                              borderColor: isActive ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => handleCuisineSelect(option.id)}
                        >
                          <Text
                            style={[
                              styles.cuisineOptionText,
                              { color: isActive ? colors.textInverse : colors.text },
                            ]}
                          >
                            {t(option.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.preferenceRow}>
                    <Text style={[styles.preferencesLabel, { color: colors.text }]}>
                      {t('analysis.food.preferences.favorites')}
                    </Text>
                    <View
                      style={[
                        styles.preferenceInputWrapper,
                        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      ]}
                    >
                      <TextInput
                        style={[styles.preferenceInput, { color: colors.text }]}
                        value={newFavorite}
                        onChangeText={setNewFavorite}
                        placeholder={t('analysis.food.preferences.favoritePlaceholder')}
                        placeholderTextColor={colors.textTertiary}
                        onSubmitEditing={handleAddFavorite}
                      />
                      <TouchableOpacity onPress={handleAddFavorite} style={styles.preferenceAddButton}>
                        <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.preferenceChips}>
                      {preferences?.favoriteIngredients?.map((item) => (
                        <View
                          key={item}
                          style={[
                            styles.preferenceChip,
                            { backgroundColor: colors.primary + '15', borderColor: colors.primary },
                          ]}
                        >
                          <Text style={[styles.preferenceChipText, { color: colors.text }]}>{item}</Text>
                          <TouchableOpacity onPress={() => handleRemoveFavorite(item)} style={styles.chipRemove}>
                            <FontAwesome name="times" size={12} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.preferenceRow}>
                    <Text style={[styles.preferencesLabel, { color: colors.text }]}>
                      {t('analysis.food.preferences.allergies')}
                    </Text>
                    <View
                      style={[
                        styles.preferenceInputWrapper,
                        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      ]}
                    >
                      <TextInput
                        style={[styles.preferenceInput, { color: colors.text }]}
                        value={newAllergy}
                        onChangeText={setNewAllergy}
                        placeholder={t('analysis.food.preferences.allergyPlaceholder')}
                        placeholderTextColor={colors.textTertiary}
                        onSubmitEditing={handleAddAllergy}
                      />
                      <TouchableOpacity onPress={handleAddAllergy} style={styles.preferenceAddButton}>
                        <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.preferenceChips}>
                      {preferences?.allergies?.map((item) => (
                        <View
                          key={item}
                          style={[
                            styles.preferenceChip,
                            { backgroundColor: colors.error + '15', borderColor: colors.error },
                          ]}
                        >
                          <Text style={[styles.preferenceChipText, { color: colors.text }]}>{item}</Text>
                          <TouchableOpacity onPress={() => handleRemoveAllergy(item)} style={styles.chipRemove}>
                            <FontAwesome name="times" size={12} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Inserimento rapido */}
                <View style={styles.quickAddSection}>
                  <View style={styles.quickAddHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('analysis.food.fridge.quickAdd')}
                    </Text>
                    <TouchableOpacity
                      onPress={handlePhotoAnalysis}
                      disabled={analyzingPhoto}
                      style={[styles.photoButton, { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                    >
                      {analyzingPhoto ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="camera" size={18} color={colors.accent} />
                          <Text style={[styles.photoButtonText, { color: colors.accent }]}>
                            {t('analysis.food.fridge.takePhoto') || 'Foto'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  
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

                {/* Ingredienti salvati */}
                {savedIngredients.length > 0 && (
                  <View style={styles.savedIngredientsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('analysis.food.fridge.savedIngredients') || 'Ingredienti Salvati'}
                    </Text>
                    {savedIngredients.map((item) => (
                      <View key={item.id} style={[styles.savedIngredientRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                        <View style={styles.savedIngredientInfo}>
                          <Text style={[styles.savedIngredientName, { color: colors.text }]}>{item.name}</Text>
                          {item.expiry_date && (
                            <Text style={[styles.savedIngredientExpiry, { color: colors.textSecondary }]}>
                              {t('analysis.food.fridge.expires')}: {item.expiry_date}
                            </Text>
                          )}
                          {item.quantity && (
                            <Text style={[styles.savedIngredientQuantity, { color: colors.textSecondary }]}>
                              {item.quantity} {item.unit || ''}
                            </Text>
                          )}
                        </View>
                        <View style={styles.savedIngredientActions}>
                          <TouchableOpacity
                            onPress={() => toggleExcludeIngredient(item.id)}
                            style={[
                              styles.excludeButton,
                              {
                                backgroundColor: excludedIngredientIds[item.id]
                                  ? colors.warning + '25'
                                  : colors.surface,
                                borderColor: excludedIngredientIds[item.id]
                                  ? colors.warning
                                  : colors.border,
                              },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={
                                excludedIngredientIds[item.id]
                                  ? 'eye-off-outline'
                                  : 'eye-outline'
                              }
                              size={16}
                              color={excludedIngredientIds[item.id] ? colors.warning : colors.textSecondary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleAddFavoriteFromSaved(item.name)}
                            style={[styles.excludeButton, { borderColor: colors.primary }]}
                          >
                            <MaterialCommunityIcons name="star-outline" size={16} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => removeSavedIngredient(item.id)}
                            style={[styles.removeSavedButton, { backgroundColor: colors.error + '20' }]}
                          >
                            <FontAwesome name="trash" size={14} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Mostra solo ingredienti non ancora salvati */}
                {ingredients.some(ing => ing.name.trim().length > 0) && (
                  <View style={styles.ingredientsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('analysis.food.fridge.newIngredients') || 'Nuovi Ingredienti'}
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
                )}
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
                        setIngredients([{ name: '' }]);
                      }}
                    >
                      <Text 
                        style={[styles.secondaryButtonText, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {t('analysis.food.fridge.newRecipe')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveLibraryButton, { borderColor: colors.primary }]}
                      onPress={openRecipeEditorForGenerated}
                    >
                      <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} />
                      <Text 
                        style={[styles.saveLibraryButtonText, { color: colors.primary }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {t('analysis.food.fridge.editAndSave')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                      onPress={handleClose}
                    >
                      <Text 
                        style={[styles.primaryButtonText, { color: colors.textInverse }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
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

    <RecipeEditorModal
      visible={recipeEditorVisible}
      mode="create"
      recipe={null}
      initialDraft={recipeDraft}
      onClose={() => {
        setRecipeEditorVisible(false);
        setRecipeDraft(null);
      }}
      onSaved={handleRecipeEditorSavedFromFridge}
    />
    </>
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
  preferencesSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  preferencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  preferencesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  cuisineOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cuisineOption: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cuisineOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  preferenceRow: {
    marginTop: 12,
  },
  preferenceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  preferenceInput: {
    flex: 1,
    fontSize: 14,
  },
  preferenceAddButton: {
    padding: 6,
  },
  preferenceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  preferenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  preferenceChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickAddSection: {
    marginBottom: 20,
  },
  quickAddHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  photoButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
    flexWrap: 'wrap',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minWidth: 0, // ✅ FIX: Permette al flex di ridursi correttamente
    paddingVertical: 14,
    paddingHorizontal: 12, // ✅ FIX: Aggiunge padding orizzontale per il testo
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14, // ✅ FIX: Ridotto leggermente per evitare overflow
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    flex: 1,
    minWidth: 0, // ✅ FIX: Permette al flex di ridursi correttamente
    paddingVertical: 14,
    paddingHorizontal: 12, // ✅ FIX: Aggiunge padding orizzontale per il testo
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14, // ✅ FIX: Ridotto leggermente per evitare overflow
    fontWeight: '700',
    textAlign: 'center',
  },
  saveLibraryButton: {
    flex: 1,
    minWidth: 0, // ✅ FIX: Permette al flex di ridursi correttamente
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12, // ✅ FIX: Aggiunge padding orizzontale per il testo
    gap: 6, // ✅ FIX: Ridotto gap per dare più spazio al testo
  },
  saveLibraryButtonText: {
    fontSize: 14, // ✅ FIX: Ridotto leggermente per evitare overflow
    fontWeight: '600',
    flexShrink: 1, // ✅ FIX: Permette al testo di ridursi se necessario
  },
  saveRecipeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  saveRecipeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  saveRecipeTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveRecipeSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  saveRecipeField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  saveRecipeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveRecipeInput: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveRecipeTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveRecipeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saveRecipeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  saveRecipeChipText: {
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
  },
  favoriteToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  savedIngredientsSection: {
    marginBottom: 24,
  },
  savedIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  savedIngredientInfo: {
    flex: 1,
    marginRight: 12,
  },
  savedIngredientName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  savedIngredientExpiry: {
    fontSize: 13,
    marginTop: 2,
  },
  savedIngredientQuantity: {
    fontSize: 13,
    marginTop: 2,
  },
  savedIngredientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  excludeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSavedButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

