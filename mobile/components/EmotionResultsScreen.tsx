// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { EmotionSession } from '../stores/analysis.store';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

interface EmotionResultsScreenProps {
  currentEmotion: string | null;
  confidence: number;
  fullAnalysisResult?: any;
  onGoBack: () => void;
  onRetake: () => void;
}

export const EmotionResultsScreen: React.FC<EmotionResultsScreenProps> = ({
  currentEmotion,
  confidence,
  fullAnalysisResult,
  onGoBack,
  onRetake,
}) => {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  
  // Helper function to translate AI-generated observations/recommendations if they're in English
  const translateAIText = (text: string): string => {
    if (!text || language === 'en') return text;
    
    // Common AI-generated phrases that need translation
    const translations: { [key: string]: string } = {
      'Facial expression appears neutral.': 'L\'espressione facciale appare neutra.',
      'No strong emotional cues from eyebrows or mouth.': 'Nessun segnale emotivo forte da sopracciglia o bocca.',
      'Eyes are relaxed, indicating low arousal.': 'Gli occhi sono rilassati, indicando bassa attivazione.',
      'Consider engaging in activities that promote positive emotions.': 'Considera di impegnarti in attività che promuovono emozioni positive.',
      'Monitor for any changes in emotional expression.': 'Monitora eventuali cambiamenti nell\'espressione emotiva.',
    };
    
    // Check if exact match exists
    if (translations[text]) {
      return translations[text];
    }
    
    // Return original text if no translation found
    return text;
  };
  
  const getEmotionData = (emotion: string) => {
    // Helper function per ottenere tips con fallback sicuro
    const getTips = (emotionKey: string): string[] => {
      const tips = t(`analysis.emotion.results.tips.${emotionKey}`, { returnObjects: true });
      return Array.isArray(tips) ? tips : [];
    };

    const emotionData: { [key: string]: any } = {
      joy: {
        color: '#10b981',
        icon: 'smile-o',
        title: t('analysis.emotion.results.emotions.joy.title'),
        description: t('analysis.emotion.results.emotions.joy.description'),
        advice: t('analysis.emotion.results.emotions.joy.advice'),
        tips: getTips('joy'),
        intensity: t('analysis.emotion.results.emotions.joy.intensity'),
        wellnessScore: 85
      },
      sadness: {
        color: '#3b82f6',
        icon: 'frown-o',
        title: t('analysis.emotion.results.emotions.sadness.title'),
        description: t('analysis.emotion.results.emotions.sadness.description'),
        advice: t('analysis.emotion.results.emotions.sadness.advice'),
        tips: getTips('sadness'),
        intensity: t('analysis.emotion.results.emotions.sadness.intensity'),
        wellnessScore: 45
      },
      anger: {
        color: '#ef4444',
        icon: 'fire',
        title: t('analysis.emotion.results.emotions.anger.title'),
        description: t('analysis.emotion.results.emotions.anger.description'),
        advice: t('analysis.emotion.results.emotions.anger.advice'),
        tips: getTips('anger'),
        intensity: t('analysis.emotion.results.emotions.anger.intensity'),
        wellnessScore: 30
      },
      fear: {
        color: '#8b5cf6',
        icon: 'exclamation-triangle',
        title: t('analysis.emotion.results.emotions.fear.title'),
        description: t('analysis.emotion.results.emotions.fear.description'),
        advice: t('analysis.emotion.results.emotions.fear.advice'),
        tips: getTips('fear'),
        intensity: t('analysis.emotion.results.emotions.fear.intensity'),
        wellnessScore: 25
      },
      surprise: {
        color: '#f59e0b',
        icon: 'star',
        title: t('analysis.emotion.results.emotions.surprise.title'),
        description: t('analysis.emotion.results.emotions.surprise.description'),
        advice: t('analysis.emotion.results.emotions.surprise.advice'),
        tips: getTips('surprise'),
        intensity: t('analysis.emotion.results.emotions.surprise.intensity'),
        wellnessScore: 60
      },
      disgust: {
        color: '#84cc16',
        icon: 'thumbs-down',
        title: t('analysis.emotion.results.emotions.disgust.title'),
        description: t('analysis.emotion.results.emotions.disgust.description'),
        advice: t('analysis.emotion.results.emotions.disgust.advice'),
        tips: getTips('disgust'),
        intensity: t('analysis.emotion.results.emotions.disgust.intensity'),
        wellnessScore: 40
      },
      neutral: {
        color: '#6b7280',
        icon: 'meh-o',
        title: t('analysis.emotion.results.emotions.neutral.title'),
        description: t('analysis.emotion.results.emotions.neutral.description'),
        advice: t('analysis.emotion.results.emotions.neutral.advice'),
        tips: getTips('neutral'),
        intensity: t('analysis.emotion.results.emotions.neutral.intensity'),
        wellnessScore: 70
      },
    };
    return emotionData[emotion] || emotionData.neutral;
  };

  if (!currentEmotion) {
    return null;
  }

  const emotionData = getEmotionData(currentEmotion);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analysis.emotion.results.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{t('analysis.emotion.results.subtitle')}</Text>
        </View>

        {/* Main Emotion Card */}
        <View style={styles.emotionCard}>
          <LinearGradient
            colors={[emotionData.color, `${emotionData.color}80`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emotionGradient}
          >
            <View style={styles.emotionIconContainer}>
              <FontAwesome 
                name={emotionData.icon} 
                size={48} 
                color="#ffffff" 
              />
            </View>
            <Text style={styles.emotionText}>{emotionData.title}</Text>
            <Text style={styles.emotionDescription}>{emotionData.description}</Text>
            
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('analysis.emotion.metrics.valence')}</Text>
                <Text style={styles.metricValue}>{fullAnalysisResult?.valence ? Math.round(fullAnalysisResult.valence * 100) : 0}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('analysis.emotion.metrics.arousal')}</Text>
                <Text style={styles.metricValue}>{fullAnalysisResult?.arousal ? Math.round(fullAnalysisResult.arousal * 100) : 0}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('analysis.emotion.results.wellness')}</Text>
                <Text style={styles.metricValue}>{emotionData.wellnessScore}/100</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Wellness Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.tipsHeader}>
            <FontAwesome name="lightbulb-o" size={20} color="#f59e0b" />
            <Text style={[styles.tipsTitle, { color: colors.text }]}>{t('analysis.emotion.results.wellnessTips')}</Text>
          </View>
          <View style={styles.tipsList}>
            {Array.isArray(emotionData.tips) && emotionData.tips.length > 0 ? (
              emotionData.tips.map((tip: string, index: number) => (
                <View key={index} style={styles.tipItem}>
                  <View style={styles.tipIcon}>
                    <FontAwesome name="check" size={12} color="#10b981" />
                  </View>
                  <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                {t('analysis.emotion.results.noTips') || 'Nessun consiglio disponibile al momento'}
              </Text>
            )}
          </View>
        </View>

        {/* Analysis Details */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>{t('analysis.emotion.results.analysisDetails')}</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="eye" size={16} color="#6366f1" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.text }]}>{t('analysis.emotion.results.facialExpression')}</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{t('analysis.emotion.results.facialExpressionDesc')}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="cogs" size={16} color="#8b5cf6" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.text }]}>{t('analysis.emotion.results.aiProcessing')}</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{t('analysis.emotion.results.aiProcessingDesc')}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="clock-o" size={16} color="#10b981" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.text }]}>{t('analysis.emotion.results.analysisTime')}</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{t('analysis.emotion.results.analysisTimeDesc')}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="heart" size={16} color="#ef4444" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.text }]}>{t('analysis.emotion.results.emotionalState')}</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{t('analysis.emotion.results.emotionalStateDesc')}</Text>
            </View>
          </View>
        </View>

        {/* Observations */}
        {fullAnalysisResult?.observations && fullAnalysisResult.observations.length > 0 && (
          <View style={[styles.observationsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.observationsHeader}>
              <FontAwesome name="search" size={20} color="#3b82f6" />
              <Text style={[styles.observationsTitle, { color: colors.text }]}>{t('analysis.emotion.results.aiObservations')}</Text>
            </View>
            <View style={styles.observationsList}>
              {fullAnalysisResult.observations.map((observation: string, index: number) => (
                <View key={index} style={styles.observationItem}>
                  <View style={styles.observationIcon}>
                    <FontAwesome name="check" size={12} color="#3b82f6" />
                  </View>
                  <Text style={[styles.observationText, { color: colors.text }]}>{translateAIText(observation)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recommendations */}
        {fullAnalysisResult?.recommendations && fullAnalysisResult.recommendations.length > 0 && (
          <View style={[styles.recommendationsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.recommendationsHeader}>
              <FontAwesome name="lightbulb-o" size={20} color="#f59e0b" />
              <Text style={[styles.recommendationsTitle, { color: colors.text }]}>{t('analysis.emotion.results.aiRecommendations')}</Text>
            </View>
            <View style={styles.recommendationsList}>
              {fullAnalysisResult.recommendations.map((recommendation: string, index: number) => (
                <View key={index} style={styles.recommendationItem}>
                  <View style={styles.recommendationIcon}>
                    <FontAwesome name="arrow-right" size={12} color="#f59e0b" />
                  </View>
                  <Text style={[styles.recommendationText, { color: colors.text }]}>{translateAIText(recommendation)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Wellness Advice */}
        <View style={[styles.adviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.adviceHeader}>
            <FontAwesome name="heart" size={20} color="#ef4444" />
            <Text style={[styles.adviceTitle, { color: colors.text }]}>{t('analysis.emotion.results.wellnessGuidance')}</Text>
          </View>
          <Text style={[styles.adviceText, { color: colors.textSecondary }]}>
            {fullAnalysisResult?.recommendations && fullAnalysisResult.recommendations.length > 0 
              ? fullAnalysisResult.recommendations.map(translateAIText).join('. ') + '.'
              : emotionData.advice
            }
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.goBackButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} 
            onPress={onGoBack}
          >
            <FontAwesome name="arrow-left" size={16} color={colors.primary} />
            <Text style={[styles.goBackButtonText, { color: colors.primary }]}>{t('analysis.emotion.results.goBack')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.retakeButton, { backgroundColor: colors.primary }]} 
            onPress={onRetake}
          >
            <FontAwesome name="refresh" size={16} color="#ffffff" />
            <Text style={styles.retakeButtonText}>{t('analysis.emotion.results.retake')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  emotionCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  emotionGradient: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  emotionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  emotionDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
  },
  detailsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
  },
  tipsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  adviceCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  adviceTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  adviceText: {
    fontSize: 14,
    lineHeight: 20,
  },
  observationsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  observationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  observationsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  observationsList: {
    gap: 12,
  },
  observationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  observationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  observationText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  recommendationsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: '600',
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
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 12,
  },
  goBackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  goBackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    gap: 8,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default EmotionResultsScreen;
