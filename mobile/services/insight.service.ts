import { useAnalysisStore } from '../stores/analysis.store';
import { HealthDataService } from './health-data.service';
import { AuthService } from './auth.service';

export interface InsightData {
  id: string;
  type: 'trend' | 'pattern' | 'correlation' | 'recommendation' | 'achievement';
  title: string;
  description: string;
  confidence: number; // 0-100
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'emotion' | 'health' | 'wellness' | 'productivity';
  actionable: boolean;
  action?: {
    type: 'navigate' | 'start_activity' | 'set_reminder' | 'view_details';
    target?: string;
    label: string;
    icon: string;
  };
  data?: {
    trend?: 'up' | 'down' | 'stable';
    change?: number; // percentage change
    period?: string;
    correlation?: number; // -1 to 1
    benchmark?: number;
  };
  timestamp: Date;
  expiresAt?: Date;
}

export interface InsightAnalysis {
  emotionalTrends?: {
    valence: { trend: 'up' | 'down' | 'stable'; change: number; period: string };
    arousal: { trend: 'up' | 'down' | 'stable'; change: number; period: string };
    stability: { score: number; description: string };
  };
  skinTrends?: {
    texture: { trend: 'up' | 'down' | 'stable'; change: number; period: string };
    redness: { trend: 'up' | 'down' | 'stable'; change: number; period: string };
    hydration: { trend: 'up' | 'down' | 'stable'; change: number; period: string };
    oiliness: { trend: 'up' | 'down' | 'stable'; change: number; period: string };
    overall: { score: number; description: string };
  };
  patterns: {
    weekly: { day: string; avgValence?: number; avgArousal?: number; avgTexture?: number; avgRedness?: number; avgHydration?: number; avgOiliness?: number }[];
    daily: { hour: string; avgValence?: number; avgArousal?: number; avgTexture?: number; avgRedness?: number; avgHydration?: number; avgOiliness?: number }[];
    dominant: { emotion?: string; frequency: number; trend: 'up' | 'down' | 'stable' };
    skinDominant?: { metric: string; frequency: number; trend: 'up' | 'down' | 'stable' };
  };
  correlations: {
    sleep: { correlation: number; description: string };
    activity: { correlation: number; description: string };
    stress: { correlation: number; description: string };
    weather?: { correlation: number; description: string };
    skincare?: { correlation: number; description: string };
  };
  recommendations: {
    immediate: string[];
    weekly: string[];
    longTerm: string[];
  };
}

export class InsightService {
  private static instance: InsightService;
  private insights: InsightData[] = [];
  private lastAnalysis: Date | null = null;

  static getInstance(): InsightService {
    if (!InsightService.instance) {
      InsightService.instance = new InsightService();
    }
    return InsightService.instance;
  }

  /**
   * Generate intelligent insights based on current data
   */
  async generateInsights(): Promise<InsightData[]> {
    try {
      console.log('🧠 Generating intelligent insights...');
      
      const analysis = await this.analyzeEmotionalData();
      const healthData = await this.getHealthData();
      
      const insights: InsightData[] = [];
      
      // 1. Emotional Trend Insights
      insights.push(...this.generateTrendInsights(analysis));
      
      // 2. Pattern Recognition Insights
      insights.push(...this.generatePatternInsights(analysis));
      
      // 3. Health Correlation Insights
      insights.push(...this.generateHealthCorrelationInsights(analysis, healthData));
      
      // 4. Personalized Recommendations
      insights.push(...this.generateRecommendationInsights(analysis, healthData));
      
      // 5. Achievement Insights
      insights.push(...this.generateAchievementInsights(analysis));
      
      // Sort by priority and confidence
      insights.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.confidence - a.confidence;
      });
      
      this.insights = insights;
      this.lastAnalysis = new Date();
      
      console.log(`✅ Generated ${insights.length} intelligent insights`);
      return insights;
      
    } catch (error) {
      console.error('❌ Failed to generate insights:', error);
      return [];
    }
  }

  /**
   * Analyze emotional data for patterns and trends
   */
  private async analyzeEmotionalData(): Promise<InsightAnalysis> {
    const store = useAnalysisStore.getState();
    const emotionHistory = store.getSafeEmotionHistory();
    const skinHistory = store.getSafeSkinHistory();
    
    if (emotionHistory.length === 0 && skinHistory.length === 0) {
      return this.getEmptyAnalysis();
    }

    const analysis: InsightAnalysis = {
      patterns: {
        weekly: [],
        daily: [],
        dominant: { frequency: 0, trend: 'stable' }
      },
      correlations: {
        sleep: { correlation: 0, description: 'No sleep data available' },
        activity: { correlation: 0, description: 'No activity data available' },
        stress: { correlation: 0, description: 'No stress data available' }
      },
      recommendations: {
        immediate: [],
        weekly: [],
        longTerm: []
      }
    };

    // Analyze emotional data if available
    if (emotionHistory.length > 0) {
      const valenceTrend = this.calculateTrend(emotionHistory.map(s => s.avg_valence || 0));
      const arousalTrend = this.calculateTrend(emotionHistory.map(s => s.avg_arousal || 0));
      const stability = this.calculateEmotionalStability(emotionHistory);
      
      analysis.emotionalTrends = {
        valence: valenceTrend,
        arousal: arousalTrend,
        stability: stability
      };

      // Calculate patterns for emotions
      const weeklyPatterns = this.calculateWeeklyPatterns(emotionHistory);
      const dailyPatterns = this.calculateDailyPatterns(emotionHistory);
      const dominantPattern = this.calculateDominantPattern(emotionHistory);
      
      analysis.patterns.weekly = weeklyPatterns;
      analysis.patterns.daily = dailyPatterns;
      analysis.patterns.dominant = dominantPattern;
    }

    // Analyze skin data if available
    if (skinHistory.length > 0) {
      const textureTrend = this.calculateTrend(skinHistory.map(s => s.scores?.texture || 0));
      const rednessTrend = this.calculateTrend(skinHistory.map(s => s.scores?.redness || 0));
      const hydrationTrend = this.calculateTrend(skinHistory.map(s => s.scores?.hydration || 0));
      const oilinessTrend = this.calculateTrend(skinHistory.map(s => s.scores?.oiliness || 0));
      const overall = this.calculateSkinOverall(skinHistory);
      
      analysis.skinTrends = {
        texture: textureTrend,
        redness: rednessTrend,
        hydration: hydrationTrend,
        oiliness: oilinessTrend,
        overall: overall
      };

      // Calculate skin patterns
      const skinWeeklyPatterns = this.calculateSkinWeeklyPatterns(skinHistory);
      const skinDailyPatterns = this.calculateSkinDailyPatterns(skinHistory);
      const skinDominantPattern = this.calculateSkinDominantPattern(skinHistory);
      
      // Merge with existing patterns or create new ones
      if (analysis.patterns.weekly.length === 0) {
        analysis.patterns.weekly = skinWeeklyPatterns;
      } else {
        // Merge skin data with existing emotional patterns
        analysis.patterns.weekly = analysis.patterns.weekly.map(day => {
          const skinDay = skinWeeklyPatterns.find(sd => sd.day === day.day);
          return {
            ...day,
            avgTexture: skinDay?.avgTexture,
            avgRedness: skinDay?.avgRedness,
            avgHydration: skinDay?.avgHydration,
            avgOiliness: skinDay?.avgOiliness
          };
        });
      }

      if (analysis.patterns.daily.length === 0) {
        analysis.patterns.daily = skinDailyPatterns;
      } else {
        // Merge skin data with existing emotional patterns
        analysis.patterns.daily = analysis.patterns.daily.map(hour => {
          const skinHour = skinDailyPatterns.find(sh => sh.hour === hour.hour);
          return {
            ...hour,
            avgTexture: skinHour?.avgTexture,
            avgRedness: skinHour?.avgRedness,
            avgHydration: skinHour?.avgHydration,
            avgOiliness: skinHour?.avgOiliness
          };
        });
      }

      analysis.patterns.skinDominant = skinDominantPattern;
    }
    
    return analysis;
  }

  /**
   * Get health data for correlation analysis
   */
  private async getHealthData(): Promise<any> {
    try {
      const healthService = HealthDataService.getInstance();
      const syncResult = await healthService.syncHealthData();
      return syncResult.success ? syncResult.data : null;
    } catch (error) {
      console.warn('Failed to get health data for insights:', error);
      return null;
    }
  }

  /**
   * Generate trend-based insights
   */
  private generateTrendInsights(analysis: InsightAnalysis): InsightData[] {
    const insights: InsightData[] = [];
    
    // Emotional trends
    if (analysis.emotionalTrends?.valence && analysis.emotionalTrends.valence.change > 10) {
      insights.push({
        id: 'valence-improvement',
        type: 'trend',
        title: 'Mood Improvement Detected! 🎉',
        description: `Your positivity has increased by ${Math.round(analysis.emotionalTrends.valence.change)}% over the last ${analysis.emotionalTrends.valence.period}. This is a great sign of emotional growth!`,
        confidence: 85,
        priority: 'high',
        category: 'emotion',
        actionable: true,
        action: {
          type: 'view_details',
          label: 'View Trend Chart',
          icon: 'trending-up'
        },
        data: {
          trend: analysis.emotionalTrends.valence.trend,
          change: analysis.emotionalTrends.valence.change,
          period: analysis.emotionalTrends.valence.period
        },
        timestamp: new Date()
      });
    } else if (analysis.emotionalTrends?.valence && analysis.emotionalTrends.valence.change < -10) {
      insights.push({
        id: 'valence-decline',
        type: 'trend',
        title: 'Mood Support Needed 📉',
        description: `Your positivity has decreased by ${Math.round(Math.abs(analysis.emotionalTrends.valence.change))}% over the last ${analysis.emotionalTrends.valence.period}. Let's work on some mood-boosting activities.`,
        confidence: 80,
        priority: 'high',
        category: 'emotion',
        actionable: true,
        action: {
          type: 'start_activity',
          target: 'meditation',
          label: 'Start Meditation',
          icon: 'meditation'
        },
        data: {
          trend: analysis.emotionalTrends.valence.trend,
          change: analysis.emotionalTrends.valence.change,
          period: analysis.emotionalTrends.valence.period
        },
        timestamp: new Date()
      });
    }

    // Arousal trend insight
    if (analysis.emotionalTrends?.arousal && analysis.emotionalTrends.arousal.change > 15) {
      insights.push({
        id: 'arousal-increase',
        type: 'trend',
        title: 'High Energy Levels Detected ⚡',
        description: `Your emotional intensity has increased by ${Math.round(analysis.emotionalTrends.arousal.change)}% over the last ${analysis.emotionalTrends.arousal.period}. This could indicate stress or excitement.`,
        confidence: 75,
        priority: 'medium',
        category: 'emotion',
        actionable: true,
        action: {
          type: 'start_activity',
          target: 'breathing',
          label: 'Breathing Exercise',
          icon: 'breath'
        },
        data: {
          trend: analysis.emotionalTrends.arousal.trend,
          change: analysis.emotionalTrends.arousal.change,
          period: analysis.emotionalTrends.arousal.period
        },
        timestamp: new Date()
      });
    }

    // Skin trends
    if (analysis.skinTrends?.texture && analysis.skinTrends.texture.change > 10) {
      insights.push({
        id: 'skin-texture-improvement',
        type: 'trend',
        title: 'Skin Texture Improving! ✨',
        description: `Your skin smoothness has improved by ${Math.round(analysis.skinTrends.texture.change)}% over the last ${analysis.skinTrends.texture.period}. Your skincare routine is working!`,
        confidence: 85,
        priority: 'high',
        category: 'health',
        actionable: true,
        action: {
          type: 'view_details',
          label: 'View Skin Trends',
          icon: 'chart-line'
        },
        data: {
          trend: analysis.skinTrends.texture.trend,
          change: analysis.skinTrends.texture.change,
          period: analysis.skinTrends.texture.period
        },
        timestamp: new Date()
      });
    }

    if (analysis.skinTrends?.redness && analysis.skinTrends.redness.change < -15) {
      insights.push({
        id: 'skin-redness-reduction',
        type: 'trend',
        title: 'Skin Calming Down! 🌿',
        description: `Your skin redness has decreased by ${Math.round(Math.abs(analysis.skinTrends.redness.change))}% over the last ${analysis.skinTrends.redness.period}. Your anti-inflammatory routine is effective!`,
        confidence: 80,
        priority: 'high',
        category: 'health',
        actionable: true,
        action: {
          type: 'start_activity',
          target: 'skincare_routine',
          label: 'Continue Routine',
          icon: 'leaf'
        },
        data: {
          trend: analysis.skinTrends.redness.trend,
          change: analysis.skinTrends.redness.change,
          period: analysis.skinTrends.redness.period
        },
        timestamp: new Date()
      });
    }

    if (analysis.skinTrends?.hydration && analysis.skinTrends.hydration.change > 12) {
      insights.push({
        id: 'skin-hydration-boost',
        type: 'trend',
        title: 'Skin Hydration Boost! 💧',
        description: `Your skin hydration has improved by ${Math.round(analysis.skinTrends.hydration.change)}% over the last ${analysis.skinTrends.hydration.period}. Keep up the hydration routine!`,
        confidence: 75,
        priority: 'medium',
        category: 'health',
        actionable: true,
        action: {
          type: 'start_activity',
          target: 'hydration_tips',
          label: 'Hydration Tips',
          icon: 'water'
        },
        data: {
          trend: analysis.skinTrends.hydration.trend,
          change: analysis.skinTrends.hydration.change,
          period: analysis.skinTrends.hydration.period
        },
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Generate pattern-based insights
   */
  private generatePatternInsights(analysis: InsightAnalysis): InsightData[] {
    const insights: InsightData[] = [];
    
    // Weekly pattern insight
    if (analysis.patterns.weekly.length > 0) {
      const bestDay = analysis.patterns.weekly.reduce((best, current) => 
        current.avgValence > best.avgValence ? current : best
      );
      const worstDay = analysis.patterns.weekly.reduce((worst, current) => 
        current.avgValence < worst.avgValence ? current : worst
      );
    
      if (bestDay.avgValence - worstDay.avgValence > 0.3) {
        insights.push({
          id: 'weekly-pattern',
          type: 'pattern',
          title: 'Weekly Mood Pattern Identified 📅',
          description: `You tend to feel best on ${bestDay.day}s (${Math.round(bestDay.avgValence * 100)}% positive) and struggle more on ${worstDay.day}s (${Math.round(worstDay.avgValence * 100)}% positive).`,
          confidence: 70,
          priority: 'medium',
          category: 'emotion',
          actionable: true,
          action: {
            type: 'set_reminder',
            target: worstDay.day,
            label: `Set ${worstDay.day} Reminder`,
            icon: 'calendar'
          },
          data: {
            period: 'weekly',
            benchmark: bestDay.avgValence
          },
          timestamp: new Date()
        });
      }
    }

    // Dominant emotion insight
    if (analysis.patterns.dominant.frequency > 0.4) {
      insights.push({
        id: 'dominant-emotion',
        type: 'pattern',
        title: `Your Dominant Emotion: ${analysis.patterns.dominant.emotion} 🎭`,
        description: `${Math.round(analysis.patterns.dominant.frequency * 100)}% of your recent sessions show ${analysis.patterns.dominant.emotion} as the primary emotion.`,
        confidence: 80,
        priority: 'medium',
        category: 'emotion',
        actionable: true,
        action: {
          type: 'view_details',
          label: 'View Emotion History',
          icon: 'chart-line'
        },
        data: {
          period: 'recent',
          benchmark: analysis.patterns.dominant.frequency
        },
        timestamp: new Date()
      });
    }

    // Skin pattern insights
    if (analysis.patterns.skinDominant) {
      const { metric, frequency, trend } = analysis.patterns.skinDominant;
      
      if (frequency > 0.7) {
        const metricNames: Record<string, string> = {
          texture: 'smoothness',
          redness: 'redness',
          hydration: 'hydration',
          oiliness: 'oiliness'
        };

        insights.push({
          id: 'skin-dominant-pattern',
          type: 'pattern',
          title: `Consistent Skin ${metricNames[metric] || metric} Pattern 🎯`,
          description: `Your skin shows consistent ${metricNames[metric] || metric} patterns (${(frequency * 100).toFixed(0)}% of analyses). This ${trend === 'up' ? 'improving' : trend === 'down' ? 'declining' : 'stable'} trend suggests your current routine is ${trend === 'up' ? 'very effective' : trend === 'down' ? 'needs adjustment' : 'maintaining well'}.`,
          confidence: 80,
          priority: 'medium',
          category: 'health',
          actionable: true,
          action: {
            type: 'view_details',
            label: 'View Skin Patterns',
            icon: 'chart-bar'
          },
          data: {
            metric,
            frequency,
            trend,
            metricName: metricNames[metric] || metric
          },
          timestamp: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Generate health correlation insights
   */
  private generateHealthCorrelationInsights(analysis: InsightAnalysis, healthData: any): InsightData[] {
    const insights: InsightData[] = [];
    
    if (!healthData) return insights;

    // Sleep correlation
    if (healthData.sleepHours && healthData.sleepQuality) {
      const sleepCorrelation = this.calculateSleepCorrelation(analysis, healthData);
      if (Math.abs(sleepCorrelation) > 0.3) {
        insights.push({
          id: 'sleep-correlation',
          type: 'correlation',
          title: 'Sleep-Mood Connection Found! 😴',
          description: `Your sleep quality (${healthData.sleepQuality}%) is ${sleepCorrelation > 0 ? 'positively' : 'negatively'} correlated with your mood. Better sleep = better mood!`,
          confidence: 75,
          priority: 'high',
          category: 'health',
          actionable: true,
          action: {
            type: 'start_activity',
            target: 'sleep_tracking',
            label: 'Track Sleep',
            icon: 'sleep'
          },
          data: {
            correlation: sleepCorrelation,
            period: 'recent'
          },
          timestamp: new Date()
        });
      }
    }

    // Activity correlation
    if (healthData.steps) {
      const activityCorrelation = this.calculateActivityCorrelation(analysis, healthData);
      if (activityCorrelation > 0.2) {
        insights.push({
          id: 'activity-correlation',
          type: 'correlation',
          title: 'Activity Boosts Your Mood! 🚶‍♂️',
          description: `Your daily steps (${healthData.steps.toLocaleString()}) are positively correlated with your mood. More movement = better emotional state!`,
          confidence: 70,
          priority: 'medium',
          category: 'health',
          actionable: true,
          action: {
            type: 'start_activity',
            target: 'walking',
            label: 'Go for a Walk',
            icon: 'walk'
          },
          data: {
            correlation: activityCorrelation,
            period: 'daily'
          },
          timestamp: new Date()
        });
      }
    }

    // Skin-health correlations
    if (analysis.skinTrends && healthData.hydration) {
      const hydrationCorrelation = this.calculateSkinHydrationCorrelation(analysis, healthData);
      if (Math.abs(hydrationCorrelation) > 0.4) {
        insights.push({
          id: 'skin-hydration-correlation',
          type: 'correlation',
          title: 'Hydration-Skin Connection! 💧',
          description: `Your water intake (${Math.round(healthData.hydration / 250)} glasses) is ${hydrationCorrelation > 0 ? 'positively' : 'negatively'} correlated with your skin hydration. ${hydrationCorrelation > 0 ? 'Keep drinking water for better skin!' : 'Consider increasing your water intake.'}`,
          confidence: 80,
          priority: 'high',
          category: 'health',
          actionable: true,
          action: {
            type: 'start_activity',
            target: 'hydration_reminder',
            label: 'Set Hydration Reminder',
            icon: 'water'
          },
          data: {
            correlation: hydrationCorrelation,
            period: 'recent'
          },
          timestamp: new Date()
        });
      }
    }

    if (analysis.skinTrends && healthData.sleepQuality) {
      const sleepSkinCorrelation = this.calculateSleepSkinCorrelation(analysis, healthData);
      if (Math.abs(sleepSkinCorrelation) > 0.3) {
        insights.push({
          id: 'sleep-skin-correlation',
          type: 'correlation',
          title: 'Sleep-Skin Connection! 😴✨',
          description: `Your sleep quality (${healthData.sleepQuality}%) is ${sleepSkinCorrelation > 0 ? 'positively' : 'negatively'} correlated with your skin health. Beauty sleep is real!`,
          confidence: 75,
          priority: 'medium',
          category: 'health',
          actionable: true,
          action: {
            type: 'start_activity',
            target: 'sleep_optimization',
            label: 'Optimize Sleep',
            icon: 'sleep'
          },
          data: {
            correlation: sleepSkinCorrelation,
            period: 'recent'
          },
          timestamp: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendationInsights(analysis: InsightAnalysis, healthData: any): InsightData[] {
    const insights: InsightData[] = [];
    
    // Immediate recommendations based on current state
    if (analysis.emotionalTrends.valence.change < -5) {
      insights.push({
        id: 'mood-boost-recommendation',
        type: 'recommendation',
        title: 'Quick Mood Boost Needed! 🌟',
        description: 'Your mood has been declining recently. Try a 5-minute meditation or listen to your favorite music to lift your spirits.',
        confidence: 85,
        priority: 'high',
        category: 'wellness',
        actionable: true,
        action: {
          type: 'start_activity',
          target: 'meditation',
          label: 'Start Meditation',
          icon: 'meditation'
        },
        timestamp: new Date()
      });
    }

    // Weekly recommendations
    if (analysis.patterns.weekly.length > 0) {
      const avgValence = analysis.patterns.weekly.reduce((sum, day) => sum + day.avgValence, 0) / analysis.patterns.weekly.length;
      if (avgValence < 0.3) {
        insights.push({
          id: 'weekly-wellness-plan',
          type: 'recommendation',
          title: 'Weekly Wellness Plan 📋',
          description: 'Your weekly mood average is below optimal. Consider scheduling regular wellness activities like exercise, social time, or hobbies.',
          confidence: 80,
          priority: 'medium',
          category: 'wellness',
          actionable: true,
          action: {
            type: 'set_reminder',
            target: 'weekly_plan',
            label: 'Create Weekly Plan',
            icon: 'calendar-plus'
          },
          timestamp: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Generate achievement insights
   */
  private generateAchievementInsights(analysis: InsightAnalysis): InsightData[] {
    const insights: InsightData[] = [];
    
    // Consistency achievement
    if (analysis.emotionalTrends.stability.score > 0.7) {
      insights.push({
        id: 'emotional-stability-achievement',
        type: 'achievement',
        title: 'Emotional Stability Master! 🎯',
        description: `You've achieved ${Math.round(analysis.emotionalTrends.stability.score * 100)}% emotional stability. This shows great emotional regulation skills!`,
        confidence: 90,
        priority: 'medium',
        category: 'emotion',
        actionable: false,
        data: {
          benchmark: analysis.emotionalTrends.stability.score
        },
        timestamp: new Date()
      });
    }

    // Progress achievement
    if (analysis.emotionalTrends.valence.change > 20) {
      insights.push({
        id: 'mood-progress-achievement',
        type: 'achievement',
        title: 'Mood Improvement Champion! 🏆',
        description: `Amazing progress! Your mood has improved by ${Math.round(analysis.emotionalTrends.valence.change)}% over the last ${analysis.emotionalTrends.valence.period}. Keep up the great work!`,
        confidence: 95,
        priority: 'high',
        category: 'emotion',
        actionable: false,
        data: {
          change: analysis.emotionalTrends.valence.change,
          period: analysis.emotionalTrends.valence.period
        },
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Calculate trend for a data series
   */
  private calculateTrend(data: number[]): { trend: 'up' | 'down' | 'stable'; change: number; period: string } {
    if (data.length < 2) {
      return { trend: 'stable', change: 0, period: 'insufficient data' };
    }

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
    
    let trend: 'up' | 'down' | 'stable';
    if (change > 5) trend = 'up';
    else if (change < -5) trend = 'down';
    else trend = 'stable';
    
    return {
      trend,
      change: Math.round(change),
      period: data.length > 7 ? 'week' : 'few days'
    };
  }

  /**
   * Calculate weekly patterns
   */
  private calculateWeeklyPatterns(emotionHistory: any[]): { day: string; avgValence: number; avgArousal: number }[] {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const patterns = days.map(day => ({
      day,
      avgValence: 0.5, // Default neutral
      avgArousal: 0.5
    }));

    // Group by day of week and calculate averages
    const dayGroups: { [key: string]: any[] } = {};
    emotionHistory.forEach(session => {
      const day = new Date(session.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
      if (!dayGroups[day]) dayGroups[day] = [];
      dayGroups[day].push(session);
    });

    Object.entries(dayGroups).forEach(([day, sessions]) => {
      const dayIndex = days.indexOf(day);
      if (dayIndex !== -1) {
        const avgValence = sessions.reduce((sum, s) => sum + (s.avg_valence || 0), 0) / sessions.length;
        const avgArousal = sessions.reduce((sum, s) => sum + (s.avg_arousal || 0), 0) / sessions.length;
        patterns[dayIndex] = { day, avgValence, avgArousal };
      }
    });

    return patterns;
  }

  /**
   * Calculate daily patterns
   */
  private calculateDailyPatterns(emotionHistory: any[]): { hour: string; avgValence: number; avgArousal: number }[] {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const patterns = hours.map(hour => ({
      hour: `${hour}:00`,
      avgValence: 0.5,
      avgArousal: 0.5
    }));

    // Group by hour and calculate averages
    const hourGroups: { [key: number]: any[] } = {};
    emotionHistory.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      if (!hourGroups[hour]) hourGroups[hour] = [];
      hourGroups[hour].push(session);
    });

    Object.entries(hourGroups).forEach(([hourStr, sessions]) => {
      const hour = parseInt(hourStr);
      const avgValence = sessions.reduce((sum, s) => sum + (s.avg_valence || 0), 0) / sessions.length;
      const avgArousal = sessions.reduce((sum, s) => sum + (s.avg_arousal || 0), 0) / sessions.length;
      patterns[hour] = { hour: `${hour}:00`, avgValence, avgArousal };
    });

    return patterns;
  }

  /**
   * Calculate dominant emotion pattern
   */
  private calculateDominantPattern(emotionHistory: any[]): { emotion: string; frequency: number; trend: 'up' | 'down' | 'stable' } {
    const emotionCounts: { [key: string]: number } = {};
    emotionHistory.forEach(session => {
      const emotion = session.dominant || 'neutral';
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });

    const total = emotionHistory.length;
    const dominant = Object.entries(emotionCounts).reduce((max, [emotion, count]) => 
      count > max.count ? { emotion, count } : max, 
      { emotion: 'neutral', count: 0 }
    );

    const frequency = dominant.count / total;
    
    // Calculate trend for dominant emotion
    const recentSessions = emotionHistory.slice(-Math.min(5, emotionHistory.length));
    const recentCount = recentSessions.filter(s => s.dominant === dominant.emotion).length;
    const recentFrequency = recentCount / recentSessions.length;
    
    let trend: 'up' | 'down' | 'stable';
    if (recentFrequency > frequency + 0.1) trend = 'up';
    else if (recentFrequency < frequency - 0.1) trend = 'down';
    else trend = 'stable';

    return {
      emotion: dominant.emotion,
      frequency,
      trend
    };
  }

  /**
   * Calculate emotional stability
   */
  private calculateEmotionalStability(emotionHistory: any[]): { score: number; description: string } {
    if (emotionHistory.length < 3) {
      return { score: 0.5, description: 'Insufficient data for stability analysis' };
    }

    const valences = emotionHistory.map(s => s.avg_valence || 0);
    const arousals = emotionHistory.map(s => s.avg_arousal || 0);
    
    // Calculate standard deviation (lower = more stable)
    const valenceStd = this.calculateStandardDeviation(valences);
    const arousalStd = this.calculateStandardDeviation(arousals);
    
    // Convert to stability score (0-1, higher = more stable)
    const stability = Math.max(0, 1 - (valenceStd + arousalStd) / 2);
    
    let description: string;
    if (stability > 0.8) description = 'Very stable emotional patterns';
    else if (stability > 0.6) description = 'Moderately stable emotional patterns';
    else if (stability > 0.4) description = 'Somewhat variable emotional patterns';
    else description = 'Highly variable emotional patterns';

    return { score: stability, description };
  }

  /**
   * Calculate sleep correlation
   */
  private calculateSleepCorrelation(analysis: InsightAnalysis, healthData: any): number {
    // Simplified correlation calculation
    // In a real implementation, you'd use proper statistical correlation
    const sleepQuality = healthData.sleepQuality / 100;
    const avgValence = analysis.patterns.weekly.reduce((sum, day) => sum + day.avgValence, 0) / analysis.patterns.weekly.length;
    
    // Simple correlation: better sleep = better mood
    return Math.max(-1, Math.min(1, (sleepQuality - 0.5) * 2));
  }

  /**
   * Calculate activity correlation
   */
  private calculateActivityCorrelation(analysis: InsightAnalysis, healthData: any): number {
    // Simplified correlation calculation
    const steps = healthData.steps;
    const avgValence = analysis.patterns.weekly.reduce((sum, day) => sum + day.avgValence, 0) / analysis.patterns.weekly.length;
    
    // Simple correlation: more steps = better mood (up to a point)
    const normalizedSteps = Math.min(1, steps / 10000);
    return Math.max(0, normalizedSteps * 0.5);
  }

  /**
   * Calculate skin hydration correlation
   */
  private calculateSkinHydrationCorrelation(analysis: InsightAnalysis, healthData: any): number {
    if (!analysis.skinTrends?.hydration) return 0;
    
    const hydration = healthData.hydration;
    const skinHydration = analysis.skinTrends.hydration.change;
    
    // Simple correlation: more water intake = better skin hydration
    const normalizedHydration = Math.min(1, hydration / 2000); // 2L = 100%
    return Math.max(0, normalizedHydration * 0.6);
  }

  /**
   * Calculate sleep-skin correlation
   */
  private calculateSleepSkinCorrelation(analysis: InsightAnalysis, healthData: any): number {
    if (!analysis.skinTrends?.overall) return 0;
    
    const sleepQuality = healthData.sleepQuality;
    const skinHealth = analysis.skinTrends.overall.score;
    
    // Simple correlation: better sleep = better skin
    const normalizedSleep = sleepQuality / 100;
    const normalizedSkin = skinHealth / 100;
    
    return Math.max(0, (normalizedSleep + normalizedSkin) / 2 * 0.7);
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Get empty analysis for when no data is available
   */
  private getEmptyAnalysis(): InsightAnalysis {
    return {
      emotionalTrends: {
        valence: { trend: 'stable', change: 0, period: 'no data' },
        arousal: { trend: 'stable', change: 0, period: 'no data' },
        stability: { score: 0.5, description: 'No data available' }
      },
      patterns: {
        weekly: [],
        daily: [],
        dominant: { emotion: 'neutral', frequency: 0, trend: 'stable' }
      },
      correlations: {
        sleep: { correlation: 0, description: 'No sleep data available' },
        activity: { correlation: 0, description: 'No activity data available' },
        stress: { correlation: 0, description: 'No stress data available' }
      },
      recommendations: {
        immediate: [],
        weekly: [],
        longTerm: []
      }
    };
  }

  /**
   * Get current insights
   */
  getInsights(): InsightData[] {
    return this.insights;
  }

  /**
   * Get insights by category
   */
  getInsightsByCategory(category: string): InsightData[] {
    return this.insights.filter(insight => insight.category === category);
  }

  /**
   * Get high priority insights
   */
  getHighPriorityInsights(): InsightData[] {
    return this.insights.filter(insight => insight.priority === 'high' || insight.priority === 'critical');
  }

  /**
   * Mark insight as read
   */
  markInsightAsRead(insightId: string): void {
    const insight = this.insights.find(i => i.id === insightId);
    if (insight) {
      insight.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expire in 24 hours
    }
  }

  /**
   * Get fresh insights (regenerate if needed)
   */
  async getFreshInsights(): Promise<InsightData[]> {
    const now = new Date();
    const shouldRegenerate = !this.lastAnalysis || 
      (now.getTime() - this.lastAnalysis.getTime()) > 30 * 60 * 1000; // 30 minutes

    if (shouldRegenerate) {
      return await this.generateInsights();
    }

    return this.insights;
  }
}
