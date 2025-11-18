// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import CameraCapture from './CameraCapture';
import { useCameraController } from '../hooks/useCameraController';
import { Platform } from 'react-native';

import { BACKEND_URL } from '../constants/env';
import UnifiedAnalysisService from '../services/unified-analysis.service';
import { FoodAnalysisService } from '../services/food-analysis.service';
import { AuthService } from '../services/auth.service';
import { ChartDataService } from '../services/chart-data.service';
import { UserFeedbackService } from '../services/user-feedback.service';
import { DatabaseVerificationService } from '../services/database-verification.service';
import { useAnalysisStore } from '../stores/analysis.store';
import { CoachService } from '../services/coach.service';
import { GaugeChart } from './charts/GaugeChart';
import { FoodLoadingScreen } from './FoodLoadingScreen';
import { FoodResultsScreen } from './FoodResultsScreen';
import { FoodAnalysisResult } from '../types/analysis.types';
import { EnhancedScoreTile } from './EnhancedScoreTile';
import { QualityBadge } from './QualityBadge';
import { InsightCorrelation } from './InsightCorrelation';
import { InsightSection } from './InsightSection';
import { ActionCard } from './ActionCard';
import { MetricsService } from '../services/metrics.service';
import { ActionsService } from '../services/actions.service';
import { QualityService } from '../services/quality.service';
import { CorrelationService } from '../services/correlation.service';
import { InsightService } from '../services/insight.service';
import { DetailedAnalysisPopup } from './DetailedAnalysisPopup';
import { IntelligentInsightsSection } from './IntelligentInsightsSection';
import { VideoHero } from './VideoHero';
import { FoodCaptureCard } from './FoodCaptureCard';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../contexts/ThemeContext';
import { NutritionalGoalsModal } from './NutritionalGoalsModal';
import { FridgeIngredientsModal } from './FridgeIngredientsModal';
import { RecipeDetailModal } from './RecipeDetailModal';
// Removed useInsights - now using IntelligentInsightsSection directly

const { width } = Dimensions.get('window');

interface FoodAnalysisResults {
  calories: number;
  carbohydrates: number;
  proteins: number;
  fats: number;
  fiber?: number;
  healthScore: number;
  recommendations: string[];
}

interface InsightCard {
  id: string;
  title: string;
  description: string;
  image: string;
}

const heroImageUri = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=3280&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
// Video URI per Food Analysis - usando require per file locali
const heroVideoUri = require('../assets/videos/food-analysis-video.mp4');

// Guide e insight cards rimosse - non necessarie per food analysis

// Image component with fallback
const ImageWithFallback: React.FC<{ uri: string; style: any; fallbackColor?: string }> = ({ 
  uri, 
  style, 
  fallbackColor 
}) => {
  const { colors } = useTheme();
  const [imageError, setImageError] = useState(false);
  
  const defaultFallbackColor = fallbackColor || colors.surfaceMuted;
  
  if (imageError) {
    return (
      <View style={[style, { backgroundColor: defaultFallbackColor, justifyContent: 'center', alignItems: 'center' }]}>
        <FontAwesome name="image" size={24} color={colors.textTertiary} />
      </View>
    );
  }
  
  return (
    <Image 
      source={{ uri }} 
      style={style}
      onError={() => setImageError(true)}
      resizeMode="cover"
    />
  );
};

// Animated Calorie Bar Component
const AnimatedCalorieBar: React.FC<{
  current: number;
  max: number;
  label: string;
}> = ({ current, max, label }) => {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  
  useEffect(() => {
    const percent = Math.max(0, Math.min(100, (current / (max || 1)) * 100));
    progress.value = withTiming(percent, { duration: 800 });
  }, [current, max, progress]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));
  
  const caloriesPercent = Math.max(0, Math.min(100, Math.round((current / (max || 1)) * 100)));
  
  return (
    <View style={[styles.calorieBarContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.calorieBarHeader}>
        <Text style={[styles.calorieBarLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text style={[styles.calorieBarValue, { color: colors.textSecondary }]}>
          {Math.round(current)} / {max} kcal ({caloriesPercent}%)
        </Text>
      </View>
      <View style={[styles.calorieBarTrack, { backgroundColor: colors.borderLight }]}>
        <Animated.View 
          style={[
            styles.calorieBarFill, 
            { backgroundColor: colors.accent },
            animatedStyle
          ]} 
        />
      </View>
    </View>
  );
};

// Funzione helper per ricette predefinite
const getDefaultRecipe = (mealType: string) => {
  const defaultRecipes: Record<string, any> = {
    breakfast: {
      title: 'Colazione Proteica Completa',
      servings: 1,
      readyInMinutes: 15,
      ingredients: [
        { name: 'Uova', quantity: 2, unit: 'pcs' },
        { name: 'Pane integrale', quantity: 2, unit: 'fette' },
        { name: 'Avocado', quantity: 0.5, unit: 'pcs' },
        { name: 'Pomodori', quantity: 2, unit: 'pcs' },
        { name: 'Olio d\'oliva', quantity: 5, unit: 'ml' },
      ],
      steps: [
        'Scalda una padella antiaderente e cuoci le uova come preferisci (fritte, strapazzate o in camicia).',
        'Tosta il pane integrale e spalma l\'avocado.',
        'Taglia i pomodori a fette e disponili sul pane.',
        'Aggiungi le uova e condisci con olio d\'oliva, sale e pepe.',
      ],
      tips: [
        'Per un pasto più saziante, aggiungi una fonte di proteine come formaggio fresco o prosciutto.',
        'L\'avocado fornisce grassi sani che aiutano l\'assorbimento delle vitamine liposolubili.',
      ],
      macrosPerServing: { protein: 20, carbs: 35, fat: 25 },
      caloriesPerServing: 420,
      shoppingGaps: [],
    },
    lunch: {
      title: 'Insalata Mediterranea con Pollo',
      servings: 1,
      readyInMinutes: 20,
      ingredients: [
        { name: 'Petto di pollo', quantity: 150, unit: 'g' },
        { name: 'Insalata mista', quantity: 100, unit: 'g' },
        { name: 'Pomodori ciliegini', quantity: 100, unit: 'g' },
        { name: 'Cetrioli', quantity: 50, unit: 'g' },
        { name: 'Feta', quantity: 50, unit: 'g' },
        { name: 'Olio d\'oliva', quantity: 10, unit: 'ml' },
        { name: 'Limone', quantity: 0.5, unit: 'pcs' },
      ],
      steps: [
        'Cuoci il petto di pollo in padella con un filo d\'olio per 8-10 minuti per lato.',
        'Taglia il pollo a strisce e lascia raffreddare leggermente.',
        'Prepara l\'insalata lavando e tagliando tutti gli ingredienti freschi.',
        'Aggiungi la feta a cubetti e il pollo.',
        'Condisci con olio d\'oliva, succo di limone, sale e pepe.',
      ],
      tips: [
        'Puoi preparare il pollo in anticipo e tenerlo in frigorifero per un pasto veloce.',
        'Aggiungi noci o mandorle per aumentare i grassi sani e le proteine.',
      ],
      macrosPerServing: { protein: 45, carbs: 15, fat: 20 },
      caloriesPerServing: 380,
      shoppingGaps: [],
    },
    dinner: {
      title: 'Salmone con Verdure al Forno',
      servings: 1,
      readyInMinutes: 25,
      ingredients: [
        { name: 'Filetto di salmone', quantity: 150, unit: 'g' },
        { name: 'Zucchine', quantity: 150, unit: 'g' },
        { name: 'Peperoni', quantity: 100, unit: 'g' },
        { name: 'Patate dolci', quantity: 100, unit: 'g' },
        { name: 'Olio d\'oliva', quantity: 15, unit: 'ml' },
        { name: 'Erbe aromatiche', quantity: 5, unit: 'g' },
      ],
      steps: [
        'Preriscalda il forno a 200°C.',
        'Taglia le verdure a cubetti e disponile su una teglia con carta forno.',
        'Condisci le verdure con olio d\'oliva, sale, pepe e erbe aromatiche.',
        'Cuoci le verdure per 15 minuti, poi aggiungi il salmone e cuoci per altri 10 minuti.',
        'Servi caldo con un filo d\'olio d\'oliva.',
      ],
      tips: [
        'Il salmone è ricco di omega-3, importanti per la salute del cuore.',
        'Le patate dolci forniscono carboidrati complessi per energia duratura.',
      ],
      macrosPerServing: { protein: 35, carbs: 40, fat: 22 },
      caloriesPerServing: 480,
      shoppingGaps: [],
    },
    snack: {
      title: 'Smoothie Verde Energizzante',
      servings: 1,
      readyInMinutes: 5,
      ingredients: [
        { name: 'Spinaci freschi', quantity: 50, unit: 'g' },
        { name: 'Banana', quantity: 1, unit: 'pcs' },
        { name: 'Yogurt greco', quantity: 100, unit: 'g' },
        { name: 'Mirtilli', quantity: 50, unit: 'g' },
        { name: 'Miele', quantity: 10, unit: 'ml' },
        { name: 'Acqua o latte', quantity: 100, unit: 'ml' },
      ],
      steps: [
        'Lava gli spinaci e taglia la banana a pezzi.',
        'Aggiungi tutti gli ingredienti in un frullatore.',
        'Frulla per 1-2 minuti fino a ottenere una consistenza liscia.',
        'Versa in un bicchiere e gusta immediatamente.',
      ],
      tips: [
        'Puoi preparare questo smoothie in anticipo e conservarlo in frigorifero per massimo 24 ore.',
        'Aggiungi semi di chia o lino per aumentare i grassi sani e le fibre.',
      ],
      macrosPerServing: { protein: 15, carbs: 45, fat: 8 },
      caloriesPerServing: 280,
      shoppingGaps: [],
    },
  };
  
  return defaultRecipes[mealType] || defaultRecipes.breakfast;
};

export const FoodAnalysisScreen: React.FC = () => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const { colors } = useTheme();
  const cameraController = useCameraController({ isScreenFocused: true });
  const [currentImageUri, setCurrentImageUri] = useState(heroImageUri);
  
  const [analyzing, setAnalyzing] = useState(false);
  // Removed capturing state - no more capture overlay
  const [results, setResults] = useState<FoodAnalysisResults | null>(null);
  const [fullAnalysisResult, setFullAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  // Removed showResultsCard state - now using FoodResultsScreen for all results
  const [cameraType, setCameraType] = useState<'front' | 'back'>('front'); // Default to front camera for consistency
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [permissionChecking, setPermissionChecking] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Enhanced components states
  const [nextBestActions, setNextBestActions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [qualityInfo, setQualityInfo] = useState<any>(null);
  
  
  // Detailed analysis modal
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  // Intelligent insights are now handled by IntelligentInsightsSection component

  // 🔥 FIX: Spostati tutti gli useState prima degli useEffect per rispettare le regole degli hook
  // Calcola daily intake e obiettivi giornalieri
  const [dailyIntake, setDailyIntake] = useState({
    calories: 0,
    carbohydrates: 0,
    proteins: 0,
    fats: 0,
    fiber: 0,
    mealCount: 0,
  });

  // Obiettivi giornalieri (caricati dal profilo utente o valori di default)
  const [dailyGoals, setDailyGoals] = useState({
    calories: 2000, // kcal
    carbohydrates: 250, // g (50% di 2000 kcal)
    proteins: 150, // g (30% di 2000 kcal)
    fats: 65, // g (20% di 2000 kcal)
    fiber: 25, // g
  });

  // Modal per configurare obiettivi nutrizionali
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [nutritionalGoals, setNutritionalGoals] = useState<any>(null);
  
  // Modal per ingredienti frigo
  const [showFridgeModal, setShowFridgeModal] = useState(false);
  
  // Modal per dettagli ricetta
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  const analysisServiceRef = useRef(UnifiedAnalysisService.getInstance());
  const isMountedRef = useRef(true);
  // 🔥 FIX: Spostato prima degli useEffect per rispettare le regole degli hook
  const cameraInitializedRef = useRef(false);

  // 🔥 FIX: Spostato hook useAnalysisStore prima dei return condizionali per rispettare le regole degli hook
  const foodHistory = useAnalysisStore((state) => state.getSafeFoodHistory());
  const latestFoodSession = useAnalysisStore((state) => state.latestFoodSession);

  const startDisabled = permissionChecking || analyzing || !analysisReady || !!analysisError;
  const captureDisabled = !cameraController.ready || cameraController.detecting || permissionChecking || analyzing || cameraSwitching;

  const ensureCameraPermission = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setPermissionChecking(true);
      }
      const result = await cameraController.ensurePermission();
      return result;
    } finally {
      if (isMountedRef.current) {
        setPermissionChecking(false);
      }
    }
  }, [cameraController]);

  const ensureAnalysisReady = useCallback(async () => {
    if (analysisReady && !analysisError) {
      return true;
    }

    try {
      const initResult = await analysisServiceRef.current.initialize();
      const ready = !!initResult?.overall;
      if (isMountedRef.current) {
        setAnalysisReady(ready);
        setAnalysisError(ready ? null : 'Unable to initialize analysis service. Check OpenAI settings.');
      }
      return ready;
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console
      console.error('❌ Analysis service initialization failed:', error);
      if (isMountedRef.current) {
        setAnalysisReady(false);
        setAnalysisError('Unable to initialize analysis service. Check OpenAI settings.');
      }
      return false;
    }
  }, [analysisReady, analysisError]); // 🔥 FIX: Aggiunte dipendenze mancanti

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    ensureAnalysisReady();
  }, [ensureAnalysisReady]);

  // Carica i dati dei grafici dal database quando il componente si monta
  useEffect(() => {
    // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
    let isMounted = true;
    
    const loadChartData = async () => {
      try {
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        await ChartDataService.loadFoodDataForCharts();
        // 🔥 FIX: Rimuoviamo console.log eccessivi
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Failed to load food chart data:', error);
      }
    };
    
    // Delay loading to ensure component is fully mounted
    // 🔥 FIX: Memory leak - salviamo il timeout per cleanup
    const timer = setTimeout(() => {
      if (isMounted) {
        loadChartData();
      }
    }, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Calcola dati enhanced per i nuovi componenti
  useEffect(() => {
    // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
    let isMounted = true;
    
    const calculateEnhancedData = async () => {
      try {
        if (fullAnalysisResult && isMounted) {
          // Calcola quality info
          const confidenceInfo = QualityService.getConfidenceScore(fullAnalysisResult.confidence || 0.8);
          if (isMounted) {
            setQualityInfo(confidenceInfo);
          }
        }
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Error calculating enhanced data:', error);
      }
    };

    calculateEnhancedData();
    
    return () => {
      isMounted = false;
    };
  }, [fullAnalysisResult]);

  // Carica obiettivi nutrizionali dal profilo utente
  useEffect(() => {
    const loadNutritionalGoals = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          const profile = await AuthService.getUserProfile(currentUser.id);
          if (profile?.nutritional_goals) {
            const goals = profile.nutritional_goals;
            setNutritionalGoals(goals);
            
            // Calcola i grammi dai percentuali
            const calories = goals.daily_calories || 2000;
            const carbsPct = goals.carbs_percentage || 50;
            const proteinsPct = goals.proteins_percentage || 30;
            const fatsPct = goals.fats_percentage || 20;
            
            setDailyGoals({
              calories,
              carbohydrates: Math.round((calories * carbsPct / 100) / 4), // 4 kcal per grammo di carboidrati
              proteins: Math.round((calories * proteinsPct / 100) / 4), // 4 kcal per grammo di proteine
              fats: Math.round((calories * fatsPct / 100) / 9), // 9 kcal per grammo di grassi
              fiber: 25, // g (valore standard)
            });
          }
        }
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Error loading nutritional goals:', error);
      }
    };

    loadNutritionalGoals();
  }, []);

  const handleSaveGoals = async (goals: any) => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        await AuthService.updateUserProfile(currentUser.id, {
          nutritional_goals: goals,
        });
        
        setNutritionalGoals(goals);
        
        // Calcola i grammi dai percentuali
        const calories = goals.daily_calories;
        const carbsPct = goals.carbs_percentage || 50;
        const proteinsPct = goals.proteins_percentage || 30;
        const fatsPct = goals.fats_percentage || 20;
        
        setDailyGoals({
          calories,
          carbohydrates: Math.round((calories * carbsPct / 100) / 4),
          proteins: Math.round((calories * proteinsPct / 100) / 4),
          fats: Math.round((calories * fatsPct / 100) / 9),
          fiber: 25,
        });
        
        setShowGoalsModal(false);
      }
    } catch (error) {
      console.error('Error saving nutritional goals:', error);
      alert(t('common.error'));
    }
  };

  useEffect(() => {
    // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
    let isMounted = true;
    
    const loadDailyIntake = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser && isMounted) {
          const intake = await FoodAnalysisService.getDailyIntake(currentUser.id);
          if (isMounted) {
            setDailyIntake(intake);
          }
        }
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Error loading daily intake:', error);
      }
    };

    loadDailyIntake();
    
    // Ricarica ogni volta che viene aggiunta una nuova analisi
    // 🔥 FIX: Usiamo un flag per evitare subscription multiple
    let subscribed = true;
    const unsubscribe = useAnalysisStore.subscribe((state) => {
      if (subscribed && isMounted && state.foodHistory.length > 0) {
        loadDailyIntake();
      }
    });

    return () => {
      isMounted = false;
      subscribed = false;
      unsubscribe();
    };
  }, [fullAnalysisResult]);

  // Start camera automatically when screen loads
  // 🔥 FIX: Rimuoviamo cameraController dalle dipendenze per evitare loop infinito
  useEffect(() => {
    // 🔥 FIX: Evita di inizializzare la camera più volte
    if (cameraInitializedRef.current) {
      return;
    }
    
    // 🔥 FIX: Evita di avviare la camera se è già attiva
    if (cameraController.active) {
      cameraInitializedRef.current = true;
      return;
    }
    
    // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
    let isMounted = true;
    
    const initializeCamera = async () => {
      if (isMounted && !cameraController.active) {
        await cameraController.startCamera();
        if (isMounted) {
          cameraInitializedRef.current = true;
        }
      }
    };
    
    // Delay initialization to avoid conflicts
    const timer = setTimeout(() => {
      initializeCamera();
    }, 300);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []); // 🔥 FIX: Array vuoto per eseguire solo al mount


  const handleStartAnalysis = async () => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi

    // Start camera immediately for better perceived performance
    await cameraController.startCamera();

    // Run permission and analysis checks in parallel
    const [granted, ready] = await Promise.all([
      ensureCameraPermission(),
      ensureAnalysisReady()
    ]);

    // 🔥 FIX: Rimuoviamo console.log eccessivi
    if (!granted) {
      if (isMountedRef.current) {
        alert(t('analysis.food.errors.cameraPermission'));
        cameraController.stopCamera();
      }
      return;
    }

    if (!ready) {
      if (isMountedRef.current) {
        alert(t('analysis.food.errors.serviceNotReady'));
        cameraController.stopCamera();
      }
      return;
    }

    // 🔥 FIX: Rimuoviamo console.log eccessivi
    // Reset previous session state so the camera preview always shows immediately
    if (isMountedRef.current) {
      setResults(null);
      setAnalyzing(false);
      setCameraSwitching(false);
    }
  };

  // 🔧 FALLBACK: Image Picker for Testing (100% Reliable)
  const analyzeFromGallery = async () => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    
    try {
      const ready = await ensureAnalysisReady();
      if (!ready) {
        if (isMountedRef.current) {
          alert(t('analysis.food.errors.serviceNotReady'));
        }
        return;
      }

      // Request image picker permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (isMountedRef.current) {
          alert(t('analysis.food.errors.mediaLibraryPermission'));
        }
        return;
      }

      // Pick image from gallery
      // ✅ FIX: Crop libero (senza proporzioni fisse) e migliorata visibilità pulsanti
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // ✅ Rimossa aspect ratio fissa per permettere crop libero
        quality: 0.9, // ✅ Aumentata qualità per migliore analisi
        base64: true,
      };
      
      // ✅ Full screen solo su iOS per migliore visibilità pulsanti
      if (Platform.OS === 'ios') {
        pickerOptions.presentationStyle = ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN;
      }
      
      const pickerResult = await ImagePicker.launchImageLibraryAsync(pickerOptions);

      // 🔥 FIX: Rimuoviamo console.log eccessivi

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        // 🔥 FIX: Rimuoviamo console.log eccessivi

        // Convert to data URL for analysis
        const dataUrl = asset.base64 
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        if (!dataUrl) {
          if (isMountedRef.current) {
            alert(t('analysis.food.errors.imageProcessingFailed'));
          }
          return;
        }

        // 🔥 FIX: Rimuoviamo console.log eccessivi
        
        if (isMountedRef.current) {
          setAnalyzing(true);
        }

        // Analyze the selected image
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        const analysisResult = await analysisServiceRef.current.analyzeFood(dataUrl);
        
        if (analysisResult.success && analysisResult.data) {
          // 🔥 FIX: Rimuoviamo console.log eccessivi

          // Store the full analysis result
          if (isMountedRef.current) {
            setFullAnalysisResult(analysisResult.data);
          }

          const foodResults: FoodAnalysisResults = {
            calories: analysisResult.data.macronutrients?.calories || 0,
            carbohydrates: analysisResult.data.macronutrients?.carbohydrates || 0,
            proteins: analysisResult.data.macronutrients?.proteins || 0,
            fats: analysisResult.data.macronutrients?.fats || 0,
            fiber: analysisResult.data.macronutrients?.fiber,
            healthScore: analysisResult.data.health_score || 70,
            recommendations: analysisResult.data.recommendations || [],
          };
          
          if (isMountedRef.current) {
            setResults(foodResults);
            setAnalyzing(false);
          }

          // 🆕 Save to Supabase database with enhanced error handling and feedback
          try {
            const currentUser = await AuthService.getCurrentUser();
            if (currentUser) {
              try {
                const savedAnalysis = await FoodAnalysisService.saveFoodAnalysis(currentUser.id, {
                  mealType: analysisResult.data.meal_type || 'other',
                  identifiedFoods: analysisResult.data.identified_foods || [],
                  calories: analysisResult.data.macronutrients?.calories || 0,
                  carbohydrates: analysisResult.data.macronutrients?.carbohydrates || 0,
                  proteins: analysisResult.data.macronutrients?.proteins || 0,
                  fats: analysisResult.data.macronutrients?.fats || 0,
                  fiber: analysisResult.data.macronutrients?.fiber || 0,
                  vitamins: analysisResult.data.vitamins || {},
                  minerals: analysisResult.data.minerals || {},
                  healthScore: analysisResult.data.health_score || 70,
                  recommendations: analysisResult.data.recommendations || [],
                  observations: analysisResult.data.observations || [],
                  confidence: analysisResult.data.confidence || 0.8,
                  analysisData: {
                    ...analysisResult.data,
                    version: analysisResult.data.version || '1.0.0',
                    confidence: analysisResult.data.confidence || 0.8,
                  },
                  imageUrl: asset.uri,
                });
                
                if (savedAnalysis) {
                  // 🆕 Verifica post-salvataggio che i dati siano nel database
                  const verification = await DatabaseVerificationService.verifyFoodAnalysis(currentUser.id, savedAnalysis.id);
                  if (!verification.found) {
                    UserFeedbackService.showWarning('L\'analisi è stata salvata ma potrebbe non essere visibile immediatamente. Riprova più tardi.');
                  } else {
                    UserFeedbackService.showSaveSuccess('analisi');
                  }
                  
                  // Sincronizza i dati con lo store locale per i grafici
                  const foodSession = {
                    id: savedAnalysis.id,
                    timestamp: new Date(savedAnalysis.created_at),
                    macronutrients: {
                      carbohydrates: savedAnalysis.carbohydrates || 0,
                      proteins: savedAnalysis.proteins || 0,
                      fats: savedAnalysis.fats || 0,
                      fiber: savedAnalysis.fiber || 0,
                      calories: savedAnalysis.calories || 0,
                    },
                    meal_type: savedAnalysis.meal_type || 'other',
                    health_score: savedAnalysis.health_score || 70,
                    confidence: savedAnalysis.confidence || 0.8,
                    identified_foods: savedAnalysis.identified_foods || [],
                  };
                  
                  const store = useAnalysisStore.getState();
                  store.addFoodSession(foodSession);
                } else {
                  // 🆕 Nessun errore lanciato ma savedAnalysis è null
                  if (isMountedRef.current) {
                    UserFeedbackService.showSaveError('analisi', async () => {
                      // Retry logic
                      try {
                        const retryAnalysis = await FoodAnalysisService.saveFoodAnalysis(currentUser.id, {
                          mealType: analysisResult.data.meal_type || 'other',
                          identifiedFoods: analysisResult.data.identified_foods || [],
                          calories: analysisResult.data.macronutrients?.calories || 0,
                          carbohydrates: analysisResult.data.macronutrients?.carbohydrates || 0,
                          proteins: analysisResult.data.macronutrients?.proteins || 0,
                          fats: analysisResult.data.macronutrients?.fats || 0,
                          fiber: analysisResult.data.macronutrients?.fiber || 0,
                          vitamins: analysisResult.data.vitamins || {},
                          minerals: analysisResult.data.minerals || {},
                          healthScore: analysisResult.data.health_score || 70,
                          recommendations: analysisResult.data.recommendations || [],
                          observations: analysisResult.data.observations || [],
                          confidence: analysisResult.data.confidence || 0.8,
                          analysisData: {
                            ...analysisResult.data,
                            version: analysisResult.data.version || '1.0.0',
                            confidence: analysisResult.data.confidence || 0.8,
                          },
                          imageUrl: asset.uri,
                        });
                        if (retryAnalysis) {
                          UserFeedbackService.showSaveSuccess('analisi');
                        }
                      } catch (retryError) {
                        UserFeedbackService.showError('Impossibile salvare l\'analisi. Riprova più tardi.');
                      }
                    });
                  }
                }
              } catch (saveError) {
                // 🆕 Errore durante il salvataggio - mostra feedback all'utente
                if (isMountedRef.current) {
                  UserFeedbackService.showSaveError('analisi', async () => {
                    // Retry logic
                    try {
                      const retryAnalysis = await FoodAnalysisService.saveFoodAnalysis(currentUser.id, {
                        mealType: analysisResult.data.meal_type || 'other',
                        identifiedFoods: analysisResult.data.identified_foods || [],
                        calories: analysisResult.data.macronutrients?.calories || 0,
                        carbohydrates: analysisResult.data.macronutrients?.carbohydrates || 0,
                        proteins: analysisResult.data.macronutrients?.proteins || 0,
                        fats: analysisResult.data.macronutrients?.fats || 0,
                        fiber: analysisResult.data.macronutrients?.fiber || 0,
                        vitamins: analysisResult.data.vitamins || {},
                        minerals: analysisResult.data.minerals || {},
                        healthScore: analysisResult.data.health_score || 70,
                        recommendations: analysisResult.data.recommendations || [],
                        observations: analysisResult.data.observations || [],
                        confidence: analysisResult.data.confidence || 0.8,
                        analysisData: {
                          ...analysisResult.data,
                          version: analysisResult.data.version || '1.0.0',
                          confidence: analysisResult.data.confidence || 0.8,
                        },
                        imageUrl: asset.uri,
                      });
                      if (retryAnalysis) {
                        UserFeedbackService.showSaveSuccess('analisi');
                      }
                    } catch (retryError) {
                      UserFeedbackService.showError('Impossibile salvare l\'analisi. Riprova più tardi.');
                    }
                  });
                }
              }
            }
          } catch (dbError) {
            // 🆕 Errore generale - mostra feedback all'utente
            if (isMountedRef.current) {
              UserFeedbackService.showError('Errore durante il salvataggio dell\'analisi. I dati potrebbero non essere stati salvati.');
            }
          }
          
        } else {
          console.error('❌ Gallery food analysis failed:', analysisResult.error);
          if (isMountedRef.current) {
            alert(t('analysis.food.errors.analysisFailed', { error: analysisResult.error || 'Unknown error' }));
            setAnalyzing(false);
          }
        }
      }
      // 🔥 FIX: Rimuoviamo console.log eccessivi
    } catch (error: any) {
      console.error('❌ Gallery food analysis error:', error);
      if (isMountedRef.current) {
        alert(t('analysis.food.errors.failedToAnalyze', { error: error.message }));
        setAnalyzing(false);
      }
    }
  };

  const switchCamera = useCallback(() => {
    if (cameraSwitching) {
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      return;
    }

    const nextType = cameraType === 'front' ? 'back' : 'front';
    // 🔥 FIX: Rimuoviamo console.log eccessivi

    // DON'T set cameraSwitching to true immediately - this causes ref loss
    // Instead, update the camera type and let the CameraView handle the transition
    if (isMountedRef.current) {
      setCameraType(nextType);
    }
    
    // Set switching state AFTER the camera type change to prevent ref loss
    // 🔥 FIX: Memory leak - usiamo Promise per gestire i delay invece di setTimeout annidati
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (isMountedRef.current) {
        setCameraSwitching(true);
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        
        // Reset switching state after a short delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (isMountedRef.current) {
          setCameraSwitching(false);
          // 🔥 FIX: Rimuoviamo console.log eccessivi
        }
      }
    })();
    
  }, [cameraType, cameraSwitching]);

  const captureAndAnalyze = async () => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    
    // Store cameraController methods in local variables to prevent scope issues
    const { ref, ready, detecting, error, isCameraReady, setDetecting } = cameraController;
    
    // 🔥 FIX: Rimuoviamo console.log eccessivi

    if (!isCameraReady()) {
      const errorMsg = error || t('analysis.food.errors.cameraNotReady');
      console.error('❌ Capture failed:', errorMsg);
      if (isMountedRef.current) {
        alert(errorMsg);
      }
      return;
    }
    if (detecting || analyzing) {
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      return;
    }
    if (cameraSwitching) {
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      if (isMountedRef.current) {
        alert(t('analysis.common.processing'));
      }
      return;
    }

    try {
      const serviceReady = await ensureAnalysisReady();
      if (!serviceReady) {
        const errorMsg = t('analysis.food.errors.serviceNotReady');
        console.error('❌ Capture failed:', errorMsg);
        if (isMountedRef.current) {
          alert(errorMsg);
        }
        return;
      }

      if (isMountedRef.current) {
        setAnalyzing(true);
        setDetecting(true);
      }

      // 🔥 FIX: Rimuoviamo console.log eccessivi
      // 🔥 FIX: Rimuoviamo console.log eccessivi

      // Aggressive ref recovery before capture (same as EmotionDetectionScreen)
      if (!ref.current) {
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        
        // Try to restore from global storage first
        const globalRef = (globalThis as any).globalCameraRef;
        if (globalRef) {
          // 🔥 FIX: Rimuoviamo console.log eccessivi
          ref.current = globalRef;
        }
        
        // Try multiple recovery attempts
        for (let attempt = 1; attempt <= 3; attempt++) {
          // 🔥 FIX: Rimuoviamo console.log eccessivi
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          
          // Force a re-render by updating state
          if (isMountedRef.current) {
            setDetecting(false);
            await new Promise(resolve => setTimeout(resolve, 50));
            setDetecting(true);
          }
          
          if (ref.current) {
            // 🔥 FIX: Rimuoviamo console.log eccessivi
            break;
          }
        }
        
        if (!ref.current) {
          throw new Error('Camera ref is null - camera may have been unmounted. Please restart the camera.');
        }
      }

      // 🔥 FIX: Rimuoviamo console.log eccessivi

      // Try multiple capture strategies (exact copy from Emotion Detection)
      let photo = null;
      const captureStrategies = [
        {
          name: 'High Quality',
          options: {
            quality: 0.9,
            base64: true,
            skipProcessing: false,
            exif: false,
            sound: false, // Disable capture sound
          }
        },
        {
          name: 'Android Optimized',
          options: {
            quality: 0.7,
            base64: true,
            skipProcessing: Platform.OS === 'android',
            exif: false,
            sound: false, // Disable capture sound
          }
        },
        {
          name: 'Minimal Processing',
          options: {
            quality: 0.5,
            base64: true,
            skipProcessing: true,
            exif: false,
            sound: false, // Disable capture sound
          }
        }
      ];

      for (let i = 0; i < captureStrategies.length; i++) {
        const strategy = captureStrategies[i];
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        
        try {
          // Double-check camera ref is still valid right before capture
          if (!ref.current) {
            // 🔥 FIX: Rimuoviamo console.log eccessivi
            
            // Try to recover ref from global storage
            const globalRef = (globalThis as any).globalCameraRef;
            if (globalRef) {
              // 🔥 FIX: Rimuoviamo console.log eccessivi
              ref.current = globalRef;
            } else {
              throw new Error('Camera ref is null and cannot be recovered');
            }
          }
          
          // Additional safety check - ensure the ref has the takePictureAsync method
          if (typeof ref.current.takePictureAsync !== 'function') {
            // 🔥 FIX: Rimuoviamo console.log eccessivi
            throw new Error('Camera ref does not have takePictureAsync method');
          }
          
          // Extra validation for camera switching scenarios
          if (cameraSwitching) {
            // 🔥 FIX: Rimuoviamo console.log eccessivi
            throw new Error('Camera is still switching');
          }
          
          // 🔥 FIX: Rimuoviamo console.log eccessivi
          const capturePromise = ref.current.takePictureAsync(strategy.options);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Camera capture timeout')), 8000);
          });

          photo = await Promise.race([capturePromise, timeoutPromise]);
          // 🔥 FIX: Rimuoviamo console.log eccessivi
          break;
        } catch (strategyError) {
          // 🔥 FIX: Rimuoviamo console.log eccessivi
          
          // If this is the first strategy and it fails, try to restart the camera
          if (i === 0 && strategyError.message.includes('ERR_IMAGE_CAPTURE_FAILED')) {
            // 🔥 FIX: Rimuoviamo console.log eccessivi
            try {
              cameraController.stopCamera();
              await new Promise(resolve => setTimeout(resolve, 1000));
              cameraController.startCamera();
              await new Promise(resolve => setTimeout(resolve, 2000));
              // 🔥 FIX: Rimuoviamo console.log eccessivi
            } catch (restartError) {
              // 🔥 FIX: Rimuoviamo console.log eccessivi
            }
          }
          
          if (i === captureStrategies.length - 1) {
            throw strategyError; // Re-throw the last error if all strategies fail
          }
          // Wait a bit before trying the next strategy
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!photo) {
        throw new Error('All capture strategies failed');
      }

      // 🔥 FIX: Rimuoviamo console.log eccessivi

      if (!photo) {
        throw new Error('Camera returned null photo');
      }

      if (!photo?.base64 && photo?.uri) {
        try {
          // 🔥 FIX: Rimuoviamo console.log eccessivi
          const base64 = await FileSystem.readAsStringAsync(photo.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          photo.base64 = base64;
          // 🔥 FIX: Rimuoviamo console.log eccessivi
        } catch (conversionError) {
          // 🔥 FIX: Solo errori critici in console
          console.error('❌ Failed to convert photo to base64:', conversionError);
          throw new Error('Failed to process photo data');
        }
      }

      if (!photo?.base64) {
        throw new Error('Camera returned empty data. Please retry.');
      }

      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      // 🔥 FIX: Rimuoviamo console.log eccessivi

      const result = await analysisServiceRef.current.analyzeFood(dataUrl, 'food-analysis-session');
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Food analysis failed.');
      }

      // 🔥 FIX: Rimuoviamo console.log eccessivi

      // Store the full analysis result
      if (isMountedRef.current) {
        setFullAnalysisResult(result.data);
      }

      // 🆕 Save to Supabase database with enhanced error handling and feedback
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          try {
            const savedAnalysis = await FoodAnalysisService.saveFoodAnalysis(currentUser.id, {
              mealType: result.data.meal_type || 'other',
              identifiedFoods: result.data.identified_foods || [],
              calories: result.data.macronutrients?.calories || 0,
              carbohydrates: result.data.macronutrients?.carbohydrates || 0,
              proteins: result.data.macronutrients?.proteins || 0,
              fats: result.data.macronutrients?.fats || 0,
              fiber: result.data.macronutrients?.fiber || 0,
              vitamins: result.data.vitamins || {},
              minerals: result.data.minerals || {},
              healthScore: result.data.health_score || 70,
              recommendations: result.data.recommendations || [],
              observations: result.data.observations || [],
              confidence: result.data.confidence || 0.8,
              analysisData: {
                ...result.data,
                version: result.data.version || '1.0.0',
                confidence: result.data.confidence || 0.8,
              },
              imageUrl: photo.uri,
            });
            
            if (savedAnalysis) {
              // 🆕 Verifica post-salvataggio che i dati siano nel database
              const verification = await DatabaseVerificationService.verifyFoodAnalysis(currentUser.id, savedAnalysis.id);
              if (!verification.found) {
                UserFeedbackService.showWarning('L\'analisi è stata salvata ma potrebbe non essere visibile immediatamente. Riprova più tardi.');
              } else {
                UserFeedbackService.showSaveSuccess('analisi');
              }
              
              // ✅ FIX: Sincronizza i dati con lo store locale per i grafici
              // Usa i dati dall'analisi risultato (result.data) invece di savedAnalysis per garantire valori corretti
              const foodSession = {
                id: savedAnalysis.id,
                timestamp: new Date(savedAnalysis.created_at),
                macronutrients: {
                  carbohydrates: result.data.macronutrients?.carbohydrates || savedAnalysis.carbohydrates || 0,
                  proteins: result.data.macronutrients?.proteins || savedAnalysis.proteins || 0,
                  fats: result.data.macronutrients?.fats || savedAnalysis.fats || 0,
                  fiber: result.data.macronutrients?.fiber || savedAnalysis.fiber || 0,
                  calories: result.data.macronutrients?.calories || savedAnalysis.calories || 0, // ✅ Usa result.data per valori corretti
                },
                meal_type: result.data.meal_type || savedAnalysis.meal_type || 'other',
                health_score: result.data.health_score || savedAnalysis.health_score || 70,
                confidence: result.data.confidence || savedAnalysis.confidence || 0.8,
                identified_foods: result.data.identified_foods || savedAnalysis.identified_foods || [],
              };
              
              const store = useAnalysisStore.getState();
              store.addFoodSession(foodSession);
              
              // ✅ FIX: Ricarica dailyIntake dal database per aggiornare i totali giornalieri
              try {
                const intake = await FoodAnalysisService.getDailyIntake(currentUser.id);
                if (isMountedRef.current) {
                  setDailyIntake(intake);
                }
              } catch (error) {
                console.warn('Failed to refresh daily intake:', error);
              }
            } else {
              // 🆕 Nessun errore lanciato ma savedAnalysis è null
              if (isMountedRef.current) {
                UserFeedbackService.showSaveError('analisi', async () => {
                  // Retry logic
                  try {
                    const retryAnalysis = await FoodAnalysisService.saveFoodAnalysis(currentUser.id, {
                      mealType: result.data.meal_type || 'other',
                      identifiedFoods: result.data.identified_foods || [],
                      calories: result.data.macronutrients?.calories || 0,
                      carbohydrates: result.data.macronutrients?.carbohydrates || 0,
                      proteins: result.data.macronutrients?.proteins || 0,
                      fats: result.data.macronutrients?.fats || 0,
                      fiber: result.data.macronutrients?.fiber || 0,
                      vitamins: result.data.vitamins || {},
                      minerals: result.data.minerals || {},
                      healthScore: result.data.health_score || 70,
                      recommendations: result.data.recommendations || [],
                      observations: result.data.observations || [],
                      confidence: result.data.confidence || 0.8,
                      analysisData: {
                        ...result.data,
                        version: result.data.version || '1.0.0',
                        confidence: result.data.confidence || 0.8,
                      },
                      imageUrl: photo.uri,
                    });
                    if (retryAnalysis) {
                      UserFeedbackService.showSaveSuccess('analisi');
                    }
                  } catch (retryError) {
                    UserFeedbackService.showError('Impossibile salvare l\'analisi. Riprova più tardi.');
                  }
                });
              }
            }
          } catch (saveError) {
            // 🆕 Errore durante il salvataggio - mostra feedback all'utente
            if (isMountedRef.current) {
              UserFeedbackService.showSaveError('analisi', async () => {
                // Retry logic
                try {
                  const retryAnalysis = await FoodAnalysisService.saveFoodAnalysis(currentUser.id, {
                    mealType: result.data.meal_type || 'other',
                    identifiedFoods: result.data.identified_foods || [],
                    calories: result.data.macronutrients?.calories || 0,
                    carbohydrates: result.data.macronutrients?.carbohydrates || 0,
                    proteins: result.data.macronutrients?.proteins || 0,
                    fats: result.data.macronutrients?.fats || 0,
                    fiber: result.data.macronutrients?.fiber || 0,
                    vitamins: result.data.vitamins || {},
                    minerals: result.data.minerals || {},
                    healthScore: result.data.health_score || 70,
                    recommendations: result.data.recommendations || [],
                    observations: result.data.observations || [],
                    confidence: result.data.confidence || 0.8,
                    analysisData: {
                      ...result.data,
                      version: result.data.version || '1.0.0',
                      confidence: result.data.confidence || 0.8,
                    },
                    imageUrl: photo.uri,
                  });
                  if (retryAnalysis) {
                    UserFeedbackService.showSaveSuccess('analisi');
                  }
                } catch (retryError) {
                  UserFeedbackService.showError('Impossibile salvare l\'analisi. Riprova più tardi.');
                }
              });
            }
          }
        }
      } catch (dbError) {
        // 🆕 Errore generale - mostra feedback all'utente
        if (isMountedRef.current) {
          UserFeedbackService.showError('Errore durante il salvataggio dell\'analisi. I dati potrebbero non essere stati salvati.');
        }
      }

      const foodResults: FoodAnalysisResults = {
        calories: result.data.macronutrients?.calories || 0,
        carbohydrates: result.data.macronutrients?.carbohydrates || 0,
        proteins: result.data.macronutrients?.proteins || 0,
        fats: result.data.macronutrients?.fats || 0,
        fiber: result.data.macronutrients?.fiber,
        healthScore: result.data.health_score || 70,
        recommendations: result.data.recommendations || [],
      };

      if (isMountedRef.current) {
        cameraController.stopCamera();
        setAnalyzing(false);
        setDetecting(false);
        setResults(foodResults);
      }
    } catch (error: any) {
      console.error('❌ Capture error:', error?.message || error);
      
      let errorMessage = 'Capture failed';
      if (error?.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Capture timeout';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Camera permission is required';
        } else if (error.message.includes('not available')) {
          errorMessage = 'Camera not ready';
        } else {
          errorMessage = 'Capture failed';
        }
      }
      
      if (isMountedRef.current) {
        alert(errorMessage);
        setAnalyzing(false);
        setDetecting(false);
      }
    }
  };

  const resetAnalysis = () => {
    if (isMountedRef.current) {
      setResults(null);
      setAnalyzing(false);
      // Restart camera immediately to prevent flash
      cameraController.startCamera();
    }
  };


  // ✅ ADD: Helper functions for enhanced design
  const getSectionColor = (key: string) => {
    const sectionColors = {
      products: colors.primaryLight,    // Purple
      nutrition: colors.success,         // Green  
      routine: colors.accent,            // Orange
      timing: colors.error,              // Red
    };
    return sectionColors[key as keyof typeof sectionColors] || colors.primary;
  };

  const getSectionEmoji = (key: string) => {
    const emojis = {
      products: '🧴',
      nutrition: '🥗',
      routine: '📋',
      timing: '⏰',
    };
    return emojis[key as keyof typeof emojis] || '📝';
  };

  const ProgressBar = ({ value, color }: { value: number; color: string }) => {
    const animatedStyle = useAnimatedStyle(() => ({
      width: withTiming(`${value}%`, { duration: 900 }),
    }));

    return (
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { backgroundColor: color }, animatedStyle]} />
      </View>
    );
  };

  // Enhanced Loading Animations
  const ringRotation = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withRepeat(withTiming('360deg', { duration: 2000 }), -1, false),
      },
    ],
  }));

  const pulseAnimation = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withRepeat(withSequence(withTiming(1.2, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1, false),
      },
    ],
  }));

  // Particle animations
  const particleAnimation1 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(withSequence(withTiming(-20, { duration: 2000 }), withTiming(0, { duration: 2000 })), -1, false),
      },
      {
        translateX: withRepeat(withSequence(withTiming(10, { duration: 1500 }), withTiming(-10, { duration: 1500 })), -1, false),
      },
    ],
    opacity: withRepeat(withSequence(withTiming(0.8, { duration: 1000 }), withTiming(0.3, { duration: 1000 })), -1, false),
  }));

  const particleAnimation2 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(withSequence(withTiming(-15, { duration: 1800 }), withTiming(0, { duration: 1800 })), -1, false),
      },
      {
        translateX: withRepeat(withSequence(withTiming(-15, { duration: 1200 }), withTiming(15, { duration: 1200 })), -1, false),
      },
    ],
    opacity: withRepeat(withSequence(withTiming(0.6, { duration: 800 }), withTiming(0.2, { duration: 800 })), -1, false),
  }));

  const particleAnimation3 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(withSequence(withTiming(-25, { duration: 2200 }), withTiming(0, { duration: 2200 })), -1, false),
      },
      {
        translateX: withRepeat(withSequence(withTiming(20, { duration: 1600 }), withTiming(-20, { duration: 1600 })), -1, false),
      },
    ],
    opacity: withRepeat(withSequence(withTiming(0.7, { duration: 1200 }), withTiming(0.1, { duration: 1200 })), -1, false),
  }));

  const LoadingSpinner = () => {
    const rotation = useAnimatedStyle(() => ({
      transform: [
        {
          rotate: withRepeat(withTiming('360deg', { duration: 1600 }), -1, false),
        },
      ],
    }));

    return <Animated.View style={[styles.spinner, rotation]} />;
  };

  const CameraFrame = () => {
    const handleCameraReady = () => {
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      // Reset switching state when camera is actually ready
      if (cameraSwitching) {
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        if (isMountedRef.current) {
          setCameraSwitching(false);
        }
      }
    };

    return (
      <CameraCapture
        isScreenFocused={true}
        controller={cameraController}
        facing={cameraType}
        instructionText="Keep a steady, even light on your face for best accuracy"
        switching={cameraSwitching}
        onReady={handleCameraReady}
      />
    );
  };

  // --- Render order: permission loading → analyzing → results → camera → overview ---

  // Removed empty loading screen - CameraCapture handles its own loading state

  if (analyzing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
          {/* Keep camera mounted but hidden during analysis */}
          <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
            <CameraFrame />
          </View>
          
          <FoodLoadingScreen onCancel={() => {
            setAnalyzing(false);
            setResults(null);
          }} />
        </SafeAreaView>
      </View>
    );
  }

  if (cameraController.active && !analyzing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
          <View style={styles.captureLayout}>
            <CameraFrame />
            
            
            <View style={styles.cameraControls}>
              <TouchableOpacity 
                style={[
                  styles.ghostButton, 
                  { 
                    backgroundColor: colors.primaryMuted + '20',
                    borderColor: colors.primaryMuted + '40',
                    shadowColor: colors.primary,
                  }
                ]} 
                onPress={() => cameraController.stopCamera()}
              >
                <FontAwesome name="times" size={16} color={colors.primaryDark} />
                <Text style={[styles.ghostButtonText, { color: colors.primaryDark }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              
              {/* Camera Switch Button */}
              <TouchableOpacity 
                style={[
                  styles.ghostButton, 
                  cameraSwitching && { opacity: 0.5 },
                  { 
                    backgroundColor: colors.primaryMuted + '20',
                    borderColor: colors.primaryMuted + '40',
                    shadowColor: colors.primary,
                  }
                ]} 
                onPress={switchCamera}
                disabled={cameraSwitching}
              >
                <FontAwesome name="refresh" size={16} color={colors.primaryDark} />
                <Text style={[styles.ghostButtonText, { color: colors.primaryDark }]}>
                  {cameraType === 'front' ? 'Back' : 'Front'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={captureAndAnalyze}
                disabled={captureDisabled}
                style={captureDisabled ? { opacity: 0.5 } : {}}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <FontAwesome name="camera" size={16} color={colors.textInverse} />
                  <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>{t('common.capture')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Removed old capture card rendering - now using FoodResultsScreen for all results

  // Only render results section if we have results
  if (results) {
    return (
      <FoodResultsScreen
        results={fullAnalysisResult}
        fullAnalysisResult={fullAnalysisResult}
        onGoBack={() => {
          setResults(null);
          setAnalyzing(false);
          setFullAnalysisResult(null);
          // Immediately restart camera to prevent flash
          cameraController.startCamera();
        }}
        onRetake={resetAnalysis}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* View assoluto per colorare l'area sotto la tab bar */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 150,
        backgroundColor: colors.background,
        zIndex: 0,
      }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.overviewContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
        >
        <LinearGradient
          colors={['#10b981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <Text style={[styles.heroTitle, { color: '#ffffff' }]}>{t('analysis.food.hero.title')}</Text>
            <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.9)' }]}>{t('analysis.food.hero.subtitle')}</Text>
          </View>
          <VideoHero
            videoUri={heroVideoUri}
            title={t('analysis.food.hero.title')}
            subtitle={t('analysis.food.hero.subtitle')}
            onPlayPress={handleStartAnalysis}
            showPlayButton={false}
            autoPlay={true}
            loop={true}
            muted={true}
            style={styles.heroVideo}
            fallbackImageUri={heroImageUri}
          />
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleStartAnalysis}
            disabled={startDisabled}
            style={startDisabled ? { opacity: 0.6 } : undefined}
          >
            <LinearGradient
              colors={['#8b5cf6', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.primaryButton, styles.heroButton]}
            >
              <FontAwesome name="camera" size={16} color="#ffffff" />
              <Text style={[styles.primaryButtonText, styles.heroButtonText, { color: '#ffffff' }]}>{t('analysis.food.startAnalysis')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* 🔧 FALLBACK BUTTON - Gallery Picker (100% Reliable) */}
          <TouchableOpacity
            onPress={analyzeFromGallery}
            style={{ marginTop: 12 }}
          >
            <LinearGradient
              colors={['#a78bfa', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.primaryButton, styles.heroButton]}
            >
              <FontAwesome name="image" size={16} color="#ffffff" />
              <Text style={[styles.primaryButtonText, { color: '#ffffff' }]}>{t('common.pickFromGallery')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {permissionChecking && (
            <Text style={[styles.permissionBanner, { color: '#ffffff' }]}>{t('analysis.common.requestingPermission')}</Text>
          )}
          {analysisError && !permissionChecking && (
            <Text style={[styles.permissionBanner, { color: '#fee2e2' }]}>{analysisError}</Text>
          )}
          
        </LinearGradient>

         {/* Recent Analysis Section - Always visible */}
         <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.recent.title')}</Text>
           <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('analysis.food.recent.subtitle')}</Text>
         </View>
         
         {(() => {
           try {
             // ✅ FIX: Usa la variabile reattiva latestFoodSession invece di getState()
             // Always show the card, with fallback data if no session exists
             const fallbackSession = {
               id: 'fallback',
               timestamp: new Date().toISOString(),
               macronutrients: {
                 carbohydrates: 150,
                 proteins: 50,
                 fats: 30,
                 calories: 1000,
               },
               meal_type: 'breakfast',
               health_score: 65,
               identified_foods: [],
             };
             
             return (
               <FoodCaptureCard
                 session={latestFoodSession || fallbackSession}
               />
             );
           } catch (error) {
             // 🔥 FIX: Solo errori critici in console
             console.error('❌ Failed to load latest food session:', error);
             // Fallback session in case of error
             const fallbackSession = {
               id: 'error-fallback',
               timestamp: new Date().toISOString(),
               macronutrients: {
                 carbohydrates: 150,
                 proteins: 50,
                 fats: 30,
                 calories: 1000,
               },
               meal_type: 'breakfast',
               health_score: 65,
               identified_foods: [],
             };
             return <FoodCaptureCard session={fallbackSession} />;
           }
         })()}

        {/* Meal Improvement Suggestions Button */}
        <TouchableOpacity
          style={styles.detailedAnalysisButton}
          onPress={() => setShowDetailedAnalysis(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#10b981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.detailedAnalysisButtonGradient}
          >
            <MaterialCommunityIcons name="lightbulb-on" size={20} color="#ffffff" />
            <Text style={[styles.detailedAnalysisButtonText, { color: '#ffffff' }]}>
              {t('analysis.food.mealImprovement.title') || 'Suggerimenti per migliorare questo pasto'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Nutritional Goals Configuration Section */}
        <LinearGradient
          colors={[colors.surface, colors.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.goalsCard, { borderColor: colors.border }]}
        >
          <View style={styles.goalsHeader}>
            <View style={[styles.goalsIcon, { backgroundColor: `${colors.accent}22` }]}>
              <MaterialCommunityIcons name="target" size={24} color={colors.accent} />
            </View>
            <View style={styles.goalsContent}>
              <Text style={[styles.goalsTitle, { color: colors.text }]}>
                {nutritionalGoals ? t('analysis.food.goals.currentGoals') : t('analysis.food.goals.noGoalsSet')}
              </Text>
              {nutritionalGoals && (
                <Text style={[styles.goalsSubtitle, { color: colors.textSecondary }]}>
                  {nutritionalGoals.daily_calories} {t('analysis.food.goals.kcalPerDay')} • {nutritionalGoals.carbs_percentage}% • {nutritionalGoals.proteins_percentage}% • {nutritionalGoals.fats_percentage}%
                </Text>
              )}
              {nutritionalGoals?.source && (
                <Text style={[styles.goalsSource, { color: colors.textTertiary }]}>
                  {t('analysis.food.goals.from')}: {
                    nutritionalGoals.source === 'manual' ? t('analysis.food.goals.sourceManual') :
                    nutritionalGoals.source === 'ai_suggested' ? t('analysis.food.goals.sourceAI') :
                    t('analysis.food.goals.sourceNutritionist')
                  }
                </Text>
              )}
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.goalsButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowGoalsModal(true)}
            activeOpacity={0.8}
          >
            <FontAwesome name="cog" size={16} color={colors.textInverse} />
            <Text style={[styles.goalsButtonText, { color: colors.textInverse }]}>
              {t('analysis.food.goals.configureGoals')}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Daily Intake Section - Always visible */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.dailyIntake.title')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('analysis.food.dailyIntake.subtitle')}</Text>
        </View>
        
        {/* Daily Progress: Calories Bar + Macro Gauges */}
        {(() => {
          // ✅ FIX: Usa dailyIntake dal database invece di calcolare da foodHistory per evitare duplicati
          // Il database ha già i totali corretti per oggi, evitando problemi di doppio conteggio
          const todayTotals = {
            calories: dailyIntake.calories,
            carbohydrates: dailyIntake.carbohydrates,
            proteins: dailyIntake.proteins,
            fats: dailyIntake.fats,
          };
          
          // Calcola todayHistory solo per i trend dei grafici (senza duplicati)
          const seenIds = new Set<string>();
          const todayHistory = foodHistory.filter(session => {
            // Rimuovi duplicati per ID
            if (seenIds.has(session.id)) {
              return false;
            }
            seenIds.add(session.id);
            
            // Filtra solo per oggi
            const sessionDate = new Date(session.timestamp);
            const today = new Date();
            return sessionDate.toDateString() === today.toDateString();
          });

          return (
            <>
              {/* Animated Calorie Horizontal Progress - Full Width */}
              <AnimatedCalorieBar
                current={todayTotals.calories}
                max={dailyGoals.calories}
                label={t('analysis.food.metrics.calories')}
              />

              {/* Macro Gauges: Carbs, Proteins, Fats - In Row */}
              <View style={styles.gaugeRow}>
                <GaugeChart
                value={Math.round(todayTotals.carbohydrates)}
                maxValue={dailyGoals.carbohydrates}
                label={t('analysis.food.metrics.carbohydrates')}
                color={colors.success}
                subtitle={t('analysis.food.dailyIntake.ofGoal', { value: Math.round((todayTotals.carbohydrates / (dailyGoals.carbohydrates || 1)) * 100) })}
                trend={todayHistory.length > 1 ? 1 : 0}
                description={t('analysis.food.dailyIntake.carbsDesc')}
                historicalData={foodHistory.map((session, index) => ({
                  date: `${index + 1}`,
                  value: Math.round(session.macronutrients?.carbohydrates || 0),
                }))}
                metric="carbohydrates"
                icon="leaf"
              />

              <GaugeChart
                value={Math.round(todayTotals.proteins)}
                maxValue={dailyGoals.proteins}
                label={t('analysis.food.metrics.proteins')}
                color={colors.error}
                subtitle={t('analysis.food.dailyIntake.ofGoal', { value: Math.round((todayTotals.proteins / (dailyGoals.proteins || 1)) * 100) })}
                trend={todayHistory.length > 1 ? 1 : 0}
                description={t('analysis.food.dailyIntake.proteinsDesc')}
                historicalData={foodHistory.map((session, index) => ({
                  date: `${index + 1}`,
                  value: Math.round(session.macronutrients?.proteins || 0),
                }))}
                metric="proteins"
                icon="heart"
              />

              <GaugeChart
                value={Math.round(todayTotals.fats)}
                maxValue={dailyGoals.fats}
                label={t('analysis.food.metrics.fats')}
                color={colors.accent}
                subtitle={t('analysis.food.dailyIntake.ofGoal', { value: Math.round((todayTotals.fats / (dailyGoals.fats || 1)) * 100) })}
                trend={todayHistory.length > 1 ? 1 : 0}
                description={t('analysis.food.dailyIntake.fatsDesc')}
                historicalData={foodHistory.map((session, index) => ({
                  date: `${index + 1}`,
                  value: Math.round(session.macronutrients?.fats || 0),
                }))}
                metric="fats"
                icon="circle"
              />
              </View>
            </>
          );
        })()}

        {/* Quality Badge */}
        {qualityInfo && (
          <QualityBadge
            confidence={qualityInfo}
            qualityMessage="Analysis quality is good. Results are reliable."
            onRetakePress={() => alert('Retake analysis')}
            showRetakeButton={false}
            compact={true}
          />
        )}



        {/* Intelligent Insights Section - Food */}
        {fullAnalysisResult && (
          <IntelligentInsightsSection
            category="food"
            data={fullAnalysisResult}
            maxInsights={3}
            showTitle={true}
            compact={false}
            onInsightPress={(insight) => {
              // 🔥 FIX: Rimuoviamo console.log eccessivi
              // Handle insight press - could navigate to detailed view
            }}
            onActionPress={(insight, action) => {
              // 🔥 FIX: Rimuoviamo console.log eccessivi
              // Handle action press - could start activity, set reminder, etc.
            }}
          />
        )}

        {/* Recipes Section - AI Generated Recipes */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.recipes.title')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('analysis.food.recipes.subtitle')}</Text>
        </View>
        
        <View style={styles.insightList}>
          {[
            {
              id: 'breakfast',
              title: t('analysis.food.recipes.breakfast.title'),
              description: t('analysis.food.recipes.breakfast.description'),
              image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1200&q=80',
            },
            {
              id: 'lunch',
              title: t('analysis.food.recipes.lunch.title'),
              description: t('analysis.food.recipes.lunch.description'),
              image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
            },
            {
              id: 'dinner',
              title: t('analysis.food.recipes.dinner.title'),
              description: t('analysis.food.recipes.dinner.description'),
              image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
            },
            {
              id: 'snack',
              title: t('analysis.food.recipes.snack.title'),
              description: t('analysis.food.recipes.snack.description'),
              image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=1200&q=80',
            },
          ].map((card) => (
            <TouchableOpacity 
              key={card.id} 
              style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                const curatedRecipe = getDefaultRecipe(card.id);
                setLoadingRecipe(false);
                setSelectedRecipe({
                  ...curatedRecipe,
                  title: curatedRecipe?.title || card.title,
                });
                setShowRecipeModal(true);
              }}
              activeOpacity={0.8}
            >
              <ImageWithFallback 
                uri={card.image} 
                style={styles.insightImage}
                fallbackColor={colors.surfaceMuted}
              />
              <View style={styles.insightCopy}>
                <Text style={[styles.insightTitle, { color: colors.text }]}>{card.title}</Text>
                <Text style={[styles.insightDescription, { color: colors.textSecondary }]}>{card.description}</Text>
                <View style={styles.guideHint}>
                  <Text style={[styles.guideHintText, { color: colors.primary }]}>{t('analysis.food.recipes.tapForRecipe')}</Text>
                  <FontAwesome name="chevron-right" size={12} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* What's in Your Fridge Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analysis.food.fridge.title')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('analysis.food.fridge.subtitle')}</Text>
        </View>
        
        <LinearGradient
          colors={[colors.surface, colors.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fridgeCard, { borderColor: colors.border }]}
        >
          <View style={styles.fridgeHeader}>
            <View style={[styles.fridgeIcon, { backgroundColor: `${colors.accent}22` }]}>
              <MaterialCommunityIcons name="fridge" size={24} color={colors.accent} />
            </View>
            <View style={styles.fridgeContent}>
              <Text style={[styles.fridgeTitle, { color: colors.text }]}>{t('analysis.food.fridge.cardTitle')}</Text>
              <Text style={[styles.fridgeDescription, { color: colors.textSecondary }]}>{t('analysis.food.fridge.cardDesc')}</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.fridgeButton, { backgroundColor: colors.accent }]}
            onPress={() => setShowFridgeModal(true)}
            activeOpacity={0.8}
          >
            <FontAwesome name="plus" size={16} color={colors.textInverse} />
            <Text style={[styles.fridgeButtonText, { color: colors.textInverse }]}>{t('analysis.food.fridge.addIngredients')}</Text>
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>

      {/* Detailed Analysis Popup */}
        <DetailedAnalysisPopup
          visible={showDetailedAnalysis}
          onClose={() => setShowDetailedAnalysis(false)}
          analysisType="food"
        analysisData={fullAnalysisResult}
      />

      {/* Nutritional Goals Modal */}
      <NutritionalGoalsModal
        visible={showGoalsModal}
        onClose={() => setShowGoalsModal(false)}
        onSave={handleSaveGoals}
        currentGoals={nutritionalGoals}
      />
      
      {/* Fridge Ingredients Modal */}
      <FridgeIngredientsModal
        visible={showFridgeModal}
        onClose={() => setShowFridgeModal(false)}
        onRecipeGenerated={(recipe) => {
          // TODO: Potresti voler salvare la ricetta o mostrarla in un'altra schermata
          // 🔥 FIX: Rimuoviamo console.log eccessivi
        }}
      />
      
      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        visible={showRecipeModal}
        onClose={() => {
          setShowRecipeModal(false);
          setSelectedRecipe(null);
        }}
        recipe={selectedRecipe}
        loading={loadingRecipe}
      />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  overviewContent: {
    paddingTop: 78, // Added padding top to align with SkinAnalysisScreen
    paddingBottom: 100, // Increased padding to account for bottom navigation bar
    paddingHorizontal: 20,
    gap: 24,
  },
  heroCard: {
    borderRadius: 32,
    padding: 24,
    gap: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  resultsContent: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    gap: 24,
  },
  heroHeader: {
    gap: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    // Color will be set inline with colors.textInverse
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    // Color will be set inline with rgba(255,255,255,0.85)
  },
  heroMedia: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  heroVideo: { 
    width: '100%', 
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroStatChip: {
    flex: 1,
    minWidth: (width - 80) / 3,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroChipLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  heroChipValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroButton: {
    marginTop: 4,
  },
  heroButtonText: {
    color: '#92400e',
  },
  permissionBanner: {
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    // Color will be set inline with colors.warning or colors.accent
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    // Color will be set inline with colors.text
  },
  sectionSubtitle: {
    fontSize: 13,
    // Color will be set inline with colors.textSecondary
  },
  insightsSection: {
    marginBottom: 24,
  },
  stepList: {
    gap: 18,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  insightList: {
    gap: 16,
  },
  insightCard: {
    flexDirection: 'row',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    minHeight: 120,
    borderWidth: 1,
  },
  insightImage: {
    width: 120,
    height: '100%',
    minHeight: 120,
  },
  insightCopy: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  insightDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cameraPreview: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
    borderRadius: 28,
    // Do NOT clip CameraView on Android; it kills the TextureView/Surface
    overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    // Let flex determine height; hard caps sometimes lead to zero-height
  },
  cameraView: {
    width: '100%',
    height: '100%',
  },
  // A rounded mask overlay to preserve your rounded-corner look
  cameraRoundedMask: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 28,
    // transparent; just defines the rounded shape for children/visuals
    pointerEvents: 'none',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cameraLoadingText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  detectionFrame: {
    width: width * 0.68,
    height: width * 0.68,
    borderRadius: (width * 0.68) / 2,
    borderWidth: 4,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  cameraSwitchButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cameraSwitchText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  captureLayout: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 100,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    gap: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ghostButtonText: {
    fontWeight: '600',
    color: '#4338ca',
  },
  analyzingCard: {
    marginHorizontal: 20,
    marginTop: 60,
    borderRadius: 28,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 18,
    shadowColor: '#c7d2fe',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  analyzingSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  spinner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#818cf8',
    borderTopColor: 'transparent',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  resultHero: {
    borderRadius: 32,
    padding: 24,
    gap: 18,
    shadowColor: '#bbf7d0',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 24,
    elevation: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#0f172a',
    opacity: 0.7,
    marginTop: 6,
  },
  resultIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: '#dbeafe',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
  },
  metricList: {
    gap: 14,
  },
  metricItem: {
    gap: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  metricValue: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  recommendationsCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
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
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 19,
    flex: 1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    shadowColor: '#4c1d95',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  // How It Works Video Section Styles
  howItWorksCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 8,
    borderWidth: 1,
  },
  howItWorksHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  howItWorksIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  howItWorksContent: {
    flex: 1,
  },
  howItWorksTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  howItWorksDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  videoPlaceholder: {
    width: '100%',
    height: 240, // Same height as emotion detection screen
    borderRadius: 12,
    backgroundColor: '#1f2937',
    marginBottom: 20,
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  videoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  videoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  howItWorksSteps: {
    gap: 12,
  },
  howItWorksStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  frameText: {
    marginTop: 24,
    fontSize: 16,
    color: '#f8fafc',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    paddingHorizontal: 24,
  },
  // Gauge grid styles (2x2)
  gaugeGrid: {
    marginBottom: 20,
  },
  gaugeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  // Calorie horizontal progress styles
  calorieBarContainer: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  calorieBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calorieBarLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  calorieBarValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  calorieBarTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  calorieBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  gaugeCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  // New styles for stats grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '400',
  },

  // Enhanced Skin Analysis Styles
  heroSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  skinVisualization: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  skinCircle: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  skinInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  skinRings: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skinRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  skinRingOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
  },
  skinDetails: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skinConfidenceText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 8,
    marginBottom: 16,
    fontWeight: '500',
  },
  skinMetricsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
  },
  skinMetric: {
    alignItems: 'center',
  },
  skinMetricLabel: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
    marginBottom: 4,
  },
  skinMetricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Metrics Section
  metricsSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  metricsHeader: {
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  skinMetricsGrid: {
    gap: 12,
  },
  skinMetricCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  skinMetricCardInner: {
    padding: 16,
    borderRadius: 16,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  metricInfo: {
    flex: 1,
  },
  metricName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  metricProgressContainer: {
    height: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  metricProgressTrack: {
    height: '100%',
    borderRadius: 3,
  },
  metricProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricPercentage: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Enhanced Loading Screen Styles
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#6366f1',
    borderTopColor: 'transparent',
    position: 'absolute',
  },
  loadingRingMiddle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    borderTopColor: 'transparent',
    position: 'absolute',
  },
  loadingOrb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  particle1: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    top: 20,
    left: 30,
  },
  particle2: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8b5cf6',
    top: 40,
    right: 25,
  },
  particle3: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a78bfa',
    bottom: 30,
    left: 40,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  loadingInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  loadingInfoText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 12,
    color: '#6366f1',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  analysisSteps: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  analysisStep: {
    alignItems: 'center',
    gap: 4,
  },
  analysisStepText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  goBackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    gap: 8,
  },
  goBackButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    gap: 8,
  },
  retakeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Empty state styles
  emptyStateCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // ✅ ADD: Guide hint styles
  guideHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  guideHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // ✅ ADD: Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // ✅ ENHANCED: Hero Image Section
  heroImageContainer: {
    position: 'relative',
    marginVertical: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  heroImage: {
    width: '100%',
    height: 240,
  },
  heroOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  heroBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366f1',
    letterSpacing: 0.5,
  },
  
  // ✅ ENHANCED: Quick Stats Row
  quickStatsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  
  // ✅ ENHANCED: Section Cards
  sectionCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sectionEmoji: {
    fontSize: 24,
  },
  
  // ✅ ENHANCED: Items Container
  itemsContainer: {
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  itemBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  bulletNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  
  // ✅ ENHANCED: Action Section
  actionSection: {
    paddingVertical: 24,
    paddingBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Detailed Analysis Button
  detailedAnalysisButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  detailedAnalysisButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  detailedAnalysisButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  
  // ✅ ADD: Guide hint styles
  guideHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  guideHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // ✅ ADD: Fridge Section Styles
  fridgeCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
  },
  fridgeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  fridgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fridgeContent: {
    flex: 1,
  },
  fridgeTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  fridgeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  fridgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  fridgeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  
  // ✅ ADD: Nutritional Goals Card Styles
  goalsCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
  },
  goalsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  goalsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  goalsContent: {
    flex: 1,
  },
  goalsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  goalsSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  goalsSource: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  goalsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  goalsButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default FoodAnalysisScreen;
