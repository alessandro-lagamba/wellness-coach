import { supabase, Tables, SkinAnalysis } from '../lib/supabase';
import cacheService from './cache.service';
import { DataValidationService } from './data-validation.service';
import { RetryService } from './retry.service';
import { OperationLockService } from './operation-lock.service';
import { DatabaseVerificationService } from './database-verification.service';
import { EnhancedLoggingService } from './enhanced-logging.service';

export class SkinAnalysisService {
  /**
   * Salva una nuova analisi della pelle nel database
   * 🆕 Evita duplicati recenti: se c'è un'analisi simile negli ultimi 2 minuti, aggiorna quella invece di crearne una nuova
   * 🆕 Include: validazione dati, retry logic, locking per race conditions, verifica post-salvataggio
   */
  static async saveSkinAnalysis(
    userId: string,
    analysis: {
      overallScore: number;
      hydrationScore?: number;
      oilinessScore?: number;
      textureScore?: number;
      pigmentationScore?: number;
      rednessScore?: number;  // Added redness score
      strengths: string[];
      improvements: string[];
      recommendations: string[];
      analysisData?: Record<string, any>;
      imageUrl?: string;
    }
  ): Promise<SkinAnalysis | null> {
    // 🆕 Validazione dati prima del salvataggio
    const validation = DataValidationService.validateSkinAnalysis(analysis);
    if (!validation.valid) {
      EnhancedLoggingService.logSaveOperation('skin_analysis', userId, false, new Error(`Validation failed: ${validation.errors.join(', ')}`));
      throw new Error(`Dati non validi: ${validation.errors.join(', ')}`);
    }

    // 🆕 Usa locking per prevenire race conditions
    return OperationLockService.withLock(
      'save',
      `skin_analysis_${userId}`,
      async () => {
        // 🆕 Usa retry logic per operazioni database
        return RetryService.withRetry(
          async () => {
            try {
              // 🆕 Check duplicati recenti: analisi simili negli ultimi 2 minuti
              const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
              const { data: recentAnalysis, error: checkError } = await supabase
                .from(Tables.SKIN_ANALYSES)
                .select('id, created_at, overall_score, image_url')
                .eq('user_id', userId)
                .gte('created_at', twoMinutesAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              // 🆕 Se esiste un'analisi recente con stesso imageUrl o punteggio molto simile, aggiornala
              if (recentAnalysis && !checkError) {
                const isSimilar = 
                  (analysis.imageUrl && recentAnalysis.image_url === analysis.imageUrl) || // Stessa immagine
                  (Math.abs(recentAnalysis.overall_score - analysis.overallScore) < 5 && !analysis.imageUrl); // Punteggio simile e senza nuova immagine

                if (isSimilar) {
                  EnhancedLoggingService.logDatabaseOperation('update', 'skin_analysis', true);
                  
                  const { data: updated, error: updateError } = await supabase
                    .from(Tables.SKIN_ANALYSES)
                    .update({
                      overall_score: analysis.overallScore,
                      hydration_score: analysis.hydrationScore,
                      oiliness_score: analysis.oilinessScore,
                      texture_score: analysis.textureScore,
                      pigmentation_score: analysis.pigmentationScore,
                      redness_score: analysis.rednessScore,
                      strengths: analysis.strengths,
                      improvements: analysis.improvements,
                      recommendations: analysis.recommendations,
                      analysis_data: analysis.analysisData || {},
                      image_url: analysis.imageUrl || recentAnalysis.image_url, // Mantieni immagine esistente se non fornita nuova
                    })
                    .eq('id', recentAnalysis.id)
                    .select()
                    .single();

                  if (updateError) {
                    const err = new Error(`Error updating skin analysis: ${updateError.message}`);
                    EnhancedLoggingService.logSaveOperation('skin_analysis', userId, false, err);
                    throw err;
                  }

                  EnhancedLoggingService.logSaveOperation('skin_analysis', userId, true, undefined, updated.id);
                  
                  // 🆕 Invalida cache quando si aggiorna un'analisi
                  await cacheService.invalidatePrefix(`skin:${userId}`);
                  await cacheService.invalidate(`ai_context:${userId}`);
                  
                  // 🆕 Verifica post-salvataggio che i dati siano nel database
                  if (updated?.id) {
                    const verification = await DatabaseVerificationService.verifySkinAnalysis(userId, updated.id);
                    if (!verification.found) {
                      EnhancedLoggingService.logVerification('skin_analysis', userId, false, new Error('Data not found after update'));
                    }
                  }
                  
                  return updated;
                }
              }

              // 🆕 Nessun duplicato trovato, inserisci nuova analisi
              const { data, error } = await supabase
                .from(Tables.SKIN_ANALYSES)
                .insert({
                  user_id: userId,
                  overall_score: analysis.overallScore,
                  hydration_score: analysis.hydrationScore,
                  oiliness_score: analysis.oilinessScore,
                  texture_score: analysis.textureScore,
                  pigmentation_score: analysis.pigmentationScore,
                  redness_score: analysis.rednessScore,  // Added redness score
                  strengths: analysis.strengths,
                  improvements: analysis.improvements,
                  recommendations: analysis.recommendations,
                  analysis_data: analysis.analysisData || {},
                  image_url: analysis.imageUrl,
                })
                .select()
                .single();

              if (error) {
                const err = new Error(`Error saving skin analysis: ${error.message}`);
                EnhancedLoggingService.logSaveOperation('skin_analysis', userId, false, err);
                throw err;
              }

              EnhancedLoggingService.logSaveOperation('skin_analysis', userId, true, undefined, data.id);
              
              // 🆕 Invalida cache quando si salva una nuova analisi
              await cacheService.invalidatePrefix(`skin:${userId}`);
              await cacheService.invalidate(`ai_context:${userId}`);
              
              // 🆕 Verifica post-salvataggio che i dati siano nel database
              if (data?.id) {
                const verification = await DatabaseVerificationService.verifySkinAnalysis(userId, data.id);
                if (!verification.found) {
                  EnhancedLoggingService.logVerification('skin_analysis', userId, false, new Error('Data not found after save'));
                }
              }
              
              return data;
            } catch (error) {
              const err = error instanceof Error ? error : new Error('Unknown error');
              EnhancedLoggingService.logSaveOperation('skin_analysis', userId, false, err);
              throw err;
            }
          },
          'save_skin_analysis',
          {
            maxAttempts: 3,
            delay: 1000,
            backoff: 'exponential',
            shouldRetry: RetryService.isRetryableError,
          }
        );
      },
      `skin_analysis_${userId}`
    );
  }

  /**
   * Ottiene l'ultima analisi della pelle di un utente
   * 🆕 Con cache: cache di 5 minuti
   */
  static async getLatestSkinAnalysis(userId: string, forceRefresh: boolean = false): Promise<SkinAnalysis | null> {
    try {
      const cacheKey = `skin:${userId}:latest`;
      
      // 🆕 Prova cache prima
      if (!forceRefresh) {
        const cached = await cacheService.get<SkinAnalysis>(cacheKey);
        if (cached) {
          return cached;
        }
      }
      
      const { data, error } = await supabase
        .from(Tables.SKIN_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error getting latest skin analysis:', error);
        return null;
      }

      // 🆕 Cache per 5 minuti
      if (data) {
        await cacheService.set(cacheKey, data, 5 * 60 * 1000);
      }

      return data;
    } catch (error) {
      console.error('Error in getLatestSkinAnalysis:', error);
      return null;
    }
  }

  /**
   * Ottiene le ultime N analisi della pelle di un utente
   */
  static async getSkinHistory(userId: string, limit: number = 5): Promise<SkinAnalysis[]> {
    try {
      const { data, error } = await supabase
        .from(Tables.SKIN_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting skin history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSkinHistory:', error);
      return [];
    }
  }

  /**
   * Ottiene il contesto della pelle completo per l'AI
   */
  static async getSkinContextForAI(userId: string): Promise<{
    current: SkinAnalysis | null;
    history: SkinAnalysis[];
    trend: 'improving' | 'stable' | 'declining';
  }> {
    try {
      const [current, history] = await Promise.all([
        this.getLatestSkinAnalysis(userId),
        this.getSkinHistory(userId, 5)
      ]);

      // Calcola il trend basato sul punteggio generale
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      
      if (history.length >= 3) {
        const recent = history.slice(0, 3);
        const older = history.slice(3);
        
        if (recent.length > 0 && older.length > 0) {
          const recentAvgScore = recent.reduce((sum, h) => sum + h.overall_score, 0) / recent.length;
          const olderAvgScore = older.reduce((sum, h) => sum + h.overall_score, 0) / older.length;
          
          if (recentAvgScore > olderAvgScore + 5) {
            trend = 'improving';
          } else if (recentAvgScore < olderAvgScore - 5) {
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
      console.error('Error in getSkinContextForAI:', error);
      return {
        current: null,
        history: [],
        trend: 'stable'
      };
    }
  }

  /**
   * Ottiene statistiche della pelle per un periodo
   */
  static async getSkinStats(
    userId: string, 
    days: number = 30
  ): Promise<{
    totalAnalyses: number;
    averageOverallScore: number;
    averageHydrationScore: number;
    averageOilinessScore: number;
    averageTextureScore: number;
    averagePigmentationScore: number;
    commonStrengths: Record<string, number>;
    commonImprovements: Record<string, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from(Tables.SKIN_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error getting skin stats:', error);
        return {
          totalAnalyses: 0,
          averageOverallScore: 0,
          averageHydrationScore: 0,
          averageOilinessScore: 0,
          averageTextureScore: 0,
          averagePigmentationScore: 0,
          commonStrengths: {},
          commonImprovements: {}
        };
      }

      const analyses = data || [];
      const commonStrengths: Record<string, number> = {};
      const commonImprovements: Record<string, number> = {};
      
      let totalOverall = 0;
      let totalHydration = 0;
      let totalOiliness = 0;
      let totalTexture = 0;
      let totalPigmentation = 0;
      let hydrationCount = 0;
      let oilinessCount = 0;
      let textureCount = 0;
      let pigmentationCount = 0;

      analyses.forEach(analysis => {
        totalOverall += analysis.overall_score;
        
        if (analysis.hydration_score !== null) {
          totalHydration += analysis.hydration_score;
          hydrationCount++;
        }
        if (analysis.oiliness_score !== null) {
          totalOiliness += analysis.oiliness_score;
          oilinessCount++;
        }
        if (analysis.texture_score !== null) {
          totalTexture += analysis.texture_score;
          textureCount++;
        }
        if (analysis.pigmentation_score !== null) {
          totalPigmentation += analysis.pigmentation_score;
          pigmentationCount++;
        }

        // Conta strengths comuni
        analysis.strengths.forEach(strength => {
          commonStrengths[strength] = (commonStrengths[strength] || 0) + 1;
        });

        // Conta improvements comuni
        analysis.improvements.forEach(improvement => {
          commonImprovements[improvement] = (commonImprovements[improvement] || 0) + 1;
        });
      });

      return {
        totalAnalyses: analyses.length,
        averageOverallScore: analyses.length > 0 ? totalOverall / analyses.length : 0,
        averageHydrationScore: hydrationCount > 0 ? totalHydration / hydrationCount : 0,
        averageOilinessScore: oilinessCount > 0 ? totalOiliness / oilinessCount : 0,
        averageTextureScore: textureCount > 0 ? totalTexture / textureCount : 0,
        averagePigmentationScore: pigmentationCount > 0 ? totalPigmentation / pigmentationCount : 0,
        commonStrengths,
        commonImprovements
      };
    } catch (error) {
      console.error('Error in getSkinStats:', error);
      return {
        totalAnalyses: 0,
        averageOverallScore: 0,
        averageHydrationScore: 0,
        averageOilinessScore: 0,
        averageTextureScore: 0,
        averagePigmentationScore: 0,
        commonStrengths: {},
        commonImprovements: {}
      };
    }
  }

  /**
   * Trova correlazioni tra emozioni e pelle
   */
  static async getEmotionSkinCorrelations(userId: string): Promise<{
    correlations: Array<{
      emotion: string;
      skinScore: number;
      correlation: number;
    }>;
    insights: string[];
  }> {
    try {
      // Questa funzione potrebbe essere implementata con query più complesse
      // Per ora restituiamo dati di esempio
      return {
        correlations: [],
        insights: [
          'Lo stress può influenzare negativamente la qualità della pelle',
          'Le emozioni positive sono correlate a una pelle più luminosa',
          'L\'ansia può aumentare la produzione di sebo'
        ]
      };
    } catch (error) {
      console.error('Error in getEmotionSkinCorrelations:', error);
      return {
        correlations: [],
        insights: []
      };
    }
  }
}


