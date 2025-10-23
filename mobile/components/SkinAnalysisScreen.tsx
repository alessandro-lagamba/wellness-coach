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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import CameraCapture from './CameraCapture';
import { useCameraController } from '../hooks/useCameraController';
import { Platform } from 'react-native';

import { BACKEND_URL } from '../constants/env';
import UnifiedAnalysisService from '../services/unified-analysis.service';
import { SkinAnalysisService } from '../services/skin-analysis.service';
import { AuthService } from '../services/auth.service';
import { ChartDataService } from '../services/chart-data.service';
import { SkinCaptureCard } from './SkinCaptureCard';
import { useAnalysisStore, SkinCapture } from '../stores/analysis.store';
import { SkinHealthChart } from './charts/SkinHealthChart';
import { GaugeChart } from './charts/GaugeChart';
import { SkinLoadingScreen } from './SkinLoadingScreen';
import { SkinResultsScreen } from './SkinResultsScreen';
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
// Removed useInsights - now using IntelligentInsightsSection directly

const { width } = Dimensions.get('window');

interface SkinAnalysisResults {
  hydration: number;
  oiliness: number;
  sensitivity: number;
  pigmentation: number;
  recommendations: string[];
}

interface InsightCard {
  id: string;
  title: string;
  description: string;
  image: string;
}

const heroImageUri = 'https://images.unsplash.com/photo-1557163435-efdb2550fbfb?q=80&w=3270&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
// Video URI per Skin Analysis - usando require per file locali
const heroVideoUri = require('../assets/videos/skin-analysis-video.mp4');

// Guide dettagliate per ogni modulo
const skincareGuides = {
  smoothness: {
    title: 'Texture Improvement Guide',
    subtitle: 'Achieve smoother, more even skin',
    image: 'https://images.unsplash.com/photo-1654781350550-0dc72ecb6fae?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=998',
    sections: {
      products: {
        title: '🧴 Recommended Products',
        items: [
          'Chemical exfoliants (AHA/BHA) - 2-3x per week',
          'Retinoids - Start with low concentration',
          'Hydrating serums with hyaluronic acid',
          'Gentle cleansers with ceramides',
          'SPF 30+ daily protection'
        ]
      },
      nutrition: {
        title: '🥗 Nutrition & Diet',
        items: [
          'Omega-3 fatty acids (fish, nuts, seeds)',
          'Vitamin C rich foods (citrus, berries)',
          'Antioxidants (green tea, dark chocolate)',
          'Stay hydrated - 8+ glasses water daily',
          'Limit processed foods and sugars'
        ]
      },
      routine: {
        title: '📋 Daily Routine',
        items: [
          'Morning: Gentle cleanse → Vitamin C → Moisturizer → SPF',
          'Evening: Double cleanse → Exfoliant (2-3x/week) → Retinol → Moisturizer',
          'Weekly: Deep cleansing mask',
          'Monthly: Professional facial treatment'
        ]
      },
      timing: {
        title: '⏰ Best Timing',
        items: [
          'Exfoliate in the evening, not morning',
          'Retinoids work best at night',
          'SPF is essential every morning',
          'Allow 2-4 weeks to see improvements',
          'Be consistent for best results'
        ]
      }
    }
  },
  redness: {
    title: 'Inflammation Reduction Guide',
    subtitle: 'Calm irritated and sensitive skin',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
    sections: {
      products: {
        title: '🧴 Recommended Products',
        items: [
          'Niacinamide serums (2-5% concentration)',
          'Centella asiatica (Cica) products',
          'Aloe vera gel for immediate relief',
          'Gentle, fragrance-free cleansers',
          'Mineral SPF with zinc oxide'
        ]
      },
      nutrition: {
        title: '🥗 Anti-Inflammatory Foods',
        items: [
          'Turmeric and ginger (natural anti-inflammatories)',
          'Green leafy vegetables',
          'Berries and cherries',
          'Fatty fish (salmon, mackerel)',
          'Avoid spicy foods and alcohol'
        ]
      },
      routine: {
        title: '📋 Soothing Routine',
        items: [
          'Morning: Gentle cleanse → Niacinamide → Calming moisturizer → SPF',
          'Evening: Oil cleanse → Gentle cleanser → Centella serum → Moisturizer',
          'Use lukewarm water, never hot',
          'Pat dry, don\'t rub',
          'Apply products with clean hands'
        ]
      },
      timing: {
        title: '⏰ When to Apply',
        items: [
          'Apply calming products immediately after cleansing',
          'Use SPF every morning, even indoors',
          'Avoid harsh treatments during flare-ups',
          'Give skin time to heal between treatments',
          'Monitor skin reaction to new products'
        ]
      }
    }
  },
  oiliness: {
    title: 'Sebum Balance Guide',
    subtitle: 'Control excess oil production',
    image: 'https://images.unsplash.com/photo-1718490953028-021d352b14fd?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1699',
    sections: {
      products: {
        title: '🧴 Oil-Control Products',
        items: [
          'Salicylic acid cleansers (1-2% concentration)',
          'Clay masks (kaolin, bentonite)',
          'Oil-free, non-comedogenic moisturizers',
          'Mattifying primers and sunscreens',
          'Gentle exfoliating toners'
        ]
      },
      nutrition: {
        title: '🥗 Diet Adjustments',
        items: [
          'Reduce dairy and processed foods',
          'Limit refined sugars and carbs',
          'Increase fiber-rich foods',
          'Stay hydrated with water',
          'Consider zinc and B-vitamin supplements'
        ]
      },
      routine: {
        title: '📋 Oil-Control Routine',
        items: [
          'Morning: Salicylic acid cleanser → Toner → Light moisturizer → Mattifying SPF',
          'Evening: Double cleanse → Clay mask (2x/week) → Light moisturizer',
          'Blot excess oil throughout the day',
          'Use oil-absorbing sheets as needed',
          'Don\'t over-cleanse (can increase oil production)'
        ]
      },
      timing: {
        title: '⏰ Optimal Timing',
        items: [
          'Cleanse immediately after sweating',
          'Apply clay masks in the evening',
          'Use oil-control products in the morning',
          'Allow 4-6 weeks to see oil reduction',
          'Adjust routine based on seasonal changes'
        ]
      }
    }
  },
  confidence: {
    title: 'Analysis Quality Tips',
    subtitle: 'Get the most accurate skin analysis',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
    sections: {
      products: {
        title: '📸 Photo Quality',
        items: [
          'Use natural lighting near a window',
          'Hold phone at eye level',
          'Ensure face is fully in frame',
          'Remove glasses and accessories',
          'Keep hair away from face'
        ]
      },
      nutrition: {
        title: '🧼 Skin Preparation',
        items: [
          'Clean face thoroughly before analysis',
          'Remove all makeup completely',
          'Wait 30 minutes after washing',
          'Avoid applying products before scan',
          'Ensure skin is dry and clean'
        ]
      },
      routine: {
        title: '📋 Best Practices',
        items: [
          'Analyze at the same time each day',
          'Use consistent lighting conditions',
          'Take multiple angles if needed',
          'Compare results over time',
          'Track changes in your routine'
        ]
      },
      timing: {
        title: '⏰ Optimal Timing',
        items: [
          'Morning analysis shows natural skin state',
          'Evening analysis shows daily wear',
          'Avoid analysis after intense treatments',
          'Wait 24-48 hours after new products',
          'Consistent timing improves accuracy'
        ]
      }
    }
  }
};

const insightCards: InsightCard[] = [
  {
    id: 'smoothness',
    title: 'Texture Improvement Guide',
    description: 'Get personalized tips for smoother, more even skin.',
    image: 'https://images.unsplash.com/photo-1654781350550-0dc72ecb6fae?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=998',
  },
  {
    id: 'redness',
    title: 'Inflammation Reduction Guide',
    description: 'Learn how to calm irritated and sensitive skin.',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'oiliness',
    title: 'Sebum Balance Guide',
    description: 'Control excess oil production with expert tips.',
    image: 'https://images.unsplash.com/photo-1718490953028-021d352b14fd?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1699',
  },
  {
    id: 'confidence',
    title: 'Analysis Quality Tips',
    description: 'Get the most accurate skin analysis results.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
  },
];

// ✅ ADD: Image component with fallback
const ImageWithFallback: React.FC<{ uri: string; style: any; fallbackColor?: string }> = ({ 
  uri, 
  style, 
  fallbackColor = '#e5e7eb' 
}) => {
  const [imageError, setImageError] = useState(false);
  
  if (imageError) {
    return (
      <View style={[style, { backgroundColor: fallbackColor, justifyContent: 'center', alignItems: 'center' }]}>
        <FontAwesome name="image" size={24} color="#9ca3af" />
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

const SkinAnalysisScreen: React.FC = () => {
  const cameraController = useCameraController({ isScreenFocused: true });
  const [currentImageUri, setCurrentImageUri] = useState(heroImageUri);
  
  const [analyzing, setAnalyzing] = useState(false);
  // Removed capturing state - no more capture overlay
  const [results, setResults] = useState<SkinAnalysisResults | null>(null);
  const [fullAnalysisResult, setFullAnalysisResult] = useState<any>(null);
  // Removed showResultsCard state - now using SkinResultsScreen for all results
  const [cameraType, setCameraType] = useState<'front' | 'back'>('front'); // Default to front camera for consistency
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [permissionChecking, setPermissionChecking] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Enhanced components states
  const [nextBestActions, setNextBestActions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [qualityInfo, setQualityInfo] = useState<any>(null);
  
  // ✅ ADD: Modal state for skincare guides
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  
  // Detailed analysis modal
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  // Intelligent insights are now handled by IntelligentInsightsSection component

  const analysisServiceRef = useRef(UnifiedAnalysisService.getInstance());
  const isMountedRef = useRef(true);
  
  const { addSkinCapture } = useAnalysisStore();
  
  // Use proper selectors for reactive updates
  const latestSkinCapture = useAnalysisStore(s => s.latestSkinCapture);
  const skinHistory = useAnalysisStore(s => s.skinHistory);

  const headerStats = [
    { label: 'Hydration readiness', value: results ? `${results.hydration}%` : 'Awaiting scan' },
    { label: 'Oil balance', value: results ? `${results.oiliness}%` : 'Not measured' },
    { label: 'Last session', value: results ? 'Just now' : 'Never run' },
  ];

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
      console.warn('Analysis service initialization failed:', error);
      if (isMountedRef.current) {
        setAnalysisReady(false);
        setAnalysisError('Unable to initialize analysis service. Check OpenAI settings.');
      }
      return false;
    }
  }, []);

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
        console.log('📊 Loading skin chart data...');
        await ChartDataService.loadSkinDataForCharts();
        console.log('📊 Skin chart data loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load skin chart data:', error);
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
    const calculateEnhancedData = () => {
      try {
        const store = useAnalysisStore.getState();
        const latestSkinCapture = store.latestSkinCapture;
        const skinHistory = store.skinHistory || [];

        if (latestSkinCapture) {
          // Calcola bucket e trend per ogni metrica skin
          const textureBucket = MetricsService.getSkinBucket('texture', latestSkinCapture.scores?.texture || 0);
          const textureTrend = MetricsService.getPersonalizedTrendForMetric('texture', latestSkinCapture.scores?.texture || 0, skinHistory);
          const textureAction = ActionsService.getNextBestAction('texture', latestSkinCapture.scores?.texture || 0, textureBucket);

          const rednessBucket = MetricsService.getSkinBucket('redness', latestSkinCapture.scores?.redness || 0);
          const rednessTrend = MetricsService.getPersonalizedTrendForMetric('redness', latestSkinCapture.scores?.redness || 0, skinHistory);
          const rednessAction = ActionsService.getNextBestAction('redness', latestSkinCapture.scores?.redness || 0, rednessBucket);

          const hydrationBucket = MetricsService.getSkinBucket('hydration', latestSkinCapture.scores?.hydration || 0);
          const hydrationTrend = MetricsService.getPersonalizedTrendForMetric('hydration', latestSkinCapture.scores?.hydration || 0, skinHistory);
          const hydrationAction = ActionsService.getNextBestAction('hydration', latestSkinCapture.scores?.hydration || 0, hydrationBucket);

          const oilinessBucket = MetricsService.getSkinBucket('oiliness', latestSkinCapture.scores?.oiliness || 0);
          const oilinessTrend = MetricsService.getPersonalizedTrendForMetric('oiliness', latestSkinCapture.scores?.oiliness || 0, skinHistory);
          const oilinessAction = ActionsService.getNextBestAction('oiliness', latestSkinCapture.scores?.oiliness || 0, oilinessBucket);

          // Calcola quality info
          const confidenceInfo = QualityService.getConfidenceScore(latestSkinCapture.confidence || 0.8);
          setQualityInfo(confidenceInfo);

          // Calcola insights
          const calculatedInsights = CorrelationService.getInsights(skinHistory, null);
          setInsights(calculatedInsights.slice(0, 3)); // Max 3 insights

          // Calcola next best actions
          const actions = [textureAction, rednessAction, hydrationAction, oilinessAction]
            .filter(action => action && action.actionable);
          setNextBestActions(actions);
        }
      } catch (error) {
        console.warn('Error calculating enhanced data:', error);
      }
    };

    calculateEnhancedData();
  }, []);

  // Start camera automatically when screen loads
  useEffect(() => {
    const initializeCamera = async () => {
      console.log('🎥 Auto-starting camera on screen load...');
      await cameraController.startCamera();
    };
    
    initializeCamera();
  }, []);


  const handleStartAnalysis = async () => {
    console.log('Starting skin analysis...');

    // Start camera immediately for better perceived performance
    await cameraController.startCamera();

    // Run permission and analysis checks in parallel
    const [granted, ready] = await Promise.all([
      ensureCameraPermission(),
      ensureAnalysisReady()
    ]);

    console.log('Camera permission granted:', granted);
    if (!granted) {
      alert('Camera permission is required for skin analysis');
      cameraController.stopCamera();
      return;
    }

    if (!ready) {
      alert('Analysis service is not ready. Please check your OpenAI configuration.');
      cameraController.stopCamera();
      return;
    }

    console.log('🎥 Activating camera for skin analysis');
    // Reset previous session state so the camera preview always shows immediately
    setResults(null);
    setAnalyzing(false);
    setCameraSwitching(false);
  };

  // 🔧 FALLBACK: Image Picker for Testing (100% Reliable)
  const analyzeFromGallery = async () => {
    console.log('📸 Starting skin analysis from gallery (FALLBACK)...');
    
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

        console.log('✅ Gallery image ready for skin analysis:', dataUrl.length, 'chars');
        
        setAnalyzing(true);

        // Analyze the selected image
        console.log('🤖 Analyzing skin from gallery image...');
        const analysisResult = await analysisServiceRef.current.analyzeSkin(dataUrl);
        
        if (analysisResult.success && analysisResult.data) {
          console.log('✅ Gallery skin analysis successful:', analysisResult.data);

          const galleryScores = analysisResult.data.scores;
          const galleryRecommendations = analysisResult.data.recommendations || [];

          const skinResults: SkinAnalysisResults = {
            hydration: galleryScores.hydration,
            oiliness: galleryScores.oiliness,
            sensitivity: galleryScores.redness,
            pigmentation: galleryScores.texture,
            recommendations: galleryRecommendations,
          };
          
          setResults(skinResults);
          setAnalyzing(false);

          // Save to Supabase database
          try {
            const currentUser = await AuthService.getCurrentUser();
            if (currentUser) {
              const savedAnalysis = await SkinAnalysisService.saveSkinAnalysis(currentUser.id, {
                overallScore: galleryScores.overall,
                hydrationScore: galleryScores.hydration,
                oilinessScore: galleryScores.oiliness,
                textureScore: galleryScores.texture,
                pigmentationScore: galleryScores.pigmentation || 0, // Default if not available
                rednessScore: galleryScores.redness,  // Added redness score
                strengths: [], // Not available in current structure
                improvements: analysisResult.data.issues || [], // Map issues to improvements
                recommendations: galleryRecommendations,
                analysisData: {
                  ...analysisResult.data,
                  // Include additional metadata
                  version: analysisResult.data.version || '1.0.0',
                  notes: analysisResult.data.notes || [],
                  confidence: analysisResult.data.confidence || 0.8,
                },
                imageUrl: asset.uri,
              });
              
              if (savedAnalysis) {
                console.log('✅ Skin analysis saved to database:', savedAnalysis.id);
                
                // Sincronizza i dati con lo store locale per i grafici
                const skinCapture = {
                  id: savedAnalysis.id,
                  timestamp: new Date(savedAnalysis.created_at),
                  scores: {
                    texture: savedAnalysis.texture_score || 0,
                    redness: savedAnalysis.redness_score || 0,
                    hydration: savedAnalysis.hydration_score || 0,  // ✅ FIXED: Correctly map hydration_score
                    oiliness: savedAnalysis.oiliness_score || 0,   // ✅ FIXED: Correctly map oiliness_score
                    overall: savedAnalysis.overall_score || 0,
                  },
                  confidence: savedAnalysis.confidence || 0.8,  // Use actual confidence
                  quality: {
                    lighting: 0.8,
                    focus: 0.8,
                    roi_coverage: 0.9,
                  },
                  photoUri: savedAnalysis.image_url || '',
                };
                
                const store = useAnalysisStore.getState();
                store.addSkinCapture(skinCapture);
                console.log('📊 Skin data synchronized with local store for charts');
              } else {
                console.warn('⚠️ Failed to save skin analysis to database');
              }
            } else {
              console.warn('⚠️ No authenticated user found, skipping database save');
            }
          } catch (dbError) {
            console.error('❌ Error saving skin analysis to database:', dbError);
            // Don't fail the whole operation if database save fails
          }

          setTimeout(() => {
            // Save to store
            const capture: SkinCapture = {
              id: Date.now().toString(),
              timestamp: new Date(),
              scores: {
                texture: galleryScores.texture,
                redness: galleryScores.redness,
                hydration: galleryScores.hydration,  // ✅ FIXED: Use hydration instead of shine
                oiliness: galleryScores.oiliness,   // ✅ FIXED: Use oiliness instead of shine
                overall: galleryScores.overall,
              },
              confidence: analysisResult.data.confidence ?? 0.8,
              quality: {
                lighting: 0.8,
                focus: 0.8,
                roi_coverage: 0.9,
              },
              photoUri: asset.uri,
            };
            addSkinCapture(capture);
          }, 100);
          
        } else {
          console.error('Gallery skin analysis failed:', analysisResult.error);
          alert('Skin analysis failed: ' + (analysisResult.error || 'Unknown error'));
          setAnalyzing(false);
        }
      } else {
        console.log('📸 Image picker cancelled');
      }
    } catch (error: any) {
      console.error('Gallery skin analysis error:', error);
      alert('Failed to analyze skin image: ' + error.message);
      setAnalyzing(false);
    }
  };

  const switchCamera = useCallback(() => {
    if (cameraSwitching) {
      console.log('🔄 Camera switch already in progress, ignoring');
      return;
    }

    const nextType = cameraType === 'front' ? 'back' : 'front';
    console.log('🔄 Switching camera from', cameraType, 'to', nextType);

    // DON'T set cameraSwitching to true immediately - this causes ref loss
    // Instead, update the camera type and let the CameraView handle the transition
    setCameraType(nextType);
    
    // Set switching state AFTER the camera type change to prevent ref loss
    setTimeout(() => {
      setCameraSwitching(true);
      console.log('🔄 Camera switching state set to true');
      
      // Reset switching state after a short delay
      setTimeout(() => {
        setCameraSwitching(false);
        console.log('🔄 Camera switching state reset to false');
      }, 1000);
    }, 100);
    
  }, [cameraType, cameraSwitching]);

  const captureAndAnalyze = async () => {
    console.log('📸 Starting skin capture process...');
    
    // Store cameraController methods in local variables to prevent scope issues
    const { ref, ready, detecting, error, isCameraReady, setDetecting } = cameraController;
    
    console.log('📸 Skin Camera controller state:', {
      hasRef: !!ref.current,
      ready,
      detecting,
      error,
      isCameraReady: isCameraReady(),
      cameraSwitching,
      analyzing,
    });

    if (!isCameraReady()) {
      const errorMsg = error || 'Camera not ready. Please wait a moment...';
      console.error('📸 Skin Capture failed:', errorMsg);
      alert(errorMsg);
      return;
    }
    if (detecting || analyzing) {
      console.log('📸 Skin Capture skipped - already analyzing');
      return;
    }
    if (cameraSwitching) {
      console.log('📸 Skin Capture skipped - camera is switching');
      alert('Please wait for camera to finish switching');
      return;
    }

    try {
      const serviceReady = await ensureAnalysisReady();
      if (!serviceReady) {
        const errorMsg = 'Analysis service is not ready. Please check your OpenAI configuration.';
        console.error('📸 Skin Capture failed:', errorMsg);
        alert(errorMsg);
        return;
      }

      setAnalyzing(true);
      setDetecting(true);

      console.log('📸 Taking skin picture with CameraView...');
      console.log('📸 Camera ref before capture:', {
        hasRef: !!ref.current,
        refType: typeof ref.current,
        refMethods: ref.current ? Object.getOwnPropertyNames(ref.current) : 'null',
        cameraSwitching,
        analyzing,
      });

      // Aggressive ref recovery before capture (same as EmotionDetectionScreen)
      if (!ref.current) {
        console.log('📸 Skin Camera ref is null, attempting aggressive recovery...');
        
        // Try to restore from global storage first
        const globalRef = (globalThis as any).globalCameraRef;
        if (globalRef) {
          console.log('📸 Skin Found global camera ref, restoring...');
          ref.current = globalRef;
        }
        
        // Try multiple recovery attempts
        for (let attempt = 1; attempt <= 3; attempt++) {
          console.log(`📸 Skin Recovery attempt ${attempt}/3`);
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          
          // Force a re-render by updating state
          setDetecting(false);
          await new Promise(resolve => setTimeout(resolve, 50));
          setDetecting(true);
          
          if (ref.current) {
            console.log(`📸 Skin Recovery successful on attempt ${attempt}`);
            break;
          }
        }
        
        if (!ref.current) {
          throw new Error('Camera ref is null - camera may have been unmounted. Please restart the camera.');
        }
      }

      console.log('📸 Skin Ref validation passed, proceeding with capture...');

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
        console.log(`📸 Skin Trying capture strategy ${i + 1}/${captureStrategies.length}: ${strategy.name}`, strategy.options);
        
        try {
          // Double-check camera ref is still valid right before capture
          if (!ref.current) {
            console.log(`📸 Skin Camera ref became null before strategy ${strategy.name}, attempting recovery...`);
            
            // Try to recover ref from global storage
            const globalRef = (globalThis as any).globalCameraRef;
            if (globalRef) {
              console.log('📸 Skin Found global camera ref, restoring...');
              ref.current = globalRef;
            } else {
              throw new Error('Camera ref is null and cannot be recovered');
            }
          }
          
          // Additional safety check - ensure the ref has the takePictureAsync method
          if (typeof ref.current.takePictureAsync !== 'function') {
            console.log(`📸 Skin Camera ref takePictureAsync is not a function, skipping strategy ${strategy.name}`);
            throw new Error('Camera ref does not have takePictureAsync method');
          }
          
          // Extra validation for camera switching scenarios
          if (cameraSwitching) {
            console.log(`📸 Skin Camera still switching during strategy ${strategy.name}, skipping`);
            throw new Error('Camera is still switching');
          }
          
          console.log(`📸 Skin About to call takePictureAsync with camera ref:`, !!ref.current, 'method exists:', typeof ref.current.takePictureAsync, 'switching:', cameraSwitching);
          const capturePromise = ref.current.takePictureAsync(strategy.options);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Camera capture timeout')), 8000);
          });

          photo = await Promise.race([capturePromise, timeoutPromise]);
          console.log(`📸 Skin Capture successful with strategy: ${strategy.name}`);
          break;
        } catch (strategyError) {
          console.log(`📸 Skin Strategy ${strategy.name} failed:`, strategyError.message);
          
          // If this is the first strategy and it fails, try to restart the camera
          if (i === 0 && strategyError.message.includes('ERR_IMAGE_CAPTURE_FAILED')) {
            console.log('📸 Skin First strategy failed with ERR_IMAGE_CAPTURE_FAILED, attempting camera restart...');
            try {
              cameraController.stopCamera();
              await new Promise(resolve => setTimeout(resolve, 1000));
              cameraController.startCamera();
              await new Promise(resolve => setTimeout(resolve, 2000));
              console.log('📸 Skin Camera restarted, retrying capture...');
            } catch (restartError) {
              console.log('📸 Skin Camera restart failed:', restartError.message);
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

      console.log('📸 Skin photo captured:', {
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
          console.log('📸 Converting skin photo URI to base64...');
          const base64 = await FileSystem.readAsStringAsync(photo.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          photo.base64 = base64;
          console.log('📸 Skin base64 conversion successful, length:', base64.length);
        } catch (conversionError) {
          console.warn('📸 Failed to convert skin photo to base64:', conversionError);
          throw new Error('Failed to process photo data');
        }
      }

      if (!photo?.base64) {
        throw new Error('Camera returned empty data. Please retry.');
      }

      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      console.log('✅ Skin photo captured, sending for analysis...');

      const result = await analysisServiceRef.current.analyzeSkin(dataUrl, 'skin-analysis-session');
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Skin analysis failed.');
      }

      console.log('Skin analysis successful:', result.data);

      // Store the full analysis result
      setFullAnalysisResult(result.data);

      // Save to Supabase database
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          const savedAnalysis = await SkinAnalysisService.saveSkinAnalysis(currentUser.id, {
            overallScore: result.data.scores.overall || Math.round((result.data.scores.texture + result.data.scores.redness + result.data.scores.oiliness + result.data.scores.hydration) / 4),
            hydrationScore: result.data.scores.hydration,
            oilinessScore: result.data.scores.oiliness,
            textureScore: result.data.scores.texture,
            pigmentationScore: result.data.scores.pigmentation || 0, // Default if not available
            rednessScore: result.data.scores.redness,  // Added redness score
            strengths: [], // Not available in current structure
            improvements: result.data.issues || [], // Map issues to improvements
            recommendations: result.data.recommendations || [],
            analysisData: {
              ...result.data,
              // Include additional metadata
              version: result.data.version || '1.0.0',
              notes: result.data.notes || [],
              confidence: result.data.confidence || 0.8,
            },
            imageUrl: photo.uri,
          });
          
          if (savedAnalysis) {
            console.log('✅ Skin analysis saved to database:', savedAnalysis.id);
            
            // Sincronizza i dati con lo store locale per i grafici
            const skinCapture = {
              id: savedAnalysis.id,
              timestamp: new Date(savedAnalysis.created_at),
              scores: {
                texture: savedAnalysis.texture_score || 0,
                redness: savedAnalysis.redness_score || 0,
                hydration: savedAnalysis.hydration_score || 0,  // ✅ FIXED: Correctly map hydration_score
                oiliness: savedAnalysis.oiliness_score || 0,   // ✅ FIXED: Correctly map oiliness_score
                overall: savedAnalysis.overall_score || 0,
              },
              confidence: savedAnalysis.confidence || 0.8,  // Use actual confidence
              quality: {
                lighting: 0.8,
                focus: 0.8,
                roi_coverage: 0.9,
              },
              photoUri: savedAnalysis.image_url || '',
            };
            
            const store = useAnalysisStore.getState();
            store.addSkinCapture(skinCapture);
            console.log('📊 Skin data synchronized with local store for charts');
          } else {
            console.warn('⚠️ Failed to save skin analysis to database');
          }
        } else {
          console.warn('⚠️ No authenticated user found, skipping database save');
        }
      } catch (dbError) {
        console.error('❌ Error saving skin analysis to database:', dbError);
        // Don't fail the whole operation if database save fails
      }

      const skinResults: SkinAnalysisResults = {
        hydration: result.data.scores.hydration,
        oiliness: result.data.scores.oiliness,
        sensitivity: result.data.scores.redness,  // This is correct - sensitivity maps to redness
        pigmentation: result.data.scores.texture,  // This is correct - pigmentation maps to texture
        recommendations: result.data.recommendations,
      };

      const capture: SkinCapture = {
        id: `skin_${Date.now()}`,
        timestamp: new Date(),
        scores: {
          texture: result.data.scores.texture,
          redness: result.data.scores.redness,
          hydration: result.data.scores.hydration,  // ✅ FIXED: Use hydration instead of shine
          oiliness: result.data.scores.oiliness,    // ✅ FIXED: Use oiliness instead of shine
          overall: result.data.scores.overall || Math.round((result.data.scores.texture + result.data.scores.redness + result.data.scores.oiliness + result.data.scores.hydration) / 4),
        },
        confidence: result.data.confidence ?? 0.8,
        quality: {
          lighting: result.data.notes?.includes('lighting') ? 0.6 : 0.8,
          focus: result.data.notes?.includes('focus') ? 0.6 : 0.8,
          roi_coverage: 0.9,
        },
        photoUri: photo.uri,
      };

      addSkinCapture(capture);

      cameraController.stopCamera();
      setAnalyzing(false);
      setDetecting(false);
      setResults(skinResults);
    } catch (error: any) {
      console.error('📸 Skin capture error details:', {
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
      setAnalyzing(false);
      setDetecting(false);
    }
  };

  const resetAnalysis = () => {
    setResults(null);
    setAnalyzing(false);
    // Restart camera immediately to prevent flash
    cameraController.startCamera();
  };

  // ✅ ADD: Function to open skincare guide
  const openSkincareGuide = (guideId: string) => {
    setSelectedGuide(guideId);
  };

  const closeSkincareGuide = () => {
    setSelectedGuide(null);
  };

  // ✅ ADD: Helper functions for enhanced design
  const getSectionColor = (key: string) => {
    const colors = {
      products: '#8b5cf6',    // Purple
      nutrition: '#10b981',   // Green  
      routine: '#f59e0b',     // Orange
      timing: '#ef4444',      // Red
    };
    return colors[key as keyof typeof colors] || '#6366f1';
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
      console.log('📷 Camera ready callback triggered');
      // Reset switching state when camera is actually ready
      if (cameraSwitching) {
        console.log('📷 Camera ready during switch, resetting switching state');
        setCameraSwitching(false);
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
      <View style={styles.container}>
        {/* Keep camera mounted but hidden during analysis */}
        <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
          <CameraFrame />
        </View>
        
        <SkinLoadingScreen onCancel={() => {
          setAnalyzing(false);
          setResults(null);
        }} />
      </View>
    );
  }

  if (cameraController.active && !analyzing) {
    return (
      <View style={styles.container}>
        <View style={styles.captureLayout}>
          <CameraFrame />
          
          
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.ghostButton} onPress={() => cameraController.stopCamera()}>
              <FontAwesome name="times" size={16} color="#4338ca" />
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            {/* Camera Switch Button */}
            <TouchableOpacity 
              style={[styles.ghostButton, cameraSwitching && { opacity: 0.5 }]} 
              onPress={switchCamera}
              disabled={cameraSwitching}
            >
              <FontAwesome name="refresh" size={16} color="#4338ca" />
              <Text style={styles.ghostButtonText}>
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
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <FontAwesome name="camera" size={16} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Capture</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Removed old SkinCaptureCard rendering - now using SkinResultsScreen for all results

  // Only render results section if we have results
  if (results) {
    return (
      <SkinResultsScreen
        results={results}
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.overviewContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#22d3ee', '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Advanced Skin Analysis</Text>
            <Text style={styles.heroSubtitle}>
              Measure hydration, redness, and texture with a guided camera scan. Get recommendations in seconds.
            </Text>
          </View>
          <VideoHero
            videoUri={heroVideoUri}
            title="Advanced Skin Analysis"
            subtitle="Measure hydration, redness, and texture with a guided camera scan. Get recommendations in seconds."
            onPlayPress={handleStartAnalysis}
            showPlayButton={false}
            autoPlay={true}
            loop={true}
            muted={true}
            style={styles.heroVideo}
            fallbackImageUri="https://images.unsplash.com/photo-1557163435-efdb2550fbfb?q=80&w=3270&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          />
          <View style={styles.heroStatsRow}>
            {headerStats.map((item) => (
              <View key={item.label} style={styles.heroStatChip}>
                <Text style={styles.heroChipLabel}>{item.label}</Text>
                <Text style={styles.heroChipValue}>{item.value}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleStartAnalysis}
            disabled={startDisabled}
            style={startDisabled ? { opacity: 0.6 } : undefined}
          >
            <LinearGradient
              colors={['#fef3c7', '#fde68a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.primaryButton, styles.heroButton]}
            >
              <FontAwesome name="camera" size={16} color="#92400e" />
              <Text style={[styles.primaryButtonText, styles.heroButtonText]}>Start skin scan</Text>
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

         {/* Recent Analysis Section - Always visible */}
         <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>Recent Analysis</Text>
           <Text style={styles.sectionSubtitle}>Your latest skin scan results</Text>
         </View>
         
         {(() => {
           try {
             const store = useAnalysisStore.getState();
             const latestCapture = store.latestSkinCapture;
             const skinHistory = store.skinHistory;
             
             // Debug: Log dello stato dello store
             console.log('🔍 SkinAnalysisScreen Debug:', {
               hasLatestCapture: !!latestCapture,
               latestCaptureId: latestCapture?.id,
               skinHistoryLength: skinHistory.length,
               storeState: {
                 latestSkinCapture: store.latestSkinCapture,
                 skinHistory: store.skinHistory
               }
             });
             
             // Always show the card, with fallback data if no capture exists
             const fallbackCapture = {
               id: 'fallback',
               timestamp: new Date().toISOString(),
               scores: {
                 texture: 65,
                 redness: 25,
                 hydration: 70,
                 oiliness: 45,
                 overall: 60,
               },
               confidence: 0.5,
               quality: {
                 lighting: 0.7,
                 focus: 0.6,
                 roi_coverage: 0.8,
               },
             };
             
             return (
               <SkinCaptureCard
                 capture={latestCapture || fallbackCapture}
               />
             );
           } catch (error) {
             console.warn('Failed to load latest skin capture:', error);
             // Fallback capture in case of error
             const fallbackCapture = {
               id: 'error-fallback',
               timestamp: new Date().toISOString(),
               scores: {
                 texture: 65,
                 redness: 25,
                 hydration: 70,
                 oiliness: 45,
                 overall: 60,
               },
               confidence: 0.5,
               quality: {
                 lighting: 0.7,
                 focus: 0.6,
                 roi_coverage: 0.8,
               },
             };
             return <SkinCaptureCard capture={fallbackCapture} />;
           }
         })()}

        {/* Detailed Analysis Button */}
        <TouchableOpacity
          style={styles.detailedAnalysisButton}
          onPress={() => setShowDetailedAnalysis(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#22d3ee', '#6366f1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.detailedAnalysisButtonGradient}
          >
            <MaterialCommunityIcons name="face-woman-shimmer" size={20} color="#ffffff" />
            <Text style={styles.detailedAnalysisButtonText}>
              Ricevi ulteriori dettagli della tua analisi
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Stats Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <Text style={styles.sectionSubtitle}>Your skin health overview</Text>
        </View>
        
        {/* Gauge Charts Grid 2x2 */}
        <View style={styles.gaugeGrid}>
          <View style={styles.gaugeRow}>
            <View style={styles.gaugeCard}>
              <GaugeChart
                value={skinHistory.length > 0 
                  ? Math.round(skinHistory.reduce((sum, capture) => sum + (capture.scores?.texture || 0), 0) / skinHistory.length)
                  : 65
                }
                maxValue={100}
                label="Smoothness"
                color="#8b5cf6"
                subtitle="Skin Texture"
                trend={2}
                description="Shows skin surface uniformity. Helps identify dryness, roughness, or damage. High values indicate smooth, healthy skin, while low values may indicate dryness, irregularities, or damage. Good texture is essential for a youthful and healthy appearance."
                historicalData={skinHistory.map((capture, index) => ({
                  date: `${index + 1}`,
                  value: capture.scores?.texture || 0
                }))}
                metric="texture"
                icon="blur"
              />
            </View>
            
            <View style={styles.gaugeCard}>
              <GaugeChart
                value={skinHistory.length > 0 
                  ? Math.round(skinHistory.reduce((sum, capture) => sum + (capture.scores?.redness || 0), 0) / skinHistory.length)
                  : 25
                }
                maxValue={100}
                label="Redness"
                color="#ef4444"
                subtitle="Skin Redness"
                trend={-3}
                description="Measures skin irritation and inflammation. Low values indicate calm, healthy skin, while high values may indicate inflammation, sensitivity, or conditions like rosacea. Monitoring this value helps identify irritating triggers."
                historicalData={skinHistory.map((capture, index) => ({
                  date: `${index + 1}`,
                  value: capture.scores?.redness || 0
                }))}
                metric="redness"
                icon="fire"
              />
            </View>
          </View>
          
          <View style={styles.gaugeRow}>
            <View style={styles.gaugeCard}>
              <GaugeChart
                value={skinHistory.length > 0 
                  ? Math.round(skinHistory.reduce((sum, capture) => sum + (capture.scores?.hydration || 0), 0) / skinHistory.length)
                  : 45
                }
                maxValue={100}
                label="Hydration"
                color="#f59e0b"
                subtitle="Water Content"
                trend={1}
                description="Shows surface water content. Helps prevent dryness and signs of fatigue. High values indicate well-hydrated and elastic skin, while low values indicate dryness and dehydration. Good hydration is essential for maintaining soft, elastic skin resistant to wrinkles."
                historicalData={skinHistory.map((capture, index) => ({
                  date: `${index + 1}`,
                  value: capture.scores?.hydration || 0
                }))}
                metric="hydration"
                icon="water"
              />
            </View>
            
            <View style={styles.gaugeCard}>
              <GaugeChart
                value={skinHistory.length > 0 
                  ? Math.round(skinHistory.reduce((sum, capture) => sum + (capture.scores?.oiliness || 0), 0) / skinHistory.length)
                  : 50
                }
                maxValue={100}
                label="Oiliness"
                color="#8b5cf6"
                subtitle="Sebaceous Activity"
                trend={0}
                description="Measures sebaceous activity and oil production. Helps balance skincare routine. High values indicate oily skin, while low values indicate dry skin. Balanced oiliness is essential for healthy skin barrier."
                historicalData={skinHistory.map((capture, index) => ({
                  date: `${index + 1}`,
                  value: capture.scores?.oiliness || 0
                }))}
                metric="oiliness"
                icon="oil-can"
              />
            </View>
          </View>
        </View>

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


        {/* Skin Health Trend Chart */}
        <SkinHealthChart
          data={skinHistory.map((capture, index) => ({
            date: `${index + 1}`,
            texture: capture.scores?.texture || 0,
            redness: capture.scores?.redness || 0,
            hydration: capture.scores?.hydration || 0,  // ✅ FIXED: Use hydration instead of shine
            overall: capture.scores?.overall || 0,
          }))}
          title="Skin Health Score Trends"
          subtitle="7-day overview of your skin metrics"
        />

        {/* Intelligent Insights Section - Skin Only */}
        <IntelligentInsightsSection
          category="skin"
          data={(() => {
            try {
              const store = useAnalysisStore.getState();
              return {
                latestCapture: store.latestSkinCapture,
                skinHistory: store.skinHistory || [],
                trend: store.skinTrend,
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
            console.log('Intelligent skin insight pressed:', insight.title);
            // Handle insight press - could navigate to detailed view
          }}
          onActionPress={(insight, action) => {
            console.log('Intelligent skin action pressed:', insight.title, action);
            // Handle action press - could start activity, set reminder, etc.
          }}
        />

        {/* How Skin Analysis Works Video Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>How Skin Analysis Works</Text>
          <Text style={styles.sectionSubtitle}>Understanding the technology behind our analysis</Text>
        </View>
        
        <LinearGradient
          colors={['#fef3c7', '#fde68a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.howItWorksCard}
        >
          <View style={styles.howItWorksHeader}>
            <View style={[styles.howItWorksIcon, { backgroundColor: '#f59e0b22' }]}>
              <FontAwesome name="cogs" size={20} color="#d97706" />
            </View>
            <View style={styles.howItWorksContent}>
              <Text style={styles.howItWorksTitle}>AI-Powered Skin Analysis</Text>
              <Text style={styles.howItWorksDescription}>
                Our advanced computer vision algorithms analyze skin smoothness, hydration levels, redness patterns, and oiliness to provide comprehensive skin health insights.
              </Text>
            </View>
          </View>
          
          {/* Video Placeholder */}
          <View style={styles.videoPlaceholder}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=1200&q=80' }} 
              style={styles.videoImage} 
            />
            <View style={styles.videoPlayButton}>
              <FontAwesome name="play" size={16} color="#312e81" />
            </View>
          </View>
          
          <View style={styles.howItWorksSteps}>
            <View style={styles.howItWorksStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Capture high-resolution skin images using advanced camera technology</Text>
            </View>
            
            <View style={styles.howItWorksStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>AI analyzes skin smoothness, hydration, redness, and oiliness patterns</Text>
            </View>
            
            <View style={styles.howItWorksStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Get detailed skin health report with personalized recommendations</Text>
            </View>
          </View>
        </LinearGradient>


        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Advanced modules</Text>
          <Text style={styles.sectionSubtitle}>Unlock deeper diagnostics</Text>
        </View>
        <View style={styles.insightList}>
          {insightCards.map((card) => (
            <TouchableOpacity 
              key={card.id} 
              style={styles.insightCard}
              onPress={() => openSkincareGuide(card.id)}
              activeOpacity={0.8}
            >
              <ImageWithFallback 
                uri={card.image} 
                style={styles.insightImage}
                fallbackColor="#f3f4f6"
              />
              <View style={styles.insightCopy}>
                <Text style={styles.insightTitle}>{card.title}</Text>
                <Text style={styles.insightDescription}>{card.description}</Text>
                <View style={styles.guideHint}>
                  <Text style={styles.guideHintText}>Tap for detailed guide</Text>
                  <FontAwesome name="chevron-right" size={12} color="#6366f1" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Detailed Analysis Popup */}
      <DetailedAnalysisPopup
        visible={showDetailedAnalysis}
        onClose={() => setShowDetailedAnalysis(false)}
        analysisType="skin"
        analysisData={(() => {
          try {
            const store = useAnalysisStore.getState();
            return store.latestSkinCapture;
          } catch (error) {
            return null;
          }
        })()}
      />
      
      {/* ✅ ADD: Skincare Guide Modal */}
      {selectedGuide && (
        <Modal
          visible={!!selectedGuide}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeSkincareGuide}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeSkincareGuide} style={styles.closeButton}>
                <FontAwesome name="times" size={20} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {skincareGuides[selectedGuide as keyof typeof skincareGuides]?.title}
              </Text>
              <Text style={styles.modalSubtitle}>
                {skincareGuides[selectedGuide as keyof typeof skincareGuides]?.subtitle}
              </Text>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Hero Image Section */}
              <View style={styles.heroImageContainer}>
                <ImageWithFallback 
                  uri={skincareGuides[selectedGuide as keyof typeof skincareGuides]?.image || ''} 
                  style={styles.heroImage}
                  fallbackColor="#f3f4f6"
                />
                <View style={styles.heroOverlay}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>EXPERT GUIDE</Text>
                  </View>
                </View>
              </View>
              
              {/* Quick Stats Row */}
              <View style={styles.quickStatsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>5</Text>
                  <Text style={styles.statLabel}>Key Tips</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>4</Text>
                  <Text style={styles.statLabel}>Categories</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>2-4</Text>
                  <Text style={styles.statLabel}>Weeks</Text>
                </View>
              </View>
              
              {/* Sections with Enhanced Design */}
              {Object.entries(skincareGuides[selectedGuide as keyof typeof skincareGuides]?.sections || {}).map(([key, section], index) => (
                <View key={key} style={[
                  styles.sectionCard,
                  { 
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderLeftWidth: 4,
                    borderLeftColor: getSectionColor(key)
                  }
                ]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.sectionIcon, { backgroundColor: `${getSectionColor(key)}20` }]}>
                      <Text style={[styles.sectionEmoji, { color: getSectionColor(key) }]}>
                        {getSectionEmoji(key)}
                      </Text>
                    </View>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  </View>
                  
                  <View style={styles.itemsContainer}>
                    {section.items.map((item, itemIndex) => (
                      <View key={itemIndex} style={styles.itemCard}>
                        <View style={[styles.itemBullet, { backgroundColor: `${getSectionColor(key)}15` }]}>
                          <Text style={[styles.bulletNumber, { color: getSectionColor(key) }]}>{itemIndex + 1}</Text>
                        </View>
                        <Text style={styles.itemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              
              {/* Action Button */}
              <View style={styles.actionSection}>
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                  <FontAwesome name="heart" size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Save to My Routine</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flex: 1,
  },
  overviewContent: {
    paddingTop: 0,
    paddingBottom: 100, // Increased padding to account for bottom navigation bar
    paddingHorizontal: 20,
    gap: 24,
  },
  resultsContent: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    gap: 24,
  },
  heroCard: {
    borderRadius: 32,
    padding: 24,
    gap: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 12,
  },
  heroHeader: {
    gap: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
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
    height: 180,
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
    color: 'rgba(255,255,255,0.75)',
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
    color: '#fef3c7',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
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
    backgroundColor: '#ffffff',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    minHeight: 120,
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
    color: '#0f172a',
    marginBottom: 8,
  },
  insightDescription: {
    fontSize: 13,
    color: '#475569',
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
    color: '#92400e',
    marginBottom: 4,
  },
  howItWorksDescription: {
    fontSize: 14,
    color: '#a16207',
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
    color: '#a16207',
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
  gaugeCard: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    color: '#6366f1',
    fontWeight: '600',
  },
  
  // ✅ ADD: Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6b7280',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366f1',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
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
    borderColor: '#e2e8f0',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
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
    color: '#374151',
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
});

export default SkinAnalysisScreen;
