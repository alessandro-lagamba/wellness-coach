import { supabase, Tables, EmotionAnalysis } from '../lib/supabase';
import cacheService from './cache.service';
import { DataValidationService } from './data-validation.service';
import { RetryService } from './retry.service';
import { OperationLockService } from './operation-lock.service';
import { DatabaseVerificationService } from './database-verification.service';
import { EnhancedLoggingService } from './enhanced-logging.service';

export class EmotionAnalysisService {
  /**
   * Salva una nuova analisi emotiva nel database
   * 🆕 Evita duplicati recenti: se c'è un'analisi simile negli ultimi 2 minuti, aggiorna quella invece di crearne una nuova
   * 🆕 Include: validazione dati, retry logic, locking per race conditions, verifica post-salvataggio
   */
  static async saveEmotionAnalysis(
    userId: string,
    analysis: {
      dominantEmotion: string;
      valence: number;
      arousal: number;
      confidence: number;
      analysisData?: Record<string, any>;
      sessionDuration?: number;
    }
  ): Promise<EmotionAnalysis | null> {
    // 🆕 Validazione dati prima del salvataggio
    const validation = DataValidationService.validateEmotionAnalysis(analysis);
    if (!validation.valid) {
      EnhancedLoggingService.logSaveOperation('emotion_analysis', userId, false, new Error(`Validation failed: ${validation.errors.join(', ')}`));
      throw new Error(`Dati non validi: ${validation.errors.join(', ')}`);
    }

    // 🆕 Usa locking per prevenire race conditions
    return OperationLockService.withLock(
      'save',
      `emotion_analysis_${userId}`,
      async () => {
        // 🆕 Usa retry logic per operazioni database
        return RetryService.withRetry(
          async () => {
            try {
              // 🆕 Check duplicati recenti: analisi simili negli ultimi 2 minuti
              const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
              const { data: recentAnalysis, error: checkError } = await supabase
                .from(Tables.EMOTION_ANALYSES)
                .select('id, created_at, dominant_emotion, valence, arousal')
                .eq('user_id', userId)
                .gte('created_at', twoMinutesAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              // 🆕 Se esiste un'analisi recente simile, aggiornala invece di crearne una nuova
              if (recentAnalysis && !checkError) {
                const isSimilar = 
                  recentAnalysis.dominant_emotion === analysis.dominantEmotion &&
                  Math.abs(recentAnalysis.valence - analysis.valence) < 0.1 &&
                  Math.abs(recentAnalysis.arousal - analysis.arousal) < 0.1;

                if (isSimilar) {
                  EnhancedLoggingService.logDatabaseOperation('update', 'emotion_analysis', true);
                  
                  const { data: updated, error: updateError } = await supabase
                    .from(Tables.EMOTION_ANALYSES)
                    .update({
                      dominant_emotion: analysis.dominantEmotion,
                      valence: analysis.valence,
                      arousal: analysis.arousal,
                      confidence: analysis.confidence,
                      analysis_data: analysis.analysisData || {},
                      session_duration: analysis.sessionDuration,
                    })
                    .eq('id', recentAnalysis.id)
                    .select()
                    .single();

                  if (updateError) {
                    const err = new Error(`Error updating emotion analysis: ${updateError.message}`);
                    EnhancedLoggingService.logSaveOperation('emotion_analysis', userId, false, err);
                    throw err;
                  }

                  EnhancedLoggingService.logSaveOperation('emotion_analysis', userId, true, undefined, updated.id);
                  
                  // 🆕 Invalida cache quando si aggiorna un'analisi
                  await cacheService.invalidatePrefix(`emotion:${userId}`);
                  await cacheService.invalidate(`ai_context:${userId}`);
                  
                  // 🆕 Verifica post-salvataggio che i dati siano nel database
                  if (updated?.id) {
                    const verification = await DatabaseVerificationService.verifyEmotionAnalysis(userId, updated.id);
                    if (!verification.found) {
                      EnhancedLoggingService.logVerification('emotion_analysis', userId, false, new Error('Data not found after update'));
                    }
                  }
                  
                  return updated;
                }
              }

              // 🆕 Nessun duplicato trovato, inserisci nuova analisi
              const { data, error } = await supabase
                .from(Tables.EMOTION_ANALYSES)
                .insert({
                  user_id: userId,
                  dominant_emotion: analysis.dominantEmotion,
                  valence: analysis.valence,
                  arousal: analysis.arousal,
                  confidence: analysis.confidence,
                  analysis_data: analysis.analysisData || {},
                  session_duration: analysis.sessionDuration,
                })
                .select()
                .single();

              if (error) {
                const err = new Error(`Error saving emotion analysis: ${error.message}`);
                EnhancedLoggingService.logSaveOperation('emotion_analysis', userId, false, err);
                throw err;
              }

              EnhancedLoggingService.logSaveOperation('emotion_analysis', userId, true, undefined, data.id);
              
              // 🆕 Invalida cache quando si salva una nuova analisi
              await cacheService.invalidatePrefix(`emotion:${userId}`);
              await cacheService.invalidate(`ai_context:${userId}`);
              
              // 🆕 Verifica post-salvataggio che i dati siano nel database
              if (data?.id) {
                const verification = await DatabaseVerificationService.verifyEmotionAnalysis(userId, data.id);
                if (!verification.found) {
                  EnhancedLoggingService.logVerification('emotion_analysis', userId, false, new Error('Data not found after save'));
                }
              }
              
              return data;
            } catch (error) {
              const err = error instanceof Error ? error : new Error('Unknown error');
              EnhancedLoggingService.logSaveOperation('emotion_analysis', userId, false, err);
              throw err;
            }
          },
          'save_emotion_analysis',
          {
            maxAttempts: 3,
            delay: 1000,
            backoff: 'exponential',
            shouldRetry: RetryService.isRetryableError,
          }
        );
      }
    );
  }

  /**
   * Ottiene l'ultima analisi emotiva di un utente
   * 🆕 Con cache: cache di 5 minuti
   */
  static async getLatestEmotionAnalysis(userId: string, forceRefresh: boolean = false): Promise<EmotionAnalysis | null> {
    try {
      const cacheKey = `emotion:${userId}:latest`;
      
      // 🆕 Prova cache prima
      if (!forceRefresh) {
        const cached = await cacheService.get<EmotionAnalysis>(cacheKey);
        if (cached) {
          return cached;
        }
      }
      
      // 🔥 FIX: Usa maybeSingle() invece di single() per evitare errori quando non ci sono risultati
      const { data, error } = await supabase
        .from(Tables.EMOTION_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error getting latest emotion analysis:', error);
        return null;
      }
      
      // Se non ci sono risultati, data sarà null (non un errore)
      if (!data) {
        return null;
      }

      // 🆕 Cache per 5 minuti
      if (data) {
        await cacheService.set(cacheKey, data, 5 * 60 * 1000);
      }

      return data;
    } catch (error) {
      console.error('Error in getLatestEmotionAnalysis:', error);
      return null;
    }
  }

  /**
   * Ottiene le ultime N analisi emotive di un utente
   */
  static async getEmotionHistory(userId: string, limit: number = 5): Promise<EmotionAnalysis[]> {
    try {
      const { data, error } = await supabase
        .from(Tables.EMOTION_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting emotion history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getEmotionHistory:', error);
      return [];
    }
  }

  /**
   * Ottiene il contesto emotivo completo per l'AI
   */
  static async getEmotionContextForAI(userId: string): Promise<{
    current: EmotionAnalysis | null;
    history: EmotionAnalysis[];
    trend: 'improving' | 'stable' | 'declining';
  }> {
    try {
      const [current, history] = await Promise.all([
        this.getLatestEmotionAnalysis(userId),
        this.getEmotionHistory(userId, 5)
      ]);

      // Calcola il trend basato sulle ultime analisi
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      
      if (history.length >= 3) {
        const recent = history.slice(0, 3);
        const older = history.slice(3);
        
        if (recent.length > 0 && older.length > 0) {
          const recentAvgValence = recent.reduce((sum, h) => sum + h.valence, 0) / recent.length;
          const olderAvgValence = older.reduce((sum, h) => sum + h.valence, 0) / older.length;
          
          if (recentAvgValence > olderAvgValence + 0.1) {
            trend = 'improving';
          } else if (recentAvgValence < olderAvgValence - 0.1) {
            trend = 'declining';
          }
        }
      }

      return {
        current,
        history,
        trend
      };
    } catch (error) {
      console.error('Error in getEmotionContextForAI:', error);
      return {
        current: null,
        history: [],
        trend: 'stable'
      };
    }
  }

  /**
   * Ottiene statistiche emotive per un periodo
   */
  static async getEmotionStats(
    userId: string, 
    days: number = 30
  ): Promise<{
    totalAnalyses: number;
    dominantEmotions: Record<string, number>;
    averageValence: number;
    averageArousal: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from(Tables.EMOTION_ANALYSES)
        .select('dominant_emotion, valence, arousal')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error getting emotion stats:', error);
        return {
          totalAnalyses: 0,
          dominantEmotions: {},
          averageValence: 0,
          averageArousal: 0
        };
      }

      const analyses = data || [];
      const dominantEmotions: Record<string, number> = {};
      let totalValence = 0;
      let totalArousal = 0;

      analyses.forEach(analysis => {
        dominantEmotions[analysis.dominant_emotion] = 
          (dominantEmotions[analysis.dominant_emotion] || 0) + 1;
        totalValence += analysis.valence;
        totalArousal += analysis.arousal;
      });

      return {
        totalAnalyses: analyses.length,
        dominantEmotions,
        averageValence: analyses.length > 0 ? totalValence / analyses.length : 0,
        averageArousal: analyses.length > 0 ? totalArousal / analyses.length : 0
      };
    } catch (error) {
      console.error('Error in getEmotionStats:', error);
      return {
        totalAnalyses: 0,
        dominantEmotions: {},
        averageValence: 0,
        averageArousal: 0
      };
    }
  }
}


