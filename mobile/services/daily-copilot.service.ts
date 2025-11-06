import { AuthService } from './auth.service';
import { BACKEND_URL } from '../constants/env';
import { AIContextService } from './ai-context.service';
import DailyCopilotDBService from './daily-copilot-db.service';

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
        const savedData = this.convertDBRecordToCopilotData(dbResult.data);
        this.setCachedAnalysis(cacheKey, savedData);
        return savedData;
      }

      // Check cache as fallback
      const cached = this.getCachedAnalysis(cacheKey);
      if (cached) {
        return cached;
      }

      // Generating analysis (logging handled by backend)

      // Raccoglie tutti i dati necessari
      const analysisData = await this.collectAnalysisData(currentUser.id);
      if (!analysisData) {
        console.log('No data available for Daily Copilot analysis');
        return null;
      }

      // Genera l'analisi tramite AI
      const copilotData = await this.generateAIAnalysis(analysisData, currentUser.id);
      if (!copilotData) {
        console.log('Failed to generate AI analysis');
        return null;
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
      return null;
    }
  }

  /**
   * Ottiene il mood di oggi dal check-in
   */
  private async getTodayMood(): Promise<number> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const dayKey = new Date().toISOString().slice(0, 10);
      const savedMood = await AsyncStorage.getItem(`checkin:mood:${dayKey}`);
      return savedMood ? parseInt(savedMood, 10) : 3; // Default neutro
    } catch {
      return 3;
    }
  }

  /**
   * Ottiene i dati del sonno di oggi
   */
  private async getTodaySleep(): Promise<{ hours: number; quality: number; }> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const dayKey = new Date().toISOString().slice(0, 10);
      const savedSleep = await AsyncStorage.getItem(`checkin:sleep:${dayKey}`);
      
      // Default basati su dati tipici
      return {
        hours: 7.5,
        quality: savedSleep ? parseInt(savedSleep, 10) : 80
      };
    } catch {
      return { hours: 7.5, quality: 80 };
    }
  }

  /**
   * Ottiene le metriche di salute
   */
  private async getHealthMetrics(aiContext: any): Promise<{
    steps: number;
    hrv: number;
    hydration: number;
    restingHR?: number;
  }> {
    // Usa i dati dal contesto AI o valori di default
    return {
      steps: aiContext?.currentHealth?.steps || 5000,
      hrv: aiContext?.currentHealth?.hrv || 35,
      hydration: aiContext?.currentHealth?.hydration || 6,
      restingHR: aiContext?.currentHealth?.restingHR || 65
    };
  }

  /**
   * Genera l'analisi tramite AI
   */
  private async generateAIAnalysis(
    data: CopilotAnalysisRequest, 
    userId: string
  ): Promise<DailyCopilotData | null> {
    try {
      const userMessage = `Analizza i miei dati giornalieri e fornisci raccomandazioni personalizzate per affrontare al meglio la giornata. 

Dati attuali:
- Mood: ${data.mood}/5
- Sonno: ${data.sleep.hours}h (qualità ${data.sleep.quality}%)
- Steps: ${data.healthMetrics.steps}
- HRV: ${data.healthMetrics.hrv}ms
- Idratazione: ${data.healthMetrics.hydration}/8 bicchieri
- Frequenza cardiaca a riposo: ${data.healthMetrics.restingHR || 65} bpm

Fornisci:
1. Un punteggio generale (0-100)
2. 3-4 raccomandazioni specifiche e actionable
3. Un focus principale per la giornata
4. Valutazione di energia, recupero e umore

IMPORTANTE: Rispondi SOLO con un JSON valido nel seguente formato:

{
  "overallScore": 75,
  "focus": "Mantenimento & Crescita",
  "energy": "medium",
  "recovery": "good", 
  "mood": "positive",
  "recommendations": [
    {
      "id": "energy-maintenance",
      "priority": "low",
      "category": "energy",
      "action": "Mantieni questo ritmo! Considera una passeggiata al sole",
      "reason": "I tuoi valori sono buoni, mantieni l'energia positiva",
      "icon": "☀️",
      "estimatedTime": "10 min",
      "detailedExplanation": "I tuoi parametri mostrano un buon equilibrio: umore ${data.mood}/5, sonno ${data.sleep.hours}h con qualità ${data.sleep.quality}%, HRV ${data.healthMetrics.hrv}ms. Una passeggiata al sole può ottimizzare ulteriormente questi valori. L'esposizione alla luce naturale regola il ritmo circadiano, aumenta la produzione di vitamina D e migliora l'umore attraverso la stimolazione della serotonina.",
      "correlations": [
        "Mood positivo (${data.mood}/5) supportato da buon sonno",
        "HRV ${data.healthMetrics.hrv}ms indica buon recupero",
        "Sonno ${data.sleep.hours}h con qualità ${data.sleep.quality}% ottimale"
      ],
      "expectedBenefits": [
        "Aumento della produzione di vitamina D",
        "Miglioramento del ritmo circadiano", 
        "Incremento della serotonina (ormone del buonumore)",
        "Supporto al sistema immunitario"
      ]
    }
  ]
}

Rispondi SOLO con il JSON, senza testo aggiuntivo.`;

      const response = await fetch(`${BACKEND_URL}/api/chat/respond`, {
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
            isDailyCopilot: true
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status}`);
      }

      const aiResponse = await response.json();
      const analysisText = aiResponse.response || aiResponse.message || aiResponse.text;

      // Parsing dell'analisi AI (per ora usiamo dati mock, poi implementeremo il parsing)
      return this.parseAIAnalysis(analysisText, data);

    } catch (error) {
      console.error('Error generating AI analysis:', error);
      // Fallback con analisi basica
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
          summary: {
            focus: parsedData.focus || this.generateFocus(data),
            energy: parsedData.energy || this.getEnergyLevel(data),
            recovery: parsedData.recovery || this.getRecoveryLevel(data),
            mood: parsedData.mood || this.getMoodLevel(data.mood)
          }
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
  private generateSummary(data: CopilotAnalysisRequest) {
    const energy = data.mood >= 4 && data.healthMetrics.hrv >= 35 ? 'high' : 
                   data.mood >= 3 && data.healthMetrics.hrv >= 25 ? 'medium' : 'low';
    
    const recovery = data.sleep.hours >= 7 && data.sleep.quality >= 80 ? 'excellent' :
                     data.sleep.hours >= 6 && data.sleep.quality >= 60 ? 'good' : 'needs_attention';
    
    const mood = data.mood >= 4 ? 'positive' : data.mood >= 3 ? 'neutral' : 'low';
    
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
    return {
      overallScore: dbRecord.overall_score,
      mood: dbRecord.mood,
      sleep: {
        hours: dbRecord.sleep_hours,
        quality: dbRecord.sleep_quality,
        bedtime: dbRecord.health_metrics?.bedtime,
        wakeTime: dbRecord.health_metrics?.wakeTime,
      },
      healthMetrics: dbRecord.health_metrics,
      recommendations: dbRecord.recommendations,
      summary: dbRecord.summary,
    };
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
