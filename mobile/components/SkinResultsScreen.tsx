// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { SkinCapture } from '../stores/analysis.store';

interface SkinResultsScreenProps {
  results: SkinCapture | null;
  fullAnalysisResult?: any;
  onGoBack: () => void;
  onRetake: () => void;
}

export const SkinResultsScreen: React.FC<SkinResultsScreenProps> = ({
  results,
  fullAnalysisResult,
  onGoBack,
  onRetake,
}) => {
  if (!results) {
    return null;
  }

  const getOverallSkinScore = () => {
    if (fullAnalysisResult?.scores?.overall) {
      return fullAnalysisResult.scores.overall;
    }
    return 65; // Default fallback
  };

  const getSkinHealthLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: '#10b981', description: 'Your skin is in great condition!' };
    if (score >= 60) return { level: 'Good', color: '#3b82f6', description: 'Your skin is healthy with room for improvement.' };
    if (score >= 40) return { level: 'Fair', color: '#f59e0b', description: 'Your skin needs some attention and care.' };
    return { level: 'Needs Care', color: '#ef4444', description: 'Your skin requires focused skincare routine.' };
  };

  const overallScore = getOverallSkinScore();
  const healthLevel = getSkinHealthLevel(overallScore);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Skin Analysis Complete</Text>
          <Text style={styles.headerSubtitle}>Comprehensive AI-powered skin health assessment</Text>
        </View>

        {/* Main Skin Health Card */}
        <View style={styles.skinHealthCard}>
          <LinearGradient
            colors={[healthLevel.color, `${healthLevel.color}80`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.skinHealthGradient}
          >
            <View style={styles.skinHealthIconContainer}>
              <FontAwesome name="heart" size={48} color="#ffffff" />
            </View>
            <Text style={styles.skinHealthTitle}>{healthLevel.level} Skin Health</Text>
            <Text style={styles.skinHealthDescription}>{healthLevel.description}</Text>
            
            <View style={styles.skinMetricsRow}>
              <View style={styles.skinMetricItem}>
                <Text style={styles.skinMetricLabel}>Overall Score</Text>
                <Text style={styles.skinMetricValue}>{overallScore}/100</Text>
              </View>
              <View style={styles.skinMetricItem}>
                <Text style={styles.skinMetricLabel}>Health Level</Text>
                <Text style={styles.skinMetricValue}>{healthLevel.level}</Text>
              </View>
              <View style={styles.skinMetricItem}>
                <Text style={styles.skinMetricLabel}>Analysis</Text>
                <Text style={styles.skinMetricValue}>Complete</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Detailed Metrics Section */}
        <LinearGradient
          colors={['#f8fafc', '#ffffff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.metricsCard}
        >
          <Text style={styles.sectionTitle}>Detailed Skin Metrics</Text>
          <View style={styles.skinMetricsGrid}>
            {/* Hydration Metric */}
            <View style={styles.skinMetricCard}>
              <LinearGradient colors={['#ecfdf5', '#f0fdf4']} style={styles.skinMetricCardInner}>
                <View style={styles.metricCardHeader}>
                  <View style={[styles.metricIconContainer, { backgroundColor: '#10b98120' }]}>
                    <FontAwesome name="tint" size={20} color="#10b981" />
                  </View>
                  <View style={styles.metricInfo}>
                    <Text style={styles.metricName}>Hydration</Text>
                    <Text style={[styles.metricPercentage, { color: '#10b981' }]}>
                      {fullAnalysisResult?.scores?.hydration || 60}%
                    </Text>
                  </View>
                </View>
                <View style={styles.metricProgressContainer}>
                  <View style={styles.metricProgressTrack}>
                    <View style={[
                      styles.metricProgressFill,
                      { backgroundColor: '#10b981', width: `${fullAnalysisResult?.scores?.hydration || 60}%` }
                    ]} />
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Texture Metric */}
            <View style={styles.skinMetricCard}>
              <LinearGradient colors={['#fef3c7', '#fef7cd']} style={styles.skinMetricCardInner}>
                <View style={styles.metricCardHeader}>
                  <View style={[styles.metricIconContainer, { backgroundColor: '#f59e0b20' }]}>
                    <FontAwesome name="circle-o" size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.metricInfo}>
                    <Text style={styles.metricName}>Texture</Text>
                    <Text style={[styles.metricPercentage, { color: '#f59e0b' }]}>
                      {fullAnalysisResult?.scores?.texture || 70}%
                    </Text>
                  </View>
                </View>
                <View style={styles.metricProgressContainer}>
                  <View style={styles.metricProgressTrack}>
                    <View style={[
                      styles.metricProgressFill,
                      { backgroundColor: '#f59e0b', width: `${fullAnalysisResult?.scores?.texture || 70}%` }
                    ]} />
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Redness Metric */}
            <View style={styles.skinMetricCard}>
              <LinearGradient colors={['#fef2f2', '#fee2e2']} style={styles.skinMetricCardInner}>
                <View style={styles.metricCardHeader}>
                  <View style={[styles.metricIconContainer, { backgroundColor: '#ef444420' }]}>
                    <FontAwesome name="heart" size={20} color="#ef4444" />
                  </View>
                  <View style={styles.metricInfo}>
                    <Text style={styles.metricName}>Redness</Text>
                    <Text style={[styles.metricPercentage, { color: '#ef4444' }]}>
                      {fullAnalysisResult?.scores?.redness || 30}%
                    </Text>
                  </View>
                </View>
                <View style={styles.metricProgressContainer}>
                  <View style={styles.metricProgressTrack}>
                    <View style={[
                      styles.metricProgressFill,
                      { backgroundColor: '#ef4444', width: `${fullAnalysisResult?.scores?.redness || 30}%` }
                    ]} />
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Oiliness Metric */}
            <View style={styles.skinMetricCard}>
              <LinearGradient colors={['#fef2f2', '#fee2e2']} style={styles.skinMetricCardInner}>
                <View style={styles.metricCardHeader}>
                  <View style={[styles.metricIconContainer, { backgroundColor: '#ef444420' }]}>
                    <FontAwesome name="circle" size={20} color="#ef4444" />
                  </View>
                  <View style={styles.metricInfo}>
                    <Text style={styles.metricName}>Oiliness</Text>
                    <Text style={[styles.metricPercentage, { color: '#ef4444' }]}>
                      {fullAnalysisResult?.scores?.oiliness || 40}%
                    </Text>
                  </View>
                </View>
                <View style={styles.metricProgressContainer}>
                  <View style={styles.metricProgressTrack}>
                    <View style={[
                      styles.metricProgressFill,
                      { backgroundColor: '#ef4444', width: `${fullAnalysisResult?.scores?.oiliness || 40}%` }
                    ]} />
                  </View>
                </View>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>

        {/* Analysis Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Analysis Details</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="camera" size={16} color="#6366f1" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Image Analysis</Text>
              <Text style={styles.detailValue}>High-resolution skin texture and color analysis</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="cogs" size={16} color="#8b5cf6" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>AI Processing</Text>
              <Text style={styles.detailValue}>Advanced computer vision algorithms</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="clock-o" size={16} color="#10b981" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Analysis Time</Text>
              <Text style={styles.detailValue}>Real-time processing completed</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FontAwesome name="heart" size={16} color="#ef4444" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Skin Health</Text>
              <Text style={styles.detailValue}>Comprehensive wellness assessment</Text>
            </View>
          </View>
        </View>

        {/* Skin Issues */}
        {fullAnalysisResult?.issues && fullAnalysisResult.issues.length > 0 && (
          <View style={styles.issuesCard}>
            <View style={styles.issuesHeader}>
              <FontAwesome name="exclamation-triangle" size={20} color="#ef4444" />
              <Text style={styles.issuesTitle}>Detected Issues</Text>
            </View>
            <View style={styles.issuesList}>
              {fullAnalysisResult.issues.map((issue: string, index: number) => (
                <View key={index} style={styles.issueItem}>
                  <View style={styles.issueIcon}>
                    <FontAwesome name="warning" size={12} color="#ef4444" />
                  </View>
                  <Text style={styles.issueText}>{issue}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Analysis Notes */}
        {fullAnalysisResult?.notes && fullAnalysisResult.notes.length > 0 && (
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <FontAwesome name="info-circle" size={20} color="#3b82f6" />
              <Text style={styles.notesTitle}>Analysis Notes</Text>
            </View>
            <View style={styles.notesList}>
              {fullAnalysisResult.notes.map((note: string, index: number) => (
                <View key={index} style={styles.noteItem}>
                  <View style={styles.noteIcon}>
                    <FontAwesome name="info" size={12} color="#3b82f6" />
                  </View>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recommendations Section */}
        <LinearGradient
          colors={['#f8fafc', '#ffffff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.recommendationsCard}
        >
          <View style={styles.recommendationsHeader}>
            <FontAwesome name="lightbulb-o" size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Personalized Recommendations</Text>
          </View>
          <View style={styles.recommendationsList}>
            {(fullAnalysisResult?.recommendations || []).map((item: string, index: number) => (
              <View key={index} style={styles.recommendationItem}>
                <View style={styles.recommendationIcon}>
                  <FontAwesome name="check" size={12} color="#10b981" />
                </View>
                <Text style={styles.recommendationText}>{item}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Skincare Tips */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <FontAwesome name="star" size={20} color="#8b5cf6" />
            <Text style={styles.tipsTitle}>Daily Skincare Tips</Text>
          </View>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <View style={styles.tipIcon}>
                <FontAwesome name="sun-o" size={12} color="#f59e0b" />
              </View>
              <Text style={styles.tipText}>Always use SPF 30+ sunscreen, even on cloudy days</Text>
            </View>
            <View style={styles.tipItem}>
              <View style={styles.tipIcon}>
                <FontAwesome name="tint" size={12} color="#3b82f6" />
              </View>
              <Text style={styles.tipText}>Drink 8-10 glasses of water daily for optimal hydration</Text>
            </View>
            <View style={styles.tipItem}>
              <View style={styles.tipIcon}>
                <FontAwesome name="moon-o" size={12} color="#6366f1" />
              </View>
              <Text style={styles.tipText}>Get 7-9 hours of quality sleep for skin regeneration</Text>
            </View>
            <View style={styles.tipItem}>
              <View style={styles.tipIcon}>
                <FontAwesome name="leaf" size={12} color="#10b981" />
              </View>
              <Text style={styles.tipText}>Eat antioxidant-rich foods like berries and leafy greens</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.goBackButton} 
            onPress={onGoBack}
          >
            <FontAwesome name="arrow-left" size={16} color="#6366f1" />
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.retakeButton} 
            onPress={onRetake}
          >
            <FontAwesome name="refresh" size={16} color="#ffffff" />
            <Text style={styles.retakeButtonText}>Retake</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  skinHealthCard: {
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
  skinHealthGradient: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  skinHealthIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skinHealthTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  skinHealthDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  skinMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  skinMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  skinMetricLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 4,
  },
  skinMetricValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
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
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
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
  detailsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
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
    color: '#374151',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: '#6b7280',
  },
  issuesCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  issuesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  issuesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  issuesList: {
    gap: 12,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  issueIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  issueText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  notesCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  notesList: {
    gap: 12,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noteIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  noteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
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
    marginHorizontal: 20,
    marginBottom: 20,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
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
  tipsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
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
    color: '#1e293b',
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
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tipText: {
    fontSize: 14,
    color: '#374151',
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
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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

export default SkinResultsScreen;