// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { EmotionSession } from '../stores/analysis.store';
import { useTheme } from '../contexts/ThemeContext';

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
  const getEmotionData = (emotion: string) => {
    const emotionData: { [key: string]: any } = {
      joy: {
        color: '#10b981',
        icon: 'smile-o',
        title: 'Joyful',
        description: 'You\'re radiating positive energy!',
        advice: "Great! Your positive mood is wonderful. Consider sharing this joy with others or engaging in activities that amplify this feeling.",
        tips: ['Share your happiness with friends', 'Engage in creative activities', 'Practice gratitude', 'Help someone else feel good'],
        intensity: 'High Positivity',
        wellnessScore: 85
      },
      sadness: {
        color: '#3b82f6',
        icon: 'frown-o',
        title: 'Melancholy',
        description: 'It\'s okay to feel this way sometimes.',
        advice: "It's okay to feel sad sometimes. Try gentle activities like listening to music, talking to a friend, or taking a peaceful walk.",
        tips: ['Listen to calming music', 'Talk to a trusted friend', 'Take a peaceful walk', 'Practice self-compassion'],
        intensity: 'Gentle Emotion',
        wellnessScore: 45
      },
      anger: {
        color: '#ef4444',
        icon: 'fire',
        title: 'Frustrated',
        description: 'Anger is a natural response to challenges.',
        advice: "Anger is a natural emotion. Try deep breathing exercises, counting to ten, or engaging in physical activity to release tension.",
        tips: ['Practice deep breathing', 'Count to ten slowly', 'Engage in physical activity', 'Express feelings constructively'],
        intensity: 'High Energy',
        wellnessScore: 30
      },
      fear: {
        color: '#8b5cf6',
        icon: 'exclamation-triangle',
        title: 'Concerned',
        description: 'Fear can be overwhelming but manageable.',
        advice: "Fear can be overwhelming. Practice grounding techniques like focusing on your breathing or identifying things you can control.",
        tips: ['Practice grounding techniques', 'Focus on your breathing', 'Identify what you can control', 'Seek support if needed'],
        intensity: 'High Alert',
        wellnessScore: 25
      },
      surprise: {
        color: '#f59e0b',
        icon: 'star',
        title: 'Surprised',
        description: 'Something unexpected has caught your attention.',
        advice: "Surprise can be exciting or unsettling. Take a moment to process what happened and decide how you'd like to respond.",
        tips: ['Take time to process', 'Stay open to new experiences', 'Embrace the unexpected', 'Learn from the situation'],
        intensity: 'Moderate Alert',
        wellnessScore: 60
      },
      disgust: {
        color: '#84cc16',
        icon: 'thumbs-down',
        title: 'Displeased',
        description: 'Something doesn\'t align with your values.',
        advice: "Disgust often signals something doesn't align with your values. Consider what's causing this feeling and how to address it.",
        tips: ['Reflect on your values', 'Address the source if possible', 'Practice acceptance', 'Focus on positive alternatives'],
        intensity: 'Moderate Discomfort',
        wellnessScore: 40
      },
      neutral: {
        color: '#6b7280',
        icon: 'meh-o',
        title: 'Balanced',
        description: 'You\'re in a calm, centered state.',
        advice: "A neutral mood is perfectly fine. This calm state is ideal for reflection or engaging in routine activities mindfully.",
        tips: ['Practice mindfulness', 'Engage in routine activities', 'Use this calm for reflection', 'Maintain this balance'],
        intensity: 'Calm State',
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Emotion Analysis Complete</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Here's what we detected about your emotional state</Text>
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
                <Text style={styles.metricLabel}>Valence</Text>
                <Text style={styles.metricValue}>{fullAnalysisResult?.valence ? Math.round(fullAnalysisResult.valence * 100) : 0}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Arousal</Text>
                <Text style={styles.metricValue}>{fullAnalysisResult?.arousal ? Math.round(fullAnalysisResult.arousal * 100) : 0}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Wellness</Text>
                <Text style={styles.metricValue}>{emotionData.wellnessScore}/100</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Wellness Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.tipsHeader}>
            <FontAwesome name="lightbulb-o" size={20} color="#f59e0b" />
            <Text style={[styles.tipsTitle, { color: colors.text }]}>Wellness Tips</Text>
          </View>
          <View style={styles.tipsList}>
            {emotionData.tips.map((tip: string, index: number) => (
              <View key={index} style={styles.tipItem}>
                <View style={styles.tipIcon}>
                  <FontAwesome name="check" size={12} color="#10b981" />
                </View>
                <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Analysis Details */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>Analysis Details</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="eye" size={16} color="#6366f1" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.text }]}>Facial Expression</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>Micro-expressions and muscle movements analyzed</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="cogs" size={16} color="#8b5cf6" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.text }]}>AI Processing</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>Advanced neural network emotion recognition</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="clock-o" size={16} color="#10b981" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.text }]}>Analysis Time</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>Real-time processing completed</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="heart" size={16} color="#ef4444" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.text }]}>Emotional State</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>Current mood and emotional intensity</Text>
            </View>
          </View>
        </View>

        {/* Observations */}
        {fullAnalysisResult?.observations && fullAnalysisResult.observations.length > 0 && (
          <View style={[styles.observationsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.observationsHeader}>
              <FontAwesome name="search" size={20} color="#3b82f6" />
              <Text style={[styles.observationsTitle, { color: colors.text }]}>AI Observations</Text>
            </View>
            <View style={styles.observationsList}>
              {fullAnalysisResult.observations.map((observation: string, index: number) => (
                <View key={index} style={styles.observationItem}>
                  <View style={styles.observationIcon}>
                    <FontAwesome name="check" size={12} color="#3b82f6" />
                  </View>
                  <Text style={[styles.observationText, { color: colors.text }]}>{observation}</Text>
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
              <Text style={[styles.recommendationsTitle, { color: colors.text }]}>AI Recommendations</Text>
            </View>
            <View style={styles.recommendationsList}>
              {fullAnalysisResult.recommendations.map((recommendation: string, index: number) => (
                <View key={index} style={styles.recommendationItem}>
                  <View style={styles.recommendationIcon}>
                    <FontAwesome name="arrow-right" size={12} color="#f59e0b" />
                  </View>
                  <Text style={[styles.recommendationText, { color: colors.text }]}>{recommendation}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Wellness Advice */}
        <View style={[styles.adviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.adviceHeader}>
            <FontAwesome name="heart" size={20} color="#ef4444" />
            <Text style={[styles.adviceTitle, { color: colors.text }]}>Wellness Guidance</Text>
          </View>
          <Text style={[styles.adviceText, { color: colors.textSecondary }]}>
            {fullAnalysisResult?.recommendations && fullAnalysisResult.recommendations.length > 0 
              ? fullAnalysisResult.recommendations.join('. ') + '.'
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
            <Text style={[styles.goBackButtonText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.retakeButton, { backgroundColor: colors.primary }]} 
            onPress={onRetake}
          >
            <FontAwesome name="refresh" size={16} color="#ffffff" />
            <Text style={styles.retakeButtonText}>Retake</Text>
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
