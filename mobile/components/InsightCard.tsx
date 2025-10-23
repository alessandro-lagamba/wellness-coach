import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { InsightData } from '../services/insight.service';

const { width } = Dimensions.get('window');

interface InsightCardProps {
  insight: InsightData;
  onActionPress?: (insight: InsightData) => void;
  onDismiss?: (insightId: string) => void;
  compact?: boolean;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  onActionPress,
  onDismiss,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityGradient = (priority: string) => {
    switch (priority) {
      case 'critical': return ['#fef2f2', '#fee2e2'];
      case 'high': return ['#fff7ed', '#fed7aa'];
      case 'medium': return ['#eff6ff', '#dbeafe'];
      case 'low': return ['#f0fdf4', '#dcfce7'];
      default: return ['#f9fafb', '#f3f4f6'];
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'trend': return 'trending-up';
      case 'pattern': return 'chart-line';
      case 'correlation': return 'link';
      case 'recommendation': return 'lightbulb';
      case 'achievement': return 'trophy';
      default: return 'information';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'emotion': return 'emoticon-happy';
      case 'health': return 'heart-pulse';
      case 'wellness': return 'leaf';
      case 'productivity': return 'chart-bar';
      default: return 'information';
    }
  };

  const handleActionPress = () => {
    if (onActionPress) {
      onActionPress(insight);
    } else {
      // Default action handling
      switch (insight.action?.type) {
        case 'start_activity':
          Alert.alert(
            'Start Activity',
            `Would you like to start ${insight.action.label}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Start', onPress: () => console.log('Starting activity:', insight.action?.target) }
            ]
          );
          break;
        case 'set_reminder':
          Alert.alert(
            'Set Reminder',
            `Would you like to set a reminder for ${insight.action.label}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Set', onPress: () => console.log('Setting reminder:', insight.action?.target) }
            ]
          );
          break;
        case 'view_details':
          Alert.alert(
            'View Details',
            `Viewing details for ${insight.title}`,
            [{ text: 'OK' }]
          );
          break;
        case 'navigate':
          Alert.alert(
            'Navigate',
            `Navigating to ${insight.action.label}`,
            [{ text: 'OK' }]
          );
          break;
        default:
          Alert.alert('Insight', insight.description);
      }
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss(insight.id);
    }
  };

  if (isDismissed) return null;

  const priorityColor = getPriorityColor(insight.priority);
  const priorityGradient = getPriorityGradient(insight.priority);

  return (
    <Animated.View style={[styles.container, compact && styles.compactContainer]}>
      <LinearGradient
        colors={priorityGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, compact && styles.compactCard]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.typeIcon, { backgroundColor: `${priorityColor}20` }]}>
              <MaterialCommunityIcons
                name={getTypeIcon(insight.type)}
                size={16}
                color={priorityColor}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, compact && styles.compactTitle]}>
                {insight.title}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}20` }]}>
                  <Text style={[styles.priorityText, { color: priorityColor }]}>
                    {insight.priority.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {insight.confidence}% confidence
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <FontAwesome name="times" size={12} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Description */}
        <Text style={[styles.description, compact && styles.compactDescription]}>
          {insight.description}
        </Text>

        {/* Data Visualization */}
        {insight.data && (
          <View style={styles.dataSection}>
            {insight.data.trend && (
              <View style={styles.trendIndicator}>
                <MaterialCommunityIcons
                  name={insight.data.trend === 'up' ? 'trending-up' : 
                        insight.data.trend === 'down' ? 'trending-down' : 'trending-neutral'}
                  size={16}
                  color={insight.data.trend === 'up' ? '#10b981' : 
                         insight.data.trend === 'down' ? '#ef4444' : '#6b7280'}
                />
                <Text style={styles.trendText}>
                  {insight.data.trend === 'up' ? '↗' : 
                   insight.data.trend === 'down' ? '↘' : '→'} 
                  {insight.data.change ? ` ${Math.abs(insight.data.change)}%` : ''}
                </Text>
              </View>
            )}
            
            {insight.data.correlation && (
              <View style={styles.correlationIndicator}>
                <Text style={styles.correlationText}>
                  Correlation: {insight.data.correlation > 0 ? '+' : ''}{Math.round(insight.data.correlation * 100)}%
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action Button */}
        {insight.actionable && insight.action && (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: priorityColor }]}
            onPress={handleActionPress}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={insight.action.icon}
              size={16}
              color={priorityColor}
            />
            <Text style={[styles.actionText, { color: priorityColor }]}>
              {insight.action.label}
            </Text>
          </TouchableOpacity>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <MaterialCommunityIcons
              name={getCategoryIcon(insight.category)}
              size={12}
              color="#6b7280"
            />
            <Text style={styles.categoryText}>
              {insight.category.charAt(0).toUpperCase() + insight.category.slice(1)}
            </Text>
          </View>
          <Text style={styles.timestampText}>
            {insight.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  compactContainer: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  compactCard: {
    padding: 12,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
    lineHeight: 20,
  },
  compactTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  confidenceBadge: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  compactDescription: {
    fontSize: 13,
    marginBottom: 8,
  },
  dataSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  correlationIndicator: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  correlationText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  timestampText: {
    fontSize: 11,
    color: '#9ca3af',
  },
});

