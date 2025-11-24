// @ts-nocheck
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SkinCapture } from '../stores/analysis.store';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { ResultHero } from './ResultHero';
import { EnhancedScoreTile } from './EnhancedScoreTile';
import { IntelligentInsightsSection } from './IntelligentInsightsSection';
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
    const translations: { [key: string]: string } = {
      'visible redness': 'rossore visibile',
      'slight oiliness': 'leggera oleosità',
      'lighting is slightly uneven': 'l\'illuminazione è leggermente irregolare',
      'image is in focus': 'l\'immagine è a fuoco',
      'use gentle cleanser': 'usa un detergente delicato',
      'apply moisturizer': 'applica una crema idratante',
      'consider soothing products': 'considera prodotti lenitivi',
      'use sunscreen daily': 'usa la protezione solare quotidianamente',
      'slight redness': 'leggero rossore',
      'visible pores': 'pori visibili',
      'dark circles': 'occhiaie',
      'dry skin': 'pelle secca',
      'oily skin': 'pelle grassa',
    };
    const lowerText = text.toLowerCase();
    if (translations[lowerText]) return translations[lowerText];
    for (const [key, value] of Object.entries(translations)) {
      if (lowerText.includes(key)) {
        return text.replace(new RegExp(key, 'gi'), value);
      }
    }
    return text;
  };

  // Helper to capitalize first letter
  const capitalizeFirst = (text: string): string => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Prepare data for IntelligentInsightsSection
  const insightsData = useMemo(() => ({
    ...results,
    scores: { overall: overallScore, ...metrics },
    issues,
    recommendations,
    notes: fullAnalysisResult?.notes || [],
    confidence: fullAnalysisResult?.confidence || results?.confidence || 0.8,
  }), [results, overallScore, metrics, issues, recommendations, fullAnalysisResult]);

  // Generate actions from recommendations
  const actions = useMemo(() => {
    return recommendations.map((rec, index) => ({
      id: `rec-${index}`,
      title: t('analysis.skin.results.recommendation') || 'Skin Care Tip',
      description: translateAIText(rec),
      category: 'skin',
      priority: index === 0 ? 'high' : 'medium',
      actionable: true,
      estimatedTime: '2 min',
    }));
  }, [recommendations, language, t]);

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

  return (
    <LinearGradient
      colors={isDark ? ['#111827', '#1f2937'] : ['#f8fafc', '#e2e8f0']}
      style={styles.container}
    >
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
              color="#0ea5e9"
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
              color="#8b5cf6"
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

          {/* Intelligent Insights */}
          <IntelligentInsightsSection
            category="skin"
            data={insightsData}
            showTitle={true}
            maxInsights={2}
          />

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
      <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.bottomBar}>
        <View style={styles.bottomBarContent}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={onRetake}
          >
            <MaterialCommunityIcons name="camera-retake" size={20} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {t('analysis.skin.results.retake') || 'Retake'}
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
      </BlurView>
    </LinearGradient>
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
  },
  bottomBarContent: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 16,
  },
  secondaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
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
    fontSize: 16,
    fontWeight: '600',
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