import { EmotionAnalysisService } from './emotion-analysis.service';
import { SkinAnalysisService } from './skin-analysis.service';
import { WellnessSuggestionService } from './chat-wellness.service';
import cacheService from './cache.service';
import { UnifiedAnalysisService } from './unified-analysis.service';
import { menstrualCycleService } from './menstrual-cycle.service';
import { FoodAnalysisService } from './food-analysis.service';

export interface AIContext {
  userId: string;
  currentEmotion: {
    emotion: string;
    valence: number;
    arousal: number;
    confidence: number;
  } | null;
  currentSkin: {
    overallScore: number;
    hydrationScore?: number;
    oilinessScore?: number;
    textureScore?: number;
    pigmentationScore?: number;
  } | null;
  emotionHistory: Array<{
    date: string;
    emotion: string;
    valence: number;
    arousal: number;
    confidence: number;
  }>;
  skinHistory: Array<{
    date: string;
    overallScore: number;
    hydrationScore?: number;
    oilinessScore?: number;
    textureScore?: number;
    pigmentationScore?: number;
  }>;
  emotionTrend: 'improving' | 'stable' | 'declining';
  skinTrend: 'improving' | 'stable' | 'declining';
  correlations: Array<{
    emotion: string;
    skinScore: number;
    correlation: number;
  }>;
  insights: string[];
  // Nuovi campi per analisi avanzate
  nutritionContext: {
    todayCalories: number;
    todayMacros: {
      protein: number;
      carbs: number;
      fat: number;
    };
    recentMeals: string[];
  };
  menstrualCycleContext: {
    phase: string;
    day: number;
    nextPeriodDays: number;
    recentNotes: string;
  } | null;
  temporalPatterns: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: 'weekday' | 'weekend';
    emotionalCycles: Array<{
      pattern: string;
      frequency: number;
      description: string;
    }>;
    skinCycles: Array<{
      pattern: string;
      frequency: number;
      description: string;
    }>;
  };
  behavioralInsights: {
    stressIndicators: string[];
    wellnessTriggers: string[];
    improvementAreas: string[];
    strengths: string[];
  };
  contextualFactors: {
    recentActivity: string;
    environmentalFactors: string[];
    lifestyleIndicators: string[];
  };
  suggestedWellnessSuggestion: {
    id: string;
    title: string;
    description: string;
    category: string;
    content: string;
    actionableSteps: string[];
    urgency: 'low' | 'medium' | 'high';
    timing: 'immediate' | 'today' | 'this_week';
  } | null;
  generatedAt: string;
}

export class AIContextService {
  /**
   * Analizza pattern temporali nelle emozioni e nella pelle
   */
  private static analyzeTemporalPatterns(emotionHistory: any[], skinHistory: any[]): {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: 'weekday' | 'weekend';
    emotionalCycles: Array<{ pattern: string; frequency: number; description: string; }>;
    skinCycles: Array<{ pattern: string; frequency: number; description: string; }>;
  } {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Determina periodo della giornata
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    // Determina giorno della settimana
    const dayOfWeek = (day >= 1 && day <= 5) ? 'weekday' : 'weekend';

    // Analizza cicli emotivi
    const emotionalCycles = this.detectEmotionalCycles(emotionHistory);

    // Analizza cicli della pelle
    const skinCycles = this.detectSkinCycles(skinHistory);

    return {
      timeOfDay,
      dayOfWeek,
      emotionalCycles,
      skinCycles
    };
  }

  /**
   * Rileva cicli emotivi ricorrenti
   */
  private static detectEmotionalCycles(emotionHistory: any[]): Array<{ pattern: string; frequency: number; description: string; }> {
    const cycles: Array<{ pattern: string; frequency: number; description: string; }> = [];

    if (emotionHistory.length < 3) return cycles;

    // Analizza pattern di valence
    const valenceValues = emotionHistory.map(h => h.valence);
    const avgValence = valenceValues.reduce((sum, v) => sum + v, 0) / valenceValues.length;

    if (avgValence < -0.2) {
      cycles.push({
        pattern: 'negative_valence',
        frequency: 0.8,
        description: 'Tendenza a stati d\'animo negativi'
      });
    } else if (avgValence > 0.2) {
      cycles.push({
        pattern: 'positive_valence',
        frequency: 0.8,
        description: 'Tendenza a stati d\'animo positivi'
      });
    }

    // Analizza pattern di arousal
    const arousalValues = emotionHistory.map(h => h.arousal);
    const avgArousal = arousalValues.reduce((sum, a) => sum + a, 0) / arousalValues.length;

    if (avgArousal > 0.7) {
      cycles.push({
        pattern: 'high_arousal',
        frequency: 0.7,
        description: 'Tendenza a stati di alta attivazione'
      });
    } else if (avgArousal < 0.3) {
      cycles.push({
        pattern: 'low_arousal',
        frequency: 0.7,
        description: 'Tendenza a stati di bassa attivazione'
      });
    }

    return cycles;
  }

  /**
   * Rileva cicli della pelle
   */
  private static detectSkinCycles(skinHistory: any[]): Array<{ pattern: string; frequency: number; description: string; }> {
    const cycles: Array<{ pattern: string; frequency: number; description: string; }> = [];

    if (skinHistory.length < 2) return cycles;

    // Analizza trend del punteggio generale
    const scores = skinHistory.map(h => h.overall_score);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    if (avgScore < 60) {
      cycles.push({
        pattern: 'low_skin_health',
        frequency: 0.8,
        description: 'Condizione della pelle generalmente bassa'
      });
    } else if (avgScore > 80) {
      cycles.push({
        pattern: 'high_skin_health',
        frequency: 0.8,
        description: 'Condizione della pelle generalmente buona'
      });
    }

    // Analizza pattern di idratazione
    const hydrationScores = skinHistory.filter(h => h.hydration_score !== null).map(h => h.hydration_score);
    if (hydrationScores.length > 0) {
      const avgHydration = hydrationScores.reduce((sum, h) => sum + h, 0) / hydrationScores.length;
      if (avgHydration < 50) {
        cycles.push({
          pattern: 'dehydration',
          frequency: 0.7,
          description: 'Tendenza alla disidratazione della pelle'
        });
      }
    }

    return cycles;
  }

  /**
   * Genera insights comportamentali
   */
  private static generateBehavioralInsights(
    emotionHistory: any[],
    skinHistory: any[],
    temporalPatterns: any
  ): {
    stressIndicators: string[];
    wellnessTriggers: string[];
    improvementAreas: string[];
    strengths: string[];
  } {
    const stressIndicators: string[] = [];
    const wellnessTriggers: string[] = [];
    const improvementAreas: string[] = [];
    const strengths: string[] = [];

    // Analizza indicatori di stress
    if (emotionHistory.length > 0) {
      const recentEmotions = emotionHistory.slice(0, 3);
      const avgValence = recentEmotions.reduce((sum, e) => sum + e.valence, 0) / recentEmotions.length;
      const avgArousal = recentEmotions.reduce((sum, e) => sum + e.arousal, 0) / recentEmotions.length;

      if (avgValence < -0.3) {
        stressIndicators.push('Umore persistentemente negativo');
      }
      if (avgArousal > 0.7) {
        stressIndicators.push('Alto livello di attivazione/stress');
      }
    }

    // Analizza trigger di benessere
    if (emotionHistory.length > 0) {
      const positiveEmotions = emotionHistory.filter(e => e.valence > 0.2);
      if (positiveEmotions.length > emotionHistory.length * 0.6) {
        wellnessTriggers.push('Tendenza a stati d\'animo positivi');
      }
    }

    // Analizza aree di miglioramento
    if (skinHistory.length > 0) {
      const recentSkin = skinHistory[0];
      if (recentSkin.overall_score < 70) {
        improvementAreas.push('Salute generale della pelle');
      }
      if (recentSkin.hydration_score && recentSkin.hydration_score < 60) {
        improvementAreas.push('Idratazione della pelle');
      }
      if (recentSkin.texture_score && recentSkin.texture_score < 60) {
        improvementAreas.push('Texture della pelle');
      }
    }

    // Identifica punti di forza
    if (skinHistory.length > 0) {
      const recentSkin = skinHistory[0];
      if (recentSkin.overall_score > 80) {
        strengths.push('Salute generale della pelle eccellente');
      }
      if (recentSkin.hydration_score && recentSkin.hydration_score > 80) {
        strengths.push('Ottima idratazione della pelle');
      }
    }

    return {
      stressIndicators,
      wellnessTriggers,
      improvementAreas,
      strengths
    };
  }

  /**
   * Genera fattori contestuali
   */
  private static generateContextualFactors(
    temporalPatterns: any,
    emotionHistory: any[],
    skinHistory: any[]
  ): {
    recentActivity: string;
    environmentalFactors: string[];
    lifestyleIndicators: string[];
  } {
    const environmentalFactors: string[] = [];
    const lifestyleIndicators: string[] = [];

    // Analizza fattori ambientali basati sui pattern temporali
    if (temporalPatterns.timeOfDay === 'morning') {
      environmentalFactors.push('Periodo mattutino - energia in aumento');
    } else if (temporalPatterns.timeOfDay === 'evening') {
      environmentalFactors.push('Periodo serale - tempo di rilassamento');
    }

    if (temporalPatterns.dayOfWeek === 'weekend') {
      environmentalFactors.push('Fine settimana - tempo libero');
    } else {
      environmentalFactors.push('Giorno lavorativo - routine quotidiana');
    }

    // Analizza indicatori di stile di vita
    if (emotionHistory.length > 0) {
      const recentEmotions = emotionHistory.slice(0, 2);
      const avgValence = recentEmotions.reduce((sum, e) => sum + e.valence, 0) / recentEmotions.length;

      if (avgValence > 0.3) {
        lifestyleIndicators.push('Stile di vita positivo e bilanciato');
      } else if (avgValence < -0.3) {
        lifestyleIndicators.push('Possibili fattori di stress nello stile di vita');
      }
    }

    return {
      recentActivity: 'Analisi recenti completate',
      environmentalFactors,
      lifestyleIndicators
    };
  }

  /**
   * Ottiene il contesto completo per l'AI basato su tutte le analisi dell'utente
   * 🆕 Con cache: cache di 10 minuti per ridurre chiamate DB
   */
  static async getCompleteContext(userId: string, forceRefresh: boolean = false): Promise<AIContext> {
    try {
      const cacheKey = `ai_context:${userId}`;

      // 🆕 Prova cache prima (se non forceRefresh)
      if (!forceRefresh) {
        const cached = await cacheService.get<AIContext>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Building AI context (logging handled by backend)

      // Ottieni contesto emotivo e della pelle in parallelo
      const [
        emotionContext,
        skinContext,
        correlations,
        foodHistory,
        cycleData,
        cycleNotes
      ] = await Promise.all([
        EmotionAnalysisService.getEmotionContextForAI(userId),
        SkinAnalysisService.getSkinContextForAI(userId),
        SkinAnalysisService.getEmotionSkinCorrelations(userId),
        FoodAnalysisService.getFoodHistory(userId, 30), // 🔥 FIX: Use Supabase instead of AsyncStorage
        menstrualCycleService.getCycleData(),
        menstrualCycleService.getRecentNotesForAI()
      ]);

      // Calcola contesto nutrizionale - 🔥 FIX: Supabase schema has fields at root level
      const today = new Date().toISOString().split('T')[0];
      const todayFood = (foodHistory as any[]).filter(f => f.created_at?.startsWith(today));

      let todayCalories = 0;
      let todayMacros = { protein: 0, carbs: 0, fat: 0 };
      const recentMeals: string[] = [];

      // 🔥 FIX: Supabase schema has calories, proteins, carbohydrates, fats at root level
      todayFood.forEach(f => {
        todayCalories += f.calories || 0;
        todayMacros.protein += f.proteins || 0;
        todayMacros.carbs += f.carbohydrates || 0;
        todayMacros.fat += f.fats || 0;
        if (f.identified_foods && f.identified_foods.length > 0) {
          recentMeals.push(...f.identified_foods);
        }
      });

      // Contesto ciclo mestruale
      const cycleContext = cycleData ? {
        phase: (cycleData as any).phaseName,
        day: (cycleData as any).day,
        nextPeriodDays: (cycleData as any).nextPeriodDays,
        recentNotes: cycleNotes
      } : null;

      // Ottieni suggerimento wellness appropriato
      const suggestedSuggestion = await WellnessSuggestionService.getContextualSuggestion(
        userId,
        emotionContext.current ? {
          dominantEmotion: emotionContext.current.dominant_emotion,
          valence: emotionContext.current.valence,
          arousal: emotionContext.current.arousal,
          confidence: emotionContext.current.confidence
        } : undefined,
        skinContext.current ? {
          overallScore: skinContext.current.overall_score,
          hydrationScore: skinContext.current.hydration_score,
          oilinessScore: skinContext.current.oiliness_score,
          textureScore: skinContext.current.texture_score,
          pigmentationScore: skinContext.current.pigmentation_score
        } : undefined
      );

      // Genera analisi avanzate
      const emotionHistory = emotionContext.history.map(h => ({
        date: h.created_at,
        emotion: h.dominant_emotion,
        valence: h.valence,
        arousal: h.arousal,
        confidence: h.confidence
      }));

      const skinHistory = skinContext.history.map(h => ({
        date: h.created_at,
        overallScore: h.overall_score,
        hydrationScore: h.hydration_score,
        oilinessScore: h.oiliness_score,
        textureScore: h.texture_score,
        pigmentationScore: h.pigmentation_score
      }));

      // Analizza pattern temporali
      const temporalPatterns = this.analyzeTemporalPatterns(emotionHistory, skinHistory);

      // Genera insights comportamentali
      const behavioralInsights = this.generateBehavioralInsights(
        emotionHistory,
        skinHistory,
        temporalPatterns
      );

      // Genera fattori contestuali
      const contextualFactors = this.generateContextualFactors(
        temporalPatterns,
        emotionHistory,
        skinHistory
      );

      // Determina urgenza e timing del suggerimento
      let urgency: 'low' | 'medium' | 'high' = 'low';
      let timing: 'immediate' | 'today' | 'this_week' = 'this_week';

      if (behavioralInsights.stressIndicators.length > 0 ||
        emotionContext.trend === 'declining' ||
        skinContext.trend === 'declining') {
        urgency = 'high';
        timing = 'immediate';
      } else if (behavioralInsights.improvementAreas.length > 0) {
        urgency = 'medium';
        timing = 'today';
      }

      // Costruisci il contesto finale
      const context: AIContext = {
        userId,
        currentEmotion: emotionContext.current ? {
          emotion: emotionContext.current.dominant_emotion,
          valence: emotionContext.current.valence,
          arousal: emotionContext.current.arousal,
          confidence: emotionContext.current.confidence
        } : null,
        currentSkin: skinContext.current ? {
          overallScore: skinContext.current.overall_score,
          hydrationScore: skinContext.current.hydration_score,
          oilinessScore: skinContext.current.oiliness_score,
          textureScore: skinContext.current.texture_score,
          pigmentationScore: skinContext.current.pigmentation_score
        } : null,
        emotionHistory,
        skinHistory,
        emotionHistory,
        skinHistory,
        emotionTrend: emotionContext.trend,
        skinTrend: skinContext.trend,
        nutritionContext: {
          todayCalories,
          todayMacros,
          recentMeals
        },
        menstrualCycleContext: cycleContext,
        correlations: correlations.correlations,
        insights: correlations.insights,
        temporalPatterns,
        behavioralInsights,
        contextualFactors,
        suggestedWellnessSuggestion: suggestedSuggestion ? {
          id: suggestedSuggestion.id,
          title: suggestedSuggestion.title,
          description: suggestedSuggestion.description,
          category: suggestedSuggestion.category,
          content: suggestedSuggestion.content,
          actionableSteps: suggestedSuggestion.actionable_steps,
          urgency,
          timing
        } : null,
        generatedAt: new Date().toISOString()
      };

      // AI context built successfully (logging handled by backend)

      // 🆕 Cache per 10 minuti
      await cacheService.set(cacheKey, context, 10 * 60 * 1000);

      return context;
    } catch (error) {
      console.error('Error building AI context:', error);

      // Restituisci contesto vuoto in caso di errore
      return {
        userId,
        currentEmotion: null,
        currentSkin: null,
        emotionHistory: [],
        skinHistory: [],
        emotionTrend: 'stable',
        skinTrend: 'stable',
        nutritionContext: {
          todayCalories: 0,
          todayMacros: { protein: 0, carbs: 0, fat: 0 },
          recentMeals: []
        },
        menstrualCycleContext: null,
        correlations: [],
        insights: [],
        temporalPatterns: {
          timeOfDay: 'afternoon',
          dayOfWeek: 'weekday',
          emotionalCycles: [],
          skinCycles: []
        },
        behavioralInsights: {
          stressIndicators: [],
          wellnessTriggers: [],
          improvementAreas: [],
          strengths: []
        },
        contextualFactors: {
          recentActivity: 'No recent activity',
          environmentalFactors: [],
          lifestyleIndicators: []
        },
        suggestedWellnessSuggestion: null,
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Formatta il contesto per il prompt dell'AI
   */
  static formatContextForPrompt(context: AIContext): string {
    let promptContext = '';

    // Contesto emotivo attuale
    if (context.currentEmotion) {
      promptContext += `\nSTATO EMOTIVO ATTUALE:
- Emozione dominante: ${context.currentEmotion.emotion}
- Valence: ${context.currentEmotion.valence.toFixed(2)} (da -1 negativo a +1 positivo)
- Arousal: ${context.currentEmotion.arousal.toFixed(2)} (da -1 calmo a +1 eccitato)
- Confidenza: ${(context.currentEmotion.confidence * 100).toFixed(1)}%`;
    }

    // Contesto pelle attuale
    if (context.currentSkin) {
      promptContext += `\n\nCONDIZIONE PELLE ATTUALE:
- Score generale: ${context.currentSkin.overallScore}/100
- Idratazione: ${context.currentSkin.hydrationScore || 'N/A'}/100
- Oleosità: ${context.currentSkin.oilinessScore || 'N/A'}/100
- Texture: ${context.currentSkin.textureScore || 'N/A'}/100
- Pigmentazione: ${context.currentSkin.pigmentationScore || 'N/A'}/100`;
    }

    // Storico emozioni
    if (context.emotionHistory.length > 0) {
      promptContext += `\n\nSTORICO EMOZIONI (Ultime ${context.emotionHistory.length} analisi):`;
      context.emotionHistory.forEach((h, index) => {
        const date = new Date(h.date).toLocaleDateString('it-IT');
        promptContext += `\n${index + 1}. ${date}: ${h.emotion} (valence: ${h.valence.toFixed(2)}, arousal: ${h.arousal.toFixed(2)})`;
      });
      promptContext += `\n- Trend emotivo: ${context.emotionTrend}`;
    }

    // Storico pelle
    if (context.skinHistory.length > 0) {
      promptContext += `\n\nSTORICO PELLE (Ultime ${context.skinHistory.length} analisi):`;
      context.skinHistory.forEach((h, index) => {
        const date = new Date(h.date).toLocaleDateString('it-IT');
        promptContext += `\n${index + 1}. ${date}: Score ${h.overallScore}/100`;
      });
      promptContext += `\n- Trend pelle: ${context.skinTrend}`;
    }

    // Contesto Nutrizionale
    promptContext += `\n\nNUTRIZIONE OGGI:
- Calorie assunte: ${context.nutritionContext.todayCalories} kcal
- Macronutrienti: Proteine ${context.nutritionContext.todayMacros.protein}g, Carboidrati ${context.nutritionContext.todayMacros.carbs}g, Grassi ${context.nutritionContext.todayMacros.fat}g`;

    if (context.nutritionContext.recentMeals.length > 0) {
      promptContext += `\n- Pasti recenti: ${context.nutritionContext.recentMeals.join(', ')}`;
    }

    // Contesto Ciclo Mestruale
    if (context.menstrualCycleContext) {
      promptContext += `\n\nCICLO MESTRUALE:
- Fase: ${context.menstrualCycleContext.phase}
- Giorno del ciclo: ${context.menstrualCycleContext.day}
- Prossimo ciclo tra: ${context.menstrualCycleContext.nextPeriodDays} giorni
- Note recenti: ${context.menstrualCycleContext.recentNotes}`;
    }

    // Pattern temporali
    promptContext += `\n\nCONTESTO TEMPORALE:
- Periodo della giornata: ${context.temporalPatterns.timeOfDay}
- Giorno della settimana: ${context.temporalPatterns.dayOfWeek}`;

    if (context.temporalPatterns.emotionalCycles.length > 0) {
      promptContext += `\n- Cicli emotivi rilevati:`;
      context.temporalPatterns.emotionalCycles.forEach(cycle => {
        promptContext += `\n  • ${cycle.description} (frequenza: ${(cycle.frequency * 100).toFixed(0)}%)`;
      });
    }

    if (context.temporalPatterns.skinCycles.length > 0) {
      promptContext += `\n- Cicli della pelle rilevati:`;
      context.temporalPatterns.skinCycles.forEach(cycle => {
        promptContext += `\n  • ${cycle.description} (frequenza: ${(cycle.frequency * 100).toFixed(0)}%)`;
      });
    }

    // Insights comportamentali
    if (context.behavioralInsights.stressIndicators.length > 0) {
      promptContext += `\n\nINDICATORI DI STRESS:`;
      context.behavioralInsights.stressIndicators.forEach(indicator => {
        promptContext += `\n- ${indicator}`;
      });
    }

    if (context.behavioralInsights.wellnessTriggers.length > 0) {
      promptContext += `\n\nTRIGGER DI BENESSERE:`;
      context.behavioralInsights.wellnessTriggers.forEach(trigger => {
        promptContext += `\n- ${trigger}`;
      });
    }

    if (context.behavioralInsights.improvementAreas.length > 0) {
      promptContext += `\n\nAREE DI MIGLIORAMENTO:`;
      context.behavioralInsights.improvementAreas.forEach(area => {
        promptContext += `\n- ${area}`;
      });
    }

    if (context.behavioralInsights.strengths.length > 0) {
      promptContext += `\n\nPUNTI DI FORZA:`;
      context.behavioralInsights.strengths.forEach(strength => {
        promptContext += `\n- ${strength}`;
      });
    }

    // Fattori contestuali
    if (context.contextualFactors.environmentalFactors.length > 0) {
      promptContext += `\n\nFATTORI AMBIENTALI:`;
      context.contextualFactors.environmentalFactors.forEach(factor => {
        promptContext += `\n- ${factor}`;
      });
    }

    if (context.contextualFactors.lifestyleIndicators.length > 0) {
      promptContext += `\n\nINDICATORI DI STILE DI VITA:`;
      context.contextualFactors.lifestyleIndicators.forEach(indicator => {
        promptContext += `\n- ${indicator}`;
      });
    }

    // Correlazioni e insights esistenti
    if (context.insights.length > 0) {
      promptContext += `\n\nINSIGHTS PERSONALIZZATI:`;
      context.insights.forEach((insight, index) => {
        promptContext += `\n- ${insight}`;
      });
    }

    // Suggerimento wellness
    if (context.suggestedWellnessSuggestion) {
      promptContext += `\n\nSUGGERIMENTO WELLNESS CONSIGLIATO:
- Titolo: ${context.suggestedWellnessSuggestion.title}
- Categoria: ${context.suggestedWellnessSuggestion.category}
- Descrizione: ${context.suggestedWellnessSuggestion.description}
- Urgenza: ${context.suggestedWellnessSuggestion.urgency}
- Timing: ${context.suggestedWellnessSuggestion.timing}`;
    }

    return promptContext;
  }

  /**
   * Ottiene un suggerimento wellness basato sul contesto
   */
  static async getContextualWellnessSuggestion(userId: string): Promise<{
    suggestion: any | null;
    shouldShowBanner: boolean;
  }> {
    try {
      const context = await this.getCompleteContext(userId);

      if (!context.suggestedWellnessSuggestion) {
        return {
          suggestion: null,
          shouldShowBanner: false
        };
      }

      // Determina se mostrare il banner basato su urgenza e fattori contestuali
      const shouldShowBanner =
        context.suggestedWellnessSuggestion?.urgency === 'high' ||
        context.suggestedWellnessSuggestion?.urgency === 'medium' ||
        context.behavioralInsights.stressIndicators.length > 0 ||
        context.behavioralInsights.improvementAreas.length > 0 ||
        (context.temporalPatterns.timeOfDay === 'evening' && context.currentEmotion?.valence < -0.2);

      return {
        suggestion: context.suggestedWellnessSuggestion,
        shouldShowBanner
      };
    } catch (error) {
      console.error('Error getting contextual wellness suggestion:', error);
      return {
        suggestion: null,
        shouldShowBanner: false
      };
    }
  }
}


