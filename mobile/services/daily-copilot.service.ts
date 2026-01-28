import { AuthService } from './auth.service';
import { getBackendURL } from '../constants/env';
import { AIContextService } from './ai-context.service';
import DailyCopilotDBService from './daily-copilot-db.service';
import { RetryService } from './retry.service';
import { getUserLanguage, getLanguageInstruction } from './language.service';
import { widgetConfigService } from './widget-config.service';
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

export interface CopilotAnalysisRequest {
  mood: number | null;
  sleep: { hours: number; quality: number; } | null;
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
        return null;
      }

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const cacheKey = `copilot_${currentUser.id}_${today}`;

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

      const analysisData = await this.collectAnalysisData(currentUser.id);
      if (!analysisData) {
        console.warn('⚠️ Daily Copilot: No analysis data collected');
        return null;
      }

      // Calcola il punteggio PRIMA di generare l'analisi
      // Il punteggio è calcolabile solo se ci sono almeno 3 fattori
      const scoreResult = await this.calculateDeterministicScore(analysisData);
      if (scoreResult.score === null) {
        console.warn('⚠️ Daily Copilot: Insufficient data for score calculation (< 3 factors)');
        return null;
      }

      // Genera l'analisi tramite AI, passando il punteggio calcolato
      const copilotData = await this.generateAIAnalysis(analysisData, currentUser.id, scoreResult.score);
      if (!copilotData) {
        console.warn('⚠️ Daily Copilot: AI analysis failed, using fallback');
        const fallbackAnalysis = await this.generateFallbackAnalysis(analysisData);
        await this.dbService.saveDailyCopilotData(currentUser.id, fallbackAnalysis);
        return fallbackAnalysis;
      }

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
      return {
        mood: null,
        sleep: null,
        healthMetrics: { steps: 0, hrv: 0, hydration: 0 },
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
   */
  private async getTodaySleep(): Promise<{ hours: number; quality: number; } | null> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return null;
      }

      const { supabase } = await import('../lib/supabase');
      const today = new Date().toISOString().slice(0, 10);

      // 🔥 FIX: Leggi SOLO i dati di OGGI
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

      // Fallback ad AsyncStorage per retrocompatibilità (solo se di oggi)
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const savedSleep = await AsyncStorage.getItem(`checkin:sleep:${today}`);

      if (savedSleep) {
        return {
          hours: 7.5,
          quality: parseInt(savedSleep, 10)
        };
      }

      console.log('⚠️ Daily Copilot: No sleep data found for today');
      return null;
    } catch (error) {
      console.error('❌ Error getting sleep:', error);
      return null;
    }
  }

  /**
   * Ottiene le metriche di salute
   */
  private async getHealthMetrics(aiContext: any): Promise<{
    steps: number;
    hrv: number;
    hydration: number;
    meditationMinutes: number;
    restingHR?: number;
  }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return { steps: 5000, hrv: 35, hydration: 6, meditationMinutes: 0, restingHR: 65 };
      }

      const { supabase } = await import('../lib/supabase');
      const today = new Date().toISOString().split('T')[0];

      const { data: healthData } = await supabase
        .from('health_data')
        .select('steps, hrv, hydration, resting_heart_rate, mindfulness_minutes')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (healthData) {
        console.log('✅ Daily Copilot: Using real health data from database:', {
          steps: healthData.steps,
          hrv: healthData.hrv,
          hydration: healthData.hydration ? Math.round(healthData.hydration / 250) : 6,
          meditationMinutes: healthData.mindfulness_minutes || 0,
          restingHR: healthData.resting_heart_rate
        });

        return {
          steps: healthData.steps || 5000,
          hrv: healthData.hrv || 35,
          hydration: healthData.hydration ? Math.round(healthData.hydration / 250) : 6,
          meditationMinutes: healthData.mindfulness_minutes || 0,
          restingHR: healthData.resting_heart_rate || 65
        };
      }

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
            meditationMinutes: data.mindfulnessMinutes || 0,
            restingHR: data.restingHeartRate
          });

          return {
            steps: data.steps || 5000,
            hrv: data.hrv || 35,
            hydration: data.hydration ? Math.round(data.hydration / 250) : 6,
            meditationMinutes: data.mindfulnessMinutes || 0,
            restingHR: data.restingHeartRate || 65
          };
        }
      } catch (healthServiceError) {
        console.warn('⚠️ Daily Copilot: HealthDataService sync failed');
      }

      if (aiContext?.currentHealth) {
        return {
          steps: aiContext.currentHealth.steps || 5000,
          hrv: aiContext.currentHealth.hrv || 35,
          hydration: aiContext.currentHealth.hydration || 6,
          meditationMinutes: aiContext.currentHealth.mindfulnessMinutes || 0,
          restingHR: aiContext.currentHealth.restingHR || 65
        };
      }

      return { steps: 5000, hrv: 35, hydration: 6, meditationMinutes: 0, restingHR: 65 };
    } catch (error) {
      console.error('❌ Error getting health metrics:', error);
      return { steps: 5000, hrv: 35, hydration: 6, meditationMinutes: 0, restingHR: 65 };
    }
  }

  /**
   * Ottiene i minuti di meditazione odierni
   */
  private async getTodayMeditationMinutes(): Promise<number> {
    const healthMetrics = await this.getHealthMetrics({});
    return healthMetrics.meditationMinutes;
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
- Steps: ${data.healthMetrics.steps}
- HRV: ${data.healthMetrics.hrv} ms
- Hydration: ${data.healthMetrics.hydration}/8 glasses
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
    const overallScore = scoreResult.score || 50;
    const recommendations = this.generateRecommendations(data);
    const summary = this.generateSummary(data, recommendations);
    const themeIndicators = this.extractThemeIndicators(recommendations);

    return {
      overallScore,
      scoreDetails: scoreResult,
      mood: data.mood,
      sleep: data.sleep,
      healthMetrics: {
        ...data.healthMetrics,
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
   */
  async calculateDeterministicScore(data: CopilotAnalysisRequest): Promise<ScoreCalculationResult> {
    const config = await widgetConfigService.getWidgetConfig();
    const goals = await widgetGoalsService.getGoals();
    const enabledWidgetIds = new Set(config.filter(w => w.enabled).map(w => w.id));

    const breakdown: Record<string, ScoreItem> = {};
    const missingData: string[] = [];
    const availableCategories: string[] = [];
    let totalPoints = 0;
    let totalWeight = 0;

    // Mood (25%)
    if (data.mood !== null) {
      const score = (data.mood / 5) * 100;
      breakdown['mood'] = { score, weight: 25, value: data.mood };
      totalPoints += (score * 25) / 100;
      totalWeight += 25;
      availableCategories.push('mood');
    } else missingData.push('mood');

    // Sleep (25%)
    if (data.sleep !== null) {
      const goal = goals.sleep || 8;
      const score = (this.clamp01(data.sleep.hours / goal) * 70) + (data.sleep.quality * 0.3);
      breakdown['sleep'] = { score, weight: 25, value: data.sleep.hours, goal };
      totalPoints += (score * 25) / 100;
      totalWeight += 25;
      availableCategories.push('sleep');
    } else missingData.push('sleep');

    // Steps (20%)
    if (enabledWidgetIds.has('steps')) {
      const goal = goals.steps || 10000;
      const score = this.clamp01(data.healthMetrics.steps / goal) * 100;
      breakdown['steps'] = { score, weight: 20, value: data.healthMetrics.steps, goal };
      totalPoints += (score * 20) / 100;
      totalWeight += 20;
      availableCategories.push('steps');
    }

    // Hydration (20%)
    if (enabledWidgetIds.has('hydration')) {
      const goal = goals.hydration || 8;
      const score = this.clamp01(data.healthMetrics.hydration / goal) * 100;
      breakdown['hydration'] = { score, weight: 20, value: data.healthMetrics.hydration, goal };
      totalPoints += (score * 20) / 100;
      totalWeight += 20;
      availableCategories.push('hydration');
    }

    // HRV (10%)
    if (enabledWidgetIds.has('hrv')) {
      const score = this.clamp01(data.healthMetrics.hrv / 50) * 100;
      breakdown['hrv'] = { score, weight: 10, value: data.healthMetrics.hrv, goal: 50 };
      totalPoints += (score * 10) / 100;
      totalWeight += 10;
      availableCategories.push('hrv');
    }

    // 🔥 FIX: Il punteggio è calcolabile solo se ci sono almeno 3 fattori presenti
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
        detailedExplanation: `Il tuo umore attuale(${data.mood} / 5) indica uno stato di stress o affaticamento.La respirazione profonda attiva il sistema nervoso parasimpatico, riducendo i livelli di cortisolo e aumentando la produzione di endorfine.Questo esercizio può migliorare immediatamente il tuo stato d'animo e ridurre la tensione muscolare.`,
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
    if (data.healthMetrics.steps < 300) {
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
    if (data.healthMetrics.hydration < 2) {
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
        healthMetrics: { steps: 5000, hrv: 35, hydration: 6, meditationMinutes: 0 },
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
