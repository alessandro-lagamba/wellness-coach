import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Insight } from '../services/correlation.service';
import { InsightChip } from './InsightChip';

interface InsightCorrelationProps {
  skinData?: any;
  emotionData?: any;
  onInsightPress?: (insight: Insight) => void;
  onActionPress?: (suggestions: string[]) => void;
  maxInsights?: number;
  showTitle?: boolean;
  compact?: boolean;
}

export const InsightCorrelation: React.FC<InsightCorrelationProps> = ({
  skinData,
  emotionData,
  onInsightPress,
  onActionPress,
  maxInsights = 3,
  showTitle = true,
  compact = false,
}) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (skinData || emotionData) {
      setIsLoading(true);
      
      // Simula calcolo asincrono degli insight
      setTimeout(() => {
        try {
          // Importa CorrelationService dinamicamente per evitare errori di import
          const { CorrelationService } = require('../services/correlation.service');
          const calculatedInsights = CorrelationService.getInsights(skinData, emotionData);
          
          // Filtra e limita gli insight
          const filteredInsights = calculatedInsights
            .filter(insight => insight.confidence >= 0.6) // Solo insight con confidence alta
            .slice(0, maxInsights);
          
          setInsights(filteredInsights);
        } catch (error) {
          console.warn('Error calculating insights:', error);
          setInsights([]);
        } finally {
          setIsLoading(false);
        }
      }, 500);
    } else {
      setInsights([]);
    }
  }, [skinData, emotionData, maxInsights]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleInsightPress = (insight: Insight) => {
    onInsightPress?.(insight);
  };

  const handleActionPress = (suggestions: string[]) => {
    onActionPress?.(suggestions);
  };

  if (insights.length === 0 && !isLoading) {
    return null;
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <TouchableOpacity 
          style={styles.compactHeader}
          onPress={handleToggleExpanded}
        >
          <View style={styles.compactLeft}>
            <MaterialCommunityIcons name="lightbulb" size={16} color="#8b5cf6" />
            <Text style={styles.compactTitle}>Insights</Text>
            <Text style={styles.compactCount}>({insights.length})</Text>
          </View>
          <MaterialCommunityIcons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color="#6b7280" 
          />
        </TouchableOpacity>

        {isExpanded && (
          <Animated.View style={[styles.compactContent, { opacity: fadeAnim }]}>
            {insights.map((insight, index) => (
              <InsightChip
                key={insight.id}
                insight={insight}
                onPress={() => handleInsightPress(insight)}
                onActionPress={handleActionPress}
                expanded={false}
              />
            ))}
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity 
        style={styles.header}
        onPress={handleToggleExpanded}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="lightbulb" size={24} color="#8b5cf6" />
          </View>
          <View style={styles.headerInfo}>
            {showTitle && (
              <Text style={styles.title}>💡 Insights Intelligenti</Text>
            )}
            <Text style={styles.subtitle}>
              {isLoading 
                ? 'Calcolando correlazioni...' 
                : `${insights.length} correlazioni rilevate`
              }
            </Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          {insights.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{insights.length}</Text>
            </View>
          )}
          <MaterialCommunityIcons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#6b7280" 
          />
        </View>
      </TouchableOpacity>

      {/* Content */}
      {isExpanded && (
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <MaterialCommunityIcons name="loading" size={24} color="#8b5cf6" />
              <Text style={styles.loadingText}>Analizzando i tuoi dati...</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.insightsList}
              showsVerticalScrollIndicator={false}
            >
              {insights.map((insight, index) => (
                <InsightChip
                  key={insight.id}
                  insight={insight}
                  onPress={() => handleInsightPress(insight)}
                  onActionPress={handleActionPress}
                  expanded={false}
                />
              ))}
              
              {/* Footer con disclaimer */}
              <View style={styles.footer}>
                <Text style={styles.disclaimer}>
                  💡 Gli insights sono basati sui tuoi dati personali e non costituiscono consigli medici.
                </Text>
              </View>
            </ScrollView>
          )}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginVertical: 8,
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
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf620',
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
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  countText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    maxHeight: 400,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  insightsList: {
    padding: 16,
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  disclaimer: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 6,
  },
  compactCount: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  compactContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
