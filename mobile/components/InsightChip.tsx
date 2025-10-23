import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Insight } from '../services/correlation.service';

interface InsightChipProps {
  insight: Insight;
  onPress?: () => void;
  onActionPress?: (suggestions: string[]) => void;
  expanded?: boolean;
}

export const InsightChip: React.FC<InsightChipProps> = ({
  insight,
  onPress,
  onActionPress,
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

  const handlePress = () => {
    setIsExpanded(!isExpanded);
    onPress?.();
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'correlation': return 'link-variant';
      case 'pattern': return 'chart-line';
      case 'anomaly': return 'alert-circle';
      case 'trend': return 'trending-up';
      default: return 'lightbulb';
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'correlation': return '#8b5cf6';
      case 'pattern': return '#06b6d4';
      case 'anomaly': return '#f59e0b';
      case 'trend': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={[styles.container, { borderColor: getInsightColor(insight.type) + '30' }]}>
      {/* Header del chip */}
      <TouchableOpacity style={styles.header} onPress={handlePress}>
        <View style={styles.leftSection}>
          <View style={[styles.iconContainer, { backgroundColor: getInsightColor(insight.type) + '20' }]}>
            <MaterialCommunityIcons 
              name={getInsightIcon(insight.type) as any} 
              size={20} 
              color={getInsightColor(insight.type)} 
            />
          </View>
          <View style={styles.insightInfo}>
            <Text style={styles.title}>{insight.title}</Text>
            <Text style={styles.message} numberOfLines={2}>
              {insight.message}
            </Text>
          </View>
        </View>
        
        <View style={styles.rightSection}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(insight.priority) + '20' }]}>
            <Text style={[styles.priorityText, { color: getPriorityColor(insight.priority) }]}>
              {insight.priority.toUpperCase()}
            </Text>
          </View>
          
          <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(insight.confidence) + '20' }]}>
            <Text style={[styles.confidenceText, { color: getConfidenceColor(insight.confidence) }]}>
              {Math.round(insight.confidence * 100)}%
            </Text>
          </View>
          
          <MaterialCommunityIcons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={16} 
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
        {/* Dettagli insight */}
        <View style={styles.detailsSection}>
          <Text style={styles.detailsLabel}>Dettagli:</Text>
          <Text style={styles.detailsText}>{insight.message}</Text>
        </View>

        {/* Metriche correlate */}
        {insight.relatedMetrics && insight.relatedMetrics.length > 0 && (
          <View style={styles.metricsSection}>
            <Text style={styles.metricsLabel}>Metriche correlate:</Text>
            <View style={styles.metricsList}>
              {insight.relatedMetrics.map((metric, index) => (
                <View key={index} style={styles.metricChip}>
                  <Text style={styles.metricText}>{metric}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Suggerimenti */}
        {insight.suggestions && insight.suggestions.length > 0 && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsLabel}>Suggerimenti:</Text>
            {insight.suggestions.map((suggestion, index) => (
              <Text key={index} style={styles.suggestion}>• {suggestion}</Text>
            ))}
            
            {insight.actionable && onActionPress && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: getInsightColor(insight.type) }]}
                onPress={() => onActionPress(insight.suggestions || [])}
              >
                <MaterialCommunityIcons name="lightning-bolt" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Applica Suggerimenti</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.disclaimerText}>
            💡 Questo insight è basato sui tuoi dati personali e non costituisce un consiglio medico.
          </Text>
        </View>
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
    padding: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  insightInfo: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  detailsSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  metricsSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  metricsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  metricsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  metricText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  suggestionsSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  suggestion: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  disclaimerSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
