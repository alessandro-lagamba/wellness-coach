import { useState, useEffect, useCallback, useRef } from 'react';
import DailyCopilotService, { DailyCopilotData } from '../services/daily-copilot.service';

// Score data type (real-time, no DB save)
export interface ScoreData {
  score: number | null;
  breakdown: Record<string, { score: number; weight: number; value: number; goal?: number }>;
  missingData: string[];
  availableCategories: string[];
  healthMetrics: {
    steps: number | null;
    hrv: number | null;
    hydration: number | null;
    restingHR?: number | null;
    meditationMinutes?: number | null;
    calories?: number | null;
  };
  mood: number | null;
  sleep: { hours: number; quality: number } | null;
}

export const useDailyCopilot = () => {
  // State for complete copilot data (includes recommendations)
  const [copilotData, setCopilotData] = useState<DailyCopilotData | null>(null);

  // State for real-time score only
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);

  const [loading, setLoading] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [insufficientData, setInsufficientData] = useState(false);

  const copilotService = DailyCopilotService.getInstance();
  const scoreRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Load real-time score (no DB save)
   * Called periodically for live score updates
   */
  const refreshScore = useCallback(async () => {
    try {
      setScoreLoading(true);
      const score = await copilotService.getCurrentDailyScore();

      if (score) {
        setScoreData(score);
        setInsufficientData(score.score === null);
        setLastUpdated(new Date());
      } else {
        setInsufficientData(true);
      }
    } catch (err) {
      console.error('Error refreshing score:', err);
    } finally {
      setScoreLoading(false);
    }
  }, [copilotService]);

  /**
   * Load complete copilot data (score + recommendations)
   * This may return yesterday's recommendations if new ones aren't generated yet
   */
  const loadCopilotData = useCallback(async () => {
    let timeoutId: ReturnType<typeof setTimeout>;

    try {
      setLoading(true);
      setError(null);

      timeoutId = setTimeout(() => {
        console.warn('⚠️ Daily Copilot: forced timeout after 15s');
        setLoading(false);
      }, 15000);

      // The service handles:
      // 1. Returning saved today's data if exists
      // 2. Returning yesterday's recommendations with today's score if before recommendation time
      // 3. Generating new recommendations if after recommendation time
      const data = await copilotService.generateDailyCopilotAnalysis();

      clearTimeout(timeoutId);

      if (data) {
        setCopilotData(data);
        // Also update score from the response
        if (data.scoreDetails) {
          setScoreData({
            score: data.overallScore,
            breakdown: data.scoreDetails.breakdown,
            missingData: data.scoreDetails.missingData,
            availableCategories: data.scoreDetails.availableCategories,
            healthMetrics: data.healthMetrics as ScoreData['healthMetrics'],
            mood: data.mood,
            sleep: data.sleep,
          });
        }
        setInsufficientData(false);
        setLastUpdated(new Date());
      } else {
        // No data available - could be insufficient data
        // Try to get just the score
        await refreshScore();
      }
    } catch (err) {
      clearTimeout(timeoutId!);
      setError('Errore nel caricamento dei dati');
      console.error('Error loading copilot data:', err);
    } finally {
      setLoading(false);
    }
  }, [copilotService, refreshScore]);

  /**
   * Start periodic score refresh
   * Refreshes every 5 minutes to keep score current
   */
  const startScoreRefresh = useCallback(() => {
    if (scoreRefreshInterval.current) {
      clearInterval(scoreRefreshInterval.current);
    }

    // Refresh score every 5 minutes
    scoreRefreshInterval.current = setInterval(() => {
      refreshScore();
    }, 5 * 60 * 1000);
  }, [refreshScore]);

  /**
   * Stop periodic score refresh
   */
  const stopScoreRefresh = useCallback(() => {
    if (scoreRefreshInterval.current) {
      clearInterval(scoreRefreshInterval.current);
      scoreRefreshInterval.current = null;
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadCopilotData();
    startScoreRefresh();

    return () => {
      stopScoreRefresh();
    };
  }, [loadCopilotData, startScoreRefresh, stopScoreRefresh]);

  /**
   * Check if it's past the recommendation time and we might have new recommendations
   */
  const checkForNewRecommendations = useCallback(async () => {
    const now = new Date();
    const currentHour = now.getHours();

    // 🔥 FIX: Get the user's preferred recommendation time instead of hardcoded 18:00
    try {
      const currentUser = await (await import('../services/auth.service')).AuthService.getCurrentUser();
      if (!currentUser?.id) return;

      const recommendationTime = await copilotService.getRecommendationTime(currentUser.id);

      // If it's past the recommendation time and we don't have today's recommendations, try to load
      if (currentHour >= recommendationTime) {
        // If copilotData doesn't exist or is from yesterday (or empty), reload
        if (!copilotData || !copilotData.recommendations || copilotData.recommendations.length === 0) {
          console.log(`[COPILOT HOOK] Past recommendation time (${recommendationTime}:00), reloading data...`);
          await loadCopilotData();
        }
      }
    } catch (err) {
      console.warn('[COPILOT HOOK] Error checking for new recommendations:', err);
    }
  }, [copilotData, loadCopilotData, copilotService]);

  return {
    // Complete data (score + recommendations)
    copilotData,

    // Real-time score only
    scoreData,

    // Loading states
    loading,
    scoreLoading,

    // Error state
    error,

    // Indicates if we don't have enough data for a score
    insufficientData,

    // Last time data was updated
    lastUpdated,

    // Manual refresh functions
    reload: loadCopilotData,
    refreshScore,
    checkForNewRecommendations,
  };
};
