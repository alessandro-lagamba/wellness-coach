import { useState, useEffect, useCallback } from 'react';
import { InsightService, InsightData } from '../services/insight.service';

export interface UseInsightsReturn {
  insights: InsightData[];
  loading: boolean;
  error: string | null;
  refreshInsights: () => Promise<void>;
  markAsRead: (insightId: string) => void;
  getInsightsByCategory: (category: string) => InsightData[];
  getHighPriorityInsights: () => InsightData[];
}

export const useInsights = (autoRefresh = true): UseInsightsReturn => {
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const insightService = InsightService.getInstance();

  const loadInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const freshInsights = await insightService.getFreshInsights();
      setInsights(freshInsights);
      
      console.log(`🧠 Loaded ${freshInsights.length} insights via hook`);
    } catch (err) {
      console.error('❌ Failed to load insights:', err);
      setError('Failed to load insights. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [insightService]);

  const refreshInsights = useCallback(async () => {
    await loadInsights();
  }, [loadInsights]);

  const markAsRead = useCallback((insightId: string) => {
    insightService.markInsightAsRead(insightId);
    setInsights(prev => prev.filter(insight => insight.id !== insightId));
  }, [insightService]);

  const getInsightsByCategory = useCallback((category: string) => {
    return insights.filter(insight => insight.category === category);
  }, [insights]);

  const getHighPriorityInsights = useCallback(() => {
    return insights.filter(insight => insight.priority === 'high' || insight.priority === 'critical');
  }, [insights]);

  useEffect(() => {
    if (autoRefresh) {
      loadInsights();
    }
  }, [autoRefresh, loadInsights]);

  return {
    insights,
    loading,
    error,
    refreshInsights,
    markAsRead,
    getInsightsByCategory,
    getHighPriorityInsights,
  };
};

