import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

interface NutritionRecommendationCardProps {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  index: number;
}

export const NutritionRecommendationCard: React.FC<NutritionRecommendationCardProps> = ({
  title,
  description,
  priority,
  index,
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const { t } = useTranslation();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return t('analysis.food.recommendations.priority.high') || 'ALTA';
      case 'medium': return t('analysis.food.recommendations.priority.medium') || 'MEDIA';
      case 'low': return t('analysis.food.recommendations.priority.low') || 'BASSA';
      default: return priority.toUpperCase();
    }
  };

  const getCategoryIcon = () => {
    return 'food-apple';
  };

  const priorityColor = getPriorityColor(priority);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: priorityColor + '30' }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)' }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.categoryIcon, { backgroundColor: priorityColor + '20' }]}>
            <MaterialCommunityIcons
              name={getCategoryIcon() as any}
              size={20}
              color={priorityColor}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '20' }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {getPriorityLabel(priority)}
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={styles.descriptionSection}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  descriptionSection: {
    padding: 16,
    paddingTop: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
});



