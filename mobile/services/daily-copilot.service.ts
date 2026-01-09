import { AuthService } from './auth.service';
import { getBackendURL } from '../constants/env';
import { AIContextService } from './ai-context.service';
import DailyCopilotDBService from './daily-copilot-db.service';
import { RetryService } from './retry.service';
import { getUserLanguage, getLanguageInstruction } from './language.service';

export interface ThemeIndicator {
  icon: string;
  label: string;
  labelEn: string;
  color: string;
  category: 'nutrition' | 'movement' | 'recovery' | 'mindfulness' | 'energy';
}

export interface DailyCopilotData {
  overallScore: number;        // 0-100
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
    // Altri dati HealthKit
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

export interface CopilotAnalysisRequest {
  mood: number;
  sleep: { hours: number; quality: number; };
  healthMetrics: {
    steps: number;
    hrv: number;
    hydration: number;
    restingHR?: number;
  };
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
   */
  async generateDailyCopilotAnalysis(): Promise<DailyCopilotData | null> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        // 🔥 PERF: Removed verbose logging
        return null;
      }

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const cacheKey = `copilot_${currentUser.id}_${today}`;

      const dbResult = await this.dbService.getDailyCopilotData(currentUser.id, today);
      if (dbResult.success && dbResult.data) {
        // 🔥 PERF: Removed verbose logging
        const savedData = this.convertDBRecordToCopilotData(dbResult.data);
        // 🔥 PERF: Removed verbose logging
        this.setCachedAnalysis(cacheKey, savedData);
        return savedData;
      } else {
        // 🔥 PERF: Removed verbose logging
      }

      // Check cache as fallback
      const cached = this.getCachedAnalysis(cacheKey);
      if (cached) {
        return cached;
      }

      // 🔥 PERF: Removed verbose logging
      const analysisData = await this.collectAnalysisData(currentUser.id);
      if (!analysisData) {
        // 🔥 PERF: Keep only warning
        console.warn('⚠️ Daily Copilot: No data available for analysis, using fallback');
        const fallbackData: CopilotAnalysisRequest = {
          mood: 3,
          sleep: { hours: 7.5, quality: 80 },
          healthMetrics: {
            steps: 5000,
            hrv: 35,
            hydration: 6,
            restingHR: 65
          },
          timestamp: new Date().toISOString()
        };
        const fallbackAnalysis = this.generateFallbackAnalysis(fallbackData);
        // Salva comunque nel database
        await this.dbService.saveDailyCopilotData(currentUser.id, fallbackAnalysis);
        return fallbackAnalysis;
      }

      // 🔥 PERF: Removed verbose logging

      // Genera l'analisi tramite AI
      // 🔥 PERF: Removed verbose logging
      const copilotData = await this.generateAIAnalysis(analysisData, currentUser.id);
      if (!copilotData) {
        console.warn('⚠️ Daily Copilot: AI analysis failed, using fallback');
        // 🔥 FIX: Usa fallback invece di ritornare null
        const fallbackAnalysis = this.generateFallbackAnalysis(analysisData);
        // Salva comunque nel database
        await this.dbService.saveDailyCopilotData(currentUser.id, fallbackAnalysis);
        return fallbackAnalysis;
      }

      // 🔥 PERF: Removed verbose logging

      // Save to database
      const saveResult = await this.dbService.saveDailyCopilotData(currentUser.id, copilotData);
      if (!saveResult.success) {
        console.warn('⚠️ Failed to save Daily Copilot data to database:', saveResult.error);
      }

      // Cache the result
      this.setCachedAnalysis(cacheKey, copilotData);

      return copilotData;

    } catch (error) {
      console.error('Error generating Daily Copilot analysis:', error);
      return null;
    }
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

      // Dati HealthKit/metriche
      const healthMetrics = await this.getHealthMetrics(aiContext);

      return {
        mood,
        sleep,
        healthMetrics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error collecting analysis data:', error);
      return null;
    }
  }

  /**
   * Ottiene il mood per l'analisi (oggi se disponibile, altrimenti ieri)
   * 🔥 LOGICA: All'apertura dell'app al mattino, usa i dati di ieri (sera prima)
   */
  private async getTodayMood(): Promise<number> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return 3; // Default neutro
      }

      const { supabase } = await import('../lib/supabase');
      // ✅ FIX: Use local timezone for "today" to avoid timezone issues
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 🔥 FIX: Prima prova a leggere i dati di OGGI
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

      // 🔥 FIX: Se non ci sono dati di oggi, usa i dati di IERI (sera prima)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const { data: yesterdayCheckin } = await supabase
        .from('daily_copilot_analyses')
        .select('mood')
        .eq('user_id', currentUser.id)
        .eq('date', yesterdayKey)
        .maybeSingle();

      if (yesterdayCheckin?.mood !== null && yesterdayCheckin?.mood !== undefined) {
        console.log('ℹ️ Daily Copilot: Using yesterday\'s mood (evening before):', yesterdayCheckin.mood);
        return yesterdayCheckin.mood;
      }

      // Fallback ad AsyncStorage per retrocompatibilità
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const savedMood = await AsyncStorage.getItem(`checkin:mood:${today}`);
      if (savedMood) {
        return parseInt(savedMood, 10);
      }

      // Fallback finale: default neutro
      console.log('⚠️ Daily Copilot: No mood data found, using default (3)');
      return 3;
    } catch (error) {
      console.error('❌ Error getting mood:', error);
      return 3;
    }
  }

  /**
   * Ottiene i dati del sonno per l'analisi (oggi se disponibile, altrimenti ieri)
   * 🔥 LOGICA: All'apertura dell'app al mattino, usa i dati di ieri (sera prima)
   */
  private async getTodaySleep(): Promise<{ hours: number; quality: number; }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return { hours: 7.5, quality: 80 }; // Default
      }

      const { supabase } = await import('../lib/supabase');
      const today = new Date().toISOString().slice(0, 10);

      // 🔥 FIX: Prima prova a leggere i dati di OGGI
      const { data: todayCheckin } = await supabase
        .from('daily_copilot_analyses')
        .select('sleep_hours, sleep_quality')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (todayCheckin && (todayCheckin.sleep_hours || todayCheckin.sleep_quality)) {
        console.log('✅ Daily Copilot: Using today\'s sleep:', {
          hours: todayCheckin.sleep_hours,
          quality: todayCheckin.sleep_quality
        });
        return {
          hours: todayCheckin.sleep_hours || 7.5,
          quality: todayCheckin.sleep_quality || 80
        };
      }

      // 🔥 FIX: Se non ci sono dati di oggi, usa i dati di IERI (sera prima)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);

      const { data: yesterdayCheckin } = await supabase
        .from('daily_copilot_analyses')
        .select('sleep_hours, sleep_quality')
        .eq('user_id', currentUser.id)
        .eq('date', yesterdayKey)
        .maybeSingle();

      if (yesterdayCheckin && (yesterdayCheckin.sleep_hours || yesterdayCheckin.sleep_quality)) {
        console.log('ℹ️ Daily Copilot: Using yesterday\'s sleep (evening before):', {
          hours: yesterdayCheckin.sleep_hours,
          quality: yesterdayCheckin.sleep_quality
        });
        return {
          hours: yesterdayCheckin.sleep_hours || 7.5,
          quality: yesterdayCheckin.sleep_quality || 80
        };
      }

      // Fallback ad AsyncStorage per retrocompatibilità
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const savedSleep = await AsyncStorage.getItem(`checkin:sleep:${today}`);

      if (savedSleep) {
        return {
          hours: 7.5,
          quality: parseInt(savedSleep, 10)
        };
      }

      // Fallback finale: default
      console.log('⚠️ Daily Copilot: No sleep data found, using default (7.5h, 80%)');
      return { hours: 7.5, quality: 80 };
    } catch (error) {
      console.error('❌ Error getting sleep:', error);
      return { hours: 7.5, quality: 80 };
    }
  }

  /**
   * Ottiene le metriche di salute - 🔥 FIX: Prende i dati reali dal database o HealthDataService
   */
  private async getHealthMetrics(aiContext: any): Promise<{
    steps: number;
    hrv: number;
    hydration: number;
    restingHR?: number;
  }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return { steps: 5000, hrv: 35, hydration: 6, restingHR: 65 };
      }

      // 🔥 FIX: Prova prima a prendere i dati dal database (più aggiornati)
      const { supabase } = await import('../lib/supabase');
      const today = new Date().toISOString().split('T')[0];

      const { data: healthData } = await supabase
        .from('health_data')
        .select('steps, hrv, hydration, resting_heart_rate')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (healthData) {
        console.log('✅ Daily Copilot: Using real health data from database:', {
          steps: healthData.steps,
          hrv: healthData.hrv,
          hydration: healthData.hydration ? Math.round(healthData.hydration / 250) : 6,
          restingHR: healthData.resting_heart_rate
        });

        return {
          steps: healthData.steps || 5000,
          hrv: healthData.hrv || 35,
          hydration: healthData.hydration ? Math.round(healthData.hydration / 250) : 6, // Converti ml in bicchieri
          restingHR: healthData.resting_heart_rate || 65
        };
      }

      // 🔥 FIX: Fallback a HealthDataService per dati in tempo reale
      try {
        const { HealthDataService } = await import('./health-data.service');
        const healthService = HealthDataService.getInstance();
        const syncResult = await healthService.syncHealthData(false);

        if (syncResult.success && syncResult.data) {
          const data = syncResult.data;
          console.log('✅ Daily Copilot: Using real health data from HealthDataService:', {
            steps: data.steps,
            hrv: data.hrv,
            hydration: data.hydration ? Math.round(data.hydration / 250) : 6,
            restingHR: data.restingHeartRate
          });

          return {
            steps: data.steps || 5000,
            hrv: data.hrv || 35,
            hydration: data.hydration ? Math.round(data.hydration / 250) : 6,
            restingHR: data.restingHeartRate || 65
          };
        }
      } catch (healthServiceError) {
        console.warn('⚠️ Daily Copilot: HealthDataService sync failed, using defaults');
      }

      // 🔥 FIX: Ultimo fallback: usa i dati dal contesto AI se disponibili
      if (aiContext?.currentHealth) {
        return {
          steps: aiContext.currentHealth.steps || 5000,
          hrv: aiContext.currentHealth.hrv || 35,
          hydration: aiContext.currentHealth.hydration || 6,
          restingHR: aiContext.currentHealth.restingHR || 65
        };
      }

      // Fallback finale: valori di default
      console.warn('⚠️ Daily Copilot: No health data available, using defaults');
      return { steps: 5000, hrv: 35, hydration: 6, restingHR: 65 };
    } catch (error) {
      console.error('❌ Error getting health metrics:', error);
      return { steps: 5000, hrv: 35, hydration: 6, restingHR: 65 };
    }
  }

  /**
   * Genera l'analisi tramite AI
   * ✅ Include: timeout, retry logic, gestione errori robusta
   */
  private async generateAIAnalysis(
    data: CopilotAnalysisRequest,
    userId: string
  ): Promise<DailyCopilotData | null> {
    // 🔥 FIX: Ottieni la lingua corrente dell'utente
    const userLanguage = await getUserLanguage();
    const languageInstruction = getLanguageInstruction(userLanguage);

    // 🔥 FIX: Ottieni contesto aggiuntivo per arricchire il prompt
    let contextInfo = '';
    let menstrualCycleContext = null;
    let nutritionContext = null;
    try {
      // 🔥 FIX: Force refresh to ensure food/nutrition data is current
      const aiContext = await AIContextService.getCompleteContext(userId, true);

      // Aggiungi informazioni sul contesto emotivo e della pelle se disponibili
      if (aiContext.currentEmotion) {
        contextInfo += `\n- Emotional state: ${aiContext.currentEmotion.emotion} (valence: ${aiContext.currentEmotion.valence.toFixed(2)}, arousal: ${aiContext.currentEmotion.arousal.toFixed(2)})\n`;
      }

      if (aiContext.currentSkin) {
        contextInfo += `- Skin status score: ${aiContext.currentSkin.overallScore}/100\n`;
      }

      if (aiContext.emotionTrend) {
        const trendText = aiContext.emotionTrend === 'improving' ? 'improving' : aiContext.emotionTrend === 'declining' ? 'worsening' : 'stable';
        contextInfo += `- Emotional trend: ${trendText}\n`;
      }

      if (aiContext.insights && aiContext.insights.length > 0) {
        contextInfo += `\n- Recent insights:\n${aiContext.insights.slice(0, 3).map(i => `  - ${i}`).join('\n')}\n`;
      }

      if (aiContext.behavioralInsights?.improvementAreas && aiContext.behavioralInsights.improvementAreas.length > 0) {
        contextInfo += `\n- Areas of improvement:\n${aiContext.behavioralInsights.improvementAreas.slice(0, 2).map(a => `  - ${a}`).join('\n')}\n`;
      }

      // 🔥 FIX: Aggiungi contesto ciclo mestruale se disponibile
      if (aiContext.menstrualCycleContext) {
        menstrualCycleContext = aiContext.menstrualCycleContext;
        contextInfo += `\n🩸 MENSTRUAL CYCLE:\n`;
        if (aiContext.menstrualCycleContext.phase) {
          contextInfo += `- Current phase: ${aiContext.menstrualCycleContext.phase}\n`;
        }
        if (aiContext.menstrualCycleContext.day) {
          contextInfo += `- Cycle day: ${aiContext.menstrualCycleContext.day}\n`;
        }
        if (aiContext.menstrualCycleContext.nextPeriodDays !== undefined) {
          contextInfo += `- Days until next period: ${aiContext.menstrualCycleContext.nextPeriodDays}\n`;
        }
        if (aiContext.menstrualCycleContext.recentNotes) {
          contextInfo += `- Recent notes: ${aiContext.menstrualCycleContext.recentNotes}\n`;
        }
        contextInfo += `\n💡 Use this information to personalize recommendations based on cycle phase (e.g., more rest during menstrual phase, more energy during ovulatory phase).\n`;
      }

      // 🔥 FIX: Aggiungi contesto nutrizionale se disponibile
      if (aiContext.nutritionContext) {
        nutritionContext = aiContext.nutritionContext;
        contextInfo += `\n🍽️ NUTRITION TODAY:\n`;
        if (aiContext.nutritionContext.todayCalories !== undefined) {
          contextInfo += `- Calories consumed: ${aiContext.nutritionContext.todayCalories} kcal\n`;
        }
        if (aiContext.nutritionContext.todayMacros) {
          const macros = aiContext.nutritionContext.todayMacros;
          contextInfo += `- Macros: Protein ${macros.protein || 0}g, Carbs ${macros.carbs || 0}g, Fat ${macros.fat || 0}g\n`;
        }
        if (aiContext.nutritionContext.recentMeals && aiContext.nutritionContext.recentMeals.length > 0) {
          contextInfo += `- Foods eaten today: ${aiContext.nutritionContext.recentMeals.join(', ')}\n`;
        }
        // 🔥 NEW: Add dietary goals
        const goals = (aiContext.nutritionContext as any).dietaryGoals;
        if (goals) {
          contextInfo += `\n🎯 DIETARY GOALS:\n`;
          if (goals.dailyCalories) contextInfo += `- Daily calorie target: ${goals.dailyCalories} kcal\n`;
          if (goals.carbsPercentage) contextInfo += `- Target carbs: ${goals.carbsPercentage}%\n`;
          if (goals.proteinsPercentage) contextInfo += `- Target protein: ${goals.proteinsPercentage}%\n`;
          if (goals.fatsPercentage) contextInfo += `- Target fat: ${goals.fatsPercentage}%\n`;
        }
        // 🔥 NEW: Add today's meal plan
        const mealPlan = (aiContext.nutritionContext as any).mealPlanToday;
        if (mealPlan && mealPlan.length > 0) {
          contextInfo += `\n📅 TODAY'S MEAL PLAN:\n`;
          mealPlan.forEach((meal: any) => {
            contextInfo += `- ${meal.mealType}: ${meal.recipeName}${meal.plannedCalories ? ` (${meal.plannedCalories} kcal)` : ''}\n`;
          });
        }
        // 🔥 NEW: Add food history
        const foodHistory = (aiContext.nutritionContext as any).foodHistory;
        if (foodHistory && foodHistory.length > 0) {
          contextInfo += `\n📊 RECENT EATING HISTORY:\n`;
          foodHistory.slice(0, 3).forEach((entry: any) => {
            if (entry.foods && entry.foods.length > 0) {
              contextInfo += `- ${entry.date}: ${entry.foods.join(', ')} (${entry.totalCalories} kcal)\n`;
            }
          });
        }
        contextInfo += `\n💡 Use this information to give personalized nutrition recommendations considering goals vs actual intake.\n`;
      }
    } catch (contextError) {
      console.warn('⚠️ Could not load additional context:', contextError);
    }

    const userMessage = `Analyze the user's daily health data and generate personalized, practical recommendations to help them navigate today effectively.

CURRENT HEALTH DATA:

- Mood: ${data.mood}/5 ${data.mood >= 4 ? '(positive)' : data.mood >= 3 ? '(neutral)' : '(low)'}

- Sleep: ${data.sleep.hours.toFixed(1)}h (quality: ${data.sleep.quality}%)

- Steps: ${data.healthMetrics.steps.toLocaleString()}

- HRV: ${data.healthMetrics.hrv} ms

- Hydration: ${data.healthMetrics.hydration}/8 glasses

- Resting heart rate: ${data.healthMetrics.restingHR || 65} bpm${contextInfo ? `\n\nADDITIONAL CONTEXT (if available):${contextInfo}` : ''}

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

     • detailedExplanation: a scientific explanation of why this recommendation works (2-3 sentences, based on real health science)

     • correlations: an array of 2-3 specific correlations with the user's data (e.g., "Good hydration is correlated with brighter skin")

     • expectedBenefits: an array of 2-4 specific, measurable benefits the user can expect (e.g., "Brighter skin", "Better body temperature regulation")

     • estimatedTime: how long it takes (minutes or hours)

3. Identify **one main focus** for the day (e.g., "Recovery & Balance", "Energy & Momentum", "Mindfulness & Clarity", "Movement & Activation").

4. Provide three daily indicators:

   - energy: high / medium / low  

   - recovery: excellent / good / needs_attention  

   - mood: positive / neutral / low  

IMPORTANT RULES:

- Tailor every insight strictly to the specific data provided.

- Use realistic physiology and behavior.

- Keep explanations clear, concise, and grounded in real health science.

- DO NOT include any text outside the JSON.

- DO NOT add disclaimers, warnings, or medical advice language.

- The JSON template below is ONLY an example of the structure. Generate completely new content each day and never reuse the sample action text verbatim.

${languageInstruction}

OUTPUT FORMAT (return ONLY valid JSON):

{
  "overallScore": 75,
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
      "detailedExplanation": "Morning movement activates the sympathetic nervous system, increasing blood flow and oxygen delivery to tissues. This helps reset circadian rhythms disrupted by poor sleep and boosts daytime energy by enhancing mitochondrial function. Regular light exercise also improves HRV by training the autonomic nervous system to recover more efficiently.",
      "correlations": [
        "Lower HRV suggests reduced recovery",
        "Low steps often correlate with lower daytime energy"
      ],
      "expectedBenefits": [
        "Improved circulation and energy",
        "Better mood regulation",
        "Mild HRV improvement throughout the day"
      ]
    }
  ]
}`;

    // Usa retry logic per gestire errori transienti (rete, timeout, 5xx)
    try {
      return await RetryService.withRetry(
        async () => {
          const backendURL = await getBackendURL();

          // Timeout per la chiamata API (30 secondi - analisi AI può richiedere tempo)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 30000);

          try {
            const response = await fetch(`${backendURL}/api/chat/respond`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: userMessage,
                sessionId: `daily-copilot-${Date.now()}`,
                userId: userId,
                userContext: {
                  userName: 'Utente',
                  isDailyCopilot: true,
                  language: userLanguage, // 🔥 FIX: Includi la lingua per il backend
                  // 🔥 FIX: Includi i dati strutturati nel contesto per aiutare l'AI
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
                throw new Error(`Client error: ${response.status}`);
              }
              // Errori retryable (5xx server errors)
              throw new Error(`Server error: ${response.status}`);
            }

            const aiResponse = await response.json();
            const analysisText = aiResponse.response || aiResponse.message || aiResponse.text;

            if (!analysisText) {
              throw new Error('Empty response from AI');
            }

            // Parsing dell'analisi AI
            return this.parseAIAnalysis(analysisText, data);
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
      console.error('Error generating AI analysis after retries:', error);
      // Fallback con analisi basica - sempre disponibile
      return this.generateFallbackAnalysis(data);
    }
  }

  /**
   * Parsing dell'analisi AI
   */
  private parseAIAnalysis(analysisText: string, data: CopilotAnalysisRequest): DailyCopilotData {
    try {
      // Try to parse the entire response as JSON first
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
        // Map AI recommendations
        let recommendations = parsedData.recommendations.map((rec: any, index: number) => ({
          id: rec.id || `ai-rec-${index}`,
          priority: rec.priority || 'medium',
          category: rec.category || 'energy',
          action: rec.action || 'Azione generica',
          reason: rec.reason || 'Motivo generico',
          icon: rec.icon || '💡',
          estimatedTime: rec.estimatedTime || '5 min',
          actionable: true,
          detailedExplanation: rec.detailedExplanation || (rec.reason ? `${rec.reason} Questa raccomandazione è basata sui tuoi dati attuali e può aiutarti a migliorare il tuo benessere generale.` : ''),
          correlations: Array.isArray(rec.correlations) && rec.correlations.length > 0 ? rec.correlations : (rec.reason ? [`Questa raccomandazione è basata sui tuoi dati attuali`] : []),
          expectedBenefits: Array.isArray(rec.expectedBenefits) && rec.expectedBenefits.length > 0 ? rec.expectedBenefits : (rec.reason ? [`Miglioramento del benessere generale`, `Supporto ai tuoi obiettivi di salute`] : [])
        }));

        // 🔥 NEW: Ensure at least 3 recommendations by supplementing with fallbacks
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
          overallScore: parsedData.overallScore || this.calculateOverallScore(data),
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
      // Fallback to basic recommendations on parse error
    }

    // Fallback to basic analysis
    return this.generateFallbackAnalysis(data);
  }

  /**
   * Estrae raccomandazioni parziali da JSON incompleto
   */
  private extractPartialRecommendations(text: string): any {
    try {
      // Try to find individual recommendation objects
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
              id: idMatch ? idMatch[1] : `partial-rec-${index}`,
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
    } catch (error) {
      console.log('⚠️ Could not extract partial recommendations:', error);
    }

    return null;
  }

  /**
   * Genera un'analisi di fallback basata sui dati
   */
  private generateFallbackAnalysis(data: CopilotAnalysisRequest): DailyCopilotData {
    const overallScore = this.calculateOverallScore(data);
    const recommendations = this.generateRecommendations(data);
    const summary = this.generateSummary(data, recommendations);
    const themeIndicators = this.extractThemeIndicators(recommendations);

    return {
      overallScore,
      mood: data.mood,
      sleep: data.sleep,
      healthMetrics: data.healthMetrics,
      recommendations,
      summary,
      themeIndicators,
    };
  }

  /**
   * Calcola il punteggio generale
   */
  private calculateOverallScore(data: CopilotAnalysisRequest): number {
    let score = 0;

    // Mood (20%)
    score += (data.mood / 5) * 20;

    // Sleep (30%)
    const sleepScore = (data.sleep.hours / 8) * 0.7 + (data.sleep.quality / 100) * 0.3;
    score += Math.min(sleepScore, 1) * 30;

    // Steps (20%)
    const stepsScore = Math.min(data.healthMetrics.steps / 10000, 1);
    score += stepsScore * 20;

    // HRV (15%)
    const hrvScore = Math.min(data.healthMetrics.hrv / 50, 1);
    score += hrvScore * 15;

    // Hydration (15%)
    const hydrationScore = Math.min(data.healthMetrics.hydration / 8, 1);
    score += hydrationScore * 15;

    return Math.round(score);
  }

  /**
   * Genera raccomandazioni basate sui dati
   */
  private generateRecommendations(data: CopilotAnalysisRequest, aiData?: any) {
    const recommendations = [];

    // Se abbiamo dati AI, usali per arricchire le raccomandazioni
    if (aiData && aiData.recommendations) {
      // Using AI-generated recommendations
      return aiData.recommendations.map((rec: any, index: number) => ({
        id: rec.id || `ai-rec-${index}`,
        priority: rec.priority || 'medium',
        category: rec.category || 'energy',
        action: rec.action || 'Azione generica',
        reason: rec.reason || 'Motivo generico',
        icon: rec.icon || '💡',
        estimatedTime: rec.estimatedTime || '5 min',
        actionable: true,
        detailedExplanation: rec.detailedExplanation || (rec.reason ? `${rec.reason} Questa raccomandazione è basata sui tuoi dati attuali e può aiutarti a migliorare il tuo benessere generale.` : ''),
        correlations: Array.isArray(rec.correlations) && rec.correlations.length > 0 ? rec.correlations : (rec.reason ? [`Questa raccomandazione è basata sui tuoi dati attuali`] : []),
        expectedBenefits: Array.isArray(rec.expectedBenefits) && rec.expectedBenefits.length > 0 ? rec.expectedBenefits : (rec.reason ? [`Miglioramento del benessere generale`, `Supporto ai tuoi obiettivi di salute`] : [])
      }));
    }

    // Fallback: generazione basata sui dati
    console.log('🔄 Using fallback recommendations');

    // Mood basso
    if (data.mood <= 2) {
      recommendations.push({
        id: 'mood-boost',
        priority: 'high' as const,
        category: 'mindfulness' as const,
        action: 'Pratica 10 minuti di respirazione profonda',
        reason: 'Il tuo umore è basso, la respirazione può aiutare a riequilibrare',
        icon: '🌬️',
        estimatedTime: '10 min',
        actionable: true,
        detailedExplanation: `Il tuo umore attuale (${data.mood}/5) indica uno stato di stress o affaticamento. La respirazione profonda attiva il sistema nervoso parasimpatico, riducendo i livelli di cortisolo e aumentando la produzione di endorfine. Questo esercizio può migliorare immediatamente il tuo stato d'animo e ridurre la tensione muscolare.`,
        correlations: [
          `Mood basso (${data.mood}/5) correlato con stress elevato`,
          `HRV ${data.healthMetrics.hrv}ms indica sistema nervoso in tensione`,
          `Sonno ${data.sleep.hours}h può influenzare l'umore mattutino`
        ],
        expectedBenefits: [
          'Riduzione immediata dello stress',
          'Miglioramento dell\'umore in 5-10 minuti',
          'Attivazione del sistema di rilassamento naturale',
          'Riduzione della frequenza cardiaca'
        ]
      });
    }

    // Sonno insufficiente
    if (data.sleep.hours < 7) {
      recommendations.push({
        id: 'sleep-recovery',
        priority: 'high' as const,
        category: 'recovery' as const,
        action: 'Fai un pisolino di 20 minuti o vai a letto prima stasera',
        reason: 'Hai dormito solo ' + data.sleep.hours + 'h, il recupero è importante',
        icon: '😴',
        estimatedTime: '20 min',
        actionable: true,
        detailedExplanation: `Il sonno di ${data.sleep.hours}h è insufficiente per un recupero ottimale. La privazione del sonno influisce negativamente su HRV (${data.healthMetrics.hrv}ms), umore (${data.mood}/5) e performance cognitive. Un pisolino di 20 minuti può migliorare l'attenzione e ridurre la sonnolenza senza interferire con il sonno notturno.`,
        correlations: [
          `Sonno insufficiente (${data.sleep.hours}h) correlato con HRV basso`,
          `Qualità sonno ${data.sleep.quality}% influisce sul recupero`,
          `Mood ${data.mood}/5 può essere influenzato dalla privazione del sonno`
        ],
        expectedBenefits: [
          'Miglioramento dell\'attenzione e concentrazione',
          'Riduzione della sonnolenza diurna',
          'Supporto al sistema immunitario',
          'Miglioramento dell\'umore e dell\'energia'
        ]
      });
    }

    // Steps bassi
    if (data.healthMetrics.steps < 5000) {
      recommendations.push({
        id: 'movement-boost',
        priority: 'medium' as const,
        category: 'movement' as const,
        action: 'Fai una camminata di 15 minuti',
        reason: 'Solo ' + data.healthMetrics.steps + ' passi oggi, muoviti di più',
        icon: '🚶',
        estimatedTime: '15 min',
        actionable: true,
        detailedExplanation: `Con solo ${data.healthMetrics.steps} passi oggi, sei ben al di sotto della raccomandazione di 10.000 passi giornalieri. Una camminata di 15 minuti può aumentare significativamente la circolazione sanguigna, migliorare l'umore attraverso il rilascio di endorfine, e aiutare a mantenere la massa muscolare. Il movimento regolare è essenziale per la salute cardiovascolare e il metabolismo.`,
        correlations: [
          `Bassi passi (${data.healthMetrics.steps}) correlati con minore energia diurna`,
          `Mancanza di movimento può influenzare negativamente l'HRV (${data.healthMetrics.hrv}ms)`,
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

    // HRV basso
    if (data.healthMetrics.hrv < 30) {
      recommendations.push({
        id: 'stress-reduction',
        priority: 'high' as const,
        category: 'recovery' as const,
        action: 'Pratica meditazione o yoga per ridurre lo stress',
        reason: 'HRV basso (' + data.healthMetrics.hrv + 'ms) indica stress elevato',
        icon: '🧘',
        estimatedTime: '15 min',
        actionable: true,
        detailedExplanation: `Il tuo HRV di ${data.healthMetrics.hrv}ms è al di sotto della media, indicando un sistema nervoso simpatico iperattivo e stress elevato. La meditazione e lo yoga attivano il sistema nervoso parasimpatico, aumentando la variabilità della frequenza cardiaca. Queste pratiche riducono i livelli di cortisolo e promuovono il recupero fisiologico.`,
        correlations: [
          `HRV basso (${data.healthMetrics.hrv}ms) correlato con stress cronico`,
          `Sonno insufficiente (${data.sleep.hours}h) può contribuire a HRV basso`,
          `Mood ${data.mood}/5 può essere influenzato dallo stress elevato`
        ],
        expectedBenefits: [
          'Riduzione dei livelli di cortisolo',
          'Aumento della variabilità della frequenza cardiaca',
          'Miglioramento del recupero fisiologico',
          'Riduzione dello stress percepito'
        ]
      });
    }

    // Idratazione bassa
    if (data.healthMetrics.hydration < 6) {
      recommendations.push({
        id: 'hydration',
        priority: 'medium' as const,
        category: 'nutrition' as const,
        action: 'Bevi 2 bicchieri d\'acqua ora',
        reason: 'Solo ' + data.healthMetrics.hydration + '/8 bicchieri, idratati di più',
        icon: '💧',
        estimatedTime: '2 min',
        actionable: true,
        detailedExplanation: `Con solo ${data.healthMetrics.hydration}/8 bicchieri d'acqua consumati oggi, sei al di sotto della raccomandazione giornaliera. L'idratazione adeguata è essenziale per il funzionamento ottimale di tutti i sistemi corporei, inclusi la circolazione, la digestione, la termoregolazione e la funzione cognitiva. Una disidratazione anche lieve può influenzare negativamente l'umore, l'energia e le performance fisiche.`,
        correlations: [
          `Bassa idratazione (${data.healthMetrics.hydration}/8) può influenzare l'energia diurna`,
          `Disidratazione può contribuire a HRV basso (${data.healthMetrics.hrv}ms)`,
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
          `Pratiche di mindfulness possono migliorare l'HRV (attualmente ${data.healthMetrics.hrv}ms)`,
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
        detailedExplanation: `I tuoi parametri mostrano un buon equilibrio: umore ${data.mood}/5, sonno ${data.sleep.hours}h con qualità ${data.sleep.quality}%, HRV ${data.healthMetrics.hrv}ms. Una passeggiata al sole può ottimizzare ulteriormente questi valori. L'esposizione alla luce naturale regola il ritmo circadiano, aumenta la produzione di vitamina D e migliora l'umore.`,
        correlations: [
          `Mood positivo (${data.mood}/5) supportato da buon sonno`,
          `HRV ${data.healthMetrics.hrv}ms indica buon recupero`,
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

    return recommendations.slice(0, 4); // Max 4 raccomandazioni
  }

  /**
   * Category configuration for theme indicators
   */
  private readonly CATEGORY_CONFIG: Record<string, { icon: string; labelIt: string; labelEn: string; color: string }> = {
    nutrition: { icon: 'food-apple', labelIt: 'Nutrizione', labelEn: 'Nutrition', color: '#f59e0b' },
    movement: { icon: 'run', labelIt: 'Movimento', labelEn: 'Movement', color: '#10b981' },
    recovery: { icon: 'bed', labelIt: 'Recupero', labelEn: 'Recovery', color: '#3b82f6' },
    mindfulness: { icon: 'meditation', labelIt: 'Mindfulness', labelEn: 'Mindfulness', color: '#8b5cf6' },
    energy: { icon: 'lightning-bolt', labelIt: 'Energia', labelEn: 'Energy', color: '#f97316' },
  };

  /**
   * Extracts theme indicators from recommendations
   * ALWAYS returns exactly 3 indicators for consistent UI
   * Fills with smart defaults if not enough recommendations
   */
  private extractThemeIndicators(recommendations: DailyCopilotData['recommendations']): ThemeIndicator[] {
    // Default indicators for common wellness areas (always available)
    const defaultIndicators: ThemeIndicator[] = [
      { icon: 'lightning-bolt', label: 'Energia', labelEn: 'Energy', color: '#f97316', category: 'energy' },
      { icon: 'food-apple', label: 'Nutrizione', labelEn: 'Nutrition', color: '#f59e0b', category: 'nutrition' },
      { icon: 'run', label: 'Movimento', labelEn: 'Movement', color: '#10b981', category: 'movement' },
      { icon: 'bed', label: 'Recupero', labelEn: 'Recovery', color: '#3b82f6', category: 'recovery' },
      { icon: 'meditation', label: 'Mindfulness', labelEn: 'Mindfulness', color: '#8b5cf6', category: 'mindfulness' },
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

    // ALWAYS fill to 3 indicators with defaults not already used
    const usedCategories = new Set(result.map(r => r.category));
    for (const defaultInd of defaultIndicators) {
      if (result.length >= 3) break;
      if (!usedCategories.has(defaultInd.category)) {
        result.push(defaultInd);
        usedCategories.add(defaultInd.category);
      }
    }

    return result.slice(0, 3);
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
    const energy: 'high' | 'medium' | 'low' = data.mood >= 4 && data.healthMetrics.hrv >= 35 ? 'high' :
      data.mood >= 3 && data.healthMetrics.hrv >= 25 ? 'medium' : 'low';

    const recovery: 'excellent' | 'good' | 'needs_attention' = data.sleep.hours >= 7 && data.sleep.quality >= 80 ? 'excellent' :
      data.sleep.hours >= 6 && data.sleep.quality >= 60 ? 'good' : 'needs_attention';

    const mood: 'positive' | 'neutral' | 'low' = data.mood >= 4 ? 'positive' : data.mood >= 3 ? 'neutral' : 'low';

    // Use dynamic focus based on recommendations if available
    const { focus, focusEn } = recommendations && recommendations.length > 0
      ? this.generateDynamicFocus(recommendations)
      : {
        focus: energy === 'low' ? 'Energia & Recupero' :
          recovery === 'needs_attention' ? 'Riposo & Benessere' :
            data.healthMetrics.steps < 5000 ? 'Movimento & Vitalità' :
              'Mantenimento & Crescita',
        focusEn: energy === 'low' ? 'Energy & Recovery' :
          recovery === 'needs_attention' ? 'Rest & Wellness' :
            data.healthMetrics.steps < 5000 ? 'Movement & Vitality' :
              'Maintenance & Growth',
      };

    return { focus, focusEn, energy, recovery, mood };
  }

  /**
   * Gestione cache
   */
  private getCachedAnalysis(key: string): DailyCopilotData | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() < expiry) {
      return this.cache.get(key) || null;
    }
    return null;
  }

  private setCachedAnalysis(key: string, data: DailyCopilotData): void {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
  }

  /**
   * Converte un record del database in DailyCopilotData
   */
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
        sleep: {
          hours: dbRecord.sleep_hours || 7.5,
          quality: dbRecord.sleep_quality || 80,
          bedtime: healthMetrics?.bedtime,
          wakeTime: healthMetrics?.wakeTime,
        },
        healthMetrics: healthMetrics,
        recommendations: recommendationsArray,
        summary: summaryData,
        themeIndicators,
      };
    } catch (error) {
      console.error('❌ Error converting DB record to CopilotData:', error);
      console.error('❌ DB Record:', dbRecord);
      // 🔥 FIX: Ritorna dati di fallback invece di null per evitare che il componente mostri errore
      return {
        overallScore: dbRecord.overall_score || 50,
        mood: dbRecord.mood || 3,
        sleep: {
          hours: dbRecord.sleep_hours || 7.5,
          quality: dbRecord.sleep_quality || 80,
        },
        healthMetrics: {
          steps: 5000,
          hrv: 35,
          hydration: 6,
          restingHR: 65
        },
        recommendations: [],
        summary: {
          focus: 'Mantenimento & Crescita',
          focusEn: 'Maintenance & Growth',
          energy: 'medium',
          recovery: 'good',
          mood: 'neutral',
        },
        themeIndicators: this.extractThemeIndicators([]),
      };
    }
  }

  /**
   * Invalida la cache
   */
  invalidateCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Ottiene le statistiche del Daily Copilot
   */
  async getCopilotStats(userId: string, days: number = 30) {
    return await this.dbService.getDailyCopilotStats(userId, days);
  }

  /**
   * Ottiene la cronologia del Daily Copilot
   */
  async getCopilotHistory(userId: string, limit: number = 30) {
    return await this.dbService.getDailyCopilotHistory(userId, limit);
  }

  /**
   * Recupera i dati per il grafico dei trend
   */
  async getTrendData(userId: string, days: number = 14) {
    return await this.dbService.getTrendData(userId, days);
  }
}

export default DailyCopilotService;
