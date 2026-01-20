// @ts-nocheck
import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  BackHandler,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SkinCapture } from '../stores/analysis.store';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';
import { ResultHero } from './ResultHero';
import { EnhancedScoreTile } from './EnhancedScoreTile';
import { ActionCard } from './ActionCard';
import { MetricsService } from '../services/metrics.service';

const { width } = Dimensions.get('window');

interface SkinResultsScreenProps {
  results: SkinCapture | null;
  fullAnalysisResult?: any;
  onGoBack: () => void;
  onRetake: () => void;
}

// Video URI per Skin Analysis
const heroVideoUri = require('../assets/videos/skin-analysis-video.mp4');

export const SkinResultsScreen: React.FC<SkinResultsScreenProps> = ({
  results,
  fullAnalysisResult,
  onGoBack,
  onRetake,
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets(); // 🔥 FIX: Per gestire bottom insets nelle bottom bars
  const { hideTabBar, showTabBar } = useTabBarVisibility();

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



  // Map data from backend - backend uses 'scores' not 'metrics'
  const overallScore = fullAnalysisResult?.scores?.overall || results?.scores?.overall || 65;
  const metrics = {
    hydration: fullAnalysisResult?.scores?.hydration || results?.scores?.hydration || 50,
    texture: fullAnalysisResult?.scores?.texture || results?.scores?.texture || 70,
    redness: fullAnalysisResult?.scores?.redness || results?.scores?.redness || 40,
    oiliness: fullAnalysisResult?.scores?.oiliness || results?.scores?.oiliness || 60,
  };

  const issues = fullAnalysisResult?.issues || [];
  const recommendations = fullAnalysisResult?.recommendations || [];

  // Helper for translation (keeping existing logic)
  const translateAIText = (text: string): string => {
    if (!text || language === 'en') return text;

    // Exact match translations
    const exactTranslations: { [key: string]: string } = {
      // Issues - exact matches
      'mild acne-like breakouts': 'Lievi eruzioni simili all\'acne',
      'post-shave redness': 'Rossore post-rasatura',
      'uneven texture': 'Texture irregolare',
      'oiliness': 'Oleosità',
      'visible redness': 'Rossore visibile',
      'slight oiliness': 'Leggera oleosità',
      'slight redness': 'Leggero rossore',
      'visible pores': 'Pori visibili',
      'dark circles': 'Occhiaie',
      'dry skin': 'Pelle secca',
      'oily skin': 'Pelle grassa',
      'acne': 'Acne',
      'wrinkles': 'Rughe',
      'fine lines': 'Linee sottili',
      'dullness': 'Opacità',
      'uneven skin tone': 'Tono della pelle irregolare',
      'dehydration': 'Disidratazione',
      'enlarged pores': 'Pori dilatati',
      'blackheads': 'Punti neri',
      'whiteheads': 'Punti bianchi',
      'sun damage': 'Danni solari',
      'hyperpigmentation': 'Iperpigmentazione',

      // Notes/observations
      'lighting is slightly uneven': 'L\'illuminazione è leggermente irregolare',
      'image is in focus': 'L\'immagine è a fuoco',
      'face is partially covered': 'Il viso è parzialmente coperto',
      'lighting may affect skin appearance': 'L\'illuminazione potrebbe influenzare l\'aspetto della pelle',
      'shadows may hide some imperfections': 'Le ombre possono nascondere alcune imperfezioni',

      // Recommendations
      'use gentle cleanser': 'Usa un detergente delicato',
      'apply moisturizer': 'Applica una crema idratante',
      'consider soothing products': 'Considera prodotti lenitivi',
      'use sunscreen daily': 'Usa la protezione solare quotidianamente',
      'drink more water': 'Bevi più acqua',
      'get enough sleep': 'Dormi a sufficienza',
      'avoid touching your face': 'Evita di toccarti il viso',
      'use a toner': 'Usa un tonico',
      'exfoliate regularly': 'Esfolia regolarmente',
      'use retinol': 'Usa retinolo',
      'apply vitamin c serum': 'Applica siero alla vitamina C',
    };

    const lowerText = text.toLowerCase();

    // Check exact match first
    if (exactTranslations[lowerText]) {
      return exactTranslations[lowerText];
    }

    // Try partial matches
    let translatedText = text;
    for (const [key, value] of Object.entries(exactTranslations)) {
      if (lowerText.includes(key)) {
        translatedText = translatedText.replace(new RegExp(key, 'gi'), value);
      }
    }

    return translatedText;
  };

  // Helper to capitalize first letter
  const capitalizeFirst = (text: string): string => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Generate actions from recommendations
  const actions = useMemo(() => {
    return recommendations.map((rec, index) => ({
      id: `rec-${index}`,
      title: language === 'it' ? 'Raccomandazione Cura Pelle' : 'Skin Care Recommendation',
      description: capitalizeFirst(translateAIText(rec)),
      category: 'skin',
      priority: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      actionable: true,
      estimatedTime: '2 min',
    }));
  }, [recommendations, language]);

  // Generate actions from issues (as alerts)
  const issueActions = useMemo(() => {
    return issues.map((issue, index) => ({
      id: `issue-${index}`,
      title: t('analysis.skin.results.detectedIssue') || 'Detected Issue',
      description: translateAIText(issue),
      category: 'skin',
      priority: 'high',
      actionable: false, // Just informational
      icon: 'alert-circle-outline',
      color: '#ef4444'
    }));
  }, [issues, language, t]);

  if (!results) return null;

  // Determine hero color based on overall score
  const heroColor = overallScore > 70 ? '#10b981' : overallScore > 40 ? '#f59e0b' : '#ef4444';

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
        <ResultHero
          title={language === 'it' ? 'Punteggio Salute Pelle' : 'Skin Health Score'}
          subtitle={overallScore >= 70
            ? (language === 'it' ? 'Buone Condizioni' : 'Good Condition')
            : overallScore >= 40
              ? (language === 'it' ? 'Condizioni Discrete' : 'Fair Condition')
              : (language === 'it' ? 'Richiede Attenzione' : 'Needs Attention')}
          score={overallScore}
          color={overallScore > 70 ? '#10b981' : overallScore > 40 ? '#f59e0b' : '#ef4444'}
          style={styles.hero}
        />

        <View style={styles.contentContainer}>
          {/* Metrics Grid */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
            {language === 'it' ? 'METRICHE DETTAGLIATE' : 'DETAILED METRICS'}
          </Text>

          <View style={styles.metricsGrid}>
            {/* Hydration */}
            <EnhancedScoreTile
              metric="hydration"
              value={metrics.hydration}
              label={language === 'it' ? 'Idratazione' : 'Hydration'}
              color="#22d3ee"
              icon="water-percent"
              bucket={MetricsService.getSkinBucket('hydration', metrics.hydration)}
              expanded={true}
            />

            {/* Texture */}
            <EnhancedScoreTile
              metric="texture"
              value={metrics.texture}
              label={language === 'it' ? 'Texture' : 'Texture'}
              color="#f59e0b"
              icon="texture"
              bucket={MetricsService.getSkinBucket('texture', metrics.texture)}
            />

            {/* Redness */}
            <EnhancedScoreTile
              metric="redness"
              value={metrics.redness}
              label={language === 'it' ? 'Rossore' : 'Redness'}
              color="#ef4444"
              icon="heart-pulse"
              bucket={MetricsService.getSkinBucket('redness', metrics.redness)}
            />

            {/* Oiliness */}
            <EnhancedScoreTile
              metric="oiliness"
              value={metrics.oiliness}
              label={language === 'it' ? 'Oleosità' : 'Oiliness'}
              color="#f59e0b"
              icon="oil"
              bucket={MetricsService.getSkinBucket('oiliness', metrics.oiliness)}
            />
          </View>

          {/* AI Observations / Issues Section */}
          {(fullAnalysisResult?.analysis_description || issueActions.length > 0 || (fullAnalysisResult?.notes && fullAnalysisResult.notes.length > 0)) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'it' ? 'OSSERVAZIONI AI' : 'AI OBSERVATIONS'}
              </Text>
              <View style={[styles.observationsCard, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
                {/* Educational Description */}
                {fullAnalysisResult?.analysis_description && (
                  <View style={styles.descriptionContainer}>
                    <TouchableOpacity
                      onPress={() => {
                        const { Alert } = require('react-native');
                        Alert.alert(
                          t('analysis.skin.info.title') || 'AI Skin Analysis',
                          t('analysis.skin.info.description') || 'This analysis uses AI to assess skin features like hydration and texture. It is for wellness purposes only and not a medical diagnosis.'
                        );
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="information-outline" size={22} color={colors.primary} style={{ marginTop: 2 }} />
                    </TouchableOpacity>
                    <Text style={[styles.descriptionText, { color: colors.text }]}>
                      {capitalizeFirst(translateAIText(fullAnalysisResult.analysis_description))}
                    </Text>
                  </View>
                )}

                {/* Divider if description exists and there are other items */}
                {fullAnalysisResult?.analysis_description && (issueActions.length > 0 || fullAnalysisResult?.notes?.length > 0) && (
                  <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />
                )}

                {/* Issues List */}
                {issueActions.map((action) => (
                  <View key={action.id} style={styles.observationItem}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ef4444" style={{ opacity: 0.9 }} />
                    <Text style={[styles.observationText, { color: colors.text }]}>
                      {capitalizeFirst(action.description)}
                    </Text>
                  </View>
                ))}

                {/* Notes List */}
                {fullAnalysisResult?.notes && fullAnalysisResult.notes.map((note: string, index: number) => (
                  <View key={`note-${index}`} style={styles.observationItem}>
                    <MaterialCommunityIcons name="eye-outline" size={18} color={colors.text} style={{ opacity: 0.7 }} />
                    <Text style={[styles.observationText, { color: colors.text }]}>
                      {capitalizeFirst(translateAIText(note))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Recommendations Section */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
            {language === 'it' ? 'RACCOMANDAZIONI PERSONALIZZATE' : 'PERSONALIZED RECOMMENDATIONS'}
          </Text>

          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onComplete={() => { }}
              onDismiss={() => { }}
            />
          ))}

          {/* Bottom spacer for FAB */}
          <View style={{ height: 120 }} />
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
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={onRetake}
            >
              <MaterialCommunityIcons name="camera-retake" size={18} color={colors.text} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {language === 'it' ? 'Ripeti' : 'Retake'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={onGoBack}>
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Text style={styles.primaryButtonText}>
                  {t('common.done') || 'Done'}
                </Text>
                <MaterialCommunityIcons name="check" size={20} color="#fff" />
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
  section: {
    marginTop: 16,
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
});

export default SkinResultsScreen;