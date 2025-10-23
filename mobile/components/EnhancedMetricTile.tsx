import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BucketInfo, TrendInfo, ActionInfo } from '../services/metrics.service';

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
}) => {
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
    // Per emotion metrics, mostra con segno + o -
    if (metric === 'valence') {
      return (value >= 0 ? '+' : '') + value.toFixed(2);
    }
    return value.toFixed(2);
  };

  return (
    <View style={[styles.container, { borderColor: color + '30' }]}>
      {/* Header con valore e bucket */}
      <TouchableOpacity style={styles.header} onPress={handleExpandPress}>
        <View style={styles.leftSection}>
          <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <MaterialCommunityIcons name={icon as any} size={24} color={color} />
          </View>
          <View style={styles.metricInfo}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, { color }]}>{formatValue(value)}</Text>
          </View>
        </View>
        
        <View style={styles.rightSection}>
          {bucket && (
            <View style={[styles.bucketBadge, { backgroundColor: bucket.color + '20' }]}>
              <Text style={[styles.bucketText, { color: bucket.color }]}>
                {bucket.icon} {bucket.label}
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
            color="#6b7280" 
          />
        </View>
      </TouchableOpacity>

      {/* Contenuto espandibile */}
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
        {/* Trend dettagliato */}
        {trend && (
          <View style={styles.trendSection}>
            <Text style={styles.trendLabel}>Trend vs tuo solito:</Text>
            <Text style={[styles.trendDescription, { color: getTrendColor(trend) }]}>
              {trend.trend} {trend.percentage}% {trend.text}
            </Text>
          </View>
        )}

        {/* Bucket description */}
        {bucket && (
          <View style={styles.bucketSection}>
            <Text style={styles.bucketLabel}>Stato emotivo:</Text>
            <Text style={styles.bucketDescription}>{bucket.description}</Text>
          </View>
        )}

        {/* Interpretazione metrica */}
        <View style={styles.interpretationSection}>
          <Text style={styles.interpretationLabel}>Cosa significa:</Text>
          <Text style={styles.interpretationText}>
            {metric === 'valence' 
              ? 'Valore positivo = felice/contento, Valore negativo = triste/frustrato'
              : 'Valore alto = eccitato/stressato, Valore basso = calmo/rilassato'
            }
          </Text>
        </View>

        {/* Action suggerita */}
        {action && action.actionable && (
          <View style={styles.actionSection}>
            <View style={styles.actionHeader}>
              <Text style={styles.actionLabel}>🎯 Azione suggerita:</Text>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(action.priority) + '20' }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(action.priority) }]}>
                  {action.priority.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionDescription}>{action.description}</Text>
            
            {action.estimatedTime && (
              <Text style={styles.actionTime}>⏱️ Tempo stimato: {action.estimatedTime}</Text>
            )}
            
            {action.resources && action.resources.length > 0 && (
              <View style={styles.resourcesSection}>
                <Text style={styles.resourcesLabel}>Cosa ti serve:</Text>
                {action.resources.map((resource, index) => (
                  <Text key={index} style={styles.resource}>• {resource}</Text>
                ))}
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: getPriorityColor(action.priority) }]}
              onPress={onActionPress}
            >
              <Text style={styles.actionButtonText}>
                ✅ Completato
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
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
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  bucketBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  bucketText: {
    fontSize: 12,
    fontWeight: '600',
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
  trendSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  trendDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
  bucketSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  bucketLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  bucketDescription: {
    fontSize: 14,
    color: '#374151',
  },
  interpretationSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  interpretationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  interpretationText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
  },
  actionSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  actionTime: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  resourcesSection: {
    marginBottom: 12,
  },
  resourcesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  resource: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
