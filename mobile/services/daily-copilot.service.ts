import { AuthService } from './auth.service';
import { getBackendURL } from '../constants/env';
import { AIContextService } from './ai-context.service';
import DailyCopilotDBService from './daily-copilot-db.service';
import { RetryService } from './retry.service';
import { getUserLanguage, getLanguageInstruction } from './language.service';

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
    energy: 'high' | 'medium' | 'low';
    recovery: 'excellent' | 'good' | 'needs_attention';
    mood: 'positive' | 'neutral' | 'low';
  };
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
        console.log('No authenticated user for Daily Copilot');
        return null;
      }

      // Check database first for today's analysis
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
      const cacheKey = `copilot_${currentUser.id}_${today}`;
      
      const dbResult = await this.dbService.getDailyCopilotData(currentUser.id, today);
      if (dbResult.success && dbResult.data) {
        console.log('✅ Daily Copilot: Found existing analysis in database for today');
        const savedData = this.convertDBRecordToCopilotData(dbResult.data);
        console.log('✅ Daily Copilot: Converted data:', {
          overallScore: savedData.overallScore,
          recommendationsCount: savedData.recommendations?.length || 0,
          summary: savedData.summary
        });
        this.setCachedAnalysis(cacheKey, savedData);
        return savedData;
      } else {
        console.log('ℹ️ Daily Copilot: No existing analysis in database for today, will generate new one');
      }

      // Check cache as fallback
      const cached = this.getCachedAnalysis(cacheKey);
      if (cached) {
        return cached;
      }

      // Generating analysis (logging handled by backend)

      // 🔥 LOGICA: Raccoglie tutti i dati necessari per l'analisi
      // Se apri l'app al mattino, usa i dati di ieri (sera prima)
      // Se apri l'app durante il giorno, usa i dati di oggi se disponibili
      console.log('🔄 Daily Copilot: Collecting analysis data...');
      const analysisData = await this.collectAnalysisData(currentUser.id);
      if (!analysisData) {
        console.warn('⚠️ Daily Copilot: No data available for analysis, using fallback');
        // 🔥 FIX: Non ritornare null, usa dati di fallback per generare comunque un'analisi
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

      console.log('✅ Daily Copilot: Analysis data collected:', {
        mood: analysisData.mood,
        sleep: analysisData.sleep,
        healthMetrics: {
          steps: analysisData.healthMetrics.steps,
          hrv: analysisData.healthMetrics.hrv,
          hydration: analysisData.healthMetrics.hydration,
          restingHR: analysisData.healthMetrics.restingHR
        }
      });

      // Genera l'analisi tramite AI
      console.log('🤖 Daily Copilot: Generating AI analysis...');
      const copilotData = await this.generateAIAnalysis(analysisData, currentUser.id);
      if (!copilotData) {
        console.warn('⚠️ Daily Copilot: AI analysis failed, using fallback');
        // 🔥 FIX: Usa fallback invece di ritornare null
        const fallbackAnalysis = this.generateFallbackAnalysis(analysisData);
        // Salva comunque nel database
        await this.dbService.saveDailyCopilotData(currentUser.id, fallbackAnalysis);
        return fallbackAnalysis;
      }

      console.log('✅ Daily Copilot: AI analysis generated successfully:', {
        overallScore: copilotData.overallScore,
        recommendationsCount: copilotData.recommendations.length
      });

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
      const today = new Date().toISOString().slice(0, 10);
      
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
      const yesterdayKey = yesterday.toISOString().slice(0, 10);
      
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
    try {
      const aiContext = await AIContextService.getCompleteContext(userId);
      
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

     • correlations: how different data points are linked  

     • expectedBenefits: measurable improvements the user can expect  

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
      "action": "Take a 10–15 minute brisk walk early in the day.",
      "reason": "Your sleep quality is lower than usual and steps are behind your normal pattern.",
      "estimatedTime": "15 min",
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
        return {
          overallScore: parsedData.overallScore || this.calculateOverallScore(data),
          mood: data.mood,
          sleep: data.sleep,
          healthMetrics: data.healthMetrics,
          recommendations: parsedData.recommendations.map((rec: any, index: number) => ({
            id: rec.id || `ai-rec-${index}`,
            priority: rec.priority || 'medium',
            category: rec.category || 'energy',
            action: rec.action || 'Azione generica',
            reason: rec.reason || 'Motivo generico',
            icon: rec.icon || '💡',
            estimatedTime: rec.estimatedTime || '5 min',
            actionable: true,
            detailedExplanation: rec.detailedExplanation || 'Spiegazione dettagliata non disponibile',
            correlations: rec.correlations || [],
            expectedBenefits: rec.expectedBenefits || []
          })),
          summary: (() => {
            const fallbackSummary = this.generateSummary(data);
            return {
              focus: parsedData.focus || fallbackSummary.focus,
              energy: parsedData.energy || fallbackSummary.energy,
              recovery: parsedData.recovery || fallbackSummary.recovery,
              mood: parsedData.mood || fallbackSummary.mood
            };
          })()
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
    const summary = this.generateSummary(data);


    return {
      overallScore,
      mood: data.mood,
      sleep: data.sleep,
      healthMetrics: data.healthMetrics,
      recommendations,
      summary
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
        detailedExplanation: rec.detailedExplanation || 'Spiegazione dettagliata non disponibile',
        correlations: rec.correlations || [],
        expectedBenefits: rec.expectedBenefits || []
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
        actionable: true
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
        actionable: true
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
        actionable: true
      });
    }

    // Raccomandazione di energia se tutto va bene
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'energy-maintenance',
        priority: 'low' as const,
        category: 'energy' as const,
        action: 'Mantieni questo ritmo! Considera una passeggiata al sole',
        reason: 'I tuoi valori sono buoni, mantieni l\'energia positiva',
        icon: '☀️',
        estimatedTime: '10 min',
        actionable: true,
        detailedExplanation: `I tuoi parametri mostrano un buon equilibrio: umore ${data.mood}/5, sonno ${data.sleep.hours}h con qualità ${data.sleep.quality}%, HRV ${data.healthMetrics.hrv}ms. Una passeggiata al sole può ottimizzare ulteriormente questi valori. L'esposizione alla luce naturale regola il ritmo circadiano, aumenta la produzione di vitamina D e migliora l'umore attraverso la stimolazione della serotonina. Questo tipo di attività fisica leggera supporta anche la circolazione sanguigna e può migliorare la variabilità della frequenza cardiaca.`,
        correlations: [
          `Mood positivo (${data.mood}/5) supportato da buon sonno`,
          `HRV ${data.healthMetrics.hrv}ms indica buon recupero`,
          `Sonno ${data.sleep.hours}h con qualità ${data.sleep.quality}% ottimale`,
          `Steps ${data.healthMetrics.steps} possono essere incrementati per benefici aggiuntivi`,
          `Idratazione ${data.healthMetrics.hydration}/8 bicchieri supporta l'energia`
        ],
        expectedBenefits: [
          'Aumento della produzione di vitamina D',
          'Miglioramento del ritmo circadiano',
          'Incremento della serotonina (ormone del buonumore)',
          'Supporto al sistema immunitario',
          'Miglioramento della qualità del sonno notturno',
          'Riduzione dello stress e dell\'ansia',
          'Miglioramento della circolazione sanguigna'
        ]
      });
    }

    return recommendations.slice(0, 4); // Max 4 raccomandazioni
  }

  /**
   * Genera il riassunto
   */
  private generateSummary(data: CopilotAnalysisRequest): {
    focus: string;
    energy: 'high' | 'medium' | 'low';
    recovery: 'excellent' | 'good' | 'needs_attention';
    mood: 'positive' | 'neutral' | 'low';
  } {
    const energy: 'high' | 'medium' | 'low' = data.mood >= 4 && data.healthMetrics.hrv >= 35 ? 'high' : 
                   data.mood >= 3 && data.healthMetrics.hrv >= 25 ? 'medium' : 'low';
    
    const recovery: 'excellent' | 'good' | 'needs_attention' = data.sleep.hours >= 7 && data.sleep.quality >= 80 ? 'excellent' :
                     data.sleep.hours >= 6 && data.sleep.quality >= 60 ? 'good' : 'needs_attention';
    
    const mood: 'positive' | 'neutral' | 'low' = data.mood >= 4 ? 'positive' : data.mood >= 3 ? 'neutral' : 'low';
    
    const focus = energy === 'low' ? 'Energia & Recupero' :
                  recovery === 'needs_attention' ? 'Riposo & Benessere' :
                  data.healthMetrics.steps < 5000 ? 'Movimento & Vitalità' :
                  'Mantenimento & Crescita';

    return { focus, energy, recovery, mood };
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
        energy: summary.energy || 'medium',
        recovery: summary.recovery || 'good',
        mood: summary.mood || 'neutral',
      };
      
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
          energy: 'medium',
          recovery: 'good',
          mood: 'neutral',
        },
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
