// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
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

import { useRouter } from 'expo-router';
import { UnifiedAnalysisService } from '../services/unified-analysis.service';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { AuthService } from '../services/auth.service';
import { ChartDataService } from '../services/chart-data.service';
import { EmotionSessionCard } from './EmotionSessionCard';
import { useAnalysisStore } from '../stores/analysis.store';
import { LoadingScreen } from './LoadingScreen';
import { EmotionTrendChart } from './charts/EmotionTrendChart';
import { GaugeChart } from './charts/GaugeChart';
import { EmotionLoadingScreen } from './EmotionLoadingScreen';
import { EmotionResultsScreen } from './EmotionResultsScreen';
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

import Colors from '../constants/Colors';

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

export const EmotionDetectionScreen: React.FC = () => {
  const cameraController = useCameraController({ isScreenFocused: true });
  const router = useRouter();
  
  const [detecting, setDetecting] = useState(false);
  // Removed capturing state - no more capture overlay
  const [currentEmotion, setCurrentEmotion] = useState<Emotion | null>(null);
  const [showingResults, setShowingResults] = useState(false);
  const [confidence, setConfidence] = useState<number>(0);
  const [fullAnalysisResult, setFullAnalysisResult] = useState<any>(null);
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
  const [qualityInfo, setQualityInfo] = useState<any>(null);
  
  // Intelligent insights are now handled by IntelligentInsightsSection component
  
  // State to force re-render when data is loaded
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Detailed analysis modal
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  

  const analysisServiceRef = useRef(UnifiedAnalysisService.getInstance());
  const isMountedRef = useRef(true);

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

  const headerStats = [
    { label: 'Current mood', value: currentEmotion ? capitalise(currentEmotion) : 'Ready to scan' },
    { label: 'Recent logs', value: emotionHistory.length ? `${emotionHistory.length} saved` : 'None yet' },
  ];

  const startDisabled = permissionChecking || detecting || !analysisReady || !!analysisError;
  const captureDisabled = !cameraController.ready || permissionChecking || detecting;

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
      const result = await analysisServiceRef.current.initialize();
      const ready = !!result?.overall;
      if (isMountedRef.current) {
        setAnalysisReady(ready);
        setAnalysisError(ready ? null : 'Unable to initialize analysis service. Check OpenAI settings.');
      }
      return ready;
    } catch (error) {
      console.warn('Analysis service initialization failed:', error);
      if (isMountedRef.current) {
        setAnalysisReady(false);
        setAnalysisError('Unable to initialize analysis service. Check OpenAI settings.');
      }
      return false;
    }
  }, [analysisReady, analysisError]);

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
    const loadChartData = async () => {
      try {
        console.log('📊 Loading emotion chart data...');
        
        await ChartDataService.loadEmotionDataForCharts();
        console.log('📊 Emotion chart data loaded successfully');
        
        // Force re-render after data is loaded
        setDataLoaded(true);
      } catch (error) {
        console.error('❌ Failed to load emotion chart data:', error);
        // Retry after 10 seconds on error
        setTimeout(() => {
          loadChartData();
        }, 10000);
      }
    };
    
    // Delay loading to ensure component is fully mounted
    const timer = setTimeout(() => {
      loadChartData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Calcola dati enhanced per i nuovi componenti
  useEffect(() => {
    const calculateEnhancedData = async () => {
      try {
        const store = useAnalysisStore.getState();
        const latestSession = store.latestEmotionSession;
        const emotionHistory = store.emotionHistory || [];

        if (latestSession) {
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
          setQualityInfo(confidenceInfo);

          // Calcola insights
          const calculatedInsights = CorrelationService.getInsights(null, emotionHistory);
          setInsights(calculatedInsights.slice(0, 3)); // Max 3 insights

          // Calcola next best actions
          const actions = [valenceAction, arousalAction].filter(action => action && action.actionable);
          setNextBestActions(actions);
        }

        // Generate intelligent insights
        try {
          const freshInsights = await insightService.getFreshInsights();
          setIntelligentInsights(freshInsights);
          console.log(`🧠 Loaded ${freshInsights.length} intelligent insights`);
        } catch (insightError) {
          console.warn('Failed to load intelligent insights:', insightError);
        }
      } catch (error) {
        console.warn('Error calculating enhanced data:', error);
      }
    };

    calculateEnhancedData();
  }, [dataLoaded]); // Re-run when data is loaded

  // Start camera automatically when screen loads
  useEffect(() => {
    const initializeCamera = async () => {
      console.log('🎥 Auto-starting camera on screen load...');
      await cameraController.startCamera();
    };
    
    initializeCamera();
  }, []);


  // No background camera initialization - privacy first!

  const handleStartDetection = async () => {
    console.log('🎬 Starting emotion detection...');

    const granted = await ensureCameraPermission();
    console.log('📷 Camera permission granted:', granted);
    if (!granted) {
      alert('Camera permission is required for emotion detection');
      return;
    }

    const ready = await ensureAnalysisReady();
    if (!ready) {
      alert('Analysis service is not ready. Please check your OpenAI configuration.');
      return;
    }

    console.log('🎥 Activating camera for emotion detection');
    // Reset previous session state so the camera preview always shows immediately
    setCurrentEmotion(null);
    setConfidence(0);
    setDetecting(false);
    setShowingResults(false);
    
    // Use camera controller to start camera
    await cameraController.startCamera();
  };

  // 🔧 FALLBACK: Image Picker for Testing (100% Reliable)
  const analyzeFromGallery = async () => {
    console.log('📸 Starting analysis from gallery (FALLBACK)...');
    
    try {
      const ready = await ensureAnalysisReady();
      if (!ready) {
        alert('Analysis service is not ready. Please check your OpenAI configuration.');
        return;
      }

      // Request image picker permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Media library permission is required to select photos');
        return;
      }

      // Pick image from gallery
      console.log('📸 Opening image picker...');
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      console.log('📸 Image picker result:', {
        canceled: pickerResult.canceled,
        hasAssets: !!pickerResult.assets,
        assetsLength: pickerResult.assets?.length,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        console.log('📸 Gallery image selected:', {
          hasUri: !!asset.uri,
          hasBase64: !!asset.base64,
          width: asset.width,
          height: asset.height,
        });

        // Convert to data URL for analysis
        const dataUrl = asset.base64 
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        if (!dataUrl) {
          alert('Failed to process selected image');
          return;
        }

        console.log('✅ Gallery image ready for analysis:', dataUrl.length, 'chars');
        
        setDetecting(true);

        // Analyze the selected image
        console.log('🤖 Analyzing emotion from gallery image...');
        const analysisResult = await analysisServiceRef.current.analyzeEmotion(dataUrl);
        
        if (analysisResult.success && analysisResult.data) {
          console.log('✅ Gallery emotion analysis successful:', analysisResult.data);
          
          // Process results (same logic as camera capture)
          const { scores, dominantEmotion, confidence } = analysisResult.data;
          const newConfidences = Math.round(confidence * 100);
          const dominantEmotionKey = dominantEmotion as Emotion;

          const updatedScores: Record<Emotion, number> = { ...INITIAL_EMOTION_SCORES };
          (Object.keys(EMOTION_META) as Emotion[]).forEach((emotion) => {
            const score = scores[emotion] ?? 0;
            const percentage = Math.min(100, Math.max(0, Math.round(score * 100)));
            updatedScores[emotion] = percentage;
          });
          
          setEmotionScores(updatedScores);
          setDetecting(false);
          setShowingResults(true); // Set immediately to prevent flash

          setTimeout(() => {
            setCurrentEmotion(dominantEmotionKey);
            setConfidence(newConfidences);
          }, 100);
          
        } else {
          console.error('Gallery emotion analysis failed:', analysisResult.error);
          alert('Analysis failed: ' + (analysisResult.error || 'Unknown error'));
          setDetecting(false);
        }
      } else {
        console.log('📸 Image picker cancelled');
      }
    } catch (error: any) {
      console.error('Gallery analysis error:', error);
      alert('Failed to analyze image: ' + error.message);
      setDetecting(false);
    }
  };

  const captureAndAnalyze = async () => {
    console.log('📸 Starting capture process...');
    
    // Store cameraController methods in local variables to prevent scope issues
    const { ref, ready, detecting, error, isCameraReady } = cameraController;
    
    console.log('📸 Camera controller state:', {
      hasRef: !!ref.current,
      ready,
      detecting,
      error,
      isCameraReady: isCameraReady(),
    });

    if (!isCameraReady()) {
      const errorMsg = error || 'Camera not ready. Please wait a moment...';
      console.error('📸 Capture failed:', errorMsg);
      alert(errorMsg);
      return;
    }
    if (detecting) {
      console.log('📸 Capture skipped - already detecting');
      return;
    }

    try {
      const serviceReady = await ensureAnalysisReady();
      if (!serviceReady) {
        const errorMsg = 'Analysis service is not ready. Please check your OpenAI configuration.';
        console.error('📸 Capture failed:', errorMsg);
        alert(errorMsg);
        return;
      }

      setDetecting(true); // Set component detecting state
      console.log('📸 Set detecting to true, current detecting state:', detecting);
      
      console.log('📸 Taking picture with CameraView...');
      console.log('📸 Camera ref before capture:', {
        hasRef: !!ref.current,
        refType: typeof ref.current,
        refMethods: ref.current ? Object.getOwnPropertyNames(ref.current) : 'null',
      });

      // Aggressive ref recovery before capture
      if (!ref.current) {
        console.log('📸 Camera ref is null, attempting aggressive recovery...');
        
        // Try to restore from global storage first
        const globalRef = (globalThis as any).globalCameraRef;
        if (globalRef) {
          console.log('📸 Found global camera ref, restoring...');
          ref.current = globalRef;
        }
        
        // Try multiple recovery attempts
        for (let attempt = 1; attempt <= 3; attempt++) {
          console.log(`📸 Recovery attempt ${attempt}/3`);
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          
          // Force a re-render by updating state
          setDetecting(false);
          await new Promise(resolve => setTimeout(resolve, 50));
          setDetecting(true);
          
          if (ref.current) {
            console.log(`📸 Recovery successful on attempt ${attempt}`);
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
        console.log(`📸 Trying capture strategy ${i + 1}/${captureStrategies.length}: ${strategy.name}`, strategy.options);
        
        try {
          const capturePromise = ref.current.takePictureAsync(strategy.options);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Camera capture timeout')), 8000);
          });

          photo = await Promise.race([capturePromise, timeoutPromise]);
          console.log(`📸 Capture successful with strategy: ${strategy.name}`);
          break;
        } catch (strategyError) {
          console.log(`📸 Strategy ${strategy.name} failed:`, strategyError.message);
          
          // If this is the first strategy and it fails, try to restart the camera
          if (i === 0 && strategyError.message.includes('ERR_IMAGE_CAPTURE_FAILED')) {
            console.log('📸 First strategy failed with ERR_IMAGE_CAPTURE_FAILED, attempting camera restart...');
            try {
              cameraController.stopCamera();
              await new Promise(resolve => setTimeout(resolve, 1000));
              cameraController.startCamera();
              await new Promise(resolve => setTimeout(resolve, 2000));
              console.log('📸 Camera restarted, retrying capture...');
            } catch (restartError) {
              console.log('📸 Camera restart failed:', restartError.message);
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

      console.log('📸 Photo captured:', {
        hasUri: !!photo?.uri,
        hasBase64: !!photo?.base64,
        width: photo?.width,
        height: photo?.height,
        uriLength: photo?.uri?.length,
        base64Length: photo?.base64?.length,
      });

      if (!photo) {
        throw new Error('Camera returned null photo');
      }

      if (!photo?.base64 && photo?.uri) {
        try {
          console.log('📸 Converting photo URI to base64...');
          const base64 = await FileSystem.readAsStringAsync(photo.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          photo.base64 = base64;
          console.log('📸 Base64 conversion successful, length:', base64.length);
        } catch (conversionError) {
          console.warn('📸 Failed to convert photo to base64:', conversionError);
          throw new Error('Failed to process photo data');
        }
      }

      if (!photo?.base64) {
        throw new Error('Camera returned empty data. Please try again.');
      }

      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      console.log('✅ Photo captured, sending for analysis...');

      const analysisResult = await analysisServiceRef.current.analyzeEmotion(dataUrl, 'emotion-analysis-session');
      if (!analysisResult.success || !analysisResult.data) {
        throw new Error(analysisResult.error || 'Analysis failed.');
      }

      console.log('Emotion analysis successful:', analysisResult.data);
      const dominantEmotion = (analysisResult.data.dominant_emotion || 'neutral') as Emotion;
      const newConfidence = Math.round((analysisResult.data.confidence || 0) * 100);

      // Store the full analysis result
      setFullAnalysisResult(analysisResult.data);

      // Save to Supabase database
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          const savedAnalysis = await EmotionAnalysisService.saveEmotionAnalysis(currentUser.id, {
            dominantEmotion: dominantEmotion,
            valence: analysisResult.data.valence || 0,
            arousal: analysisResult.data.arousal || 0,
            confidence: analysisResult.data.confidence || 0,
            analysisData: {
              ...analysisResult.data,
              // Include the full emotions breakdown
              emotions: analysisResult.data.emotions || {},
              timestamp: analysisResult.data.timestamp || new Date().toISOString(),
            },
            sessionDuration: Date.now() - (analysisResult.timestamp?.getTime() || Date.now()),
          });
          
          if (savedAnalysis) {
            console.log('✅ Emotion analysis saved to database:', savedAnalysis.id);
            
            // Sincronizza i dati con lo store locale per i grafici
            const emotionSession = {
              id: savedAnalysis.id,
              timestamp: new Date(savedAnalysis.created_at),
              dominant: savedAnalysis.dominant_emotion,
              avg_valence: savedAnalysis.valence,
              avg_arousal: savedAnalysis.arousal,
              confidence: savedAnalysis.confidence,
              duration: savedAnalysis.session_duration || 0,
            };
            
            const store = useAnalysisStore.getState();
            store.addEmotionSession(emotionSession);
            console.log('📊 Emotion data synchronized with local store for charts');
          } else {
            console.warn('⚠️ Failed to save emotion analysis to database');
          }
        } else {
          console.warn('⚠️ No authenticated user found, skipping database save');
        }
      } catch (dbError) {
        console.error('❌ Error saving emotion analysis to database:', dbError);
        // Don't fail the whole operation if database save fails
      }

      const scores = analysisResult.data.emotions ?? {};
      const updatedScores: Record<Emotion, number> = { ...INITIAL_EMOTION_SCORES };
      (Object.keys(EMOTION_META) as Emotion[]).forEach((emotion) => {
        const percentage = Math.min(100, Math.max(0, Math.round((scores[emotion] ?? 0) * 100)));
        updatedScores[emotion] = percentage;
      });
      setEmotionScores(updatedScores);

      const newEntry: EmotionData = {
        ...EMOTION_META[dominantEmotion],
        percentage: updatedScores[dominantEmotion],
      };
      setEmotionHistory((prev) => [newEntry, ...prev.slice(0, 4)]);

      cameraController.stopCamera();
        setDetecting(false);
        setShowingResults(true); // Set immediately to prevent flash

      setTimeout(() => {
        setCurrentEmotion(dominantEmotion);
        setConfidence(newConfidence);
      }, 100);
    } catch (error: any) {
      console.error('📸 Capture error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        error: error,
      });
      
      let errorMessage = 'Failed to capture image.';
      if (error?.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Camera capture timed out. Please try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Camera permission denied. Please check your settings.';
        } else if (error.message.includes('not available')) {
          errorMessage = 'Camera is not available. Please restart the app.';
        } else {
          errorMessage = `Capture failed: ${error.message}`;
        }
      }
      
      alert(errorMessage);
      setDetecting(false);
    }
  };

  const resetDetection = () => {
    setDetecting(false);
    setCurrentEmotion(null);
    setShowingResults(false);
    // Restart camera immediately to prevent flash
    cameraController.startCamera();
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

  const LoadingSpinner = () => {
    // Main rotating ring
    const ringRotation = useAnimatedStyle(() => ({
      transform: [
        {
          rotate: withRepeat(withTiming('360deg', { duration: 3000 }), -1, false),
        },
      ],
    }));

    // Inner pulsing orb
    const pulseAnimation = useAnimatedStyle(() => ({
      transform: [
        {
          scale: withRepeat(
            withSequence(
              withTiming(0.9, { duration: 1200 }),
              withTiming(1.1, { duration: 1200 }),
              withTiming(0.9, { duration: 1200 })
            ),
            -1,
            false
          ),
        },
      ],
      opacity: withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200 }),
          withTiming(1, { duration: 1200 }),
          withTiming(0.6, { duration: 1200 })
        ),
        -1,
        false
      ),
    }));

    // Outer expanding circles
    const outerPulse1 = useAnimatedStyle(() => ({
      transform: [
        {
          scale: withRepeat(
            withSequence(
              withTiming(1, { duration: 2000 }),
              withTiming(1.5, { duration: 2000 }),
              withTiming(1, { duration: 2000 })
            ),
            -1,
            false
          ),
        },
      ],
      opacity: withRepeat(
        withSequence(
          withTiming(0.4, { duration: 2000 }),
          withTiming(0.1, { duration: 2000 }),
          withTiming(0.4, { duration: 2000 })
        ),
        -1,
        false
      ),
    }));

    const outerPulse2 = useAnimatedStyle(() => ({
      transform: [
        {
          scale: withRepeat(
            withSequence(
              withTiming(1.2, { duration: 2500 }),
              withTiming(1.8, { duration: 2500 }),
              withTiming(1.2, { duration: 2500 })
            ),
            -1,
            false
          ),
        },
      ],
      opacity: withRepeat(
        withSequence(
          withTiming(0.3, { duration: 2500 }),
          withTiming(0.05, { duration: 2500 }),
          withTiming(0.3, { duration: 2500 })
        ),
        -1,
        false
      ),
    }));

    // Floating particles
    const particle1 = useAnimatedStyle(() => ({
      transform: [
        {
          translateY: withRepeat(
            withSequence(
              withTiming(0, { duration: 1000 }),
              withTiming(-20, { duration: 1000 }),
              withTiming(0, { duration: 1000 })
            ),
            -1,
            false
          ),
        },
        {
          rotate: withRepeat(withTiming('360deg', { duration: 4000 }), -1, false),
        },
      ],
    }));

    const particle2 = useAnimatedStyle(() => ({
      transform: [
        {
          translateY: withRepeat(
            withSequence(
              withTiming(0, { duration: 1200 }),
              withTiming(-30, { duration: 1200 }),
              withTiming(0, { duration: 1200 })
            ),
            -1,
            false
          ),
        },
        {
          rotate: withRepeat(withTiming('-360deg', { duration: 3500 }), -1, false),
        },
      ],
    }));

    const particle3 = useAnimatedStyle(() => ({
      transform: [
        {
          translateY: withRepeat(
            withSequence(
              withTiming(0, { duration: 900 }),
              withTiming(-25, { duration: 900 }),
              withTiming(0, { duration: 900 })
            ),
            -1,
            false
          ),
        },
        {
          rotate: withRepeat(withTiming('360deg', { duration: 4500 }), -1, false),
        },
      ],
    }));

    // Animated dots with timing offset
    const dotsAnimation = useAnimatedStyle(() => ({
      opacity: withRepeat(
        withSequence(
          withTiming(0.3, { duration: 800 }),
          withTiming(1, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        false
      ),
      transform: [
        {
          scale: withRepeat(
            withSequence(
              withTiming(0.8, { duration: 800 }),
              withTiming(1.2, { duration: 800 }),
              withTiming(0.8, { duration: 800 })
            ),
            -1,
            false
          ),
        },
      ],
    }));

    return (
      <View style={styles.loadingContainer}>
        {/* Outer expanding circles */}
        <Animated.View style={[styles.outerPulse, outerPulse2]} />
        <Animated.View style={[styles.outerPulse, outerPulse1]} />
        
        {/* Main loading elements */}
        <Animated.View style={[styles.loadingRing, ringRotation]} />
        <Animated.View style={[styles.loadingOrb, pulseAnimation]} />
        
        {/* Floating particles */}
        <Animated.View style={[styles.particle, styles.particle1, particle1]} />
        <Animated.View style={[styles.particle, styles.particle2, particle2]} />
        <Animated.View style={[styles.particle, styles.particle3, particle3]} />
        
        {/* Text content */}
        <View style={styles.loadingTextContainer}>
          <Text style={styles.detectingTitle}>Analyzing expressions</Text>
          <Text style={styles.detectingSubtitle}>
            Processing facial micro-expressions and emotional patterns...
          </Text>
          
          <View style={styles.loadingDots}>
            <Animated.View style={[styles.loadingDot, styles.dot1, dotsAnimation]} />
            <Animated.View style={[styles.loadingDot, styles.dot2, dotsAnimation]} />
            <Animated.View style={[styles.loadingDot, styles.dot3, dotsAnimation]} />
          </View>
        </View>
      </View>
    );
  };

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
        instructionText="Align your face within the camera frame to begin emotion detection"
        switching={false}
      />
    );
  };

  // --- Render order: permission loading → detecting → results → camera → overview ---

  // Removed empty loading screen - CameraCapture handles its own loading state
  console.log('🎬 Render state:', { detecting, currentEmotion, cameraActive: cameraController.active });

  // Priority 1: Show detecting screen
  if (detecting) {
    return (
      <View style={styles.container}>
        {/* Keep camera mounted but hidden during analysis */}
        <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
          <CameraFrame />
        </View>
        
        <EmotionLoadingScreen onCancel={() => {
          setDetecting(false);
          setCurrentEmotion(null);
          setShowingResults(false);
        }} />
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
          setCurrentEmotion(null);
          setShowingResults(false);
          setDetecting(false);
          setFullAnalysisResult(null);
          // Immediately restart camera to prevent flash
          cameraController.startCamera();
        }}
        onRetake={resetDetection}
      />
    );
  }

  // Priority 3: Show camera when active
  if (cameraController.active) {
    return (
      <View style={styles.container}>
        <View style={styles.captureLayout}>
          <CameraFrame />
          
          
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.ghostButton} onPress={() => cameraController.stopCamera()}>
              <FontAwesome name="times" size={16} color="#4338ca" />
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={captureAndAnalyze}
              disabled={captureDisabled}
              style={captureDisabled ? { opacity: 0.5 } : {}}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <FontAwesome name="camera" size={18} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Capture</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Priority 4: Overview screen (only show when no other state is active)
  // Overview screen
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.overviewContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#6366f1', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Real-time Emotion Detection</Text>
              <Text style={styles.heroSubtitle}>Capture a quick scan to understand how you feel and keep track of mood trends.</Text>
            </View>
          </View>
          <VideoHero
            videoUri={heroVideoUri}
            title="Real-time Emotion Detection"
            subtitle="Capture a quick scan to understand how you feel and keep track of mood trends."
            onPlayPress={handleStartDetection}
            showPlayButton={false}
            autoPlay={true}
            loop={true}
            muted={true}
            style={styles.heroVideo}
            fallbackImageUri="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80"
          />
          <View style={styles.heroStatsRow}>
            {headerStats.map((stat) => (
              <View key={stat.label} style={styles.heroStatChip}>
                <Text style={styles.heroChipLabel}>{stat.label}</Text>
                <Text style={styles.heroChipValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
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
              <Text style={[styles.primaryButtonText, styles.heroButtonText]}>Start detection</Text>
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
              <Text style={[styles.primaryButtonText, { color: '#0ea5e9' }]}>Pick from Gallery</Text>
            </LinearGradient>
          </TouchableOpacity>

          {permissionChecking && (
            <Text style={styles.permissionBanner}>Requesting camera permission…</Text>
          )}
          {analysisError && !permissionChecking && (
            <Text style={styles.permissionBanner}>{analysisError}</Text>
          )}
          
        </LinearGradient>


        {/* Recent Session Section - Always visible */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.sectionTitle}>Recent Session</Text>
              <Text style={styles.sectionSubtitle}>Your latest emotion analysis results</Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                console.log('🔄 Manually reloading emotion data...');
                try {
                  await ChartDataService.loadEmotionDataForCharts();
                  setDataLoaded(prev => !prev); // Toggle to force re-render
                  console.log('✅ Manual reload completed');
                } catch (error) {
                  console.error('❌ Manual reload failed:', error);
                }
              }}
              style={{
                padding: 8,
                backgroundColor: '#f3f4f6',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#d1d5db'
              }}
            >
              <FontAwesome name="refresh" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
        
        {(() => {
          try {
            const store = useAnalysisStore.getState();
            const latestSession = store.latestEmotionSession;
            const emotionHistory = store.emotionHistory;
            
            // Debug: Log dello stato dello store
            console.log('🔍 EmotionDetectionScreen Debug:', {
              hasLatestSession: !!latestSession,
              latestSessionId: latestSession?.id,
              latestSessionData: latestSession,
              emotionHistoryLength: emotionHistory.length,
              dataLoaded,
              storeState: {
                latestEmotionSession: store.latestEmotionSession,
                emotionHistory: store.emotionHistory
              }
            });
            
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
                session={latestSession || fallbackSession}
              />
            );
          } catch (error) {
            console.warn('Failed to load latest emotion session:', error);
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

        {/* Detailed Analysis Button */}
        <TouchableOpacity
          style={styles.detailedAnalysisButton}
          onPress={() => setShowDetailedAnalysis(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#8b5cf6', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.detailedAnalysisButtonGradient}
          >
            <MaterialCommunityIcons name="brain" size={20} color="#ffffff" />
            <Text style={styles.detailedAnalysisButtonText}>
              Ricevi ulteriori dettagli della tua analisi
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Stats Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <Text style={styles.sectionSubtitle}>Your emotional wellness overview</Text>
        </View>

        {/* Gauge Charts Row */}
        <View style={styles.gaugeRow}>
          {(() => {
            try {
              const store = useAnalysisStore.getState();
              const emotionHistory = store.getSafeEmotionHistory();
              
              return (
                <>
                  <GaugeChart
                    value={
                      emotionHistory.length > 0
                        ? Math.round(
                            (emotionHistory.reduce((sum, session) => sum + (session.avg_valence || 0), 0) /
                              emotionHistory.length +
                              1) * 50,
                          )
                        : 65
                    }
                    maxValue={100}
                    label="Valence"
                    color="#10b981"
                    subtitle="Positivity"
                    trend={2}
                    description="Valence misura quanto positive o negative sono le tue emozioni. Valori alti indicano felicità e soddisfazione, mentre valori bassi indicano tristezza o preoccupazione. Questo metrico ti aiuta a capire il tuo stato emotivo generale."
                    historicalData={emotionHistory.map((session, index) => ({
                      date: `${index + 1}`,
                      value: Math.round(((session.avg_valence || 0) + 1) * 50),
                    }))}
                    metric="valence"
                    icon="emoticon-happy"
                  />

                  <GaugeChart
                    value={
                      emotionHistory.length > 0
                        ? Math.round(
                            (emotionHistory.reduce((sum, session) => sum + (session.avg_arousal || 0), 0) /
                              emotionHistory.length +
                              1) * 50,
                          )
                        : 45
                    }
                    maxValue={100}
                    label="Arousal"
                    color="#ef4444"
                    subtitle="Intensity"
                    trend={-1}
                    description="Arousal misura l'intensità delle tue emozioni, indipendentemente dal fatto che siano positive o negative. Valori alti indicano eccitazione o stress, mentre valori bassi indicano calma o rilassamento. Ti aiuta a capire il tuo livello di attivazione emotiva."
                    historicalData={emotionHistory.map((session, index) => ({
                      date: `${index + 1}`,
                      value: Math.round(((session.avg_arousal || 0) + 1) * 50),
                    }))}
                    metric="arousal"
                    icon="trending-up"
                  />

                  <GaugeChart
                    value={emotionHistory.length}
                    maxValue={30}
                    label="Sessions"
                    color="#6366f1"
                    subtitle="This month"
                    trend={1}
                    description="Il numero di sessioni di analisi emotiva che hai completato questo mese..."
                    historicalData={emotionHistory.map((session, index) => ({
                      date: `${index + 1}`,
                      value: index + 1,
                    }))}
                  />
                </>
              );
            } catch (error) {
              console.warn('Failed to load emotion history for charts:', error);
              return (
                <>
                  <GaugeChart 
                    value={65} 
                    maxValue={100} 
                    label="Valence" 
                    color="#10b981" 
                    subtitle="Positivity" 
                    trend={2} 
                    description="Valence measuring" 
                    historicalData={[]} 
                    metric="valence"
                    icon="emoticon-happy"
                  />
                  <GaugeChart 
                    value={45} 
                    maxValue={100} 
                    label="Arousal" 
                    color="#ef4444" 
                    subtitle="Intensity" 
                    trend={-1} 
                    description="Arousal measuring" 
                    historicalData={[]} 
                    metric="arousal"
                    icon="trending-up"
                  />
                  <GaugeChart value={0} maxValue={30} label="Sessions" color="#6366f1" subtitle="This month" trend={1} description="Analysis sessions" historicalData={[]} />
                </>
              );
            }
          })()}
        </View>

        {/* Quality Badge - Removed per richiesta utente */}


        {/* Emotion Trend Chart */}
        {(() => {
          try {
            const store = useAnalysisStore.getState();
            const emotionHistory = store.getSafeEmotionHistory();
            return (
              <EmotionTrendChart
                data={emotionHistory.map((session, index) => ({
                  date: `${index + 1}`,
                  valence: session.avg_valence || 0,
                  arousal: session.avg_arousal || 0,
                  emotion: session.dominant || 'neutral',
                }))}
                title="Emotional Trends"
                subtitle="7-day overview of your emotional state"
              />
            );
          } catch (error) {
            console.warn('Failed to load emotion history for trend chart:', error);
            return (
              <EmotionTrendChart
                data={[]}
                title="Emotional Trends"
                subtitle="7-day overview of your emotional state"
              />
            );
          }
        })()}

        {/* Intelligent Insights Section - Emotion Only */}
        <IntelligentInsightsSection
          category="emotion"
          data={(() => {
            try {
              const store = useAnalysisStore.getState();
              return {
                latestSession: store.latestEmotionSession,
                emotionHistory: store.emotionHistory || [],
                trend: store.emotionTrend,
                insights: store.insights || []
              };
            } catch (error) {
              return null;
            }
          })()}
          maxInsights={3}
          showTitle={true}
          compact={false}
          onInsightPress={(insight) => {
            console.log('Intelligent emotion insight pressed:', insight.title);
            // Handle insight press - could navigate to detailed view
          }}
          onActionPress={(insight, action) => {
            console.log('Intelligent emotion action pressed:', insight.title, action);
            // Handle action press - could start activity, set reminder, etc.
          }}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Valence & Arousal</Text>
          <Text style={styles.sectionSubtitle}>Understand emotional positivity and intensity</Text>
        </View>

        <View style={styles.metricGrid}>
          <LinearGradient colors={['#ecfdf5', '#d1fae5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#bbf7d022' }]}>
              <FontAwesome name="line-chart" size={18} color="#047857" />
            </View>
            <Text style={styles.metricTitle}>Valence</Text>
            <Text style={styles.metricBody}>Tracks the positivity of your expression and overall affect.</Text>
          </LinearGradient>

          <LinearGradient colors={['#e0f2fe', '#bae6fd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#bfdbfe22' }]}>
              <FontAwesome name="area-chart" size={18} color="#0ea5e9" />
            </View>
            <Text style={styles.metricTitle}>Arousal</Text>
            <Text style={styles.metricBody}>Measures the intensity or energy level detected at the moment.</Text>
          </LinearGradient>
        </View>

        {/* How It Works */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>How Emotion Detection Works</Text>
          <Text style={styles.sectionSubtitle}>Understanding the technology behind our analysis</Text>
        </View>

        <LinearGradient colors={['#fef3c7', '#fde68a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.howItWorksCard}>
          <View style={styles.howItWorksHeader}>
            <View style={[styles.howItWorksIcon, { backgroundColor: '#f59e0b22' }]}>
              <FontAwesome name="cogs" size={20} color="#d97706" />
            </View>
            <View style={styles.howItWorksContent}>
              <Text style={styles.howItWorksTitle}>AI-Powered Analysis</Text>
              <Text style={styles.howItWorksDescription}>
                Our advanced neural networks analyze facial expressions, micro-movements, and emotional cues to provide accurate emotion detection in real-time.
              </Text>
            </View>
          </View>

          <View style={styles.howItWorksSteps}>
            <View style={styles.howItWorksStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Capture your facial expression using the camera</Text>
            </View>
            <View style={styles.howItWorksStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>AI analyzes facial landmarks and micro-expressions</Text>
            </View>
            <View style={styles.howItWorksStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Get detailed emotion breakdown and mood insights</Text>
            </View>
          </View>
        </LinearGradient>

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
    </View>
  );
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.palette.surfaceMuted,
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
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  heroSubtitle: { marginTop: 8, fontSize: 13, lineHeight: 20, color: 'rgba(255, 255, 255, 0.85)' },
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
  heroChipValue: { marginTop: 6, fontSize: 15, fontWeight: '600', color: '#ffffff' },
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
  primaryButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  heroButton: { marginTop: 4 },
  heroButtonText: { color: '#312e81' },
  permissionBanner: {
    marginTop: 12,
    color: '#fee2e2',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },

  sectionHeader: { gap: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  sectionSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 16, lineHeight: 20 },
  emotionIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionSubtitle: { fontSize: 13, color: '#64748b' },

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
  },
  metricIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  metricTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  metricBody: { fontSize: 13, lineHeight: 18, color: '#475569' },

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
    paddingTop: 16,
    paddingBottom: 100,
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
    fontWeight: '500',
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
    fontWeight: '500',
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
  ghostButtonText: { color: '#4338ca', fontWeight: '600' },

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
  detectingTitle: { fontSize: 20, fontWeight: '600', color: '#1e293b' },
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
  resultEmotion: { fontSize: 24, fontWeight: '700', color: '#312e81' },
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
  emotionLabel: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  emotionPercentage: { fontSize: 13, color: '#475569', fontWeight: '600' },

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
  historyLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  historyMeta: { fontSize: 12, color: '#64748b' },

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
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },

  // How it Works
  howItWorksCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  howItWorksHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  howItWorksIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  howItWorksContent: { flex: 1 },
  howItWorksTitle: { fontSize: 16, fontWeight: '600', color: '#92400e', marginBottom: 6 },
  howItWorksDescription: { fontSize: 13, color: '#a16207', lineHeight: 18 },
  howItWorksSteps: { gap: 12 },
  howItWorksStep: { flexDirection: 'row', alignItems: 'center' },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stepNumberText: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  stepText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },

  // Gauge row
  gaugeRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 4 },

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
    fontWeight: '700',
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
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginHorizontal: 12,
  },
});

export default EmotionDetectionScreen;
