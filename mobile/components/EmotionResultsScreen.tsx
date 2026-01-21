// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaWrapper } from './shared/SafeAreaWrapper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { ResultHero } from './ResultHero';
import { EnhancedMetricTile } from './EnhancedMetricTile';
import { ActionCard } from './ActionCard';
import { MetricsService } from '../services/metrics.service';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';
import { AuthService } from '../services/auth.service';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { useAnalysisStore } from '../stores/analysis.store';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface EmotionResultsScreenProps {
  currentEmotion: string | null;
  confidence: number;
  fullAnalysisResult?: any;
  onGoBack: () => void;
  onSave?: () => Promise<void>;
}

// Video URI per Emotion Analysis
const heroVideoUri = require('../assets/videos/emotion-detection-video.mp4');

export const EmotionResultsScreen: React.FC<EmotionResultsScreenProps> = ({
  currentEmotion,
  confidence,
  fullAnalysisResult,
  onGoBack,
  onSave,
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets(); // 🔥 FIX: Per gestire bottom insets nelle bottom bars
  const { hideTabBar, showTabBar } = useTabBarVisibility();

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (onSave) {
        await onSave();
      } else {
        // Logica di salvataggio robusta (migrata da EmotionDetectionScreen)
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser && fullAnalysisResult) {
          const saved = await EmotionAnalysisService.saveEmotionAnalysis(currentUser.id, {
            dominantEmotion: currentEmotion,
            valence: fullAnalysisResult.valence || 0,
            arousal: fullAnalysisResult.arousal || 0,
            confidence: confidence / 100,
            analysisData: {
              ...fullAnalysisResult,
              analysis_description: fullAnalysisResult.analysis_description || '',
              observations: fullAnalysisResult.observations || [],
              recommendations: fullAnalysisResult.recommendations || [],
              emotions: fullAnalysisResult.emotions || {},
              timestamp: fullAnalysisResult.timestamp || new Date().toISOString(),
            },
            aiAnalysisText: [
              fullAnalysisResult.analysis_description || '',
              ...(fullAnalysisResult.observations || [])
            ].filter(Boolean).join('\n'),
          });

          if (saved) {
            // Verifica e feedback
            try {
              const { DatabaseVerificationService } = await import('../services/database-verification.service');
              const { UserFeedbackService } = await import('../services/user-feedback.service');
              const verification = await DatabaseVerificationService.verifyEmotionAnalysis(currentUser.id, saved.id);

              if (!verification.found) {
                UserFeedbackService.showWarning(
                  language === 'it'
                    ? 'L\'analisi è stata salvata ma potrebbe non essere visibile immediatamente.'
                    : 'Analysis saved but might not be visible immediately.'
                );
              } else {
                UserFeedbackService.showSaveSuccess('analisi');
              }

              // Aggiorna lo store locale
              const store = useAnalysisStore.getState();
              store.addEmotionSession({
                id: saved.id,
                timestamp: new Date(saved.created_at),
                dominant: saved.dominant_emotion,
                avg_valence: saved.valence,
                avg_arousal: saved.arousal,
                confidence: saved.confidence,
                duration: saved.session_duration || 0,
              });

              // Onboarding
              const { OnboardingService } = await import('../services/onboarding.service');
              const isFirstTime = await OnboardingService.isFirstTime('emotion');
              if (isFirstTime) {
                await OnboardingService.markFirstTimeCompleted('emotion');
              }
            } catch (e) {
              console.error('Error in post-save logic:', e);
            }
          }
        }
        onGoBack();
      }
    } catch (error) {
      console.error('Error saving emotion analysis:', error);
      try {
        const { UserFeedbackService } = await import('../services/user-feedback.service');
        UserFeedbackService.showError(
          language === 'it'
            ? 'Errore durante il salvataggio dell\'analisi.'
            : 'Error saving analysis.'
        );
      } catch (e) { }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    hideTabBar();
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);

  // 🔥 FIX: Gestisci il tasto indietro del sistema per tornare alla schermata overview
  useEffect(() => {
    const onBackPress = () => {
      onGoBack();
      return true; // Previeni il comportamento di default (navigare via dalla schermata)
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => subscription.remove();
  }, [onGoBack]);

  // 🆕 Contextual Questions State
  const [contextAnswers, setContextAnswers] = useState<{
    sleep?: string;
    activity?: string;
    stress?: string;
  }>({});
  const [contextSubmitted, setContextSubmitted] = useState(false);

  // 🆕 Contextual Questions definitions with emoji-enhanced labels
  const contextualQuestions = useMemo(() => [
    {
      id: 'sleep',
      question: language === 'it' ? 'Come hai dormito?' : 'How did you sleep?',
      icon: 'moon' as const,
      options: language === 'it'
        ? [{ value: 'good', label: '✨ Bene (7-9h)' }, { value: 'okay', label: '😐 Discretamente (5-7h)' }, { value: 'bad', label: '😫 Male (<5h)' }]
        : [{ value: 'good', label: '✨ Well (7-9h)' }, { value: 'okay', label: '😐 Okay (5-7h)' }, { value: 'bad', label: '😫 Poorly (<5h)' }],
    },
    {
      id: 'activity',
      question: language === 'it' ? "Cosa hai fatto nell'ultima ora?" : 'What were you doing?',
      icon: 'activity' as const,
      options: language === 'it'
        ? [{ value: 'work', label: '💼 Lavoro' }, { value: 'relax', label: '🛋️ Relax' }, { value: 'exercise', label: '🏃 Esercizio' }, { value: 'social', label: '👥 Social' }]
        : [{ value: 'work', label: '💼 Work' }, { value: 'relax', label: '🛋️ Relax' }, { value: 'exercise', label: '🏃 Exercise' }, { value: 'social', label: '👥 Social' }],
    },
    {
      id: 'stress',
      question: language === 'it' ? 'Livello di stress oggi?' : 'Stress level today?',
      icon: 'thermometer' as const,
      options: language === 'it'
        ? [{ value: 'low', label: '😌 Basso' }, { value: 'medium', label: '😅 Medio' }, { value: 'high', label: '😤 Alto' }]
        : [{ value: 'low', label: '😌 Low' }, { value: 'medium', label: '😅 Medium' }, { value: 'high', label: '😤 High' }],
    },
  ], [language]);

  // 🆕 Save contextual answers to database
  const handleSaveContext = useCallback(async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser && fullAnalysisResult) {
        // Get the latest analysis and update its analysis_data
        const latest = await EmotionAnalysisService.getLatestEmotionAnalysis(currentUser.id, true);
        if (latest) {
          // 🆕 Actually persist the context data to Supabase
          const success = await EmotionAnalysisService.updateContextData(latest.id, {
            sleep: contextAnswers.sleep,
            activity: contextAnswers.activity,
            stress: contextAnswers.stress,
          });

          if (success) {
            console.log('✅ Context answers saved to database:', contextAnswers);
            setContextSubmitted(true);
          } else {
            console.error('Failed to save context answers');
          }
        }
      }
    } catch (error) {
      console.error('Error saving context:', error);
    }
  }, [contextAnswers, fullAnalysisResult]);

  // Helper to filter out AU (Action Unit) technical observations
  const filterObservations = (observations: string[]): string[] => {
    if (!observations) return [];
    return observations.filter(obs => {
      const lower = obs.toLowerCase();
      // Filter out AU codes like "AU1:", "AU12:", etc.
      if (/\bau\d+\b/i.test(obs)) return false;
      // Filter out technical facial muscle terms
      if (lower.includes('action unit')) return false;
      return true;
    });
  };

  // Helper for translation - handles AI observations
  const translateAIText = (text: string): string => {
    if (!text || language === 'en') return text;

    const translations: { [key: string]: string } = {
      // Exact matches - Observations
      'Facial expression appears neutral.': 'L\'espressione facciale appare neutra.',
      'No strong emotional cues from eyebrows or mouth.': 'Nessun segnale emotivo forte da sopracciglia o bocca.',
      'Eyes are relaxed, indicating low arousal.': 'Gli occhi sono rilassati, indicando bassa attivazione.',
      'Face is partially occluded by a cap.': 'Il viso è parzialmente coperto da un cappello.',
      'Facial expression is mostly neutral.': 'L\'espressione facciale è principalmente neutra.',
      'Mouth is slightly downturned.': 'La bocca è leggermente rivolta verso il basso.',
      'Lighting is uneven, affecting visibility of facial features.': 'L\'illuminazione è irregolare, influenzando la visibilità dei tratti facciali.',
      'Eyes appear tired or fatigued.': 'Gli occhi appaiono stanchi o affaticati.',
      'Slight tension detected in forehead.': 'Leggera tensione rilevata nella fronte.',
      'Relaxed facial muscles detected.': 'Muscoli facciali rilassati rilevati.',
      'Eyebrows are slightly raised.': 'Le sopracciglia sono leggermente sollevate.',
      'Signs of stress detected.': 'Segni di stress rilevati.',

      // Exact matches - Recommendations
      'Consider engaging in activities that promote positive emotions.': 'Considera di impegnarti in attività che promuovono emozioni positive.',
      'Monitor for any changes in emotional expression.': 'Monitora eventuali cambiamenti nell\'espressione emotiva.',
      'Take a few deep breaths to relax.': 'Fai qualche respiro profondo per rilassarti.',
      'Try a short meditation session.': 'Prova una breve sessione di meditazione.',
      'Consider a walk in nature.': 'Considera una passeggiata nella natura.',
      'Listen to calming music.': 'Ascolta musica rilassante.',
      'Practice gratitude journaling.': 'Pratica il diario della gratitudine.',
      'Get some fresh air.': 'Prendi un po\' d\'aria fresca.',
      'Take a break from screens.': 'Fai una pausa dagli schermi.',
      'Stay hydrated.': 'Mantieniti idratato.',
    };

    // Check exact match first
    if (translations[text]) return translations[text];

    // Pattern-based translations
    const lowerText = text.toLowerCase();
    let translated = text;

    // Common patterns
    const patterns: { pattern: RegExp; replacement: string }[] = [
      // AU (Action Unit) translations
      { pattern: /AU1\d?:/gi, replacement: (m) => m }, // Keep AU codes as-is for clarity
      { pattern: /lip corner puller/gi, replacement: 'sollevamento angolo labbra' },
      { pattern: /clear smile/gi, replacement: 'sorriso evidente' },
      { pattern: /cheek raiser/gi, replacement: 'sollevamento guance' },
      { pattern: /crow\'?s feet/gi, replacement: 'zampe di gallina' },
      { pattern: /inner brow raiser/gi, replacement: 'sollevamento sopracciglio interno' },
      { pattern: /outer brow raiser/gi, replacement: 'sollevamento sopracciglio esterno' },
      { pattern: /brow lowerer/gi, replacement: 'abbassamento sopracciglia' },
      { pattern: /upper lid raiser/gi, replacement: 'sollevamento palpebra superiore' },
      { pattern: /nose wrinkler/gi, replacement: 'arricciamento naso' },
      { pattern: /lip stretcher/gi, replacement: 'stiramento labbra' },
      { pattern: /lip corner depressor/gi, replacement: 'abbassamento angolo labbra' },
      { pattern: /chin raiser/gi, replacement: 'sollevamento mento' },
      { pattern: /lip pressor/gi, replacement: 'pressione labbra' },
      { pattern: /jaw drop/gi, replacement: 'apertura mandibola' },
      { pattern: /is present/gi, replacement: 'è presente' },
      { pattern: /is visible/gi, replacement: 'è visibile' },
      { pattern: /is detected/gi, replacement: 'è rilevato' },
      { pattern: /is slightly/gi, replacement: 'è leggermente' },
      { pattern: /slightly open/gi, replacement: 'leggermente aperta' },
      { pattern: /slightly squinted/gi, replacement: 'leggermente socchiusi' },
      { pattern: /indicating happiness/gi, replacement: 'indicando felicità' },
      { pattern: /indicating sadness/gi, replacement: 'indicando tristezza' },
      { pattern: /indicating surprise/gi, replacement: 'indicando sorpresa' },
      { pattern: /indicating anger/gi, replacement: 'indicando rabbia' },
      { pattern: /indicating fear/gi, replacement: 'indicando paura' },
      { pattern: /indicating disgust/gi, replacement: 'indicando disgusto' },
      { pattern: /appears positive/gi, replacement: 'appare positiva' },
      { pattern: /appears negative/gi, replacement: 'appare negativa' },
      { pattern: /Mouth is rilassato/gi, replacement: 'La bocca è rilassata' },
      { pattern: /Mouth is/gi, replacement: 'La bocca è' },
      { pattern: /Eyes are/gi, replacement: 'Gli occhi sono' },
      { pattern: /Overall/gi, replacement: 'Complessivamente' },
      { pattern: /l\'espressione facciale/gi, replacement: 'l\'espressione facciale' },

      // Original patterns
      { pattern: /face is partially occluded by/gi, replacement: 'il viso è parzialmente coperto da' },
      { pattern: /facial expression is mostly/gi, replacement: 'l\'espressione facciale è principalmente' },
      { pattern: /facial expression appears/gi, replacement: 'l\'espressione facciale appare' },
      { pattern: /mouth is slightly/gi, replacement: 'la bocca è leggermente' },
      { pattern: /lighting is uneven/gi, replacement: 'l\'illuminazione è irregolare' },
      { pattern: /affecting visibility of facial features/gi, replacement: 'influenzando la visibilità dei tratti facciali' },
      { pattern: /eyes are relaxed/gi, replacement: 'gli occhi sono rilassati' },
      { pattern: /eyes appear/gi, replacement: 'gli occhi appaiono' },
      { pattern: /indicating low arousal/gi, replacement: 'indicando bassa attivazione' },
      { pattern: /indicating high arousal/gi, replacement: 'indicando alta attivazione' },
      { pattern: /no strong emotional cues/gi, replacement: 'nessun segnale emotivo forte' },
      { pattern: /consider engaging in/gi, replacement: 'considera di impegnarti in' },
      { pattern: /activities that promote/gi, replacement: 'attività che promuovono' },
      { pattern: /positive emotions/gi, replacement: 'emozioni positive' },
      { pattern: /negative emotions/gi, replacement: 'emozioni negative' },
      { pattern: /neutral/gi, replacement: 'neutra' },
      { pattern: /stress/gi, replacement: 'stress' },
      { pattern: /relaxed/gi, replacement: 'rilassato' },
      { pattern: /tired/gi, replacement: 'stanco' },
      { pattern: /fatigued/gi, replacement: 'affaticato' },
      { pattern: /and/gi, replacement: 'e' },
    ];

    for (const { pattern, replacement } of patterns) {
      if (pattern.test(translated)) {
        translated = translated.replace(pattern, replacement);
      }
    }

    return translated;
  };

  // Helper to capitalize first letter
  const capitalizeFirst = (text: string): string => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Get Valence description based on value
  const getValenceDescription = (valence: number): string => {
    if (valence > 0.3) {
      return language === 'it'
        ? 'L\'espressione facciale suggerisce emozioni positive, con tratti che indicano piacevolezza e soddisfazione.'
        : 'Facial expression suggests positive emotions, with features indicating pleasantness and satisfaction.';
    } else if (valence < -0.3) {
      return language === 'it'
        ? 'L\'espressione facciale suggerisce emozioni negative, con tratti che indicano disagio o insoddisfazione.'
        : 'Facial expression suggests negative emotions, with features indicating discomfort or dissatisfaction.';
    }
    return language === 'it'
      ? 'L\'espressione facciale è neutra, senza chiari segnali di emozioni positive o negative.'
      : 'Facial expression is neutral, without clear signs of positive or negative emotions.';
  };

  // Get Arousal description based on value
  const getArousalDescription = (arousal: number): string => {
    if (arousal > 0.3) {
      return language === 'it'
        ? 'Livello di attivazione elevato, indicando energia e vigilanza nell\'espressione.'
        : 'High activation level, indicating energy and alertness in the expression.';
    } else if (arousal < -0.3) {
      return language === 'it'
        ? 'Livello di attivazione basso, suggerendo calma e rilassatezza.'
        : 'Low activation level, suggesting calmness and relaxation.';
    }
    return language === 'it'
      ? 'Livello di attivazione moderato, in uno stato di equilibrio tra calma ed energia.'
      : 'Moderate activation level, in a balanced state between calmness and energy.';
  };

  const getEmotionData = (emotion: string) => {
    const getTips = (emotionKey: string): string[] => {
      const tips = t(`analysis.emotion.results.tips.${emotionKey}`, { returnObjects: true });
      return Array.isArray(tips) ? tips : [];
    };

    const emotionData: { [key: string]: any } = {
      joy: {
        gradient: ['#fbbf24', '#f59e0b', '#f97316'],
        icon: 'emoticon-happy-outline',
        title: t('analysis.emotion.results.emotions.joy.title'),
        description: t('analysis.emotion.results.emotions.joy.description'),
        tips: getTips('joy'),
        wellnessScore: 85
      },
      sadness: {
        gradient: ['#3b82f6', '#1d4ed8', '#1e40af'],
        icon: 'emoticon-sad-outline',
        title: t('analysis.emotion.results.emotions.sadness.title'),
        description: t('analysis.emotion.results.emotions.sadness.description'),
        tips: getTips('sadness'),
        wellnessScore: 45
      },
      anger: {
        gradient: ['#ef4444', '#dc2626', '#b91c1c'],
        icon: 'emoticon-angry-outline',
        title: t('analysis.emotion.results.emotions.anger.title'),
        description: t('analysis.emotion.results.emotions.anger.description'),
        tips: getTips('anger'),
        wellnessScore: 30
      },
      fear: {
        gradient: ['#8b5cf6', '#7c3aed', '#6d28d9'],
        icon: 'emoticon-frown-outline', // Changed to valid icon
        title: t('analysis.emotion.results.emotions.fear.title'),
        description: t('analysis.emotion.results.emotions.fear.description'),
        tips: getTips('fear'),
        wellnessScore: 25
      },
      surprise: {
        gradient: ['#f59e0b', '#fbbf24', '#fde047'],
        icon: 'emoticon-outline', // Changed to valid icon
        title: t('analysis.emotion.results.emotions.surprise.title'),
        description: t('analysis.emotion.results.emotions.surprise.description'),
        tips: getTips('surprise'),
        wellnessScore: 60
      },
      disgust: {
        gradient: ['#84cc16', '#65a30d', '#4d7c0f'],
        icon: 'emoticon-poop-outline', // Changed to valid icon
        title: t('analysis.emotion.results.emotions.disgust.title'),
        description: t('analysis.emotion.results.emotions.disgust.description'),
        tips: getTips('disgust'),
        wellnessScore: 40
      },
      neutral: {
        gradient: ['#6b7280', '#4b5563', '#374151'],
        icon: 'emoticon-neutral-outline',
        title: t('analysis.emotion.results.emotions.neutral.title'),
        description: t('analysis.emotion.results.emotions.neutral.description'),
        tips: getTips('neutral'),
        wellnessScore: 70
      },
    };
    return emotionData[emotion] || emotionData.neutral;
  };

  const emotionData = getEmotionData(currentEmotion);
  const valence = fullAnalysisResult?.valence || 0;
  const arousal = fullAnalysisResult?.arousal || 0;

  const recommendationRules = useMemo(
    () => [
      {
        keywords: ['medit', 'respiro', 'respira', 'breath'],
        title: language === 'it' ? 'Reset di Respiro Guidato' : 'Guided Breathing Reset',
      },
      {
        keywords: ['passegg', 'cammin', 'walk', 'movement'],
        title: language === 'it' ? 'Mini Passeggiata Energizzante' : 'Mood Walk Booster',
      },
      {
        keywords: ['musica', 'sound', 'ascolt', 'music'],
        title: language === 'it' ? 'Pausa Musicale Calmante' : 'Calming Music Break',
      },
      {
        keywords: ['scrivi', 'journal', 'diario', 'gratitude', 'gratitudine'],
        title: language === 'it' ? 'Mini Sessione di Journaling' : 'Quick Journaling Ritual',
      },
      {
        keywords: ['stretch', 'allunga', 'yoga', 'postura'],
        title: language === 'it' ? 'Stretching di Rilascio' : 'Release Stretch',
      },
      {
        keywords: ['bere', 'acqua', 'idrata', 'drink'],
        title: language === 'it' ? 'Idratazione Mirata' : 'Hydration Reminder',
      },
      {
        keywords: ['sole', 'luce', 'sun', 'outdoor'],
        title: language === 'it' ? 'Dose di Luce Naturale' : 'Sunlight Boost',
      },
    ],
    [language],
  );

  const fallbackRecommendationTitles = useMemo(
    () =>
      language === 'it'
        ? ['Suggerimento Personalizzato', 'Momento di Benessere', 'Rituale Espresso']
        : ['Personalized Tip', 'Wellness Moment', 'Quick Ritual'],
    [language],
  );

  const getRecommendationTitle = useCallback((text: string, index: number) => {
    if (!text) {
      return fallbackRecommendationTitles[index % fallbackRecommendationTitles.length];
    }
    const lower = text.toLowerCase();
    const matchedRule = recommendationRules.find((rule) =>
      rule.keywords.some((keyword) => lower.includes(keyword)),
    );
    if (matchedRule) {
      return matchedRule.title;
    }
    return fallbackRecommendationTitles[index % fallbackRecommendationTitles.length];
  }, [fallbackRecommendationTitles, recommendationRules]);

  const wellnessRecommendationsTitle = useMemo(
    () => (language === 'it' ? 'CONSIGLI DI BENESSERE' : 'WELLNESS RECOMMENDATIONS'),
    [language],
  );

  // Generate actions from tips
  const actions = useMemo(() => {
    return emotionData.tips.map((tip, index) => ({
      id: `tip-${index}`,
      title: getRecommendationTitle(tip, index),
      description: tip,
      category: 'emotional',
      priority: index === 0 ? 'high' : 'medium',
      actionable: true,
      estimatedTime: '5 min',
    }));
  }, [emotionData.tips, getRecommendationTitle]);

  if (!currentEmotion) return null;

  // Get hero color from emotion gradient
  const heroColor = emotionData.gradient[0];

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        {/* 🆕 Dynamic wellness score: 70% valence + 30% arousal for balanced score */}
        <ResultHero
          title={emotionData.title}
          subtitle={language === 'it' ? 'Punteggio Benessere' : 'Wellness Score'}
          score={Math.round((((valence + 1) / 2) * 0.7 + ((arousal + 1) / 2) * 0.3) * 100)} // Both normalized: valence 70% + arousal 30%
          color={emotionData.gradient[0]}
          style={styles.hero}
        />

        <View style={styles.contentContainer}>
          {/* Metrics Grid */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
            {t('analysis.emotion.results.emotionalMetrics') || 'EMOTIONAL METRICS'}
          </Text>

          <View style={styles.metricsGrid}>
            {/* Valence */}
            <EnhancedMetricTile
              metric="valence"
              value={valence}
              label={t('analysis.emotion.metrics.valence') || 'Valence'}
              color={valence > 0 ? '#10b981' : '#ef4444'}
              icon={valence > 0 ? 'emoticon-happy-outline' : 'emoticon-sad-outline'}
              bucket={MetricsService.getEmotionBucket('valence', valence)}
              description={getValenceDescription(valence)}
              expanded={true}
            />

            {/* Arousal */}
            <EnhancedMetricTile
              metric="arousal"
              value={arousal}
              label={t('analysis.emotion.metrics.arousal') || 'Arousal'}
              color="#f59e0b"
              icon="lightning-bolt"
              bucket={MetricsService.getEmotionBucket('arousal', arousal)}
              description={getArousalDescription(arousal)}
              expanded={true}
            />
          </View>

          {/* AI Observations Section */}
          {(fullAnalysisResult?.analysis_description || (fullAnalysisResult?.observations && fullAnalysisResult.observations.length > 0)) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('analysis.emotion.results.aiObservations') || 'WHAT AI NOTICED'}
              </Text>
              <View style={[styles.observationsCard, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
                {/* Educational Description */}
                {fullAnalysisResult?.analysis_description && (
                  <View style={styles.descriptionContainer}>
                    <TouchableOpacity
                      onPress={() => {
                        // Import Alert dynamically or use global Alert
                        const { Alert } = require('react-native');
                        Alert.alert(
                          t('analysis.emotion.info.title') || 'AI Analysis',
                          t('analysis.emotion.info.description') || 'This analysis is based on facial cues detected by AI. It provides insights into your emotional state but is not a medical diagnosis.'
                        );
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="information-outline" size={22} color={colors.primary} style={{ marginTop: 2 }} />
                    </TouchableOpacity>
                    <Text style={[styles.descriptionText, { color: colors.text }]}>
                      {translateAIText(fullAnalysisResult.analysis_description)}
                    </Text>
                  </View>
                )}

                {/* Divider if both exist */}
                {fullAnalysisResult?.analysis_description && fullAnalysisResult?.observations?.length > 0 && (
                  <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />
                )}

                {/* Key Cues List - filtered to remove AU codes */}
                {fullAnalysisResult?.observations && filterObservations(fullAnalysisResult.observations).map((obs: string, index: number) => (
                  <View key={index} style={styles.observationItem}>
                    <View style={styles.bulletPoint} />
                    <Text style={[styles.observationText, { color: colors.text }]}>
                      {capitalizeFirst(translateAIText(obs))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Recommendations / Tips */}
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onComplete={() => { }}
              onDismiss={() => { }}
            />
          ))}

          {/* AI Recommendations Section - Using ActionCard format like Skin */}
          {fullAnalysisResult?.recommendations && fullAnalysisResult.recommendations.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
                {wellnessRecommendationsTitle}
              </Text>

              {fullAnalysisResult.recommendations.map((rec: string, index: number) => (
                <ActionCard
                  key={`ai-rec-${index}`}
                  action={{
                    id: `ai-recommendation-${index}`,
                    title: getRecommendationTitle(rec, index),
                    description: capitalizeFirst(rec),
                    category: 'emotional',
                    priority: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
                    actionable: true,
                    estimatedTime: '2 min',
                  }}
                  onComplete={() => { }}
                  onDismiss={() => { }}
                />
              ))}
            </>
          )}

          {/* 🆕 Contextual Questions Card */}
          {/* 🆕 Contextual Questions Card - Premium Design */}
          {!contextSubmitted && (
            <View style={[styles.contextCard, { backgroundColor: colors.surface, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }]}>
              <View style={styles.contextHeader}>
                <View style={[styles.contextIconBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Feather name="help-circle" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contextTitle, { color: colors.text }]}>
                    {language === 'it' ? 'Aiutaci a capire meglio' : 'Help us understand'}
                  </Text>
                  <Text style={[styles.contextSubtitle, { color: colors.textSecondary, marginBottom: 0 }]}>
                    {language === 'it'
                      ? 'Confrontiamo i tuoi risultati con il tuo contesto'
                      : 'We match your results with your context'}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 20, marginTop: 16 }}>
                {contextualQuestions.map((q) => (
                  <View key={q.id}>
                    <View style={styles.questionHeader}>
                      <Text style={[styles.questionText, { color: colors.text }]}>{q.question}</Text>
                    </View>
                    <View style={styles.optionsRow}>
                      {q.options.map((opt) => {
                        const isSelected = contextAnswers[q.id as keyof typeof contextAnswers] === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            activeOpacity={0.8}
                            style={[
                              styles.optionButton,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.surface,
                                borderColor: isSelected ? colors.primary : colors.border,
                                borderWidth: isSelected ? 0 : 1,
                              },
                              !isSelected && { backgroundColor: isDark ? '#1f2937' : '#f8fafc' } // Subtle background for unselected
                            ]}
                            onPress={() => setContextAnswers(prev => ({ ...prev, [q.id]: opt.value }))}
                          >
                            <Text
                              style={[
                                styles.optionText,
                                { color: isSelected ? '#fff' : colors.textSecondary },
                                isSelected && { fontWeight: '600' }
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>

              {Object.keys(contextAnswers).length >= 1 && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.saveContextButton, { marginTop: 24 }]} // Gradient handled in child or style
                  onPress={handleSaveContext}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primary + 'E6']} // Slight gradient
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 16, flexDirection: 'row', gap: 8 }}
                  >
                    <Text style={styles.saveContextText}>
                      {language === 'it' ? 'Salva Contesto' : 'Save Context'}
                    </Text>
                    <Feather name="arrow-right" size={16} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          {contextSubmitted && (
            <View style={[styles.contextCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <View style={styles.contextHeader}>
                <Feather name="check-circle" size={20} color={colors.primary} />
                <Text style={[styles.contextTitle, { color: colors.primary }]}>
                  {language === 'it' ? 'Grazie!' : 'Thanks!'}
                </Text>
              </View>
              <Text style={[styles.contextSubtitle, { color: colors.textSecondary }]}>
                {language === 'it'
                  ? 'Le tue risposte ci aiuteranno a fornirti insight migliori.'
                  : 'Your answers will help us provide better insights.'}
              </Text>
            </View>
          )}

          {/* Bottom spacer for FAB */}
          <View style={{ height: 140 }} />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)',
          },
        ]}
      >
        <View
          style={[
            styles.bottomBarInner,
            {
              backgroundColor: colors.background,
              borderColor: isDark ? 'rgba(148,163,184,0.25)' : 'rgba(15,23,42,0.08)',
            },
          ]}
        >
          <View style={styles.bottomBarContent}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }, isSaving && { opacity: 0.5 }]}
              onPress={onGoBack} // 🔥 Cambiato da onRetake a onGoBack
              disabled={isSaving}
            >
              <MaterialCommunityIcons name="close" size={18} color={colors.text} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {language === 'it' ? 'Chiudi' : 'Close'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, isSaving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <LinearGradient
                colors={emotionData.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      {language === 'it' ? 'Salva analisi' : 'Save analysis'}
                    </Text>
                    <MaterialCommunityIcons name="check" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  hero: {
    height: 300,
    width: '100%',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  contentContainer: {
    padding: 20,
    marginTop: -40, // Overlap with hero
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    opacity: 0.7,
    marginTop: 16,
  },
  metricsGrid: {
    gap: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
  },
  bottomBarInner: {
    borderRadius: 30,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  bottomBarContent: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    flex: 1,
    minWidth: 100,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  primaryButton: {
    flex: 2,
    minWidth: 150,
    height: 54,
    borderRadius: 27,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    flex: 1,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  section: {
    marginTop: 24,
  },
  observationsCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  observationItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366f1',
    marginTop: 7, // Center with text line height
  },
  observationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  descriptionContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  descriptionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 8,
  },
  recommendationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recommendationIcon: {
    marginTop: 2,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  // 🆕 Contextual Questions Styles (Premium)
  contextCard: {
    borderRadius: 24,
    padding: 20,
    marginTop: 24,
    borderWidth: 1, // Will be overridden to 0 in JSX for premium look
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  contextIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  contextSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  questionContainer: {
    marginBottom: 16,
  },
  questionHeader: {
    marginBottom: 10,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999, // Pill shape
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveContextButton: {
    height: 50,
    borderRadius: 16,
    marginTop: 8,
    overflow: 'hidden', // For gradient
  },
  saveContextText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default EmotionResultsScreen;
