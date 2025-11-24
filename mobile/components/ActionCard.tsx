import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionInfo } from '../services/actions.service';
import { useTheme } from '../contexts/ThemeContext';

interface ActionCardProps {
  action: ActionInfo;
  onComplete?: (action: ActionInfo) => void;
  onDismiss?: (action: ActionInfo) => void;
  onSnooze?: (action: ActionInfo) => void;
  showSnooze?: boolean;
  compact?: boolean;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  onComplete,
  onDismiss,
  onSnooze,
  showSnooze = true,
  compact = false,
}) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'skincare': return 'face-woman';
      case 'lifestyle': return 'heart';
      case 'medical': return 'medical-bag';
      case 'emotional': return 'brain';
      default: return 'lightbulb';
    }
  };

  const handleComplete = () => {
    setIsCompleted(true);

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onComplete?.(action);
    });
  };

  const handleDismiss = () => {
    Alert.alert(
      'Rimuovi Azione',
      'Sei sicuro di voler rimuovere questa azione?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: () => {
            setIsDismissed(true);
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              onDismiss?.(action);
            });
          }
        }
      ]
    );
  };

  const handleSnooze = () => {
    Alert.alert(
      'Rimanda Azione',
      'Quando vuoi essere ricordato di questa azione?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Tra 1 ora', onPress: () => onSnooze?.({ ...action, snoozeUntil: new Date(Date.now() + 60 * 60 * 1000) }) },
        { text: 'Tra 4 ore', onPress: () => onSnooze?.({ ...action, snoozeUntil: new Date(Date.now() + 4 * 60 * 60 * 1000) }) },
        { text: 'Domani', onPress: () => onSnooze?.({ ...action, snoozeUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) }) },
      ]
    );
  };

  if (isCompleted || isDismissed) {
    return null;
  }

  if (compact) {
    return (
      <Animated.View style={[styles.compactContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={[styles.compactCard, { borderLeftColor: getPriorityColor(action.priority) }]}
          onPress={handleComplete}
        >
          <View style={styles.compactLeft}>
            <MaterialCommunityIcons
              name={getCategoryIcon(action.category) as any}
              size={16}
              color={getPriorityColor(action.priority)}
            />
            <Text style={styles.compactTitle} numberOfLines={1}>
              {action.title}
            </Text>
          </View>
          <View style={styles.compactRight}>
            <Text style={styles.compactTime}>{action.estimatedTime}</Text>
            <MaterialCommunityIcons name="check" size={16} color={getPriorityColor(action.priority)} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.card, { borderColor: getPriorityColor(action.priority) + '30', backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.categoryIcon, { backgroundColor: getPriorityColor(action.priority) + '20' }]}>
              <MaterialCommunityIcons
                name={getCategoryIcon(action.category) as any}
                size={20}
                color={getPriorityColor(action.priority)}
              />
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.category, { color: isDark ? colors.textSecondary : '#6b7280' }]}>{action.category.toUpperCase()}</Text>
              <Text style={[styles.title, { color: colors.text }]}>{action.title}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(action.priority) + '20' }]}>
              <Text style={[styles.priorityText, { color: getPriorityColor(action.priority) }]}>
                {action.priority.toUpperCase()}
              </Text>
            </View>
            {action.estimatedTime && (
              <Text style={styles.timeText}>⏱️ {action.estimatedTime}</Text>
            )}
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={[styles.description, { color: colors.text }]}>{action.description}</Text>
        </View>

        {/* Resources */}
        {action.resources && action.resources.length > 0 && (
          <View style={styles.resourcesSection}>
            <Text style={styles.resourcesLabel}>Cosa ti serve:</Text>
            <View style={styles.resourcesList}>
              {action.resources.map((resource, index) => (
                <View key={index} style={styles.resourceItem}>
                  <MaterialCommunityIcons name="check" size={14} color="#10b981" />
                  <Text style={styles.resourceText}>{resource}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: getPriorityColor(action.priority) }]}
            onPress={handleComplete}
          >
            <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
            <Text style={styles.completeButtonText}>Completato</Text>
          </TouchableOpacity>

          {showSnooze && (
            <TouchableOpacity
              style={styles.snoozeButton}
              onPress={handleSnooze}
            >
              <MaterialCommunityIcons name="clock-outline" size={16} color="#6b7280" />
              <Text style={styles.snoozeButtonText}>Rimanda</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
          >
            <MaterialCommunityIcons name="close" size={16} color="#6b7280" />
            <Text style={styles.dismissButtonText}>Non ora</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  category: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  descriptionSection: {
    padding: 16,
    paddingTop: 0,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  resourcesSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  resourcesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  resourcesList: {
    gap: 6,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  actionsSection: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  snoozeButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dismissButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  // Compact styles
  compactContainer: {
    marginVertical: 2,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactTime: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 8,
  },
});
