import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

interface RecommendationDetailModalProps {
  visible: boolean;
  onClose: () => void;
  recommendation: {
    id: string;
    priority: 'high' | 'medium' | 'low';
    category: 'nutrition' | 'movement' | 'recovery' | 'mindfulness' | 'energy';
    action: string;
    reason: string;
    icon: string;
    estimatedTime?: string;
    detailedExplanation?: string;
    correlations?: string[];
    expectedBenefits?: string[];
  } | null;
}

const RecommendationDetailModal: React.FC<RecommendationDetailModalProps> = ({
  visible,
  onClose,
  recommendation,
}) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const { colors: themeColors } = useTheme();
  if (!recommendation) return null;

  // Animation styles
  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 300 }),
    };
  });

  const popupStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 300 }),
      transform: [
        { scale: withTiming(visible ? 1 : 0.9, { duration: 300 }) }
      ],
    };
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityEmoji = (priority: string) => {
    switch (priority) {
      case 'high': return '🚨'; // Urgente/Importante
      case 'medium': return '⚠️'; // Attenzione
      case 'low': return '✅'; // Tutto ok/Opzionale
      default: return '💡';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'nutrition': return '#f59e0b';
      case 'movement': return '#10b981';
      case 'recovery': return '#3b82f6';
      case 'mindfulness': return '#8b5cf6';
      case 'energy': return '#f97316';
      default: return '#6b7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'nutrition': return 'food-apple';
      case 'movement': return 'run';
      case 'recovery': return 'bed';
      case 'mindfulness': return 'meditation';
      case 'energy': return 'lightning-bolt';
      default: return 'heart';
    }
  };

  const priorityColor = getPriorityColor(recommendation.priority);
  const categoryColor = getCategoryColor(recommendation.category);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity 
          style={styles.backdropTouchable} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View style={[styles.popupContainer, popupStyle, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <LinearGradient
            colors={[categoryColor, categoryColor + 'CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.titleContainer}>
                <Text style={styles.emoji}>{recommendation.icon}</Text>
                <View style={styles.titleTextContainer}>
                  <Text style={styles.title}>{t('popups.recommendation.title')}</Text>
                  <Text style={styles.subtitle}>{t('popups.recommendation.subtitle')}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Action Card */}
            <View style={[
              styles.actionCard, 
              { 
                borderLeftColor: priorityColor,
                backgroundColor: themeColors.surfaceElevated,
                borderColor: themeColors.border,
              }
            ]}>
              <View style={styles.actionHeader}>
                <Text style={styles.actionIcon}>{recommendation.icon}</Text>
                <View style={[
                  styles.priorityBadge,
                  { backgroundColor: priorityColor + '20' }
                ]}>
                  <Text style={[styles.priorityText, { color: priorityColor }]}>
                    {getPriorityEmoji(recommendation.priority)}
                  </Text>
                </View>
              </View>
              
              <Text style={[styles.actionText, { color: themeColors.text }]}>{recommendation.action}</Text>
              <Text style={[styles.reasonText, { color: themeColors.textSecondary }]}>{recommendation.reason}</Text>
              
              <View style={styles.actionFooter}>
                <View style={styles.categoryBadge}>
                  <MaterialCommunityIcons 
                    name={getCategoryIcon(recommendation.category) as any} 
                    size={16} 
                    color={categoryColor} 
                  />
                  <Text style={[styles.categoryText, { color: categoryColor }]}>
                    {recommendation.category}
                  </Text>
                </View>
                {recommendation.estimatedTime && (
                  <Text style={[styles.timeText, { color: themeColors.textTertiary }]}>{recommendation.estimatedTime}</Text>
                )}
              </View>
            </View>

            {/* Detailed Explanation */}
            {recommendation.detailedExplanation && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="brain" size={20} color={themeColors.primary} />
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t('popups.recommendation.scientificExplanation')}</Text>
                </View>
                <Text style={[
                  styles.explanationText,
                  {
                    color: themeColors.text,
                    backgroundColor: themeColors.surfaceElevated,
                    borderLeftColor: themeColors.primary,
                  }
                ]}>
                  {recommendation.detailedExplanation}
                </Text>
              </View>
            )}

            {/* Correlations */}
            {recommendation.correlations && recommendation.correlations.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="chart-line" size={20} color={themeColors.success} />
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t('popups.recommendation.correlations')}</Text>
                </View>
                {recommendation.correlations.map((correlation, index) => (
                  <View key={index} style={styles.correlationItem}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={themeColors.success} />
                    <Text style={[styles.correlationText, { color: themeColors.text }]}>{correlation}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Expected Benefits */}
            {recommendation.expectedBenefits && recommendation.expectedBenefits.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="trending-up" size={20} color={themeColors.warning} />
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t('popups.recommendation.expectedBenefits')}</Text>
                </View>
                {recommendation.expectedBenefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <MaterialCommunityIcons name="star" size={16} color={themeColors.warning} />
                    <Text style={[styles.benefitText, { color: themeColors.text }]}>{benefit}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popupContainer: {
    width: width * 0.95,
    height: height * 0.85,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
    // Background gestito inline con themeColors.surface
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 32,
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  actionCard: {
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    marginBottom: 20,
    // Background e border gestiti inline con themeColors
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionIcon: {
    fontSize: 32,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
    // Colore gestito inline con themeColors.text
  },
  reasonText: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
    // Colore gestito inline con themeColors.textSecondary
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    // Colore gestito inline con themeColors.text
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 24,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    // Colori gestiti inline con themeColors
  },
  correlationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  correlationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    // Colore gestito inline con themeColors.text
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    // Colore gestito inline con themeColors.text
  },
});

export default RecommendationDetailModal;
export { RecommendationDetailModal };
