import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BucketInfo, TrendInfo } from '../services/metrics.service';
import { ActionInfo } from '../services/actions.service';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

interface EnhancedMetricTileProps {
  metric: string;
  value: number;
  label: string;
  color: string;
  icon: string;
  bucket?: BucketInfo;
  trend?: TrendInfo;
  action?: ActionInfo;
  onActionPress?: () => void;
  onExpandPress?: () => void;
  expanded?: boolean;
  description?: string; // NEW: For Valence/Arousal explanations
  unit?: string; // 🔥 NEW: Unit to display (e.g., 'g', 'kcal')
}

export const EnhancedMetricTile: React.FC<EnhancedMetricTileProps> = ({
  metric,
  value,
  label,
  color,
  icon,
  bucket,
  trend,
  action,
  onActionPress,
  onExpandPress,
  expanded = false,
  description, // NEW
  unit, // 🔥 NEW
}) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const isDark = mode === 'dark';
  const [isExpanded, setIsExpanded] = useState(expanded);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  const handleExpandPress = () => {
    setIsExpanded(!isExpanded);
    onExpandPress?.();
  };

  const getTrendColor = (trend?: TrendInfo) => {
    if (!trend) return '#6b7280';
    switch (trend.trend) {
      case '↑': return '#10b981';
      case '↓': return '#ef4444';
      case '→': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatValue = (value: number) => {
    if (value === undefined || value === null) return '--';

    // 🆕 Valence: normalize from [-1, 1] to [0, 100]
    if (metric === 'valence') {
      const normalized = Math.round(((value + 1) / 2) * 100);
      return String(normalized);
    }

    // 🆕 Arousal: normalize from [-1, 1] to [0, 100] (same as valence)
    if (metric === 'arousal') {
      const normalized = Math.round(((value + 1) / 2) * 100);
      return String(normalized);
    }

    // 🔥 FIX: Append unit if provided
    const formatted = value.toFixed(0);
    return unit ? `${formatted}${unit}` : formatted;
  };

  // Translate bucket label
  const getTranslatedBucketLabel = (label: string): string => {
    // 🔥 NEW: Check if it's already a full key
    if (label.includes('.')) return t(label);

    const labelLower = label.toLowerCase();
    if (labelLower.includes('negative')) return t('analysis.emotion.metrics.buckets.negative') || label;
    if (labelLower.includes('neutral')) return t('analysis.emotion.metrics.buckets.neutral') || label;
    if (labelLower.includes('positive')) {
      if (labelLower.includes('very')) return t('analysis.emotion.metrics.buckets.veryPositive') || label;
      return t('analysis.emotion.metrics.buckets.positive') || label;
    }
    if (labelLower.includes('low')) {
      if (labelLower.includes('very')) return t('analysis.emotion.metrics.buckets.veryLow') || label;
      return t('analysis.emotion.metrics.buckets.low') || label;
    }
    if (labelLower.includes('medium')) return t('analysis.emotion.metrics.buckets.medium') || label;
    if (labelLower.includes('high')) {
      if (labelLower.includes('very')) return t('analysis.emotion.metrics.buckets.veryHigh') || label;
      return t('analysis.emotion.metrics.buckets.high') || label;
    }
    return label;
  };

  return (
    <View style={[
      styles.container,
      {
        shadowColor: color,
        backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
        borderColor: isDark ? colors.border : '#f3f4f6',
      }
    ]}>
      <TouchableOpacity style={styles.header} onPress={handleExpandPress} activeOpacity={0.7}>
        <View style={styles.leftSection}>
          <LinearGradient
            colors={[color, color + '90']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <MaterialCommunityIcons name={icon as any} size={22} color="#fff" />
          </LinearGradient>

          <View style={styles.metricInfo}>
            <Text style={[styles.label, { color: isDark ? colors.textSecondary : '#6b7280' }]} numberOfLines={1}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[styles.value, { color: isDark ? colors.text : '#1f2937' }]}>
                {formatValue(value)}
              </Text>
              {(unit || metric === 'valence' || metric === 'arousal') && (
                <Text style={[styles.unit, { color: isDark ? colors.textSecondary : '#6b7280', marginLeft: 2 }]}>
                  {unit || '%'}
                </Text>
              )}
            </View></View>
        </View>

        <View style={styles.rightSection}>
          {bucket && (
            <View style={[styles.bucketBadge, { backgroundColor: bucket.color + '15' }]}>
              <Text style={[styles.bucketText, { color: bucket.color }]} numberOfLines={1}>
                {getTranslatedBucketLabel(bucket.label)}
              </Text>
            </View>
          )}

          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={isDark ? colors.textSecondary : '#9ca3af'}
          />
        </View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.expandedContent,
          {
            opacity: fadeAnim,
            height: isExpanded ? 'auto' : 0,
            overflow: 'hidden'
          }
        ]}
      >
        <View style={[styles.divider, { backgroundColor: isDark ? colors.border : '#f3f4f6' }]} />

        {trend && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDark ? colors.textSecondary : '#9ca3af' }]}>
              {t('common.trend') || 'Trend'}
            </Text>
            <Text style={[styles.detailValue, { color: getTrendColor(trend) }]}>
              {trend.trend} {trend.percentage}% {trend.text}
            </Text>
          </View>
        )}

        {bucket && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDark ? colors.textSecondary : '#9ca3af' }]}>
              {t('common.status') || 'Status'}
            </Text>
            <Text style={[styles.detailValue, { color: isDark ? colors.text : '#374151' }]}>
              {t(bucket.description)}
            </Text>
          </View>
        )}

        {/* Description for Valence/Arousal */}
        {description && (
          <View style={styles.detailRow}>
            <Text style={[styles.descriptionText, { color: isDark ? colors.textSecondary : '#6b7280' }]}>
              {t(description)}
            </Text>
          </View>
        )}

        {action && action.actionable && (
          <View style={[styles.actionContainer, { backgroundColor: isDark ? colors.surface : '#f9fafb' }]}>
            <View style={styles.actionHeader}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={getPriorityColor(action.priority)} />
              <Text style={[styles.actionTitle, { color: getPriorityColor(action.priority) }]}>
                {t('common.recommendation') || 'Recommendation'}
              </Text>
            </View>

            <Text style={[styles.actionDescription, { color: isDark ? colors.text : '#4b5563' }]}>
              {action.description}
            </Text>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: getPriorityColor(action.priority) }]}
              onPress={onActionPress}
            >
              <Text style={styles.actionButtonText}>
                {t('common.markAsDone') || 'Mark as Done'}
              </Text>
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    marginVertical: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  metricInfo: {
    flex: 1,
    minWidth: 90,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 1,
    minWidth: 40,
  },
  bucketBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  bucketText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  actionContainer: {
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
