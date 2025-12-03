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

interface EnhancedScoreTileProps {
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
}

export const EnhancedScoreTile: React.FC<EnhancedScoreTileProps> = ({
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
}) => {
  const { colors, mode } = useTheme();
  const { t, language } = useTranslation();
  const isDark = mode === 'dark';
  const [isExpanded, setIsExpanded] = useState(expanded);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // 🔥 FIX: Traduce le etichette dei bucket dinamicamente
  const translateBucketLabel = (label: string): string => {
    const translations: { [key: string]: { it: string; en: string } } = {
      // Texture
      'ROUGH': { it: 'RUVIDA', en: 'ROUGH' },
      'FAIR': { it: 'DISCRETA', en: 'FAIR' },
      'GOOD': { it: 'BUONA', en: 'GOOD' },
      'EXCELLENT': { it: 'ECCELLENTE', en: 'EXCELLENT' },
      // Redness
      'LOW': { it: 'BASSO', en: 'LOW' },
      'MILD': { it: 'LIEVE', en: 'MILD' },
      'MODERATE': { it: 'MODERATO', en: 'MODERATE' },
      'HIGH': { it: 'ALTO', en: 'HIGH' },
      // Hydration
      'BELOW OPTIMAL': { it: 'SOTTO OTTIMALE', en: 'BELOW OPTIMAL' },
      'OPTIMAL': { it: 'OTTIMALE', en: 'OPTIMAL' },
      // Oiliness
      'DRY': { it: 'SECCA', en: 'DRY' },
      'BALANCED': { it: 'EQUILIBRATA', en: 'BALANCED' },
      'OILY': { it: 'OLEOSA', en: 'OILY' },
      'VERY OILY': { it: 'MOLTO OLEOSA', en: 'VERY OILY' },
      // Overall
      'POOR': { it: 'SCARSA', en: 'POOR' },
      // Emotion
      'NEGATIVE': { it: 'NEGATIVA', en: 'NEGATIVE' },
      'NEUTRAL': { it: 'NEUTRA', en: 'NEUTRAL' },
      'POSITIVE': { it: 'POSITIVA', en: 'POSITIVE' },
      'VERY POSITIVE': { it: 'MOLTO POSITIVA', en: 'VERY POSITIVE' },
      'MEDIUM': { it: 'MEDIA', en: 'MEDIUM' },
      'VERY HIGH': { it: 'MOLTO ALTA', en: 'VERY HIGH' },
    };
    
    const upperLabel = label.toUpperCase();
    if (translations[upperLabel]) {
      return translations[upperLabel][language as 'it' | 'en'] || label;
    }
    return label;
  };

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

  return (
    <View style={[
      styles.container, 
      { 
        shadowColor: color,
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6',
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
            <Text style={[styles.label, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{label}</Text>
            <Text style={[styles.value, { color: isDark ? '#f3f4f6' : '#1f2937' }]}>{Math.round(value)}</Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          {bucket && (
            <View style={[styles.bucketBadge, { backgroundColor: bucket.color + '15' }]}>
              <Text style={[styles.bucketText, { color: bucket.color }]}>
                {translateBucketLabel(bucket.label)}
              </Text>
            </View>
          )}

          {trend && (
            <Text style={[styles.trendText, { color: getTrendColor(trend) }]}>
              {trend.trend} {trend.percentage}%
            </Text>
          )}

          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={isDark ? '#6b7280' : '#9ca3af'}
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
        <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }]} />

        {trend && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDark ? '#6b7280' : '#9ca3af' }]}>Trend</Text>
            <Text style={[styles.detailValue, { color: getTrendColor(trend) }]}>
              {trend.trend} {trend.percentage}% {trend.text}
            </Text>
          </View>
        )}

        {bucket && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDark ? '#6b7280' : '#9ca3af' }]}>Status</Text>
            <Text style={[styles.detailValue, { color: isDark ? '#d1d5db' : '#374151' }]}>{bucket.description}</Text>
          </View>
        )}

        {action && action.actionable && (
          <View style={[styles.actionContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }]}>
            <View style={styles.actionHeader}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={getPriorityColor(action.priority)} />
              <Text style={[styles.actionTitle, { color: getPriorityColor(action.priority) }]}>Recommendation</Text>
            </View>

            <Text style={[styles.actionDescription, { color: isDark ? '#9ca3af' : '#4b5563' }]}>{action.description}</Text>

            {action.estimatedTime && (
              <Text style={[styles.actionTime, { color: isDark ? '#6b7280' : '#6b7280' }]}>⏱️ {action.estimatedTime}</Text>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: getPriorityColor(action.priority) }]}
              onPress={onActionPress}
            >
              <Text style={styles.actionButtonText}>Mark as Done</Text>
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
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
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
  trendText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 20,
  },
  actionContainer: {
    backgroundColor: '#f9fafb',
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
    color: '#4b5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  actionTime: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    fontStyle: 'italic',
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
