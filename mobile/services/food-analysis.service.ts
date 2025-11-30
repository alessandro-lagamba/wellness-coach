import { supabase, Tables, FoodAnalysis } from '../lib/supabase';
import { encryptText, decryptText, encryptStringArray, decryptStringArray } from './encryption.service';
import cacheService from './cache.service';
import { DataValidationService } from './data-validation.service';
import { RetryService } from './retry.service';
import { OperationLockService } from './operation-lock.service';
import { DatabaseVerificationService } from './database-verification.service';
import { EnhancedLoggingService } from './enhanced-logging.service';

type AllowedMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
const MEAL_TYPE_ALIASES: Record<string, AllowedMealType> = {
  breakfast: 'breakfast',
  colazione: 'breakfast',
  lunch: 'lunch',
  pranzo: 'lunch',
  dinner: 'dinner',
  supper: 'dinner',
  cena: 'dinner',
  snack: 'snack',
  merenda: 'snack',
};

const normalizeMealType = (value?: string | null): AllowedMealType => {
  if (!value) {
    return 'other';
  }

  const normalized = value.toLowerCase().trim();
  if (MEAL_TYPE_ALIASES[normalized]) {
    return MEAL_TYPE_ALIASES[normalized];
  }

  if (normalized.includes('break')) return 'breakfast';
  if (normalized.includes('lunch') || normalized.includes('pranzo')) return 'lunch';
  if (normalized.includes('dinner') || normalized.includes('supper') || normalized.includes('cena')) return 'dinner';
  if (normalized.includes('snack') || normalized.includes('merenda')) return 'snack';

  return 'other';
};

export class FoodAnalysisService {
  /**
   * Salva una nuova analisi del cibo nel database
   * Evita duplicati recenti: se c'è un'analisi simile negli ultimi 2 minuti, aggiorna quella invece di crearne una nuova
   * 🆕 Include: validazione dati, retry logic, locking per race conditions, verifica post-salvataggio
   */
  static async saveFoodAnalysis(
    userId: string,
    analysis: {
      mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
      identifiedFoods: string[];
      calories: number;
      carbohydrates: number;
      proteins: number;
      fats: number;
      fiber?: number;
      vitamins?: Record<string, number>;
      minerals?: Record<string, number>;
      healthScore?: number;
      recommendations: string[];
      observations: string[];
      confidence: number;
      analysisData?: Record<string, any>;
      imageUrl?: string;
    }
  ): Promise<FoodAnalysis | null> {
    // 🔥 FIX: Carica l'immagine in Supabase Storage se fornita
    let finalImageUrl = analysis.imageUrl;
    if (analysis.imageUrl && !analysis.imageUrl.startsWith('http')) {
      // Se è un URI locale, caricalo in Supabase Storage
      try {
        const { foodImageStorageService } = await import('./food-image-storage.service');
        // Carica l'immagine (l'analysisId verrà aggiunto dopo il salvataggio)
        finalImageUrl = await foodImageStorageService.uploadFoodImage(analysis.imageUrl);
        console.log('[FoodAnalysis] Image uploaded to Supabase Storage:', finalImageUrl);
      } catch (uploadError) {
        console.error('[FoodAnalysis] Failed to upload image to Supabase Storage:', uploadError);
        // Continua con l'URI locale come fallback
        console.warn('[FoodAnalysis] Using local URI as fallback:', analysis.imageUrl);
      }
    }
    // 🆕 Validazione dati prima del salvataggio
    const validation = DataValidationService.validateFoodAnalysis(analysis);
    if (!validation.valid) {
      EnhancedLoggingService.logSaveOperation('food_analysis', userId, false, new Error(`Validation failed: ${validation.errors.join(', ')}`));
      throw new Error(`Dati non validi: ${validation.errors.join(', ')}`);
    }

    // 🆕 Usa locking per prevenire race conditions
    return OperationLockService.withLock(
      'save',
      `food_analysis_${userId}`,
      async () => {
        // 🆕 Usa retry logic per operazioni database
        return RetryService.withRetry(
          async () => {
            try {
              const normalizedMealType = normalizeMealType(analysis.mealType);

              // Check duplicati recenti: analisi simili negli ultimi 2 minuti
              const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
              const { data: recentAnalysis, error: checkError } = await supabase
                .from(Tables.FOOD_ANALYSES)
                .select('id, created_at, calories, image_url')
                .eq('user_id', userId)
                .gte('created_at', twoMinutesAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              // Se esiste un'analisi recente con stesso imageUrl o calorie molto simili, aggiornala
              if (recentAnalysis && !checkError) {
                const isSimilar = 
                  (analysis.imageUrl && recentAnalysis.image_url === analysis.imageUrl) || // Stessa immagine
                  (Math.abs(recentAnalysis.calories - analysis.calories) < 50 && !analysis.imageUrl); // Calorie simili e senza nuova immagine

                if (isSimilar) {
                  EnhancedLoggingService.logDatabaseOperation('update', 'food_analysis', true);
                  
                  // Cifra observations prima di salvare
                  let encryptedObservations: string[] | null = null;
                  if (analysis.observations && analysis.observations.length > 0) {
                    try {
                      const encrypted = await encryptStringArray(analysis.observations, userId);
                      if (encrypted) {
                        // Salva come array con un singolo elemento cifrato (per compatibilità con tipo array)
                        encryptedObservations = [encrypted];
                      }
                    } catch (encError) {
                      console.warn('[FoodAnalysis] ⚠️ Encryption failed for observations, saving as plaintext (fallback):', encError);
                      encryptedObservations = analysis.observations; // Fallback
                    }
                  }
                  
                  const { data: updated, error: updateError } = await supabase
                    .from(Tables.FOOD_ANALYSES)
                    .update({
                      meal_type: normalizedMealType,
                      identified_foods: analysis.identifiedFoods,
                      calories: analysis.calories,
                      carbohydrates: analysis.carbohydrates,
                      proteins: analysis.proteins,
                      fats: analysis.fats,
                      fiber: analysis.fiber,
                      vitamins: analysis.vitamins || {},
                      minerals: analysis.minerals || {},
                      health_score: analysis.healthScore,
                      recommendations: analysis.recommendations,
                      observations: encryptedObservations || analysis.observations,
                      confidence: analysis.confidence,
                      analysis_data: analysis.analysisData || {},
                      image_url: finalImageUrl || recentAnalysis.image_url, // 🔥 FIX: Usa l'URL pubblico di Supabase Storage
                    })
                    .eq('id', recentAnalysis.id)
                    .select()
                    .single();

                  if (updateError) {
                    const err = new Error(`Error updating food analysis: ${updateError.message}`);
                    EnhancedLoggingService.logSaveOperation('food_analysis', userId, false, err);
                    throw err;
                  }

                  EnhancedLoggingService.logSaveOperation('food_analysis', userId, true, undefined, updated.id);
                  
                  // Invalida cache quando si aggiorna un'analisi
                  await cacheService.invalidatePrefix(`food:${userId}`);
                  await cacheService.invalidate(`ai_context:${userId}`);
                  
                  // 🆕 Verifica post-salvataggio che i dati siano nel database
                  if (updated?.id) {
                    const verification = await DatabaseVerificationService.verifyFoodAnalysis(userId, updated.id);
                    if (!verification.found) {
                      EnhancedLoggingService.logVerification('food_analysis', userId, false, new Error('Data not found after update'));
                    }
                  }
                  
                  // Decifra observations prima di restituire
                  const result = updated as FoodAnalysis;
                  if (result.observations && result.observations.length > 0) {
                    const decrypted = await decryptStringArray(result.observations[0], userId);
                    if (decrypted !== null) {
                      result.observations = decrypted;
                    }
                  }
                  
                  return result;
                }
              }

              // Cifra observations prima di salvare
              let encryptedObservations: string[] | null = null;
              if (analysis.observations && analysis.observations.length > 0) {
                try {
                  const encrypted = await encryptStringArray(analysis.observations, userId);
                  if (encrypted) {
                    // Salva come array con un singolo elemento cifrato (per compatibilità con tipo array)
                    encryptedObservations = [encrypted];
                  }
                } catch (encError) {
                  console.warn('[FoodAnalysis] ⚠️ Encryption failed for observations, saving as plaintext (fallback):', encError);
                  encryptedObservations = analysis.observations; // Fallback
                }
              }

              // Nessun duplicato trovato, inserisci nuova analisi
              const { data, error } = await supabase
                .from(Tables.FOOD_ANALYSES)
                .insert({
                  user_id: userId,
                  meal_type: normalizedMealType,
                  identified_foods: analysis.identifiedFoods,
                  calories: analysis.calories,
                  carbohydrates: analysis.carbohydrates,
                  proteins: analysis.proteins,
                  fats: analysis.fats,
                  fiber: analysis.fiber,
                  vitamins: analysis.vitamins || {},
                  minerals: analysis.minerals || {},
                  health_score: analysis.healthScore,
                  recommendations: analysis.recommendations,
                  observations: encryptedObservations || analysis.observations,
                  confidence: analysis.confidence,
                  analysis_data: analysis.analysisData || {},
                  image_url: finalImageUrl, // 🔥 FIX: Usa l'URL pubblico di Supabase Storage
                })
                .select()
                .single();

              if (error) {
                const err = new Error(`Error saving food analysis: ${error.message}`);
                EnhancedLoggingService.logSaveOperation('food_analysis', userId, false, err);
                throw err;
              }

              EnhancedLoggingService.logSaveOperation('food_analysis', userId, true, undefined, data.id);
              
              // Invalida cache quando si salva una nuova analisi
              await cacheService.invalidatePrefix(`food:${userId}`);
              await cacheService.invalidate(`ai_context:${userId}`);
              
              // 🆕 Verifica post-salvataggio che i dati siano nel database
              if (data?.id) {
                const verification = await DatabaseVerificationService.verifyFoodAnalysis(userId, data.id);
                if (!verification.found) {
                  EnhancedLoggingService.logVerification('food_analysis', userId, false, new Error('Data not found after save'));
                }
              }
              
              // Decifra observations prima di restituire
              const result = data as FoodAnalysis;
              if (result.observations && result.observations.length > 0) {
                const decrypted = await decryptStringArray(result.observations[0], userId);
                if (decrypted !== null) {
                  result.observations = decrypted;
                }
              }
              
              return result;
            } catch (error) {
              const err = error instanceof Error ? error : new Error('Unknown error');
              EnhancedLoggingService.logSaveOperation('food_analysis', userId, false, err);
              throw err;
            }
          },
          'save_food_analysis',
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
   * Ottiene l'ultima analisi del cibo di un utente
   * Con cache: cache di 5 minuti
   */
  static async getLatestFoodAnalysis(userId: string, forceRefresh: boolean = false): Promise<FoodAnalysis | null> {
    try {
      const cacheKey = `food:${userId}:latest`;
      
      // Prova cache prima
      if (!forceRefresh) {
        const cached = await cacheService.get<FoodAnalysis>(cacheKey);
        if (cached) {
          return cached;
        }
      }
      
      const { data, error } = await supabase
        .from(Tables.FOOD_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error getting latest food analysis:', error);
        return null;
      }

      // Decifra observations prima di restituire
      if (data) {
        if (data.observations && data.observations.length > 0) {
          const decrypted = await decryptStringArray(data.observations[0], userId);
          if (decrypted !== null) {
            data.observations = decrypted;
          }
        }
        
        // Cache per 5 minuti (dopo decifratura)
        await cacheService.set(cacheKey, data, 5 * 60 * 1000);
      }

      return data;
    } catch (error) {
      console.error('Error in getLatestFoodAnalysis:', error);
      return null;
    }
  }

  /**
   * Ottiene le ultime N analisi del cibo di un utente
   */
  static async getFoodHistory(userId: string, limit: number = 10): Promise<FoodAnalysis[]> {
    try {
      const { data, error } = await supabase
        .from(Tables.FOOD_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting food history:', error);
        return [];
      }

      // Decifra observations per tutti i record
      const analyses = (data || []) as FoodAnalysis[];
      for (const analysis of analyses) {
        if (analysis.observations && analysis.observations.length > 0) {
          const decrypted = await decryptStringArray(analysis.observations[0], userId);
          if (decrypted !== null) {
            analysis.observations = decrypted;
          }
        }
      }

      return analyses;
    } catch (error) {
      console.error('Error in getFoodHistory:', error);
      return [];
    }
  }

  /**
   * Ottiene il totale giornaliero di macronutrienti per un utente
   */
  static async getDailyIntake(userId: string, date?: Date): Promise<{
    calories: number;
    carbohydrates: number;
    proteins: number;
    fats: number;
    fiber: number;
    mealCount: number;
  }> {
    try {
      const targetDate = date || new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from(Tables.FOOD_ANALYSES)
        .select('calories, carbohydrates, proteins, fats, fiber')
        .eq('user_id', userId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      if (error) {
        console.error('Error getting daily intake:', error);
        return {
          calories: 0,
          carbohydrates: 0,
          proteins: 0,
          fats: 0,
          fiber: 0,
          mealCount: 0,
        };
      }

      const meals = data || [];
      // 🔥 FIX: Esplicita il tipo dell'accumulatore per evitare errori TypeScript
      const totals = meals.reduce<{
        calories: number;
        carbohydrates: number;
        proteins: number;
        fats: number;
        fiber: number;
        mealCount: number;
      }>((acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        carbohydrates: acc.carbohydrates + (meal.carbohydrates || 0),
        proteins: acc.proteins + (meal.proteins || 0),
        fats: acc.fats + (meal.fats || 0),
        fiber: acc.fiber + (meal.fiber || 0),
        mealCount: acc.mealCount + 1,
      }), {
        calories: 0,
        carbohydrates: 0,
        proteins: 0,
        fats: 0,
        fiber: 0,
        mealCount: 0,
      });

      return totals;
    } catch (error) {
      console.error('Error in getDailyIntake:', error);
      return {
        calories: 0,
        carbohydrates: 0,
        proteins: 0,
        fats: 0,
        fiber: 0,
        mealCount: 0,
      };
    }
  }

  /**
   * Ottiene statistiche del cibo per un periodo
   */
  static async getFoodStats(
    userId: string, 
    days: number = 30
  ): Promise<{
    totalAnalyses: number;
    averageCalories: number;
    averageHealthScore: number;
    mealTypeDistribution: Record<string, number>;
    averageMacros: {
      carbohydrates: number;
      proteins: number;
      fats: number;
    };
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from(Tables.FOOD_ANALYSES)
        .select('calories, carbohydrates, proteins, fats, health_score, meal_type')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error getting food stats:', error);
        return {
          totalAnalyses: 0,
          averageCalories: 0,
          averageHealthScore: 0,
          mealTypeDistribution: {},
          averageMacros: {
            carbohydrates: 0,
            proteins: 0,
            fats: 0,
          },
        };
      }

      const analyses = data || [];
      const mealTypeDistribution: Record<string, number> = {};
      let totalCalories = 0;
      let totalHealthScore = 0;
      let healthScoreCount = 0;
      let totalCarbs = 0;
      let totalProteins = 0;
      let totalFats = 0;

      analyses.forEach(analysis => {
        totalCalories += analysis.calories || 0;
        totalCarbs += analysis.carbohydrates || 0;
        totalProteins += analysis.proteins || 0;
        totalFats += analysis.fats || 0;
        
        if (analysis.health_score !== null && analysis.health_score !== undefined) {
          totalHealthScore += analysis.health_score;
          healthScoreCount++;
        }

        const mealType = analysis.meal_type || 'other';
        mealTypeDistribution[mealType] = (mealTypeDistribution[mealType] || 0) + 1;
      });

      return {
        totalAnalyses: analyses.length,
        averageCalories: analyses.length > 0 ? totalCalories / analyses.length : 0,
        averageHealthScore: healthScoreCount > 0 ? totalHealthScore / healthScoreCount : 0,
        mealTypeDistribution,
        averageMacros: {
          carbohydrates: analyses.length > 0 ? totalCarbs / analyses.length : 0,
          proteins: analyses.length > 0 ? totalProteins / analyses.length : 0,
          fats: analyses.length > 0 ? totalFats / analyses.length : 0,
        },
      };
    } catch (error) {
      console.error('Error in getFoodStats:', error);
      return {
        totalAnalyses: 0,
        averageCalories: 0,
        averageHealthScore: 0,
        mealTypeDistribution: {},
        averageMacros: {
          carbohydrates: 0,
          proteins: 0,
          fats: 0,
        },
      };
    }
  }
}



