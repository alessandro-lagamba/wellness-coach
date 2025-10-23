import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { IntelligentInsight } from '../services/intelligent-insight.service';

const { width } = Dimensions.get('window');

interface IntelligentInsightCardProps {
  insight: IntelligentInsight;
  onPress?: (insight: IntelligentInsight) => void;
  onActionPress?: (insight: IntelligentInsight, action: 'start' | 'remind' | 'track') => void;
  compact?: boolean;
}

export const IntelligentInsightCard: React.FC<IntelligentInsightCardProps> = ({
  insight,
  onPress,
  onActionPress,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case 'routine': return 'play-circle';
      case 'reminder': return 'bell';
      case 'tracking': return 'chart-line';
      default: return 'lightbulb';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'emotion': return 'brain';
      case 'skin': return 'face-woman-shimmer';
      default: return 'lightbulb';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'emotion': return '#8b5cf6';
      case 'skin': return '#22d3ee';
      default: return '#6b7280';
    }
  };

  const handleActionPress = async (action: 'start' | 'remind' | 'track') => {
    setActionLoading(action);
    try {
      await onActionPress?.(insight, action);
    } finally {
      setActionLoading(null);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(expanded ? 1.02 : 1, {
          damping: 15,
          stiffness: 150,
        }),
      },
    ],
  }));

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, { borderLeftColor: getPriorityColor(insight.priority) }]}
        onPress={() => onPress?.(insight)}
        activeOpacity={0.7}
      >
        <View style={styles.compactHeader}>
          <View style={styles.compactIconContainer}>
            <MaterialCommunityIcons 
              name={getCategoryIcon(insight.category) as any} 
              size={16} 
              color={getCategoryColor(insight.category)} 
            />
          </View>
          <View style={[
            styles.priorityBadge,
            { backgroundColor: getPriorityColor(insight.priority) + '20' }
          ]}>
            <Text style={[
              styles.priorityText,
              { color: getPriorityColor(insight.priority) }
            ]}>
              {insight.priority.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <Text style={styles.compactTitle} numberOfLines={2}>
          {insight.title}
        </Text>
        
        <Text style={styles.compactDescription} numberOfLines={2}>
          {insight.description}
        </Text>
        
        <View style={styles.compactFooter}>
          <View style={styles.actionTypeContainer}>
            <MaterialCommunityIcons 
              name={getActionTypeIcon(insight.actionType) as any} 
              size={14} 
              color={getCategoryColor(insight.category)} 
            />
            <Text style={[
              styles.actionTypeText,
              { color: getCategoryColor(insight.category) }
            ]}>
              {insight.actionType}
            </Text>
          </View>
          {insight.estimatedTime && (
            <Text style={styles.timeText}>{insight.estimatedTime}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <TouchableOpacity
        style={[styles.cardContent, { borderLeftColor: getPriorityColor(insight.priority) }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name={getCategoryIcon(insight.category) as any} 
                size={20} 
                color={getCategoryColor(insight.category)} 
              />
            </View>
            <View style={styles.titleTextContainer}>
              <Text style={styles.title}>{insight.title}</Text>
              <Text style={styles.description}>{insight.description}</Text>
            </View>
          </View>
          
          <View style={[
            styles.priorityBadge,
            { backgroundColor: getPriorityColor(insight.priority) + '20' }
          ]}>
            <Text style={[
              styles.priorityText,
              { color: getPriorityColor(insight.priority) }
            ]}>
              {insight.priority.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.metaContainer}>
          <View style={styles.actionTypeContainer}>
            <MaterialCommunityIcons 
              name={getActionTypeIcon(insight.actionType) as any} 
              size={16} 
              color={getCategoryColor(insight.category)} 
            />
            <Text style={[
              styles.actionTypeText,
              { color: getCategoryColor(insight.category) }
            ]}>
              {insight.actionType}
            </Text>
          </View>
          
          {insight.estimatedTime && (
            <Text style={styles.timeText}>{insight.estimatedTime}</Text>
          )}
        </View>

        {expanded && (
          <View style={styles.expandedContent}>
            {insight.detailedExplanation && (
              <View style={styles.detailedSection}>
                <Text style={styles.detailedTitle}>Spiegazione</Text>
                <Text style={styles.detailedText}>{insight.detailedExplanation}</Text>
              </View>
            )}

            {insight.correlations && insight.correlations.length > 0 && (
              <View style={styles.correlationsSection}>
                <Text style={styles.correlationsTitle}>Correlazioni</Text>
                {insight.correlations.map((correlation, index) => (
                  <View key={index} style={styles.correlationItem}>
                    <MaterialCommunityIcons name="link" size={14} color="#6b7280" />
                    <Text style={styles.correlationText}>{correlation}</Text>
                  </View>
                ))}
              </View>
            )}

            {insight.expectedBenefits && insight.expectedBenefits.length > 0 && (
              <View style={styles.benefitsSection}>
                <Text style={styles.benefitsTitle}>Benefici Attesi</Text>
                {insight.expectedBenefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <MaterialCommunityIcons name="check-circle" size={14} color="#10b981" />
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: getCategoryColor(insight.category) }]}
                onPress={() => handleActionPress('start')}
                disabled={actionLoading === 'start'}
              >
                {actionLoading === 'start' ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <MaterialCommunityIcons name="play" size={16} color="#ffffff" />
                )}
                <Text style={styles.actionButtonText}>Inizia</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryActionButton]}
                onPress={() => handleActionPress('remind')}
                disabled={actionLoading === 'remind'}
              >
                {actionLoading === 'remind' ? (
                  <ActivityIndicator size="small" color={getCategoryColor(insight.category)} />
                ) : (
                  <MaterialCommunityIcons name="bell" size={16} color={getCategoryColor(insight.category)} />
                )}
                <Text style={[styles.actionButtonText, { color: getCategoryColor(insight.category) }]}>
                  Promemoria
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryActionButton]}
                onPress={() => handleActionPress('track')}
                disabled={actionLoading === 'track'}
              >
                {actionLoading === 'track' ? (
                  <ActivityIndicator size="small" color={getCategoryColor(insight.category)} />
                ) : (
                  <MaterialCommunityIcons name="chart-line" size={16} color={getCategoryColor(insight.category)} />
                )}
                <Text style={[styles.actionButtonText, { color: getCategoryColor(insight.category) }]}>
                  Traccia
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    lineHeight: 20,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 18,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTypeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  detailedSection: {
    marginBottom: 16,
  },
  detailedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  detailedText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  correlationsSection: {
    marginBottom: 16,
  },
  correlationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  correlationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  correlationText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  benefitsSection: {
    marginBottom: 16,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  benefitText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  secondaryActionButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Compact styles
  compactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
    lineHeight: 18,
  },
  compactDescription: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 8,
  },
  compactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default IntelligentInsightCard;

