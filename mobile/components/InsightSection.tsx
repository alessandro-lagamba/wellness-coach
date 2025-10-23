import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { InsightCard } from './InsightCard';
import { InsightService, InsightData } from '../services/insight.service';

interface InsightSectionProps {
  maxInsights?: number;
  showTitle?: boolean;
  compact?: boolean;
  categoryFilter?: 'emotion' | 'health' | 'pattern' | 'correlation' | 'recommendation';
  variant?: 'default' | 'home';
  onInsightPress?: (insight: InsightData) => void;
  onActionPress?: (insight: InsightData) => void;
}

export const InsightSection: React.FC<InsightSectionProps> = ({
  maxInsights = 5,
  showTitle = true,
  compact = false,
  categoryFilter,
  variant = 'default',
  onInsightPress,
  onActionPress,
}) => {
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insightService = InsightService.getInstance();

  const loadInsights = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      setError(null);
      
      const freshInsights = await insightService.getFreshInsights();
      
      // Filter insights by category if specified
      let filteredInsights = freshInsights;
      if (categoryFilter) {
        filteredInsights = freshInsights.filter(insight => insight.category === categoryFilter);
      }
      
      const limitedInsights = filteredInsights.slice(0, maxInsights);
      
      setInsights(limitedInsights);
      
      console.log(`✅ Loaded ${limitedInsights.length} insights`);
    } catch (err) {
      console.error('❌ Failed to load insights:', err);
      setError('Failed to load insights. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const handleRefresh = () => {
    loadInsights(true);
  };

  const handleInsightPress = (insight: InsightData) => {
    if (onInsightPress) {
      onInsightPress(insight);
    } else {
      // Default behavior - show insight details
      Alert.alert(
        insight.title,
        insight.description,
        [
          { text: 'OK' },
          ...(insight.actionable && insight.action ? [{
            text: insight.action.label,
            onPress: () => handleActionPress(insight)
          }] : [])
        ]
      );
    }
  };

  const handleActionPress = (insight: InsightData) => {
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

  const handleDismiss = (insightId: string) => {
    insightService.markInsightAsRead(insightId);
    setInsights(prev => prev.filter(insight => insight.id !== insightId));
  };

  const getInsightStats = () => {
    const highPriority = insights.filter(i => i.priority === 'high' || i.priority === 'critical').length;
    const actionable = insights.filter(i => i.actionable).length;
    const categories = [...new Set(insights.map(i => i.category))];
    
    return { highPriority, actionable, categories };
  };

  const stats = getInsightStats();

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Generating insights...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={24} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadInsights()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (insights.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="lightbulb-outline" size={48} color="#9ca3af" />
        <Text style={styles.emptyTitle}>No insights yet</Text>
        <Text style={styles.emptyDescription}>
          Complete more emotion analyses to get personalized insights about your emotional patterns.
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <MaterialCommunityIcons name="refresh" size={16} color="#3b82f6" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Home variant - simplified layout
  if (variant === 'home') {
    return (
      <View style={styles.homeContainer}>
        {insights.map((insight) => (
          <View key={insight.id} style={styles.homeInsightCard}>
            <View style={styles.homeInsightHeader}>
              <MaterialCommunityIcons 
                name="lightbulb-outline" 
                size={16} 
                color="#6366f1" 
              />
              <Text style={styles.homeInsightTitle}>{insight.title}</Text>
            </View>
            <Text style={styles.homeInsightDescription} numberOfLines={2}>
              {insight.description}
            </Text>
            {insight.action && (
              <TouchableOpacity 
                style={styles.homeActionButton}
                onPress={() => handleActionPress(insight)}
              >
                <Text style={styles.homeActionText}>{insight.action.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={14} color="#6366f1" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showTitle && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="brain" size={20} color="#6366f1" />
            </View>
            <View>
              <Text style={styles.title}>Intelligent Insights</Text>
              <Text style={styles.subtitle}>
                {insights.length} personalized insights • {stats.highPriority} high priority
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <MaterialCommunityIcons 
              name="refresh" 
              size={16} 
              color={refreshing ? "#9ca3af" : "#3b82f6"} 
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Row */}
      {!compact && insights.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{insights.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f97316' }]}>{stats.highPriority}</Text>
            <Text style={styles.statLabel}>High Priority</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.actionable}</Text>
            <Text style={styles.statLabel}>Actionable</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#6366f1' }]}>{stats.categories.length}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
        </View>
      )}

      {/* Insights List */}
      <ScrollView
        style={styles.insightsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >
        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            compact={compact}
            onActionPress={handleActionPress}
            onDismiss={handleDismiss}
          />
        ))}
        
        {/* Load More Button */}
        {insights.length >= maxInsights && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => {
              // In a real app, you'd load more insights here
              Alert.alert('Load More', 'This would load additional insights in a real implementation.');
            }}
          >
            <LinearGradient
              colors={['#f8fafc', '#e2e8f0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loadMoreGradient}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#6b7280" />
              <Text style={styles.loadMoreText}>Load More Insights</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  insightsList: {
    flex: 1,
  },
  loadMoreButton: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  loadMoreGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadMoreText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 12,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  
  // Home variant styles
  homeContainer: {
    gap: 12,
  },
  homeInsightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  homeInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  homeInsightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  homeInsightDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  homeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  homeActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
});
