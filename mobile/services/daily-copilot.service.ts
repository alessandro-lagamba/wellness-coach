import { AuthService } from './auth.service';
import { getBackendURL } from '../constants/env';
import { AIContextService } from './ai-context.service';
import DailyCopilotDBService from './daily-copilot-db.service';
import { RetryService } from './retry.service';
import { getUserLanguage, getLanguageInstruction } from './language.service';
import { widgetGoalsService } from './widget-goals.service';

export interface ThemeIndicator {
  icon: string;
  label: string;
  labelEn: string;
  color: string;
  category: 'nutrition' | 'movement' | 'recovery' | 'mindfulness' | 'energy';
}

export interface ScoreItem {
  score: number;  // 0..100
  weight: number; // punti peso (es. 25, 30...)
  value: number;
  goal?: number;
}

export interface ScoreCalculationResult {
  score: number | null;                 // null se dati insufficienti
  breakdown: Record<string, ScoreItem>;
  missingData: string[];                // dati mancanti per calcolo obbligatorio + opzionali abilitati
  availableCategories: string[];         // categorie effettivamente incluse nel calcolo
}

export interface DailyCopilotData {
  overallScore: number;        // 0-100
  scoreDetails?: ScoreCalculationResult;
  mood: number;               // 1-5 dal check-in
  sleep: {
    hours: number;
    quality: number;
    bedtime?: string;
    wakeTime?: string;
  };
  healthMetrics: {
    steps: number;
    hrv: number;
    hydration: number;
    restingHR?: number;
    meditationMinutes?: number;
  };
  recommendations: {
    id: string;
    priority: 'high' | 'medium' | 'low';
    category: 'nutrition' | 'movement' | 'recovery' | 'mindfulness' | 'energy';
    action: string;
    reason: string;
    icon: string;
    estimatedTime?: string;
    actionable: boolean;
    detailedExplanation?: string;
    correlations?: string[];
    expectedBenefits?: string[];
  }[];
  summary: {
    focus: string;
    focusEn: string;
    energy: 'high' | 'medium' | 'low';
    recovery: 'excellent' | 'good' | 'needs_attention';
    mood: 'positive' | 'neutral' | 'low';
  };
  themeIndicators: ThemeIndicator[];
}

// Activity level enum from user_profiles
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';

export interface CopilotAnalysisRequest {
  mood: number | null;
  sleep: { hours: number; quality: number; } | null;
  // Nullable health metrics - null means no real data available
  healthMetrics: {
    steps: number | null;
    hrv: number | null;
    hydration: number | null;
    calories: number | null;
    meditationMinutes: number | null;
    restingHR: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
  };
  activityLevel?: ActivityLevel;  // Context for AI recommendations, not used in score
  timestamp: string;
}

class DailyCopilotService {
  private static instance: DailyCopilotService;
  private cache: Map<string, DailyCopilotData> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minuti
  private dbService = DailyCopilotDBService.getInstance();

  static getInstance(): DailyCopilotService {
    if (!DailyCopilotService.instance) {
      DailyCopilotService.instance = new DailyCopilotService();
    }
    return DailyCopilotService.instance;
  }

  /**
   * Genera l'analisi completa del Daily Copilot
   * Ora recupera le raccomandazioni del giorno precedente come "guida"
   */
  async generateDailyCopilotAnalysis(): Promise<DailyCopilotData | null> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return null;
      }

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const cacheKey = `copilot_${currentUser.id}_${today}`;

      // Check if today's recommendations have been generated
      const dbResult = await this.dbService.getDailyCopilotData(currentUser.id, today);
      if (dbResult.success && dbResult.data) {
        const savedData = this.convertDBRecordToCopilotData(dbResult.data);
        this.setCachedAnalysis(cacheKey, savedData);
        return savedData;
      }

      // Check cache as fallback
      const cached = this.getCachedAnalysis(cacheKey);
      if (cached) {
        return cached;
      }

      // Get real-time score (always calculated fresh)
      const scoreData = await this.getCurrentDailyScore();

      // If no score available, try to return yesterday's recommendations as guide
      if (!scoreData || scoreData.score === null) {
        console.warn('⚠️ Daily Copilot: Insufficient data for score calculation (< 3 factors)');
        return await this.getYesterdayRecommendationsAsGuide(currentUser.id);
      }

      // Check if it's time to generate new recommendations (after 18:00)
      const currentHour = now.getHours();
      const recommendationTime = await this.getRecommendationTime(currentUser.id);

      if (currentHour >= recommendationTime) {
        // Generate new recommendations
        return await this.generateDailyRecommendations();
      }

      // Before recommendation time: return yesterday's recommendations with today's score
      const yesterdayData = await this.getYesterdayRecommendationsAsGuide(currentUser.id);
      if (yesterdayData) {
        // Merge today's score with yesterday's recommendations
        return {
          ...yesterdayData,
          overallScore: scoreData.score,
          scoreDetails: scoreData,
          healthMetrics: {
            steps: scoreData.healthMetrics.steps ?? 0,
            hrv: scoreData.healthMetrics.hrv ?? 0,
            hydration: scoreData.healthMetrics.hydration ?? 0,
            restingHR: scoreData.healthMetrics.restingHR ?? undefined,
            meditationMinutes: scoreData.healthMetrics.meditationMinutes ?? undefined
          }
        };
      }

      // No yesterday data and before recommendation time - return score-only data
      return await this.buildScoreOnlyResult(scoreData);

    } catch (error) {
      console.error('Error generating Daily Copilot analysis:', error);
      return null;
    }
  }

  /**
   * Get the current daily score in real-time (NO DB SAVE)
   * Called by UI whenever it needs to display the current score
   */
  async getCurrentDailyScore(): Promise<{
    score: number | null;
    breakdown: Record<string, ScoreItem>;
    missingData: string[];
    availableCategories: string[];
    healthMetrics: CopilotAnalysisRequest['healthMetrics'];
    mood: number | null;
    sleep: { hours: number; quality: number; } | null;
  } | null> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) return null;

      const aiContext = await AIContextService.getCompleteContext(currentUser.id);
      const mood = await this.getTodayMood();
      const sleep = await this.getTodaySleep();
      const healthMetrics = await this.getHealthMetrics(aiContext);

      const data: CopilotAnalysisRequest = {
        mood,
        sleep,
        healthMetrics,
        timestamp: new Date().toISOString()
      };

      const scoreResult = await this.calculateDeterministicScore(data);

      return {
        ...scoreResult,
        healthMetrics: data.healthMetrics,
        mood: data.mood,
        sleep: data.sleep
      };
    } catch (error) {
      console.error('Error getting current daily score:', error);
      return null;
    }
  }

  /**
   * Generate daily recommendations at the user's configured time
   * This is the ONLY function that saves to the database
   */
  async generateDailyRecommendations(): Promise<DailyCopilotData | null> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) return null;

      // Collect all data for the day
      const analysisData = await this.collectAnalysisData(currentUser.id);
      if (!analysisData) {
        console.warn('⚠️ Daily Copilot: No analysis data collected');
        return null;
      }

      // Calculate final score
      const scoreResult = await this.calculateDeterministicScore(analysisData);

      // Only save if we have sufficient data (at least 3 factors)
      if (scoreResult.score === null) {
        console.warn('⚠️ Daily Copilot: Insufficient data for daily recommendations');
        return null;
      }

      // Generate AI analysis with full context (including activity level)
      const copilotData = await this.generateAIAnalysis(analysisData, currentUser.id, scoreResult.score);

      if (!copilotData) {
        console.warn('⚠️ Daily Copilot: AI analysis failed, using fallback');
        const fallbackAnalysis = await this.generateFallbackAnalysis(analysisData);
        await this.dbService.saveDailyCopilotData(currentUser.id, fallbackAnalysis);
        return fallbackAnalysis;
      }

      // Save to database (ONLY when generating recommendations)
      const saveResult = await this.dbService.saveDailyCopilotData(currentUser.id, copilotData);
      if (!saveResult.success) {
        console.warn('⚠️ Failed to save Daily Copilot data to database:', saveResult.error);
      }

      // Update cache
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const cacheKey = `copilot_${currentUser.id}_${today}`;
      this.setCachedAnalysis(cacheKey, copilotData);

      return copilotData;
    } catch (error) {
      console.error('Error generating daily recommendations:', error);
      return null;
    }
  }

  /**
   * Get yesterday's recommendations to use as today's "guide"
   */
  private async getYesterdayRecommendationsAsGuide(userId: string): Promise<DailyCopilotData | null> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const dbResult = await this.dbService.getDailyCopilotData(userId, yesterdayStr);
      if (dbResult.success && dbResult.data) {
        return this.convertDBRecordToCopilotData(dbResult.data);
      }

      return null;
    } catch (error) {
      console.warn('⚠️ Could not get yesterday\'s recommendations:', error);
      return null;
    }
  }

  /**
   * Get the user's preferred recommendation time (default 18:00)
   */
  /**
   * Get the user's preferred recommendation time (default 18:00)
   */
  async getRecommendationTime(userId: string): Promise<number> {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase
        .from('user_profiles')
        .select('recommendation_time')
        .eq('id', userId)
        .maybeSingle();

      // Default to 18:00 if not set
      return data?.recommendation_time ?? 18;
    } catch {
      return 18;
    }
  }

  /**
   * Update the user's preferred recommendation time
   */
  async updateRecommendationTime(userId: string, time: number): Promise<boolean> {
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('user_profiles')
        .update({ recommendation_time: time })
        .eq('id', userId);

      if (error) {
        console.error('Error updating recommendation time:', error);
        return false;
      }

      // 🔥 FIX: Update local notification schedule
      try {
        const { NotificationService } = await import('./notifications.service');
        await NotificationService.scheduleDailyCopilot(time, 0);
        console.log(`✅ Daily Copilot notification rescheduled to ${time}:00`);
      } catch (notifError) {
        console.warn('⚠️ Failed to reschedule Daily Copilot notification:', notifError);
      }

      return true;
    } catch (error) {
      console.error('Error in updateRecommendationTime:', error);
      return false;
    }
  }

  /**
   * Build a score-only result when no recommendations exist yet
   */
  private async buildScoreOnlyResult(scoreData: NonNullable<Awaited<ReturnType<typeof this.getCurrentDailyScore>>>): Promise<DailyCopilotData> {
    return {
      overallScore: scoreData.score!,
      scoreDetails: scoreData,
      mood: scoreData.mood ?? 0,
      sleep: scoreData.sleep ?? { hours: 0, quality: 0 },
      healthMetrics: {
        steps: scoreData.healthMetrics.steps ?? 0,
        hrv: scoreData.healthMetrics.hrv ?? 0,
        hydration: scoreData.healthMetrics.hydration ?? 0,
        restingHR: scoreData.healthMetrics.restingHR ?? undefined,
        meditationMinutes: scoreData.healthMetrics.meditationMinutes ?? undefined
      },
      recommendations: [],
      summary: {
        focus: 'In attesa di analisi',
        focusEn: 'Awaiting analysis',
        energy: 'medium',
        recovery: 'good',
        mood: 'neutral'
      },
      themeIndicators: []
    };
  }

  /**
   * Raccoglie tutti i dati necessari per l'analisi
   */
  private async collectAnalysisData(userId: string): Promise<CopilotAnalysisRequest | null> {
    try {
      // Ottieni contesto AI completo
      const aiContext = await AIContextService.getCompleteContext(userId);

      // Dati dal check-in giornaliero (mood e sleep)
      const mood = await this.getTodayMood();
      const sleep = await this.getTodaySleep();

      // Dati HealthKit/metriche (ora nullable, no mock data)
      const healthMetrics = await this.getHealthMetrics(aiContext);

      // Get user activity level for AI context
      const activityLevel = await this.getUserActivityLevel(userId);

      return {
        mood,
        sleep,
        healthMetrics,
        activityLevel,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error collecting analysis data:', error);
      // Return all null - NO MOCK DATA
      return {
        mood: null,
        sleep: null,
        healthMetrics: { steps: null, hrv: null, hydration: null, calories: null, meditationMinutes: null, restingHR: null, sleepHours: null, sleepQuality: null },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Ottiene il mood per l'analisi (SOLO oggi)
   */
  private async getTodayMood(): Promise<number | null> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return null;
      }

      const { supabase } = await import('../lib/supabase');
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 🔥 FIX: Leggi SOLO i dati di OGGI
      const { data: todayCheckin } = await supabase
        .from('daily_copilot_analyses')
        .select('mood')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (todayCheckin?.mood !== null && todayCheckin?.mood !== undefined) {
        console.log('✅ Daily Copilot: Using today\'s mood:', todayCheckin.mood);
        return todayCheckin.mood;
      }

      // Fallback ad AsyncStorage per retrocompatibilità (solo se di oggi)
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const savedMood = await AsyncStorage.getItem(`checkin:mood:${today}`);
      if (savedMood) {
        return parseInt(savedMood, 10);
      }

      console.log('⚠️ Daily Copilot: No mood data found for today');
      return null;
    } catch (error) {
      console.error('❌ Error getting mood:', error);
      return null;
    }
  }

  /**
   * Ottiene i dati del sonno per l'analisi (SOLO oggi)
   * 1. Check-in Manuale (daily_copilot_analyses)
   * 2. Dati Automatici (health_data)
   * 3. Fallback AsyncStorage
   */
  private async getTodaySleep(): Promise<{ hours: number; quality: number; } | null> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return null;
      }

      const { supabase } = await import('../lib/supabase');
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 1. Check-in Manuale
      const { data: todayCheckin } = await supabase
        .from('daily_copilot_analyses')
        .select('sleep_hours, sleep_quality')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (todayCheckin && (todayCheckin.sleep_hours || todayCheckin.sleep_quality)) {
        console.log('✅ Daily Copilot: Using today\'s MANUAL check-in sleep:', {
          hours: todayCheckin.sleep_hours,
          quality: todayCheckin.sleep_quality
        });
        return {
          hours: todayCheckin.sleep_hours || 7.5,
          quality: todayCheckin.sleep_quality || 80
        };
      }


      console.log('⚠️ Daily Copilot: No sleep data found for today (Manual)');
      return null;
    } catch (error) {
      console.error('❌ Error getting sleep:', error);
      return null;
    }
  }

  /**
   * Ottiene le metriche di salute - SOLO DATI REALI, NO MOCK DATA
   * Returns null for any metric that doesn't have real data
   */
  private async getHealthMetrics(aiContext: any): Promise<{
    steps: number | null;
    hrv: number | null;
    hydration: number | null;
    calories: number | null;
    meditationMinutes: number | null;
    restingHR: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
  }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        // NO MOCK DATA - return all null
        return { steps: null, hrv: null, hydration: null, calories: null, meditationMinutes: null, restingHR: null, sleepHours: null, sleepQuality: null };
      }

      const { supabase } = await import('../lib/supabase');
      const todayDate = new Date();
      const today = todayDate.toISOString().split('T')[0];

      const { data: healthData } = await supabase
        .from('health_data')
        .select('steps, hrv, hydration, calories, resting_heart_rate, mindfulness_minutes, sleep_hours, sleep_quality')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (healthData) {
        // 🔥 FIX: Use consumed calories from FoodAnalysisService instead of HealthKit burned calories
        let consumedCalories = null;
        try {
          const { FoodAnalysisService } = await import('./food-analysis.service');
          const intake = await FoodAnalysisService.getDailyIntake(currentUser.id, todayDate);
          consumedCalories = intake.calories;
        } catch (e) {
          console.warn('⚠️ Failed to fetch consumed calories:', e);
        }

        const result = {
          steps: healthData.steps ?? null,
          hrv: (healthData.hrv && healthData.hrv > 0) ? healthData.hrv : null,
          hydration: healthData.hydration != null ? Math.round(healthData.hydration / 250) : null,
          calories: consumedCalories, // Now uses consumed calories
          meditationMinutes: healthData.mindfulness_minutes ?? null,
          restingHR: (healthData.resting_heart_rate && healthData.resting_heart_rate > 0) ? healthData.resting_heart_rate : null,
          sleepHours: (healthData.sleep_hours && healthData.sleep_hours > 0) ? healthData.sleep_hours : null,
          sleepQuality: (healthData.sleep_quality && healthData.sleep_quality > 0) ? healthData.sleep_quality : null
        };

        console.log('✅ Daily Copilot: Using real health data from database:', result);
        return result;
      }

      // Try HealthDataService as fallback source for real data
      try {
        const { HealthDataService } = await import('./health-data.service');
        const healthService = HealthDataService.getInstance();
        const syncResult = await healthService.syncHealthData(false);

        if (syncResult.success && syncResult.data) {
          const data = syncResult.data;
          const result = {
            steps: data.steps ?? null,
            hrv: (data.hrv && data.hrv > 0) ? data.hrv : null,
            hydration: data.hydration != null ? Math.round(data.hydration / 250) : null,
            calories: data.calories ?? null,
            meditationMinutes: data.mindfulnessMinutes ?? null,
            restingHR: (data.restingHeartRate && data.restingHeartRate > 0) ? data.restingHeartRate : null,
            sleepHours: (data.sleepHours && data.sleepHours > 0) ? data.sleepHours : null,
            sleepQuality: (data.sleepQuality && data.sleepQuality > 0) ? data.sleepQuality : null
          };

          console.log('✅ Daily Copilot: Using real health data from HealthDataService:', result);
          return result;
        }
      } catch (healthServiceError) {
        console.warn('⚠️ Daily Copilot: HealthDataService sync failed');
      }

      // Try aiContext as last resort for real data
      if (aiContext?.currentHealth) {
        return {
          steps: aiContext.currentHealth.steps ?? null,
          hrv: (aiContext.currentHealth.hrv && aiContext.currentHealth.hrv > 0) ? aiContext.currentHealth.hrv : null,
          hydration: aiContext.currentHealth.hydration ?? null,
          calories: aiContext.currentHealth.calories ?? null,
          meditationMinutes: aiContext.currentHealth.mindfulnessMinutes ?? null,
          restingHR: (aiContext.currentHealth.restingHR && aiContext.currentHealth.restingHR > 0) ? aiContext.currentHealth.restingHR : null,
          sleepHours: aiContext.currentHealth.sleep?.hours ?? null,
          sleepQuality: aiContext.currentHealth.sleep?.quality ?? null
        };
      }

      // NO MOCK DATA - return all null
      console.log('⚠️ Daily Copilot: No health data available for today');
      return { steps: null, hrv: null, hydration: null, calories: null, meditationMinutes: null, restingHR: null, sleepHours: null, sleepQuality: null };
    } catch (error) {
      console.error('❌ Error getting health metrics:', error);
      // NO MOCK DATA - return all null on error
      return { steps: null, hrv: null, hydration: null, calories: null, meditationMinutes: null, restingHR: null, sleepHours: null, sleepQuality: null };
    }
  }

  /**
   * Ottiene i minuti di meditazione odierni
   */
  private async getTodayMeditationMinutes(): Promise<number> {
    const healthMetrics = await this.getHealthMetrics({});
    return healthMetrics.meditationMinutes ?? 0;
  }

  /**
   * Ottiene il livello di attività dell'utente dal profilo
   * Usato come contesto per l'AI, non nel calcolo del punteggio
   */
  private async getUserActivityLevel(userId: string): Promise<ActivityLevel | undefined> {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase
        .from('user_profiles')
        .select('activity_level')
        .eq('user_id', userId)
        .maybeSingle();

      return data?.activity_level as ActivityLevel | undefined;
    } catch (error) {
      console.warn('⚠️ Could not get user activity level:', error);
      return undefined;
    }
  }

  /**
   * Converte il livello di attività in una label leggibile
   */
  private getActivityLevelLabel(level: ActivityLevel): string {
    const labels: Record<ActivityLevel, string> = {
      'sedentary': 'Sedentary (little to no exercise)',
      'lightly_active': 'Lightly Active (light exercise 1-3 days/week)',
      'moderately_active': 'Moderately Active (moderate exercise 3-5 days/week)',
      'very_active': 'Very Active (hard exercise 6-7 days/week)',
      'extremely_active': 'Extremely Active (very hard exercise, physical job)'
    };
    return labels[level] || level;
  }

  /**
   * Genera l'analisi tramite AI
   */
  private async generateAIAnalysis(
    data: CopilotAnalysisRequest,
    userId: string,
    preCalculatedScore: number
  ): Promise<DailyCopilotData | null> {
    const userLanguage = await getUserLanguage();
    const languageInstruction = getLanguageInstruction(userLanguage);

    let contextInfo = '';
    try {
      const aiContext = await AIContextService.getCompleteContext(userId, true);

      if (aiContext.currentEmotion) {
        contextInfo += `\n- Emotional state: ${aiContext.currentEmotion.emotion} (valence: ${aiContext.currentEmotion.valence.toFixed(2)}, arousal: ${aiContext.currentEmotion.arousal.toFixed(2)})\n`;
      }

      if (aiContext.currentSkin) {
        contextInfo += `- Skin status score: ${aiContext.currentSkin.overallScore}/100\n`;
      }

      if (aiContext.menstrualCycleContext) {
        contextInfo += `\n🩸 MENSTRUAL CYCLE:\n- Phase: ${aiContext.menstrualCycleContext.phase}\n- Day: ${aiContext.menstrualCycleContext.day}\n`;
      }

      if (aiContext.nutritionContext) {
        contextInfo += `\n🍽️ NUTRITION TODAY:\n- Calories: ${aiContext.nutritionContext.todayCalories} kcal\n- Foods: ${aiContext.nutritionContext.recentMeals?.join(', ')}\n`;
      }
    } catch (contextError) {
      console.warn('⚠️ Could not load additional context:', contextError);
    }

    const userMessage = `Analyze the user's daily health data and generate personalized recommendations.
CURRENT HEALTH DATA:
- Mood: ${data.mood !== null ? data.mood : 'N/A'}/5
- Sleep: ${data.sleep ? `${data.sleep.hours.toFixed(1)}h (quality: ${data.sleep.quality}%)` : 'N/A'}
- Steps: ${data.healthMetrics.steps ?? 'N/A'}
- HRV: ${(data.healthMetrics.hrv && data.healthMetrics.hrv > 0) ? `${data.healthMetrics.hrv} ms` : 'N/A (Data missing, DO NOT use for recommendations)'}
- Hydration: ${data.healthMetrics.hydration ?? 'N/A'}/8 glasses
- Calories burned: ${data.healthMetrics.calories ?? 'N/A'} kcal
- Meditation: ${data.healthMetrics.meditationMinutes ?? 'N/A'} min
- User Activity Level: ${data.activityLevel ? this.getActivityLevelLabel(data.activityLevel) : 'Not specified'}
- Calculated Wellness Score: ${preCalculatedScore}/100
${contextInfo ? `\nADDITIONAL CONTEXT:${contextInfo}` : ''}

TASK:

1. Compute an overall well-being score (0–100) by integrating all provided parameters.

2. Provide **3 personalized recommendations** that are:

   - actionable and specific
   - aligned with today's data
   - realistic for daily life

   Each recommendation must include:

     • priority: high / medium / low  

     • category: nutrition / movement / recovery / mindfulness / energy  

     • action: a concrete step to take today  

     • reason: why this recommendation matters today  

     • estimatedTime: how long it takes(minutes or hours)


        3. Provide three daily indicators:

        - energy: high / medium / low

          - recovery: excellent / good / needs_attention

            - mood: positive / neutral / low  

IMPORTANT RULES:

- IGNORE metrics marked as 'N/A' or 'Data missing'. Do not generate recommendations based on missing data.
- Tailor every insight strictly to the specific data provided.

- Use realistic physiology and behavior.

- Keep explanations clear, concise, and grounded in real health science.

- DO NOT include any text outside the JSON.

- DO NOT add disclaimers, warnings, or medical advice language.

- The JSON template below is ONLY an example of the structure.Generate completely new content each day and never reuse the sample action text verbatim.

          ${languageInstruction}
OUTPUT FORMAT(return ONLY valid JSON):
        {
          "overallScore": ${preCalculatedScore},
          "focus": "Energy & Momentum",
            "energy": "medium",
              "recovery": "good",
                "mood": "positive",
                  "recommendations": [
                    {
                      "id": "morning-activation",
                      "priority": "high",
                      "category": "movement",
                      "action": "[Replace with a personalized movement action derived from today's data]",
                      "reason": "Your sleep quality is lower than usual and steps are behind your normal pattern.",
                      "estimatedTime": "15 min",
                    }
                  ]
        } `;

    try {
      return await RetryService.withRetry(
        async () => {
          const backendURL = await getBackendURL();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            const response = await fetch(`${backendURL} /api/chat / respond`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: userMessage,
                sessionId: `daily - copilot - ${Date.now()} `,
                userId: userId,
                userContext: {
                  userName: 'Utente',
                  isDailyCopilot: true,
                  language: userLanguage,
                  healthData: {
                    mood: data.mood,
                    sleep: data.sleep,
                    healthMetrics: data.healthMetrics
                  }
                }
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              // Errori non retryable (4xx client errors)
              if (response.status >= 400 && response.status < 500) {
                throw new Error(`Client error: ${response.status} `);
              }
              // Errori retryable (5xx server errors)
              throw new Error(`Server error: ${response.status} `);
            }

            const aiResponse = await response.json();
            const analysisText = aiResponse.response || aiResponse.message || aiResponse.text;

            if (!analysisText) throw new Error('Empty response from AI');

            return await this.parseAIAnalysis(analysisText, data);
          } catch (error: any) {
            clearTimeout(timeoutId);

            // Gestione specifica per timeout
            if (error.name === 'AbortError' || error.message?.includes('timeout')) {
              throw new Error('AI analysis timeout: il server ha impiegato troppo tempo');
            }

            throw error;
          }
        },
        'daily_copilot_ai_analysis',
        {
          maxAttempts: 2, // 2 retry attempts (totale 3 tentativi)
          delay: 2000, // 2 secondi tra i retry
          backoff: 'exponential',
          shouldRetry: (error: Error) => {
            // Ritenta solo su errori di rete, timeout, o 5xx
            const errorMessage = error.message.toLowerCase();
            return (
              errorMessage.includes('timeout') ||
              errorMessage.includes('network') ||
              errorMessage.includes('server error') ||
              errorMessage.includes('failed to fetch') ||
              errorMessage.includes('aborted')
            );
          },
        }
      );
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return await this.generateFallbackAnalysis(data);
    }
  }

  /**
   * Parsing dell'analisi AI
   */
  private async parseAIAnalysis(analysisText: string, data: CopilotAnalysisRequest): Promise<DailyCopilotData> {
    try {
      const scoreResult = await this.calculateDeterministicScore(data);
      const deterministicScore = scoreResult.score || 50;

      let parsedData = null;
      try {
        parsedData = JSON.parse(analysisText);
      } catch {
        // Try to extract JSON from the response with better handling of incomplete JSON
        const jsonMatch = analysisText.match(/\{[\s\S]*?\}(?=\s*$|\s*[^}])/);
        if (jsonMatch) {
          let jsonString = jsonMatch[0];

          // Try to fix incomplete JSON by adding missing closing braces
          const openBraces = (jsonString.match(/\{/g) || []).length;
          const closeBraces = (jsonString.match(/\}/g) || []).length;

          if (openBraces > closeBraces) {
            const missingBraces = openBraces - closeBraces;
            jsonString += '}'.repeat(missingBraces);
          }

          // Try to fix incomplete strings within JSON
          if (jsonString.includes('"correlations": [') && !jsonString.includes(']')) {
            // Find the last incomplete array and close it
            const lastArrayMatch = jsonString.match(/"correlations":\s*\[([^\]]*?)(?:\]|$)/);
            if (lastArrayMatch && !lastArrayMatch[0].endsWith(']')) {
              jsonString = jsonString.replace(lastArrayMatch[0], lastArrayMatch[0] + ']');
            }
          }

          try {
            parsedData = JSON.parse(jsonString);
          } catch (fixError) {
            // Try to extract individual recommendations even if the overall JSON is broken
            parsedData = this.extractPartialRecommendations(analysisText);
          }
        }
      }

      if (parsedData && parsedData.recommendations) {
        let recommendations = parsedData.recommendations.map((rec: any, index: number) => ({
          id: rec.id || `ai - rec - ${index} `,
          priority: rec.priority || 'medium',
          category: rec.category || 'energy',
          action: rec.action || 'Azione generica',
          reason: rec.reason || 'Motivo generico',
          icon: rec.icon || '💡',
          estimatedTime: rec.estimatedTime || '5 min',
          actionable: true,
          detailedExplanation: rec.detailedExplanation || rec.reason || '',
          correlations: Array.isArray(rec.correlations) ? rec.correlations : [],
          expectedBenefits: Array.isArray(rec.expectedBenefits) ? rec.expectedBenefits : []
        }));

        if (recommendations.length < 3) {
          const fallbackRecs = this.generateRecommendations(data);
          const usedCategories = new Set(recommendations.map(r => r.category));

          for (const fallback of fallbackRecs) {
            if (recommendations.length >= 3) break;
            // Add fallbacks from different categories for variety
            if (!usedCategories.has(fallback.category)) {
              recommendations.push(fallback);
              usedCategories.add(fallback.category);
            }
          }

          // If still not enough, add any remaining fallbacks
          for (const fallback of fallbackRecs) {
            if (recommendations.length >= 3) break;
            if (!recommendations.find(r => r.id === fallback.id)) {
              recommendations.push(fallback);
            }
          }
        }

        return {
          overallScore: deterministicScore,
          scoreDetails: scoreResult,
          mood: data.mood,
          sleep: data.sleep,
          healthMetrics: data.healthMetrics,
          recommendations,
          summary: (() => {
            const fallbackSummary = this.generateSummary(data, recommendations);
            return {
              focus: parsedData.focus || fallbackSummary.focus,
              focusEn: parsedData.focusEn || fallbackSummary.focusEn,
              energy: parsedData.energy || fallbackSummary.energy,
              recovery: parsedData.recovery || fallbackSummary.recovery,
              mood: parsedData.mood || fallbackSummary.mood
            };
          })(),
          themeIndicators: this.extractThemeIndicators(recommendations),
        };
      }
    } catch (error) {
      console.error('Error parsing AI analysis:', error);
    }

    return this.generateFallbackAnalysis(data);
  }

  private extractPartialRecommendations(text: string): any {
    const recommendationMatches = text.match(/\{[^}]*"id"[^}]*\}/g);
    if (recommendationMatches && recommendationMatches.length > 0) {
      const recommendations = recommendationMatches.map((match, index) => {
        try {
          return JSON.parse(match);
        } catch {
          // Create a basic recommendation from the text
          const idMatch = match.match(/"id":\s*"([^"]*)"/);
          const actionMatch = match.match(/"action":\s*"([^"]*)"/);
          const reasonMatch = match.match(/"reason":\s*"([^"]*)"/);
          return {
            id: idMatch ? idMatch[1] : `partial - rec - ${index} `,
            action: actionMatch ? actionMatch[1] : 'Azione generica',
            reason: reasonMatch ? reasonMatch[1] : 'Motivo generico',
            priority: 'medium',
            category: 'energy',
            icon: '💡',
            estimatedTime: '5 min'
          };
        }
      });

      return { recommendations };
    }
    return null;
  }

  private async generateFallbackAnalysis(data: CopilotAnalysisRequest): Promise<DailyCopilotData> {
    const scoreResult = await this.calculateDeterministicScore(data);
    const overallScore = scoreResult.score ?? 50;
    const recommendations = this.generateRecommendations(data);
    const summary = this.generateSummary(data, recommendations);
    const themeIndicators = this.extractThemeIndicators(recommendations);

    return {
      overallScore,
      scoreDetails: scoreResult,
      mood: data.mood ?? 0,
      sleep: data.sleep ?? { hours: 0, quality: 0 },
      healthMetrics: {
        steps: data.healthMetrics.steps ?? 0,
        hrv: data.healthMetrics.hrv ?? 0,
        hydration: data.healthMetrics.hydration ?? 0,
        restingHR: data.healthMetrics.restingHR ?? undefined,
        meditationMinutes: await this.getTodayMeditationMinutes()
      },
      recommendations,
      summary,
      themeIndicators,
    };
  }

  private clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  /**
   * Calcolo punteggio deterministico
   * WEIGHTS: mood:15, sleep:15, steps:15, hydration:15, hrv:15, calories:15, meditation:10 = 100
   */
  async calculateDeterministicScore(data: CopilotAnalysisRequest): Promise<ScoreCalculationResult> {
    const goals = await widgetGoalsService.getGoals();

    // Pesi approvati dall'utente
    const WEIGHTS = {
      mood: 15,
      sleep: 15,
      steps: 15,
      hydration: 15,
      hrv: 15,
      calories: 15,
      meditation: 10,
      sleep_auto: 15 // Automated sleep data (e.g. Apple Health) treated as separate factor
    };

    const breakdown: Record<string, ScoreItem> = {};
    const missingData: string[] = [];
    const availableCategories: string[] = [];
    let totalPoints = 0;
    let totalWeight = 0;

    // Mood (15%) - only if not null AND > 0
    if (data.mood !== null && data.mood > 0) {
      const score = (data.mood / 5) * 100;
      breakdown['mood'] = { score, weight: WEIGHTS.mood, value: data.mood };
      totalPoints += (score * WEIGHTS.mood) / 100;
      totalWeight += WEIGHTS.mood;
      availableCategories.push('mood');
    } else {
      missingData.push('mood');
    }

    // Sleep Manual (15%) - only if not null AND hours > 0
    if (data.sleep !== null && data.sleep.hours > 0) {
      const goal = goals.sleep || 8;
      const score = (this.clamp01(data.sleep.hours / goal) * 70) + (data.sleep.quality * 0.3);
      breakdown['sleep'] = { score, weight: WEIGHTS.sleep, value: data.sleep.hours, goal };
      totalPoints += (score * WEIGHTS.sleep) / 100;
      totalWeight += WEIGHTS.sleep;
      availableCategories.push('sleep');
    } else {
      missingData.push('sleep');
    }

    // Sleep Automated (15%) - NEW FACTOR - from Health Data (if manual is missing or present, both count)
    // We treat this as an additional factor ("sleep_auto")
    if (data.healthMetrics.sleepHours !== null && data.healthMetrics.sleepHours > 0) {
      const goal = goals.sleep || 8;
      // Calculate score based on hours (primary) and quality (if available, otherwise estimate)
      // Similar to manual sleep logic
      // If quality is null/0, we assume a decent default or calc from hours for scoring purposes
      const quality = data.healthMetrics.sleepQuality || (data.healthMetrics.sleepHours >= 7 ? 80 : 60);

      const score = (this.clamp01(data.healthMetrics.sleepHours / goal) * 70) + (quality * 0.3);

      breakdown['sleep_auto'] = { score, weight: WEIGHTS.sleep_auto, value: data.healthMetrics.sleepHours, goal };
      totalPoints += (score * WEIGHTS.sleep_auto) / 100;
      totalWeight += WEIGHTS.sleep_auto;
      availableCategories.push('sleep_auto');
    } else {
      missingData.push('sleep_auto');
    }

    // Steps (15%) - only if not null AND > 0
    if (data.healthMetrics.steps !== null && data.healthMetrics.steps > 0) {
      const goal = goals.steps || 10000;
      const score = this.clamp01(data.healthMetrics.steps / goal) * 100;
      breakdown['steps'] = { score, weight: WEIGHTS.steps, value: data.healthMetrics.steps, goal };
      totalPoints += (score * WEIGHTS.steps) / 100;
      totalWeight += WEIGHTS.steps;
      availableCategories.push('steps');
    }

    // Hydration (15%) - only if not null AND > 0
    if (data.healthMetrics.hydration !== null && data.healthMetrics.hydration > 0) {
      const goal = goals.hydration || 8;
      const score = this.clamp01(data.healthMetrics.hydration / goal) * 100;
      breakdown['hydration'] = { score, weight: WEIGHTS.hydration, value: data.healthMetrics.hydration, goal };
      totalPoints += (score * WEIGHTS.hydration) / 100;
      totalWeight += WEIGHTS.hydration;
      availableCategories.push('hydration');
    }

    // HRV (15%) - only if not null AND > 0
    if (data.healthMetrics.hrv !== null && data.healthMetrics.hrv > 0) {
      const score = this.clamp01(data.healthMetrics.hrv / 50) * 100;
      breakdown['hrv'] = { score, weight: WEIGHTS.hrv, value: data.healthMetrics.hrv, goal: 50 };
      totalPoints += (score * WEIGHTS.hrv) / 100;
      totalWeight += WEIGHTS.hrv;
      availableCategories.push('hrv');
    }

    // Calories (15%) - only if not null AND > 0
    if (data.healthMetrics.calories !== null && data.healthMetrics.calories > 0) {
      const goal = goals.calories || 2000;
      // Score based on achieving ~80-100% of calorie goal
      const ratio = data.healthMetrics.calories / goal;
      let score: number;
      if (ratio >= 0.8 && ratio <= 1.0) {
        score = 100; // Optimal range
      } else if (ratio < 0.8) {
        score = (ratio / 0.8) * 100; // Under-eating
      } else {
        // Over 100% - slight penalty for over-eating
        score = Math.max(60, 100 - ((ratio - 1.0) * 50));
      }
      breakdown['calories'] = { score, weight: WEIGHTS.calories, value: data.healthMetrics.calories, goal };
      totalPoints += (score * WEIGHTS.calories) / 100;
      totalWeight += WEIGHTS.calories;
      availableCategories.push('calories');
    }

    // Meditation (10%) - only if not null AND > 0
    if (data.healthMetrics.meditationMinutes !== null && data.healthMetrics.meditationMinutes > 0) {
      const goal = goals.meditation || 10; // Default 10 minutes meditation goal
      const score = Math.min(this.clamp01(data.healthMetrics.meditationMinutes / goal), 1) * 100;
      breakdown['meditation'] = { score, weight: WEIGHTS.meditation, value: data.healthMetrics.meditationMinutes, goal };
      totalPoints += (score * WEIGHTS.meditation) / 100;
      totalWeight += WEIGHTS.meditation;
      availableCategories.push('meditation');
    }

    // Require at least 3 factors for a valid score
    if (availableCategories.length < 3) {
      return {
        score: null,
        breakdown,
        missingData,
        availableCategories
      };
    }

    const finalScore = totalWeight > 0 ? (totalPoints / totalWeight) * 100 : null;
    return {
      score: finalScore !== null ? Math.round(finalScore) : null,
      breakdown,
      missingData,
      availableCategories
    };
  }

  private generateRecommendations(data: CopilotAnalysisRequest) {
    const recommendations = [];

    // Fallback: generazione basata sui dati
    console.log('🔄 Using fallback recommendations');

    // Helper to get safe values
    const safeMood = data.mood ?? 3;  // Default to neutral mood
    const safeSleepHours = data.sleep?.hours ?? 7;  // Default to adequate sleep
    const safeSleepQuality = data.sleep?.quality ?? 70;
    const safeSteps = data.healthMetrics.steps ?? 0;
    const safeHrv = data.healthMetrics.hrv ?? 50;
    const safeHydration = data.healthMetrics.hydration ?? 0;

    const displayHrv = (data.healthMetrics.hrv !== null && data.healthMetrics.hrv > 0)
      ? `${data.healthMetrics.hrv}ms`
      : '--';

    // Mood basso (only if mood data is actually provided)
    if (data.mood !== null && data.mood <= 2) {
      recommendations.push({
        id: 'mood-boost',
        priority: 'high' as const,
        category: 'mindfulness' as const,
        action: 'Pratica 10 minuti di respirazione profonda',
        reason: 'Il tuo umore è basso, la respirazione può aiutare a riequilibrare',
        icon: '🌬️',
        estimatedTime: '10 min',
        actionable: true,
        detailedExplanation: `Il tuo umore attuale (${safeMood}/5) indica uno stato di stress o affaticamento. La respirazione profonda attiva il sistema nervoso parasimpatico, riducendo i livelli di cortisolo e aumentando la produzione di endorfine. Questo esercizio può migliorare immediatamente il tuo stato d'animo e ridurre la tensione muscolare.`,
        correlations: [
          `Mood basso (${safeMood}/5) correlato con stress elevato`,
          `HRV ${safeHrv}ms indica sistema nervoso in tensione`,
          `Sonno ${safeSleepHours}h può influenzare l'umore mattutino`
        ],
        expectedBenefits: [
          'Riduzione immediata dello stress',
          'Miglioramento dell\'umore in 5-10 minuti',
          'Attivazione del sistema di rilassamento naturale',
          'Riduzione della frequenza cardiaca'
        ]
      });
    }

    // Sonno insufficiente (only if sleep data is provided)
    if (data.sleep !== null && data.sleep.hours < 7) {
      recommendations.push({
        id: 'sleep-recovery',
        priority: 'high' as const,
        category: 'recovery' as const,
        action: 'Fai un pisolino di 20 minuti o vai a letto prima stasera',
        reason: 'Hai dormito solo ' + safeSleepHours + 'h, il recupero è importante',
        icon: '😴',
        estimatedTime: '20 min',
        actionable: true,
        detailedExplanation: `Il sonno di ${safeSleepHours}h è insufficiente per un recupero ottimale. La privazione del sonno influisce negativamente su HRV (${safeHrv}ms), umore (${safeMood}/5) e performance cognitive. Un pisolino di 20 minuti può migliorare l'attenzione e ridurre la sonnolenza senza interferire con il sonno notturno.`,
        correlations: [
          `Sonno insufficiente (${safeSleepHours}h) correlato con HRV basso`,
          `Qualità sonno ${safeSleepQuality}% influisce sul recupero`,
          `Mood ${safeMood}/5 può essere influenzato dalla privazione del sonno`
        ],
        expectedBenefits: [
          'Miglioramento dell\'attenzione e concentrazione',
          'Riduzione della sonnolenza diurna',
          'Supporto al sistema immunitario',
          'Miglioramento dell\'umore e dell\'energia'
        ]
      });
    }

    // Passi bassi (only if steps data is provided)
    if (data.healthMetrics.steps !== null && data.healthMetrics.steps < 300) {
      recommendations.push({
        id: 'movement-boost',
        priority: 'medium' as const,
        category: 'movement' as const,
        action: 'Fai una camminata di 15 minuti',
        reason: 'Solo ' + safeSteps + ' passi oggi, muoviti di più',
        icon: '🚶',
        estimatedTime: '15 min',
        actionable: true,
        detailedExplanation: `Con solo ${safeSteps} passi oggi, sei ben al di sotto della raccomandazione di 10.000 passi giornalieri. Una camminata di 15 minuti può aumentare significativamente la circolazione sanguigna, migliorare l'umore attraverso il rilascio di endorfine, e aiutare a mantenere la massa muscolare. Il movimento regolare è essenziale per la salute cardiovascolare e il metabolismo.`,
        correlations: [
          `Bassi passi (${safeSteps}) correlati con minore energia diurna`,
          `Mancanza di movimento può influenzare negativamente l'HRV (${safeHrv}ms)`,
          `Attività fisica regolare migliora la qualità del sonno`
        ],
        expectedBenefits: [
          'Aumento della circolazione sanguigna',
          'Miglioramento dell\'umore e dell\'energia',
          'Supporto alla salute cardiovascolare',
          'Miglioramento del metabolismo'
        ]
      });
    }

    // HRV basso (only if hrv data is provided and > 0)
    if (data.healthMetrics.hrv !== null && data.healthMetrics.hrv > 0 && data.healthMetrics.hrv < 30) {
      recommendations.push({
        id: 'stress-reduction',
        priority: 'high' as const,
        category: 'recovery' as const,
        action: 'Pratica meditazione o yoga per ridurre lo stress',
        reason: 'HRV basso (' + safeHrv + 'ms) indica stress elevato',
        icon: '🧘',
        estimatedTime: '15 min',
        actionable: true,
        detailedExplanation: `Il tuo HRV di ${safeHrv}ms è al di sotto della media, indicando un sistema nervoso simpatico iperattivo e stress elevato. La meditazione e lo yoga attivano il sistema nervoso parasimpatico, aumentando la variabilità della frequenza cardiaca. Queste pratiche riducono i livelli di cortisolo e promuovono il recupero fisiologico.`,
        correlations: [
          `HRV basso (${safeHrv}ms) correlato con stress cronico`,
          `Sonno insufficiente (${safeSleepHours}h) può contribuire a HRV basso`,
          `Mood ${safeMood}/5 può essere influenzato dallo stress elevato`
        ],
        expectedBenefits: [
          'Riduzione dei livelli di cortisolo',
          'Aumento della variabilità della frequenza cardiaca',
          'Miglioramento del recupero fisiologico',
          'Riduzione dello stress percepito'
        ]
      });
    }

    // Idratazione bassa (only if hydration data is provided)
    if (data.healthMetrics.hydration !== null && data.healthMetrics.hydration < 2) {
      recommendations.push({
        id: 'hydration',
        priority: 'medium' as const,
        category: 'nutrition' as const,
        action: 'Bevi 2 bicchieri d\'acqua ora',
        reason: 'Solo ' + safeHydration + '/8 bicchieri, idratati di più',
        icon: '💧',
        estimatedTime: '2 min',
        actionable: true,
        detailedExplanation: `Con solo ${safeHydration}/8 bicchieri d'acqua consumati oggi, sei al di sotto della raccomandazione giornaliera. L'idratazione adeguata è essenziale per il funzionamento ottimale di tutti i sistemi corporei, inclusi la circolazione, la digestione, la termoregolazione e la funzione cognitiva. Una disidratazione anche lieve può influenzare negativamente l'umore, l'energia e le performance fisiche.`,
        correlations: [
          `Bassa idratazione (${safeHydration}/8) può influenzare l'energia diurna`,
          `Disidratazione può contribuire a HRV basso (${safeHrv}ms)`,
          `Adeguata idratazione migliora la qualità della pelle e la funzione renale`
        ],
        expectedBenefits: [
          'Miglioramento della funzione cognitiva',
          'Aumento dell\'energia e riduzione della fatica',
          'Supporto alla circolazione sanguigna',
          'Miglioramento della qualità della pelle'
        ]
      });
    }

    // 🔥 NEW: Always add diverse "general wellness" recommendations to ensure variety
    // These are positive suggestions that are always relevant
    const generalRecommendations = [
      {
        id: 'mindfulness-moment',
        priority: 'low' as const,
        category: 'mindfulness' as const,
        action: 'Prenditi 5 minuti per respirare profondamente',
        reason: 'Un momento di calma migliora focus e concentrazione',
        icon: '🧘',
        estimatedTime: '5 min',
        actionable: true,
        detailedExplanation: `La respirazione profonda attiva il sistema nervoso parasimpatico, riducendo cortisolo e stress. Bastano 5 minuti di respiro consapevole per migliorare la chiarezza mentale e ridurre la tensione accumulata. Questa pratica può aumentare la variabilità della frequenza cardiaca (HRV) e migliorare la resilienza allo stress.`,
        correlations: [
          `Pratiche di mindfulness possono migliorare l'HRV (attualmente ${displayHrv})`,
          `La respirazione profonda riduce la pressione sanguigna`,
          `Momenti di calma migliorano la qualità del sonno`
        ],
        expectedBenefits: [
          'Riduzione dello stress e dell\'ansia',
          'Miglioramento della concentrazione',
          'Aumento della chiarezza mentale',
          'Supporto al recupero del sistema nervoso'
        ]
      },
      {
        id: 'movement-wellness',
        priority: 'low' as const,
        category: 'movement' as const,
        action: 'Fai stretching per 5-10 minuti',
        reason: 'Lo stretching mantiene flessibilità e riduce tensioni',
        icon: '🤸',
        estimatedTime: '10 min',
        actionable: true,
        detailedExplanation: `Lo stretching regolare migliora la flessibilità muscolare, riduce il rischio di infortuni e allevia le tensioni accumulate. È particolarmente utile se passi molto tempo seduto. Lo stretching può anche migliorare la circolazione e ridurre dolori muscolari.`,
        correlations: [
          `Lo stretching migliora la circolazione sanguigna`,
          `Riduce la rigidità muscolare da sedentarietà`,
          `Può migliorare la qualità del sonno riducendo tensioni`
        ],
        expectedBenefits: [
          'Miglioramento della flessibilità',
          'Riduzione delle tensioni muscolari',
          'Prevenzione del dolore alla schiena',
          'Miglioramento della postura'
        ]
      },
      {
        id: 'nutrition-boost',
        priority: 'low' as const,
        category: 'nutrition' as const,
        action: 'Aggiungi una porzione di frutta o verdura al prossimo pasto',
        reason: 'Vitamine e antiossidanti supportano energia e benessere',
        icon: '🥗',
        estimatedTime: '5 min',
        actionable: true,
        detailedExplanation: `Frutta e verdura forniscono vitamine, minerali e antiossidanti essenziali per il funzionamento ottimale del corpo. Aumentare l'assunzione di questi alimenti può migliorare energia, umore e salute generale.`,
        correlations: [
          `Una dieta ricca di nutrienti supporta l'energia mentale`,
          `Gli antiossidanti riducono l'infiammazione e lo stress ossidativo`,
          `Le fibre migliorano la salute digestiva`
        ],
        expectedBenefits: [
          'Aumento dell\'energia naturale',
          'Supporto al sistema immunitario',
          'Miglioramento della salute digestiva',
          'Protezione antiossidante per le cellule'
        ]
      },
      {
        id: 'energy-maintenance',
        priority: 'low' as const,
        category: 'energy' as const,
        action: 'Mantieni questo ritmo! Considera una passeggiata al sole',
        reason: 'I tuoi valori sono buoni, mantieni l\'energia positiva',
        icon: '☀️',
        estimatedTime: '10 min',
        actionable: true,
        detailedExplanation: `I tuoi parametri mostrano un buon equilibrio: umore ${data.mood}/5, sonno ${data.sleep.hours}h con qualità ${data.sleep.quality}%, HRV ${displayHrv}. Una passeggiata al sole può ottimizzare ulteriormente questi valori. L'esposizione alla luce naturale regola il ritmo circadiano, aumenta la produzione di vitamina D e migliora l'umore.`,
        correlations: [
          `Mood positivo (${data.mood}/5) supportato da buon sonno`,
          `HRV ${displayHrv} indica buon recupero`,
          `La luce solare regola il ritmo circadiano`
        ],
        expectedBenefits: [
          'Aumento della produzione di vitamina D',
          'Miglioramento del ritmo circadiano',
          'Incremento della serotonina',
          'Supporto al sistema immunitario'
        ]
      }
    ];

    // Add general recommendations to fill gaps - prioritize different categories
    const usedCategories = new Set(recommendations.map(r => r.category));
    for (const generalRec of generalRecommendations) {
      if (recommendations.length >= 4) break;
      if (!usedCategories.has(generalRec.category)) {
        recommendations.push(generalRec);
        usedCategories.add(generalRec.category);
      }
    }

    return recommendations.slice(0, 3);
  }

  private readonly CATEGORY_CONFIG: Record<string, { icon: string; labelIt: string; labelEn: string; color: string }> = {
    nutrition: { icon: 'food-apple', labelIt: 'Nutrizione', labelEn: 'Nutrition', color: '#f59e0b' },
    movement: { icon: 'run', labelIt: 'Movimento', labelEn: 'Movement', color: '#10b981' },
    recovery: { icon: 'bed', labelIt: 'Recupero', labelEn: 'Recovery', color: '#3b82f6' },
    mindfulness: { icon: 'meditation', labelIt: 'Mindfulness', labelEn: 'Mindfulness', color: '#8b5cf6' },
    energy: { icon: 'lightning-bolt', labelIt: 'Energia', labelEn: 'Energy', color: '#f97316' },
  };

  private extractThemeIndicators(recommendations: DailyCopilotData['recommendations']): ThemeIndicator[] {
    const defaultIndicators: ThemeIndicator[] = [
      { icon: 'lightning-bolt', label: 'Energia', labelEn: 'Energy', color: '#f97316', category: 'energy' },
      { icon: 'food-apple', label: 'Nutrizione', labelEn: 'Nutrition', color: '#f59e0b', category: 'nutrition' },
      { icon: 'run', label: 'Movimento', labelEn: 'Movement', color: '#10b981', category: 'movement' },
    ];

    if (!recommendations || recommendations.length === 0) {
      // Return first 3 defaults
      return defaultIndicators.slice(0, 3);
    }

    // Get unique categories from recommendations, preserving order by priority
    const sortedRecs = [...recommendations].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const uniqueCategories: string[] = [];
    for (const rec of sortedRecs) {
      if (!uniqueCategories.includes(rec.category)) {
        uniqueCategories.push(rec.category);
      }
    }

    // Build result from actual categories
    const result: ThemeIndicator[] = uniqueCategories.map(category => {
      const config = this.CATEGORY_CONFIG[category] || this.CATEGORY_CONFIG.energy;
      return {
        icon: config.icon,
        label: config.labelIt,
        labelEn: config.labelEn,
        color: config.color,
        category: category as ThemeIndicator['category'],
      };
    });
    return [...result, ...defaultIndicators].slice(0, 3);
  }

  /**
   * Generates dynamic focus phrase based on actual recommendation categories
   */
  private generateDynamicFocus(recommendations: DailyCopilotData['recommendations']): { focus: string; focusEn: string } {
    if (!recommendations || recommendations.length === 0) {
      return { focus: 'Benessere Generale', focusEn: 'General Wellness' };
    }

    // Count categories weighted by priority
    const categoryWeight: Record<string, number> = {};
    for (const rec of recommendations) {
      const weight = rec.priority === 'high' ? 3 : rec.priority === 'medium' ? 2 : 1;
      categoryWeight[rec.category] = (categoryWeight[rec.category] || 0) + weight;
    }

    // Sort by weight and get top 2
    const sorted = Object.entries(categoryWeight)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([cat]) => cat);

    const focusPhrases: Record<string, { it: string; en: string }> = {
      nutrition: { it: 'Nutrizione', en: 'Nutrition' },
      movement: { it: 'Movimento', en: 'Movement' },
      recovery: { it: 'Recupero', en: 'Recovery' },
      mindfulness: { it: 'Equilibrio Mentale', en: 'Mental Balance' },
      energy: { it: 'Energia', en: 'Energy' },
    };

    if (sorted.length >= 2) {
      const first = focusPhrases[sorted[0]] || { it: 'Benessere', en: 'Wellness' };
      const second = focusPhrases[sorted[1]] || { it: 'Crescita', en: 'Growth' };
      return {
        focus: `${first.it} & ${second.it}`,
        focusEn: `${first.en} & ${second.en}`,
      };
    } else if (sorted.length === 1) {
      const single = focusPhrases[sorted[0]] || { it: 'Benessere', en: 'Wellness' };
      return {
        focus: `${single.it} & Benessere`,
        focusEn: `${single.en} & Wellness`,
      };
    }

    return { focus: 'Benessere Generale', focusEn: 'General Wellness' };
  }

  /**
   * Genera il riassunto - now uses dynamic focus based on recommendations
   */
  private generateSummary(data: CopilotAnalysisRequest, recommendations?: DailyCopilotData['recommendations']): {
    focus: string;
    focusEn: string;
    energy: 'high' | 'medium' | 'low';
    recovery: 'excellent' | 'good' | 'needs_attention';
    mood: 'positive' | 'neutral' | 'low';
  } {
    // Safe access to nullable values
    const safeMood = data.mood ?? 3;
    const safeHrv = data.healthMetrics.hrv ?? 35;
    const safeSleepHours = data.sleep?.hours ?? 6;
    const safeSleepQuality = data.sleep?.quality ?? 50;
    const safeSteps = data.healthMetrics.steps ?? 0;

    const energy: 'high' | 'medium' | 'low' = safeMood >= 4 && safeHrv >= 35 ? 'high' :
      safeMood >= 3 && safeHrv >= 25 ? 'medium' : 'low';

    const recovery: 'excellent' | 'good' | 'needs_attention' = safeSleepHours >= 7 && safeSleepQuality >= 80 ? 'excellent' :
      safeSleepHours >= 6 && safeSleepQuality >= 60 ? 'good' : 'needs_attention';

    const mood: 'positive' | 'neutral' | 'low' = safeMood >= 4 ? 'positive' : safeMood >= 3 ? 'neutral' : 'low';

    // Use dynamic focus based on recommendations if available
    const { focus, focusEn } = recommendations && recommendations.length > 0
      ? this.generateDynamicFocus(recommendations)
      : {
        focus: energy === 'low' ? 'Energia & Recupero' :
          recovery === 'needs_attention' ? 'Riposo & Benessere' :
            safeSteps < 5000 ? 'Movimento & Vitalità' :
              'Mantenimento & Crescita',
        focusEn: energy === 'low' ? 'Energy & Recovery' :
          recovery === 'needs_attention' ? 'Rest & Wellness' :
            safeSteps < 5000 ? 'Movement & Vitality' :
              'Maintenance & Growth',
      };

    return { focus, focusEn, energy, recovery, mood };
  }

  private getCachedAnalysis(key: string): DailyCopilotData | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() < expiry) return this.cache.get(key) || null;
    return null;
  }

  private setCachedAnalysis(key: string, data: DailyCopilotData): void {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
  }

  private convertDBRecordToCopilotData(dbRecord: any): DailyCopilotData {
    try {
      // 🔥 FIX: Gestisci i casi in cui i dati potrebbero essere stringhe JSON invece di oggetti
      const healthMetrics = typeof dbRecord.health_metrics === 'string'
        ? JSON.parse(dbRecord.health_metrics)
        : (dbRecord.health_metrics || {});

      const recommendations = typeof dbRecord.recommendations === 'string'
        ? JSON.parse(dbRecord.recommendations)
        : (dbRecord.recommendations || []);

      const summary = typeof dbRecord.summary === 'string'
        ? JSON.parse(dbRecord.summary)
        : (dbRecord.summary || {});

      // 🔥 FIX: Assicurati che recommendations sia un array e converti i campi
      const recommendationsArray = Array.isArray(recommendations)
        ? recommendations.map((rec: any) => ({
          id: rec.id || `rec-${Date.now()}-${Math.random()}`,
          priority: rec.priority || 'medium',
          category: rec.category || 'energy',
          action: rec.action || '',
          reason: rec.reason || '',
          icon: rec.icon || '💡',
          estimatedTime: rec.estimated_time || rec.estimatedTime || undefined,
          actionable: rec.actionable !== undefined ? rec.actionable : true,
          detailedExplanation: rec.detailed_explanation || rec.detailedExplanation,
          correlations: rec.correlations || [],
          expectedBenefits: rec.expected_benefits || rec.expectedBenefits || [],
        }))
        : [];

      // 🔥 FIX: Assicurati che summary abbia i campi necessari
      const summaryData = {
        focus: summary.focus || 'Mantenimento & Crescita',
        focusEn: summary.focusEn || 'Maintenance & Growth',
        energy: summary.energy || 'medium',
        recovery: summary.recovery || 'good',
        mood: summary.mood || 'neutral',
      };

      // Extract theme indicators from recommendations
      const themeIndicators = this.extractThemeIndicators(recommendationsArray);

      return {
        overallScore: dbRecord.overall_score || 50,
        mood: dbRecord.mood || 3,
        sleep: { hours: dbRecord.sleep_hours || 7.5, quality: dbRecord.sleep_quality || 80 },
        healthMetrics,
        recommendations: recommendationsArray,
        summary: summaryData,
        themeIndicators,
      };
    } catch (error) {
      console.error('Error converting DB record:', error);
      return {
        overallScore: 50,
        mood: 3,
        sleep: { hours: 7.5, quality: 80 },
        healthMetrics: { steps: 0, hrv: 0, hydration: 0, meditationMinutes: 0 },
        recommendations: [],
        summary: { focus: 'Benessere', focusEn: 'Wellness', energy: 'medium', recovery: 'good', mood: 'neutral' },
        themeIndicators: []
      };
    }
  }

  invalidateCache(): void { this.cache.clear(); this.cacheExpiry.clear(); }
  async getCopilotStats(userId: string, days: number = 30) { return await this.dbService.getDailyCopilotStats(userId, days); }
  async getCopilotHistory(userId: string, limit: number = 30) { return await this.dbService.getDailyCopilotHistory(userId, limit); }
  async getTrendData(userId: string, days: number = 14) { return await this.dbService.getTrendData(userId, days); }
}

export default DailyCopilotService;
