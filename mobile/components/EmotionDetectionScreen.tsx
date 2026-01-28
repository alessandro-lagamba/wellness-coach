// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ImageBackground,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  BackHandler, // Added BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { CameraView } from 'expo-camera';
import CameraCapture from './CameraCapture';
import { useCameraController } from '../hooks/useCameraController';
import SimpleCameraTest from './SimpleCameraTest';
import MinimalCameraTest from './MinimalCameraTest';
import AnalysisCaptureLayout from './shared/AnalysisCaptureLayout';

import { useRouter, useFocusEffect } from 'expo-router';
import { UnifiedAnalysisService } from '../services/unified-analysis.service';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { AuthService } from '../services/auth.service';
import { ChartDataService } from '../services/chart-data.service';
import { EmotionSessionCard } from './EmotionSessionCard';
import { useAnalysisStore } from '../stores/analysis.store';
import { LoadingScreen } from './LoadingScreen';
import { EmotionTrendChart } from './charts/EmotionTrendChart';
import { GaugeChart } from './charts/GaugeChart';
import { EmotionTrendDetailModal } from './EmotionTrendDetailModal';
import { AnalysisLoader } from './shared/AnalysisLoader';
import { EmotionResultsScreen } from './EmotionResultsScreen';
import { EmotionTimeMachineScreen } from './EmotionTimeMachineScreen'; // 🆕 Import Time Machine Screen
import { EnhancedMetricTile } from './EnhancedMetricTile';
import { QualityBadge } from './QualityBadge';
import { InsightCorrelation } from './InsightCorrelation';
import { ActionCard } from './ActionCard';
import { MetricsService } from '../services/metrics.service';
import { ActionsService } from '../services/actions.service';
import { QualityService } from '../services/quality.service';
import { CorrelationService } from '../services/correlation.service';
import { InsightSection } from './InsightSection';
// Removed InsightService import - now using IntelligentInsightsSection directly
import { DetailedAnalysisPopup } from './DetailedAnalysisPopup';
import { IntelligentInsightsSection } from './IntelligentInsightsSection';
import { VideoHero } from './VideoHero';
import { EmptyStateCard } from './EmptyStateCard';
import { FirstAnalysisCelebration } from './FirstAnalysisCelebration';
import { WeeklyEmotionRecap } from './WeeklyEmotionRecap';
// 🔥 FIX: ContextualPermissionModal rimosso - non serve più
import { OnboardingService } from '../services/onboarding.service';
// 🆕 Emotional Horoscope
import { EmotionalHoroscopeScreen } from './EmotionalHoroscopeScreen';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../contexts/ThemeContext';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';
import { getTodayISODate, toLocalISODate } from '../utils/locale-formatters';

// Removed Colors import - using theme colors instead

const { width } = Dimensions.get('window');

type Emotion = 'joy' | 'sadness' | 'neutral' | 'surprise' | 'anger' | 'disgust' | 'fear';

interface EmotionData {
  emotion: Emotion;
  percentage: number;
  color: string;
  icon: string;
}

const EMOTION_META: Record<Emotion, Omit<EmotionData, 'percentage'>> = {
  joy: { emotion: 'joy', color: '#10b981', icon: 'smile-o' },
  sadness: { emotion: 'sadness', color: '#6366f1', icon: 'frown-o' },
  neutral: { emotion: 'neutral', color: '#6b7280', icon: 'meh-o' },
  surprise: { emotion: 'surprise', color: '#8b5cf6', icon: 'star' },
  anger: { emotion: 'anger', color: '#ef4444', icon: 'fire' },
  disgust: { emotion: 'disgust', color: '#f97316', icon: 'times' },
  fear: { emotion: 'fear', color: '#a855f7', icon: 'bolt' },
};

const INITIAL_EMOTION_SCORES: Record<Emotion, number> = {
  joy: 0,
  sadness: 0,
  neutral: 0,
  surprise: 0,
  anger: 0,
  disgust: 0,
  fear: 0,
};

// Video URI per Emotion Detection - usando require per file locali
const heroVideoUri = require('../assets/videos/emotion-detection-video.mp4');

const withAlpha = (color: string | undefined, alpha: string) => {
  if (typeof color === 'string' && color.startsWith('#') && color.length === 7) {
    return `${color}${alpha}`;
  }
  return color || undefined;
};

export const EmotionDetectionScreen: React.FC = () => {
  const { t, language, i18n } = useTranslation(); // 🆕 i18n hook
  const { colors: themeColors } = useTheme();
  const cameraController = useCameraController({ isScreenFocused: true });
  const router = useRouter();
  const { hideTabBar, showTabBar } = useTabBarVisibility();

  const [detecting, setDetecting] = useState(false);
  // Removed capturing state - no more capture overlay
  const [currentEmotion, setCurrentEmotion] = useState<Emotion | null>(null);
  const [showingResults, setShowingResults] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('front');
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [confidence, setConfidence] = useState<number>(0);
  const [fullAnalysisResult, setFullAnalysisResult] = useState<any>(null);
  const [showingTimeMachine, setShowingTimeMachine] = useState(false); // 🆕 State for Time Machine
  const [emotionHistory, setEmotionHistory] = useState<EmotionData[]>([]);
  const [emotionScores, setEmotionScores] = useState<Record<Emotion, number>>(() => ({
    ...INITIAL_EMOTION_SCORES,
  }));
  const [permissionChecking, setPermissionChecking] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Enhanced components states
  const [nextBestActions, setNextBestActions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [showTrendDetailModal, setShowTrendDetailModal] = useState(false);
  const [qualityInfo, setQualityInfo] = useState<any>(null);

  // Intelligent insights are now handled by IntelligentInsightsSection component

  // State to force re-render when data is loaded
  const [dataLoaded, setDataLoaded] = useState(false);

  // Loading state to prevent empty state flash
  // Initialize to false if store already has data
  const [isLoadingData, setIsLoadingData] = useState(() => {
    const store = useAnalysisStore.getState();
    return !(store.latestEmotionSession || store.emotionHistory.length > 0);
  });

  // 🆕 FIX: Flag to track if initial data load has completed successfully
  // Empty state will only show AFTER this is true to prevent flickering
  // Initialize to true if store already has data to prevent flash
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(() => {
    const store = useAnalysisStore.getState();
    return !!(store.latestEmotionSession || store.emotionHistory.length > 0);
  });

  // Detailed analysis modal
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  // First analysis celebration
  const [showFirstAnalysisCelebration, setShowFirstAnalysisCelebration] = useState(false);

  // 🆕 Emotional Horoscope
  const [showEmotionalHoroscope, setShowEmotionalHoroscope] = useState(false);

  // Contextual permission modal
  // 🔥 FIX: Modal rimosso - non serve più


  const analysisServiceRef = useRef(UnifiedAnalysisService.getInstance());
  const isMountedRef = useRef(true);
  const isCapturingRef = useRef(false); // 🔥 FIX: Previeni race conditions con multiple catture simultanee

  // 🆕 FIX: Use reactive hook to get latest emotion session (triggers re-render when store updates)
  const latestEmotionSession = useAnalysisStore((state) => state.latestEmotionSession);
  const storeEmotionHistory = useAnalysisStore((state) => state.emotionHistory);

  const latestEmotionAnalysisDate = useMemo(() => {
    if (!latestEmotionSession?.timestamp) {
      return null;
    }
    return toLocalISODate(new Date(latestEmotionSession.timestamp));
  }, [latestEmotionSession]);

  // 🆕 FIX: Check BOTH latestEmotionSession AND storeEmotionHistory for today's analysis
  const hasTodayEmotionAnalysis = useMemo(() => {
    const today = getTodayISODate();

    // Check if latestEmotionSession is from today
    if (latestEmotionAnalysisDate === today) {
      return true;
    }

    // Also check storeEmotionHistory for any entry from today
    if (storeEmotionHistory && storeEmotionHistory.length > 0) {
      const hasTodayEntry = storeEmotionHistory.some((session) => {
        if (!session?.timestamp) return false;
        const sessionDate = toLocalISODate(new Date(session.timestamp));
        return sessionDate === today;
      });
      if (hasTodayEntry) {
        return true;
      }
    }

    return false;
  }, [latestEmotionAnalysisDate, storeEmotionHistory]);

  const emotionDisplayData = useMemo(() => {
    const mapped = {} as Record<Emotion, EmotionData>;
    (Object.keys(EMOTION_META) as Emotion[]).forEach((emotion) => {
      mapped[emotion] = {
        ...EMOTION_META[emotion],
        percentage: emotionScores[emotion] ?? 0,
      };
    });
    return mapped;
  }, [emotionScores]);

  const startDisabled = permissionChecking || detecting || !analysisReady || !!analysisError;
  const captureDisabled = !cameraController.ready || permissionChecking || detecting;
  const handleExitCapture = React.useCallback(() => {
    cameraController.stopCamera();
    if (isMountedRef.current) {
      setDetecting(false);
      setCurrentEmotion(null);
      setShowingResults(false);
    }
    showTabBar();
  }, [cameraController, showTabBar]);

  const ensureCameraPermission = useCallback(async () => {
    // 🔥 FIX: Non impostare permissionChecking per evitare delay - il popup nativo viene mostrato direttamente
    const result = await cameraController.ensurePermission();
    return result;
  }, [cameraController]);

  const ensureAnalysisReady = useCallback(async () => {
    if (analysisReady && !analysisError) {
      return true;
    }

    try {
      const result = await analysisServiceRef.current.initialize();
      const ready = !!result?.overall;
      if (isMountedRef.current) {
        setAnalysisReady(ready);
        setAnalysisError(ready ? null : t('analysis.emotion.errors.initializationFailed'));
      }
      return ready;
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console
      console.error('❌ Analysis service initialization failed:', error);
      if (isMountedRef.current) {
        setAnalysisReady(false);
        setAnalysisError(t('analysis.emotion.errors.initializationFailed'));
      }
      return false;
    }
  }, [analysisReady, analysisError, t]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    ensureAnalysisReady();
  }, [ensureAnalysisReady]);

  // Reload data when screen comes into focus - background refresh only
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const reloadData = async () => {
        try {
          // 🔥 OPTIMIZATION: Don't set loading state if we already have data
          // This prevents the flash of 'no data' state
          const store = useAnalysisStore.getState();
          const hasExistingData = !!(store.latestEmotionSession || store.emotionHistory.length > 0);

          if (!hasExistingData && isMounted) {
            setIsLoadingData(true);
          }

          // Load fresh data in background
          await ChartDataService.loadEmotionDataForCharts();

          if (isMounted) {
            setDataLoaded(prev => !prev);
            setIsLoadingData(false);
            setHasInitiallyLoaded(true);
          }
        } catch (error) {
          console.error('❌ Failed to reload emotion data on focus:', error);
          if (isMounted) {
            setIsLoadingData(false);
            setHasInitiallyLoaded(true);
          }
        }
      };

      reloadData();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  // Carica i dati dei grafici dal database quando il componente si monta
  useEffect(() => {
    // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const loadChartData = async () => {
      try {
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        await ChartDataService.loadEmotionDataForCharts();
        // 🔥 FIX: Rimuoviamo console.log eccessivi

        // Force re-render after data is loaded
        if (isMounted) {
          setDataLoaded(true);
          setIsLoadingData(false);
          setHasInitiallyLoaded(true); // 🆕 Mark initial load complete
        }
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Failed to load emotion chart data:', error);
        // 🔥 FIX: Memory leak - salviamo il retry timer per cleanup
        if (isMounted) {
          setIsLoadingData(false);
          setHasInitiallyLoaded(true); // 🆕 Still mark as loaded even on error
          retryTimer = setTimeout(() => {
            if (isMounted) {
              loadChartData();
            }
          }, 10000);
        }
      }
    };

    // Load data immediately (no delay) to prevent empty state flash
    loadChartData();

    return () => {
      isMounted = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, []);

  // Calcola dati enhanced per i nuovi componenti
  useEffect(() => {
    // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
    let isMounted = true;

    const calculateEnhancedData = async () => {
      try {
        const store = useAnalysisStore.getState();
        const latestSession = store.latestEmotionSession;
        const emotionHistory = store.emotionHistory || [];

        if (latestSession && isMounted) {
          // Calcola bucket e trend per Valence
          const valenceBucket = MetricsService.getEmotionBucket('valence', latestSession.avg_valence);
          const valenceTrend = MetricsService.getPersonalizedTrendForMetric('valence', latestSession.avg_valence, emotionHistory);
          const valenceAction = ActionsService.getNextBestAction('valence', latestSession.avg_valence, valenceBucket);

          // Calcola bucket e trend per Arousal
          const arousalBucket = MetricsService.getEmotionBucket('arousal', latestSession.avg_arousal);
          const arousalTrend = MetricsService.getPersonalizedTrendForMetric('arousal', latestSession.avg_arousal, emotionHistory);
          const arousalAction = ActionsService.getNextBestAction('arousal', latestSession.avg_arousal, arousalBucket);

          // Calcola quality info
          const confidenceInfo = QualityService.getConfidenceScore(latestSession.confidence || 0.8);
          if (isMounted) {
            setQualityInfo(confidenceInfo);
          }

          // Calcola insights
          const calculatedInsights = CorrelationService.getInsights(null, emotionHistory);
          if (isMounted) {
            setInsights(calculatedInsights.slice(0, 3)); // Max 3 insights
          }

          // Calcola next best actions
          const actions = [valenceAction, arousalAction].filter(action => action && action.actionable);
          if (isMounted) {
            setNextBestActions(actions);
          }
        }

        // 🔥 FIX: Rimuoviamo codice non utilizzato (insightService non esiste)
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Error calculating enhanced data:', error);
      }
    };

    calculateEnhancedData();

    return () => {
      isMounted = false;
    };
  }, [dataLoaded]); // Re-run when data is loaded

  // Start camera automatically when screen loads
  // 🔥 FIX: Rimuoviamo cameraController dalle dipendenze per evitare loop infinito
  // Show/hide tab bar based on camera state
  useEffect(() => {
    const shouldHideTabBar = cameraController.active || detecting || showingResults;
    if (shouldHideTabBar) {
      hideTabBar();
      return () => {
        showTabBar();
      };
    }
    showTabBar();
  }, [cameraController.active, detecting, showingResults, hideTabBar, showTabBar]);


  const switchCamera = useCallback(() => {
    if (cameraSwitching) return;

    setCameraSwitching(true);
    setCameraType(prev => prev === 'front' ? 'back' : 'front');

    // Small delay to allow camera to switch
    setTimeout(() => {
      setCameraSwitching(false);
    }, 1000);
  }, [cameraSwitching]);


  // Intercept back button/gesture to close camera instead of navigating back
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Check if we are in a "sub-mode" that should be closed first
        if (cameraController.active || detecting || showingResults || currentEmotion) {
          handleExitCapture();
          return true; // Prevent default behavior (navigating away)
        }
        return false; // Allow default behavior
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => subscription.remove();
    }, [cameraController.active, detecting, showingResults, currentEmotion, handleExitCapture])
  );


  // No background camera initialization - privacy first!

  const handleStartDetection = async () => {
    // 🔥 FIX: Chiama sempre ensureCameraPermission() che ora chiama sempre requestPermission()
    // Android mostrerà il popup nativo se possibile (anche se permesso è "denied")
    // Solo se l'utente ha selezionato "Non chiedere più" (blocked), Android non mostrerà il popup
    const granted = await ensureCameraPermission();
    if (!granted) {
      // Se il permesso non è stato concesso, esci
      // Se Android non può più mostrare il popup (blocked), l'utente dovrà aprire le impostazioni manualmente
      return;
    }

    const ready = await ensureAnalysisReady();
    if (!ready) {
      if (isMountedRef.current) {
        alert(t('analysis.emotion.errors.serviceNotReady'));
      }
      return;
    }

    // 🔥 FIX: Rimuoviamo console.log eccessivi
    // Reset previous session state so the camera preview always shows immediately
    if (isMountedRef.current) {
      setCurrentEmotion(null);
      setConfidence(0);
      setDetecting(false);
      setShowingResults(false);
    }

    // Use camera controller to start camera
    await cameraController.startCamera();
  };

  // 🔧 FALLBACK: Image Picker for Testing (100% Reliable)
  const analyzeFromGallery = async () => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi

    try {
      const ready = await ensureAnalysisReady();
      if (!ready) {
        if (isMountedRef.current) {
          alert(t('analysis.emotion.errors.serviceNotReady'));
        }
        return;
      }

      // Request image picker permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (isMountedRef.current) {
          alert(t('analysis.emotion.errors.mediaLibraryPermission'));
        }
        return;
      }

      // Pick image from gallery
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

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
            alert(t('analysis.emotion.errors.imageProcessingFailed'));
          }
          return;
        }

        // 🔥 FIX: Rimuoviamo console.log eccessivi

        if (isMountedRef.current) {
          setDetecting(true);
        }

        // Analyze the selected image
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        // 🆕 Get user ID for historical context
        const currentUser = await AuthService.getCurrentUser();
        const userId = currentUser?.id;

        // Perform analysis
        const result = await analysisServiceRef.current.analyzeEmotion(
          asset.uri,
          sessionId,
          i18n?.language || 'en',
          { source: 'gallery', userId }
        );
        if (result.success && result.data) {
          // 🔥 FIX: Rimuoviamo console.log eccessivi

          // Process results (same logic as camera capture)
          const { scores, dominantEmotion, confidence } = result.data;
          const newConfidences = Math.round(confidence * 100);
          const dominantEmotionKey = dominantEmotion as Emotion;

          const updatedScores: Record<Emotion, number> = { ...INITIAL_EMOTION_SCORES };
          (Object.keys(EMOTION_META) as Emotion[]).forEach((emotion) => {
            const score = scores[emotion] ?? 0;
            const percentage = Math.min(100, Math.max(0, Math.round(score * 100)));
            updatedScores[emotion] = percentage;
          });

          if (isMountedRef.current) {
            setEmotionScores(updatedScores);
            setDetecting(false);
            setShowingResults(true); // Set immediately to prevent flash
          }

          // 🔥 FIX: Memory leak - usiamo requestAnimationFrame invece di setTimeout quando possibile
          requestAnimationFrame(() => {
            if (isMountedRef.current) {
              setCurrentEmotion(dominantEmotionKey);
              setConfidence(newConfidences);
            }
          });

        } else {
          console.error('❌ Gallery emotion analysis failed:', analysisResult.error);
          if (isMountedRef.current) {
            alert(t('analysis.emotion.errors.analysisFailed', { error: analysisResult.error || 'Unknown error' }));
            setDetecting(false);
          }
        }
      }
      // 🔥 FIX: Rimuoviamo console.log eccessivi
    } catch (error: any) {
      console.error('❌ Gallery analysis error:', error);
      if (isMountedRef.current) {
        alert(t('analysis.emotion.errors.failedToAnalyze', { error: error.message }));
        setDetecting(false);
      }
    }
  };

  const captureAndAnalyze = async () => {
    // 🔥 FIX: Previeni race conditions - se già in cattura, ignora la nuova richiesta
    if (isCapturingRef.current) {
      return;
    }

    // 🔥 FIX: Rimuoviamo console.log eccessivi

    // Store cameraController methods in local variables to prevent scope issues
    const { ref, ready, detecting, error, isCameraReady, setDetecting: setCameraDetecting } = cameraController;

    // 🔥 FIX: Rimuoviamo console.log eccessivi

    if (!isCameraReady()) {
      const errorMsg = error || t('analysis.emotion.errors.cameraNotReady');
      console.error('❌ Capture failed:', errorMsg);
      if (isMountedRef.current) {
        alert(errorMsg);
      }
      return;
    }
    if (detecting) {
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      return;
    }

    // 🔥 FIX: Imposta flag di cattura in corso
    isCapturingRef.current = true;

    try {
      const serviceReady = await ensureAnalysisReady();
      if (!serviceReady) {
        const errorMsg = t('analysis.emotion.errors.serviceNotReady');
        console.error('❌ Capture failed:', errorMsg);
        if (isMountedRef.current) {
          alert(errorMsg);
        }
        return;
      }

      if (isMountedRef.current) {
        setDetecting(true); // Set component detecting state
      }
      // 🔥 FIX: Rimuoviamo console.log eccessivi

      // 🔥 FIX: Rimuoviamo console.log eccessivi
      // 🔥 FIX: Rimuoviamo console.log eccessivi

      // Aggressive ref recovery before capture
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

      // Try multiple capture strategies
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
          const capturePromise = ref.current.takePictureAsync(strategy.options);

          // 🔥 FIX: Memory leak - puliamo il timeout se il componente viene smontato
          let timeoutId: ReturnType<typeof setTimeout> | null = null;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              timeoutId = null;
              reject(new Error('Camera capture timeout'));
            }, 8000);
          });

          try {
            photo = await Promise.race([capturePromise, timeoutPromise]);
          } finally {
            // 🔥 FIX: Pulisci sempre il timeout per evitare memory leaks
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          }
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
        throw new Error('Camera returned empty data. Please try again.');
      }

      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      // 🔥 FIX: Rimuoviamo console.log eccessivi

      // 🆕 Get user ID for historical context
      const currentUser = await AuthService.getCurrentUser();
      const userId = currentUser?.id;

      const analysisResult = await analysisServiceRef.current.analyzeEmotion(
        dataUrl,
        'emotion-analysis-session',
        i18n?.language || 'en',
        { source: 'camera', userId }
      );
      if (!analysisResult.success || !analysisResult.data) {
        throw new Error(analysisResult.error || 'Analysis failed.');
      }

      // 🔥 FIX: Rimuoviamo console.log eccessivi
      const dominantEmotion = (analysisResult.data.dominant_emotion || 'neutral') as Emotion;
      const newConfidence = Math.round((analysisResult.data.confidence || 0) * 100);

      // Store the full analysis result
      if (isMountedRef.current) {
        setFullAnalysisResult(analysisResult.data);
      }

      const scores = analysisResult.data.emotions ?? {};
      const updatedScores: Record<Emotion, number> = { ...INITIAL_EMOTION_SCORES };
      (Object.keys(EMOTION_META) as Emotion[]).forEach((emotion) => {
        const percentage = Math.min(100, Math.max(0, Math.round((scores[emotion] ?? 0) * 100)));
        updatedScores[emotion] = percentage;
      });
      if (isMountedRef.current) {
        setEmotionScores(updatedScores);
      }

      const newEntry: EmotionData = {
        ...EMOTION_META[dominantEmotion],
        percentage: updatedScores[dominantEmotion],
      };
      if (isMountedRef.current) {
        setEmotionHistory((prev) => [newEntry, ...prev.slice(0, 4)]);
      }

      if (isMountedRef.current) {
        cameraController.stopCamera();
        setDetecting(false);
        setShowingResults(true); // Set immediately to prevent flash
      }

      // 🔥 FIX: Memory leak - usiamo requestAnimationFrame invece di setTimeout quando possibile
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          setCurrentEmotion(dominantEmotion);
          setConfidence(newConfidence);
        }
      });
    } catch (error: any) {
      console.error('❌ Capture error:', error?.message || error);

      let errorMessage = t('analysis.emotion.errors.captureFailed');
      if (error?.message) {
        if (error.message.includes('timeout')) {
          errorMessage = t('analysis.emotion.errors.captureTimeout');
        } else if (error.message.includes('permission')) {
          errorMessage = t('analysis.emotion.errors.cameraPermission');
        } else if (error.message.includes('not available')) {
          errorMessage = t('analysis.emotion.errors.cameraNotReady');
        } else {
          errorMessage = t('analysis.emotion.errors.captureFailed');
        }
      }

      if (isMountedRef.current) {
        alert(errorMessage);
        setDetecting(false);
      }
    } finally {
      // 🔥 FIX: Reset sempre il flag di cattura, anche in caso di errore o uscita anticipata
      isCapturingRef.current = false;
    }
  };

  const resetDetection = () => {
    if (isMountedRef.current) {
      setDetecting(false);
      setCurrentEmotion(null);
      setShowingResults(false);
      // Restart camera immediately to prevent flash
      cameraController.startCamera();
    }
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

  // Enhanced Loading Animations for detecting screen
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



  const CameraFrame = () => {
    const pulseStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale: withRepeat(
            withSequence(withTiming(1.05, { duration: 1000 }), withTiming(1, { duration: 1000 })),
            -1,
            false,
          ),
        },
      ],
      opacity: withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(0.7, { duration: 1000 })),
        -1,
        false,
      ),
    }));

    return (
      <CameraCapture
        isScreenFocused={true}
        controller={cameraController}
        facing="front"
        instructionText={t('analysis.emotion.camera.instructionText')}
        switching={false}
      />
    );
  };

  // --- Render order: permission loading → detecting → results → camera → overview ---

  // Removed empty loading screen - CameraCapture handles its own loading state
  // 🔥 FIX: Rimuoviamo console.log eccessivi

  // Priority 1: Show detecting screen
  if (detecting) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background, flex: 1 }]}>
        <CameraFrame />
        <AnalysisLoader messages={[
          'Analizzando l’espressione del tuo volto...',
          'Interpretando i segnali di occhi e bocca...'
        ]} />
      </View>
    );
  }

  // Priority 2: Show results if we have a current emotion or are showing results (prevent overview flash)
  if (currentEmotion || showingResults) {
    return (
      <EmotionResultsScreen
        currentEmotion={currentEmotion}
        confidence={confidence}
        fullAnalysisResult={fullAnalysisResult}
        onGoBack={() => {
          if (isMountedRef.current) {
            setCurrentEmotion(null);
            setShowingResults(false);
            setDetecting(false);
            setFullAnalysisResult(null);
            // 🔥 FIX: Ferma la fotocamera e torna alla schermata principale (overview)
            cameraController.stopCamera();
          }
        }}
      />
    );
  }


  // 🆕 Priority 2.5: Show Time Machine Screen
  if (showingTimeMachine) {
    return (
      <EmotionTimeMachineScreen
        onGoBack={() => {
          setShowingTimeMachine(false);
          // Resume camera if needed or just return to overview
          if (cameraController && !cameraController.active) {
            // Optional: restart camera/preview
          }
          showTabBar();
        }}
      />
    );
  }

  // Priority 3: Camera capture (active when camera is on)
  if (cameraController.active && !showingResults) {
    const CameraFrame = () => (
      <CameraCapture
        isScreenFocused={true}
        controller={cameraController}
        facing={cameraType}
        switching={cameraSwitching}
        instructionText={t('analysis.emotion.camera.instructionText')}
      />
    );

    return (
      <AnalysisCaptureLayout
        renderCamera={<CameraFrame />}
        onBack={handleExitCapture}
        onCancel={() => cameraController.stopCamera()}
        onCapture={captureAndAnalyze}
        captureDisabled={captureDisabled || cameraSwitching}
        showSwitch
        switchDisabled={cameraSwitching}
        switchLabel={cameraType === 'front' ? 'Back' : 'Front'}
        onSwitch={switchCamera}
        cancelLabel={t('common.cancel')}
        captureLabel={t('common.capture')}
      />
    );
  }

  // Priority 4: Overview screen (only show when no other state is active)
  // Overview screen
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* View assoluto per colorare l'area sotto la tab bar */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 150,
        backgroundColor: themeColors.background,
        zIndex: 0,
      }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={["top", "bottom"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.overviewContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
        >
          <LinearGradient colors={['#6366f1', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{t('analysis.emotion.hero.title')}</Text>
                <Text style={styles.heroSubtitle}>{t('analysis.emotion.hero.subtitle')}</Text>
              </View>
            </View>
            <VideoHero
              videoUri={heroVideoUri}
              title={t('analysis.emotion.hero.title')}
              subtitle={t('analysis.emotion.hero.subtitle')}
              onPlayPress={handleStartDetection}
              showPlayButton={false}
              autoPlay={true}
              loop={true}
              muted={true}
              style={styles.heroVideo}
              fallbackImageUri="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80"
            />
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleStartDetection}
              disabled={startDisabled}
              style={startDisabled ? { opacity: 0.6 } : undefined}
            >
              <LinearGradient
                colors={['#f0abfc', '#c084fc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.primaryButton, styles.heroButton]}
              >
                <FontAwesome name="camera" size={16} color="#312e81" />
                <Text style={[styles.primaryButtonText, styles.heroButtonText]}>{t('analysis.emotion.startDetection')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* 🔧 FALLBACK BUTTON - Gallery Picker (100% Reliable) */}
            <TouchableOpacity
              onPress={analyzeFromGallery}
              style={{ marginTop: 12 }}
            >
              <LinearGradient
                colors={['#e0f2fe', '#bae6fd']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.primaryButton, styles.heroButton]}
              >
                <FontAwesome name="image" size={16} color="#0ea5e9" />
                <Text style={[styles.primaryButtonText, { color: '#0ea5e9' }]}>{t('common.pickFromGallery')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* 🔥 FIX: Rimosso messaggio permissionChecking per evitare flash visivo - il popup nativo viene mostrato direttamente */}
            {analysisError && !permissionChecking && (
              <Text style={styles.permissionBanner}>{analysisError}</Text>
            )}

          </LinearGradient>

          {/* Empty State - Show only when initial load is complete and no sessions exist */}
          {hasInitiallyLoaded && !isLoadingData && !latestEmotionSession && (
            <EmptyStateCard
              type="emotion"
              onAction={handleStartDetection}
            />
          )}

          {/* 🆕 EXPLORE DEEPER Section Header */}
          <View style={styles.exploreDeeperSection}>
            <View style={styles.exploreDeeperHeader}>
              <View style={styles.exploreDeeperLine} />
              <Text style={styles.exploreDeeperTitle}>
                {language === 'it' ? 'ESPLORA DI PIÙ' : 'EXPLORE DEEPER'}
              </Text>
              <View style={styles.exploreDeeperLine} />
            </View>
          </View>

          {/* 🆕 Immersive Feature Cards Container */}
          <View style={{ paddingHorizontal: 16, gap: 20 }}>

            {/* Emotional Horoscope Card - Immersive Design */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (hasTodayEmotionAnalysis) {
                  setShowEmotionalHoroscope(true);
                } else {
                  // Show notification that analysis is required
                  Alert.alert(
                    language === 'it' ? 'Analisi Richiesta' : 'Analysis Required',
                    language === 'it'
                      ? 'Per scoprire il tuo Oroscopo (non richiesto) di oggi, effettua l\'analisi emotiva!'
                      : 'To discover your Horoscope (you didn\'t ask for) today, complete an emotion analysis!',
                    [{ text: 'OK' }]
                  );
                }
              }}
              style={styles.immersiveCard}
            >
              <ImageBackground
                source={require('../assets/images/galaxy-background.jpg')}
                style={styles.immersiveCardBackground}
                imageStyle={styles.immersiveCardImage}
              >
                {/* Gradient Overlay */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
                  style={styles.immersiveCardOverlay}
                >
                  <View style={styles.immersiveCardContent}>
                    {/* Title */}
                    <Text style={styles.immersiveCardTitle} allowFontScaling={false}>
                      {language === 'it' ? 'Le Tue Stelle Oggi' : 'Your Stars Today'}
                    </Text>

                    {/* Description */}
                    <Text style={styles.immersiveCardDescription}>
                      {language === 'it'
                        ? 'Sblocca insight cosmici su misura per il tuo stato emotivo attuale.'
                        : 'Unlock cosmic insights tailored to your current emotional state.'}
                    </Text>

                    {/* Call to Action */}
                    <View style={styles.immersiveCardCTA}>
                      <Text style={[styles.immersiveCardCTAText, !hasTodayEmotionAnalysis && { opacity: 0.6 }]}>
                        {hasTodayEmotionAnalysis
                          ? (language === 'it' ? 'Leggi oroscopo' : 'Read horoscope')
                          : (language === 'it' ? 'Effettua analisi prima' : 'Complete analysis first')}
                      </Text>
                      <MaterialCommunityIcons
                        name={hasTodayEmotionAnalysis ? "arrow-right" : "lock-outline"}
                        size={16}
                        color={hasTodayEmotionAnalysis ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)"}
                      />
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          </View>
          {latestEmotionSession && (
            <>
              {/* 🆕 FIX: Restored section header without refresh button */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }, { marginTop: 24 }]}>{t('analysis.emotion.recent.title')}</Text>
              </View>

              <View style={{ paddingHorizontal: 0 }}>
                {(() => {
                  try {
                    // Always show the card, with fallback data if no session exists
                    const fallbackSession = {
                      id: 'fallback',
                      timestamp: new Date(),
                      dominant: 'neutral',
                      avg_valence: 0,
                      avg_arousal: 0.5,
                      confidence: 0.5,
                      duration: 0,
                    };

                    return (
                      <EmotionSessionCard
                        session={latestEmotionSession || fallbackSession}
                      />
                    );
                  } catch (error) {
                    // 🔥 FIX: Solo errori critici in console
                    console.error('❌ Failed to load latest emotion session:', error);
                    // Fallback session in case of error
                    const fallbackSession = {
                      id: 'error-fallback',
                      timestamp: new Date(),
                      dominant: 'neutral',
                      avg_valence: 0,
                      avg_arousal: 0.5,
                      confidence: 0.5,
                      duration: 0,
                    };
                    return <EmotionSessionCard session={fallbackSession} />;
                  }
                })()}
              </View>
            </>
          )}

          {/* 🆕 Time Machine Card - Coming Soon */}
          <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 8 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setShowingTimeMachine(true);
              }}
              style={styles.immersiveCard}
            >
              <ImageBackground
                source={require('../assets/images/timemachine-background.jpg')}
                style={styles.immersiveCardBackground}
                imageStyle={styles.immersiveCardImage}
              >
                {/* Gradient Overlay for text readability */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.75)']}
                  style={styles.immersiveCardOverlay}
                >
                  <View style={styles.immersiveCardContent}>
                    {/* Title */}
                    <Text style={styles.immersiveCardTitle} allowFontScaling={false}>
                      {language === 'it' ? 'Il Te Stesso del Passato' : 'Your Past Self'}
                    </Text>

                    {/* Description */}
                    <Text style={styles.immersiveCardDescription}>
                      {language === 'it'
                        ? 'Riavvolgi il tuo viaggio emotivo e guarda quanta strada hai fatto.'
                        : 'Rewind your emotional journey and see how far you\'ve come.'}
                    </Text>

                    {/* Call to Action */}
                    <View style={styles.immersiveCardCTA}>
                      <Text style={styles.immersiveCardCTAText}>
                        {language === 'it' ? 'Entra nella Macchina del Tempo' : 'Enter Time Machine'}
                      </Text>
                      <MaterialCommunityIcons name="arrow-right" size={16} color="rgba(255,255,255,0.8)" />
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          </View>

          {/* Weekly Recap Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }, { marginTop: 24 }]}>
              {language === 'it' ? 'Analisi Settimanale' : 'Weekly Analysis'}
            </Text>
          </View>

          {/* 1. Weekly Emotion Recap Summary - First */}
          <View style={{ paddingHorizontal: 4, marginBottom: 0 }}>
            <WeeklyEmotionRecap />
          </View>

          {/* 3. Emotion Trend Chart - Third (Last) */}
          {(() => {
            try {
              const emotionHistory = storeEmotionHistory || [];
              const formatDate = (timestamp: Date) => {
                const date = new Date(timestamp);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              };
              // 🆕 Group by date and calculate daily averages
              const dailyData = new Map<string, { valence: number[], arousal: number[], emotions: string[] }>();
              emotionHistory.forEach((session) => {
                const dateKey = formatDate(session.timestamp);
                if (!dailyData.has(dateKey)) {
                  dailyData.set(dateKey, { valence: [], arousal: [], emotions: [] });
                }
                const dayData = dailyData.get(dateKey)!;
                dayData.valence.push(session.avg_valence || 0);
                dayData.arousal.push(session.avg_arousal || 0);
                dayData.emotions.push(session.dominant || 'neutral');
              });
              // Calculate averages for each day
              const aggregatedData = Array.from(dailyData.entries())
                .map(([date, data]) => ({
                  date,
                  valence: data.valence.reduce((sum, v) => sum + v, 0) / data.valence.length,
                  arousal: data.arousal.reduce((sum, a) => sum + a, 0) / data.arousal.length,
                  emotion: data.emotions[0], // Use first emotion of the day
                  timestamp: emotionHistory.find(s => formatDate(s.timestamp) === date)!.timestamp
                }))
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              return (
                <EmotionTrendChart

                  data={aggregatedData}

                  title={t('analysis.emotion.trends.title')}
                  onPress={() => setShowTrendDetailModal(true)}
                />
              );
            } catch (error) {
              console.error('❌ Failed to load emotion history for trend chart:', error);
              return (
                <EmotionTrendChart
                  data={[]}
                  title={t('analysis.emotion.trends.title')}
                  onPress={() => setShowTrendDetailModal(true)}
                />
              );
            }
          })()}

          {/* End of Recap Settimanale Section */}

        </ScrollView>

        {/* Detailed Analysis Popup */}
        <DetailedAnalysisPopup
          visible={showDetailedAnalysis}
          onClose={() => setShowDetailedAnalysis(false)}
          analysisType="emotion"
          analysisData={(() => {
            try {
              const store = useAnalysisStore.getState();
              return store.latestEmotionSession;
            } catch (error) {
              return null;
            }
          })()}
        />

        {/* Emotion Trend Detail Modal */}
        <EmotionTrendDetailModal
          visible={showTrendDetailModal}
          onClose={() => setShowTrendDetailModal(false)}
        />

        {/* First Analysis Celebration - RIMOSSO: utente lo trova brutto */}

        {/* Contextual Permission Modal */}
        {/* 🔥 FIX: Modal rimosso - non serve più */}

        {/* 🆕 Emotional Horoscope Modal */}
        <EmotionalHoroscopeScreen
          visible={showEmotionalHoroscope}
          onClose={() => setShowEmotionalHoroscope(false)}
          emotionResult={(() => {
            try {
              const session = latestEmotionSession;
              if (!session) {
                return {
                  dominant_emotion: 'neutral',
                  emotions: {},
                  valence: 0,
                  arousal: 0,
                  confidence: 0.5,
                };
              }
              // 🔥 FIX: Use correct field names from EmotionSession store
              // Store uses: dominant, avg_valence, avg_arousal
              return {
                dominant_emotion: session.dominant || 'neutral',
                emotions: {},
                valence: session.avg_valence || 0,
                arousal: session.avg_arousal || 0,
                confidence: session.confidence || 0.5,
              };
            } catch (error) {
              return {
                dominant_emotion: 'neutral',
                emotions: {},
                valence: 0,
                arousal: 0,
                confidence: 0.5,
              };
            }
          })()}
          analysisTimestamp={latestEmotionSession?.timestamp ? new Date(latestEmotionSession.timestamp) : new Date()}
        />
      </SafeAreaView>
    </View>
  );
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: { flex: 1 },
  overviewContent: {
    paddingTop: 0,
    paddingBottom: 100,
    paddingHorizontal: 20,
    gap: 24,
  },
  resultsContent: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    gap: 20,
  },

  // Hero / overview
  heroCard: {
    borderRadius: 32,
    padding: 24,
    shadowColor: '#312e81',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
    gap: 20,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  heroTitle: { fontSize: 22, fontFamily: 'Figtree_700Bold', color: '#ffffff' },
  heroSubtitle: { marginTop: 8, fontSize: 14, fontFamily: 'Figtree_500Medium', lineHeight: 20, color: 'rgba(255, 255, 255, 0.85)' },
  heroMedia: { position: 'relative', borderRadius: 24, overflow: 'hidden' },
  heroImage: { width: '100%', height: 240 },
  heroVideo: {
    width: '100%',
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  heroStatChip: {
    flex: 1,
    minWidth: (width - 80) / 3,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroChipLabel: { fontSize: 12, color: 'rgba(255,255,255,0.78)' },
  heroChipValue: { marginTop: 6, fontSize: 15, fontFamily: 'Figtree_700Bold', color: '#ffffff' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButtonText: { fontSize: 14, fontFamily: 'Figtree_700Bold', color: '#ffffff' },
  heroButton: { marginTop: 4 },
  heroButtonText: { color: '#312e81' },
  permissionBanner: {
    marginTop: 12,
    color: '#fee2e2',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Figtree_500Medium',
  },

  sectionHeader: { gap: 6 },
  sectionTitle: { fontSize: 18, fontFamily: 'Figtree_700Bold', marginBottom: 0 },
  sectionSubtitle: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  emotionIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Metrics
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metricCard: {
    flex: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
    minWidth: (width - 72) / 2,
    borderWidth: 1,
  },
  metricIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  metricTitle: { fontSize: 15, fontFamily: 'Figtree_700Bold' },
  metricBody: { fontSize: 13, lineHeight: 18 },

  // Chart card (overview)
  chartCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: '#bae6fd',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 6,
  },

  // Camera / capture (matched to Skin)
  captureLayout: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 1,
    paddingBottom: 90,
  },
  captureHeader: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  captureBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  captureBackButtonText: {
    fontSize: 14,
    fontFamily: 'Figtree_700Bold',
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
  cameraHidden: { opacity: 0 },
  cameraOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'transparent',
  },
  cameraLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cameraLoadingText: {
    color: '#f8fafc',
    fontSize: 15,
    fontFamily: 'Figtree_500Medium',
  },
  detectionFrame: {
    width: width * 0.68,
    height: width * 0.68,
    borderRadius: (width * 0.68) / 2,
    borderWidth: 4,
    borderColor: '#a855f7',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  frameText: {
    marginTop: 24,
    fontSize: 16,
    color: '#f8fafc',
    textAlign: 'center',
    fontFamily: 'Figtree_500Medium',
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    paddingHorizontal: 24,
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
  ghostButtonPlaceholder: {
    opacity: 0,
  },
  ghostButtonText: { color: '#4338ca', fontFamily: 'Figtree_700Bold' },

  // Detecting card
  detectingCard: {
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
    elevation: 10,
  },
  detectingTitle: { fontSize: 20, fontFamily: 'Figtree_700Bold', color: '#1e293b' },
  detectingSubtitle: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20 },


  // Loading
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },

  // Results
  resultHero: {
    borderRadius: 32,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 18,
    shadowColor: '#c7d2fe',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  userImageContainer: { position: 'relative' },
  userImage: { width: 132, height: 132, borderRadius: 66, borderWidth: 4, borderColor: '#ffffff' },
  emotionBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  resultEmotion: { fontSize: 24, fontFamily: 'Figtree_700Bold', color: '#312e81' },
  resultSubtitle: { fontSize: 13, color: '#64748b' },

  breakdownCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: '#cbd5f5',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  breakdownList: { gap: 14 },
  breakdownItem: { gap: 8 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emotionLabel: { fontSize: 14, fontFamily: 'Figtree_500Medium', color: '#1e293b' },
  emotionPercentage: { fontSize: 13, color: '#475569', fontFamily: 'Figtree_700Bold' },

  historyCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: '#c7d2fe',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  historyList: { gap: 12 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  historyIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  historyLabel: { fontSize: 14, fontFamily: 'Figtree_700Bold', color: '#0f172a' },
  historyMeta: { fontSize: 12, color: '#64748b' },

  insightLockedCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  insightLockedTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    textAlign: 'center',
  },
  insightLockedSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  insightLockedButton: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  insightLockedButtonText: {
    color: '#ffffff',
    fontFamily: 'Figtree_700Bold',
    fontSize: 14,
  },

  // 🆕 Horoscope Card
  horoscopeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  horoscopeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  horoscopeCardTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
  },
  horoscopeCardSubtitle: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.8,
  },
  // Horoscope Premium Card - RecipeHub Style
  horoscopeCardWrapper: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  horoscopeCardGradient: {
    padding: 20,
    position: 'relative',
  },
  horoscopeTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  horoscopeTagText: {
    fontSize: 11,
    fontFamily: 'Figtree_700Bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  horoscopeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  horoscopeTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  horoscopeTitle: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  horoscopeTitleSecondary: {
    fontSize: 18,
    fontFamily: 'Figtree_500Medium',
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 8,
  },
  horoscopeSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginTop: 8
  },
  horoscopeIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horoscopeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  horoscopeButtonWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  horoscopeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  horoscopeButtonText: {
    color: '#ffffff',
    fontFamily: 'Figtree_700Bold',
    fontSize: 15,
  },
  horoscopeLockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
    borderRadius: 12,
  },
  horoscopeLockedText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
  },
  horoscopeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  horoscopeButtonPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#a855f7',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Explore Deeper Section
  exploreDeeperSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  exploreDeeperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  exploreDeeperLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(238, 43, 238, 0.2)',
  },
  exploreDeeperTitle: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold',
    color: '#ee2bee',
    letterSpacing: 2,
    textAlign: 'center',
  },
  exploreDeeperSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },

  // Immersive Feature Cards
  immersiveCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  immersiveCardBackground: {
    width: '100%',
    aspectRatio: 5 / 3,
    justifyContent: 'flex-end',
  },
  immersiveCardImage: {
    borderRadius: 16,
  },
  immersiveCardOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  timeMachineOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  immersiveCardContent: {
    gap: 8,
  },
  immersiveCardTitle: {
    fontSize: 25,
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    color: '#ffffff',
    lineHeight: 40,
    marginTop: 4,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  immersiveCardDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
    fontFamily: 'Figtree_500Medium',
  },
  immersiveCardCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  immersiveCardCTAText: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
    color: 'rgba(233, 172, 255, 0.9)',
  },

  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    shadowColor: '#4338ca',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 6,
  },
  secondaryButtonText: { fontSize: 15, fontFamily: 'Figtree_700Bold', color: '#ffffff' },

  // How it Works
  howItWorksCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
  },
  howItWorksHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  howItWorksIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  howItWorksContent: { flex: 1 },
  howItWorksTitle: { fontSize: 16, fontFamily: 'Figtree_700Bold', marginBottom: 6 },
  howItWorksDescription: { fontSize: 13, lineHeight: 18 },
  howItWorksSteps: { gap: 12 },
  howItWorksStep: { flexDirection: 'row', alignItems: 'center' },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stepNumberText: { fontSize: 12, fontFamily: 'Figtree_700Bold', color: '#ffffff' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Gauge row
  gaugeRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 12 },

  // Enhanced Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopColor: '#8b5cf6',
    borderRightColor: '#a855f7',
    borderBottomColor: '#c084fc',
    top: 140,
  },
  loadingOrb: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#8b5cf6',
    top: 170,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  outerPulse: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    top: 155,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8b5cf6',
  },
  particle1: {
    top: 100,
    left: width / 2 - 50,
  },
  particle2: {
    top: 250,
    left: width / 2 + 30,
  },
  particle3: {
    top: 180,
    left: width / 2 + 45,
  },
  loadingTextContainer: {
    position: 'absolute',
    top: 320,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  detectingTitle: {
    fontSize: 24,
    fontFamily: 'Figtree_700Bold',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  detectingSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#8b5cf6',
  },
  dot1: {},
  dot2: {},
  dot3: {},

  // Enhanced Results UI Styles
  heroSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  emotionVisualization: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emotionCircle: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  emotionInner: {
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
  emotionRings: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  emotionRingOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
  },
  emotionDetails: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confidenceText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 8,
    marginBottom: 16,
    fontFamily: 'Figtree_500Medium',
  },
  confidenceBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Analysis Section
  analysisSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  analysisHeader: {
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emotionCardsGrid: {
    gap: 12,
  },
  emotionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dominantCard: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  emotionCardInner: {
    padding: 16,
    borderRadius: 16,
  },
  emotionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emotionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emotionInfo: {
    flex: 1,
  },
  emotionName: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  emotionProgressContainer: {
    height: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  emotionProgressTrack: {
    height: '100%',
    borderRadius: 3,
  },
  emotionProgressFill: {
    height: '100%',
    borderRadius: 3,
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
    fontFamily: 'Figtree_700Bold',
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

  // Detailed Analysis Button
  detailedAnalysisButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#8b5cf6',
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
    fontFamily: 'Figtree_700Bold',
    color: '#ffffff',
    textAlign: 'center',
    marginHorizontal: 12,
  },
});

export default EmotionDetectionScreen;
