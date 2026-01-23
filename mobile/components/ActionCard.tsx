import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionInfo } from '../services/actions.service';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { ActionTrackerService } from '../services/action-tracker.service';
import wellnessActivitiesService, {
  WellnessActivityInput,
} from '../services/wellness-activities.service';
import { TimePickerModal } from './TimePickerModal';

interface ActionCardProps {
  action: ActionInfo;
  onComplete?: (action: ActionInfo) => void;
  compact?: boolean;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  onComplete,
  compact = false,
}) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const { colors, mode } = useTheme();
  const { language } = useTranslation();
  const isDark = mode === 'dark';
  const labels = {
    addButton: language === 'it' ? 'Aggiungi' : 'Add',
    addedTitle: language === 'it' ? 'Attività aggiunta' : 'Added to routine',
    addedMessage:
      language === 'it'
        ? 'Troverai questa attività nella sezione "Cosa fare oggi" di oggi.'
        : 'You will find this activity in today’s “What to do today” section.',
    addErrorTitle: language === 'it' ? 'Non aggiunta' : 'Unable to add',
    addErrorMessage:
      language === 'it'
        ? 'Non sono riuscito ad aggiungere questa attività. Riprova più tardi.'
        : 'We couldn’t add this activity right now. Please try again later.',
    snooze: language === 'it' ? 'Rimanda' : 'Snooze',
    dismiss: language === 'it' ? 'Non ora' : 'Not now',
    removeTitle: language === 'it' ? 'Rimuovi Azione' : 'Remove action',
    removeMessage: language === 'it'
      ? 'Sei sicuro di voler rimuovere questa azione?'
      : 'Are you sure you want to remove this action?',
    snoozeTitle: language === 'it' ? 'Rimanda Azione' : 'Snooze action',
    snoozeMessage: language === 'it'
      ? 'Quando vuoi essere ricordato di questa azione?'
      : 'When should I remind you about this action?',
    snoozeHour: language === 'it' ? 'Tra 1 ora' : 'In 1 hour',
    snoozeFour: language === 'it' ? 'Tra 4 ore' : 'In 4 hours',
    snoozeDay: language === 'it' ? 'Domani' : 'Tomorrow',
    cancel: language === 'it' ? 'Annulla' : 'Cancel',
    snoozed: language === 'it'
      ? 'Ti ricorderò più tardi di questa attività.'
      : 'I’ll remind you about this action later.',
    dismissed: language === 'it'
      ? 'Ok, non te lo mostrerò più per ora.'
      : 'Okay, I won’t show this again for now.',
  };

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
      case 'skincare':
      case 'skin':
        return 'face-woman';
      case 'lifestyle':
      case 'movement':
        return 'run';
      case 'medical':
        return 'medical-bag';
      case 'nutrition':
        return 'food-apple';
      case 'emotional':
      case 'mindfulness':
        return 'brain';
      case 'recovery':
        return 'heart-pulse';
      default:
        return 'lightbulb';
    }
  };

  const getPriorityLabel = (priority: string) => {
    if (language === 'it') {
      switch (priority) {
        case 'urgent':
          return 'URGENTE';
        case 'high':
          return 'ALTA';
        case 'medium':
          return 'MEDIA';
        case 'low':
          return 'BASSA';
        default:
          return priority.toUpperCase();
      }
    }
    return priority.toUpperCase();
  };

  const mapCategoryToWellness = (
    category: ActionInfo['category'],
  ): WellnessActivityInput['category'] => {
    switch (category) {
      case 'nutrition':
        return 'nutrition';
      case 'lifestyle':
      case 'movement':
        return 'movement';
      case 'skincare':
      case 'skin':
      case 'medical':
      case 'recovery':
        return 'recovery';
      default:
        return 'mindfulness';
    }
  };

  const buildActivityInput = (): WellnessActivityInput => {
    const scheduledTime = new Date();
    const minutesMatch = action.estimatedTime?.match(/(\d+)/);
    if (minutesMatch) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + Number(minutesMatch[1]));
    }

    return {
      title: action.title,
      description:
        action.description ||
        (language === 'it'
          ? 'Suggerimento personalizzato dal risultato dell’analisi.'
          : 'Personalized suggestion from your analysis result.'),
      category: mapCategoryToWellness(action.category),
      scheduledTime,
    };
  };

  const animateRemoval = () => {
    setIsCompleted(true);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onComplete?.(action);
    });
  };

  const handleAddPress = () => {
    setShowTimePicker(true);
  };

  const handleConfirmTime = async (selectedTime: Date) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const activityInput = {
        ...buildActivityInput(),
        scheduledTime: selectedTime,
      };
      const result = await wellnessActivitiesService.saveActivity(activityInput);

      if (!result.success) {
        Alert.alert(labels.addErrorTitle, labels.addErrorMessage);
        setIsProcessing(false);
        return;
      }

      await ActionTrackerService.logAction(action, 'added');
      Alert.alert(labels.addedTitle, labels.addedMessage);
      animateRemoval();
    } catch (error) {
      console.error('[ActionCard] failed to add activity:', error);
      Alert.alert(labels.addErrorTitle, labels.addErrorMessage);
    } finally {
      setIsProcessing(false);
      setShowTimePicker(false);
    }
  };


  if (isCompleted || isDismissed) {
    return null;
  }

  if (compact) {
    return (
      <Animated.View style={[styles.compactContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={[styles.compactCard, { borderLeftColor: getPriorityColor(action.priority) }]}
          onPress={handleAddPress}
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
            <Text style={styles.compactTime} allowFontScaling={false}>{action.estimatedTime}</Text>
            <MaterialCommunityIcons name="check" size={16} color={getPriorityColor(action.priority)} />
          </View>
        </TouchableOpacity>
        <TimePickerModal
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onConfirm={handleConfirmTime}
          title={action.title}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.card, { borderColor: getPriorityColor(action.priority) + '30', backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)',
              borderBottomWidth: action.description ? StyleSheet.hairlineWidth : 0,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.categoryIcon, { backgroundColor: getPriorityColor(action.priority) + '20' }]}>
              <MaterialCommunityIcons
                name={getCategoryIcon(action.category) as any}
                size={20}
                color={getPriorityColor(action.priority)}
              />
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.title, { color: colors.text }]}>{action.title}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(action.priority) + '20' }]}>
              <Text style={[styles.priorityText, { color: getPriorityColor(action.priority) }]} allowFontScaling={false}>
                {getPriorityLabel(action.priority)}
              </Text>
            </View>
            {action.estimatedTime && (
              <Text style={styles.timeText} allowFontScaling={false}>⏱️ {action.estimatedTime}</Text>
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
            <Text style={styles.resourcesLabel} allowFontScaling={false}>Cosa ti serve:</Text>
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
            style={[
              styles.completeButton,
              {
                backgroundColor: getPriorityColor(action.priority),
                opacity: isProcessing ? 0.7 : 1,
              },
            ]}
            onPress={handleAddPress}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <MaterialCommunityIcons name="calendar-plus" size={16} color="#ffffff" />
                <Text style={styles.completeButtonText} allowFontScaling={false}>{labels.addButton}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <TimePickerModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onConfirm={handleConfirmTime}
        title={action.title}
      />
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
  title: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold', // Was 600
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
    fontFamily: 'Figtree_700Bold', // Was 700
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Figtree_500Medium',
  },
  descriptionSection: {
    padding: 16,
    paddingTop: 0,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontFamily: 'Figtree_500Medium',
  },
  resourcesSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  resourcesLabel: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold', // Was 600
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
    fontFamily: 'Figtree_500Medium',
  },
  actionsSection: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 8,
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 44,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Figtree_700Bold', // Was 600
    marginLeft: 6,
    textAlign: 'center',
    flexShrink: 1,
  },
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    minHeight: 44,
    flexShrink: 1,
  },
  snoozeButtonText: {
    color: '#6b7280',
    fontSize: 13,
    fontFamily: 'Figtree_500Medium', // Was 500
    marginLeft: 6,
    flexShrink: 1,
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    minHeight: 44,
    flexShrink: 1,
  },
  dismissButtonText: {
    color: '#6b7280',
    fontSize: 13,
    fontFamily: 'Figtree_500Medium', // Was 500
    marginLeft: 6,
    flexShrink: 1,
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
    fontFamily: 'Figtree_500Medium', // Was 500
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
    fontFamily: 'Figtree_500Medium',
  },
});
