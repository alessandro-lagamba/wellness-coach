import { BACKEND_URL } from '../constants/env';
import { AuthService } from './auth.service';
import { AIContextService } from './ai-context.service';
import { AnalysisIntentService } from './analysis-intent.service';
import { getUserLanguage } from './language.service';
import IntelligentInsightDBService from './intelligent-insight-db.service';
import { jsonrepair } from 'jsonrepair';

export interface IntelligentInsight {
  id: string;
  title: string;
  description: string;
  actionType: 'routine' | 'reminder' | 'tracking';
  estimatedTime?: string;
  priority: 'low' | 'medium' | 'high';
  category: 'emotion' | 'skin' | 'food';
  actionable: boolean;
  detailedExplanation?: string;
  correlations?: string[];
  expectedBenefits?: string[];
}

export interface InsightAnalysisRequest {
  category: 'emotion' | 'skin' | 'food';
  data: any;
  userContext?: any;
}

export interface InsightAnalysisResponse {
  insights: IntelligentInsight[];
  trendSummary: string;
  overallScore?: number;
  focus?: string;
}

class IntelligentInsightService {
  private static instance: IntelligentInsightService;
  private cache: Map<string, InsightAnalysisResponse> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): IntelligentInsightService {
    if (!IntelligentInsightService.instance) {
      IntelligentInsightService.instance = new IntelligentInsightService();
    }
    return IntelligentInsightService.instance;
  }

  /**
   * Generate intelligent insights for emotion or skin analysis
   */
  async generateIntelligentInsights(request: InsightAnalysisRequest): Promise<InsightAnalysisResponse> {
    const shouldPersistDaily = request.category !== 'food';

    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      let dbService: IntelligentInsightDBService | null = null;
      let cacheKey: string | null = null;

      if (shouldPersistDaily) {
        // Check database first for today's insights
        dbService = IntelligentInsightDBService.getInstance();
        const today = new Date().toISOString().split('T')[0];

        const { success: dbSuccess, data: existingInsights } = await dbService.getIntelligentInsights(
          currentUser.id,
          request.category,
          today
        );

        if (dbSuccess && existingInsights) {
          console.log(`📋 Using existing insights from database for ${request.category} on ${today}`);
          return dbService.convertDBRecordToInsightsData(existingInsights);
        }

        // Check cache as fallback
        const now = new Date();
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        cacheKey = `insights_${currentUser.id}_${request.category}_${localToday}`;
        const cached = this.getCachedInsights(cacheKey);
        if (cached) {
          console.log('📋 Using cached intelligent insights for today');
          return cached;
        }
      } else {
        console.log('🧠 Food insights: skipping daily cache to allow per-meal generation');
      }

      console.log(`🧠 Generating new intelligent insights for ${request.category}...`);

      // Prepare AI context
      const aiContext = await AIContextService.getCompleteContext(currentUser.id);
      const userLanguage = await getUserLanguage(); // 🔥 FIX: Ottieni la lingua dell'utente
      const userContext = aiContext ? {
        emotionHistory: aiContext.emotionHistory,
        skinHistory: aiContext.skinHistory,
        emotionTrend: aiContext.emotionTrend,
        skinTrend: aiContext.skinTrend,
        insights: aiContext.insights,
        temporalPatterns: aiContext.temporalPatterns,
        behavioralInsights: aiContext.behavioralInsights,
        contextualFactors: aiContext.contextualFactors,
        firstName: currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente',
        userName: currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente',
        language: userLanguage // 🔥 FIX: Includi la lingua per il backend
      } : {
        emotionHistory: [],
        skinHistory: [],
        emotionTrend: null,
        skinTrend: null,
        insights: [],
        temporalPatterns: null,
        behavioralInsights: null,
        contextualFactors: null,
        userName: 'Utente',
        isAnonymous: true,
        language: userLanguage // 🔥 FIX: Includi la lingua anche per utenti anonimi
      };

      // Generate AI analysis
      const analysisResponse = await this.generateAIAnalysis(request, userContext);

      // Save to database only for categories that should persist daily
      if (shouldPersistDaily && dbService) {
        try {
          await dbService.saveIntelligentInsights(currentUser.id, request.category, analysisResponse);
          console.log(`✅ Intelligent insights saved to database for ${request.category}`);
        } catch (dbError) {
          console.warn('⚠️ Failed to save intelligent insights to database:', dbError);
        }
      }

      // Cache the result only for daily categories
      if (cacheKey) {
        this.setCachedInsights(cacheKey, analysisResponse);
      }

      console.log(`✅ Generated ${analysisResponse.insights.length} intelligent insights for ${request.category}`);
      return analysisResponse;

    } catch (error) {
      if (error instanceof Error && error.message.includes('Backend request failed')) {
        console.warn('⚠️ Intelligent insights backend unavailable, serving fallback data.', error.message);
      } else {
        console.error('❌ Error generating intelligent insights:', error);
      }
      return this.getFallbackInsights(request.category);
    }
  }

  /**
   * Generate AI analysis using backend
   */
  private async generateAIAnalysis(request: InsightAnalysisRequest, userContext: any): Promise<InsightAnalysisResponse> {
    const userMessage = this.buildPrompt(request);
    const sessionId = `intelligent-insights-${Date.now()}`;
    const analysisIntent = AnalysisIntentService.detectAnalysisIntent(userMessage);

    const response = await fetch(`${BACKEND_URL}/api/chat/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        sessionId: sessionId,
        userId: userContext.userName !== 'Utente' ? userContext.userName : undefined,
        emotionContext: request.category === 'emotion' ? request.data : undefined,
        skinContext: request.category === 'skin' ? request.data : undefined,
        foodContext: request.category === 'food' ? request.data : undefined,
        userContext: userContext,
        analysisIntent: analysisIntent.confidence > 0.3 ? analysisIntent : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success && (data.response || data.message || data.text)) {
      const analysisText = data.response || data.message || data.text;
      return this.parseAIAnalysis(analysisText, request);
    } else {
      throw new Error('Failed to generate AI analysis');
    }
  }

  /**
   * Build specialized prompt for emotion, skin or food insights
   */
  private buildPrompt(request: InsightAnalysisRequest): string {
    switch (request.category) {
      case 'emotion':
        return this.buildEmotionPrompt(request.data);
      case 'skin':
        return this.buildSkinPrompt(request.data);
      case 'food':
        return this.buildFoodPrompt(request.data);
      default:
        return this.buildEmotionPrompt(request.data);
    }
  }

  /**
   * Build emotion analysis prompt
   */
  private buildEmotionPrompt(emotionData: any): string {
    // Estrai dati specifici dalla struttura dati
    const latestSession = emotionData?.latestSession || emotionData?.latest_emotion || emotionData;
    const emotionHistory = emotionData?.emotionHistory || emotionData?.emotion_history || [];
    const trend = emotionData?.trend || emotionData?.emotionTrend || 'stable';
    const insights = emotionData?.insights || [];

    // Valori attuali - supporta sia EmotionSession che altre strutture
    const currentEmotion = latestSession?.dominant || latestSession?.emotion || latestSession?.dominantEmotion || 'neutral';
    const currentValence = latestSession?.avg_valence ?? latestSession?.valence ?? latestSession?.valence_score ?? 0;
    const currentArousal = latestSession?.avg_arousal ?? latestSession?.arousal ?? latestSession?.arousal_score ?? 0;
    const currentConfidence = latestSession?.confidence ?? latestSession?.confidence_score ?? 0;
    const currentDate = latestSession?.date || (latestSession?.timestamp ? new Date(latestSession.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

    // Analizza trend storico
    let valenceTrend = 'stabile';
    let arousalTrend = 'stabile';
    let emotionPattern = 'nessun pattern evidente';
    
    if (emotionHistory && emotionHistory.length > 0) {
      const recentSessions = emotionHistory.slice(-5);
      const valences = recentSessions.map((s: any) => s.avg_valence ?? s.valence ?? s.valence_score ?? 0).filter((v: number) => v !== 0);
      const arousals = recentSessions.map((s: any) => s.avg_arousal ?? s.arousal ?? s.arousal_score ?? 0).filter((a: number) => a !== 0);
      
      if (valences.length > 1) {
        const avgValence = valences.reduce((a: number, b: number) => a + b, 0) / valences.length;
        if (currentValence > avgValence + 0.1) valenceTrend = 'in miglioramento';
        else if (currentValence < avgValence - 0.1) valenceTrend = 'in calo';
      }
      
      if (arousals.length > 1) {
        const avgArousal = arousals.reduce((a: number, b: number) => a + b, 0) / arousals.length;
        if (currentArousal > avgArousal + 0.1) arousalTrend = 'più alto del solito';
        else if (currentArousal < avgArousal - 0.1) arousalTrend = 'più basso del solito';
      }

      // Analizza pattern emotivi
      const emotions = recentSessions.map((s: any) => s.dominant || s.emotion || s.dominantEmotion || 'neutral');
      const emotionCounts: Record<string, number> = {};
      emotions.forEach((e: string) => {
        emotionCounts[e] = (emotionCounts[e] || 0) + 1;
      });
      const mostCommon = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
      if (mostCommon && mostCommon[1] >= 3) {
        emotionPattern = `tendenza verso ${mostCommon[0]} (${mostCommon[1]} volte negli ultimi ${recentSessions.length} giorni)`;
      }
    }

    // Osservazioni e raccomandazioni
    const observations = latestSession?.observations || emotionData?.observations || [];
    const recommendations = latestSession?.recommendations || emotionData?.recommendations || [];

    return `Sei un assistente wellness specializzato in benessere emotivo. 
Analizza i dati specifici dell'utente e fornisci insight pratici e personalizzati basati sui valori reali.

📊 STATO EMOTIVO ATTUALE (${currentDate}):
- Emozione dominante: ${currentEmotion}
- Valence: ${currentValence.toFixed(2)} (da -1 negativo a +1 positivo)
- Arousal: ${currentArousal.toFixed(2)} (da -1 calmo a +1 eccitato)
- Confidenza: ${(currentConfidence * 100).toFixed(0)}%

📈 TREND E PATTERN:
- Trend generale: ${trend === 'improving' ? 'miglioramento' : trend === 'declining' ? 'peggioramento' : 'stabile'}
- Trend valence: ${valenceTrend}
- Trend arousal: ${arousalTrend}
- Pattern emotivo: ${emotionPattern}
${emotionHistory.length > 0 ? `- Storia disponibile: ${emotionHistory.length} analisi precedenti` : '- Nessuna storia precedente disponibile'}

${observations.length > 0 ? `\n👁️ OSSERVAZIONI AI VISIVA:\n${observations.map((o: string) => `- ${o}`).join('\n')}` : ''}

${recommendations.length > 0 ? `\n💡 RACCOMANDAZIONI INIZIALI:\n${recommendations.map((r: string) => `- ${r}`).join('\n')}` : ''}

${insights.length > 0 ? `\n🧠 INSIGHT PREVIOUS:\n${insights.slice(0, 3).map((i: string) => `- ${i}`).join('\n')}` : ''}

🎯 ISTRUZIONI PER GLI INSIGHT:
1. **Usa i valori specifici**: Riferisciti esplicitamente ai valori di valence (${currentValence.toFixed(2)}), arousal (${currentArousal.toFixed(2)}), e emozione (${currentEmotion}) nei tuoi insight.
2. **Basati sul trend**: Se il trend è "${trend}", crea insight che supportino o contrastino questo trend in modo appropriato.
3. **Personalizza**: Se valence è ${currentValence < -0.3 ? 'molto negativa' : currentValence < 0 ? 'leggermente negativa' : currentValence > 0.3 ? 'molto positiva' : 'neutra'}, suggerisci azioni specifiche per ${currentValence < 0 ? 'migliorare' : 'mantenere'} l'umore.
4. **Considera arousal**: Se arousal è ${currentArousal > 0.5 ? 'alto (stress/ansia)' : currentArousal < -0.5 ? 'basso (depressione/fatica)' : 'normale'}, adatta le raccomandazioni di conseguenza.
5. **Action-oriented**: Ogni insight deve essere una **azione concreta** che l'utente può fare OGGI, non teoria.
6. **Massimo 3 insight**: Scegli i 3 più rilevanti basati sui dati reali.

IMPORTANTE: Rispondi SOLO con un JSON valido nel seguente formato:

{
  "insights": [
    {
      "id": "emotion-insight-1",
      "title": "Passeggiata rilassante",
      "description": "La valence è calata per 3 giorni consecutivi. Prova a fare una camminata breve oggi per stimolare un umore più positivo.",
      "actionType": "routine",
      "estimatedTime": "15 min",
      "priority": "medium",
      "category": "emotion",
      "actionable": true,
      "detailedExplanation": "La camminata all'aperto stimola la produzione di endorfine e serotonina, migliorando naturalmente l'umore. L'esposizione alla luce naturale regola anche il ritmo circadiano.",
      "correlations": [
        "Valence in calo per 3 giorni consecutivi",
        "Arousal stabile ma leggermente alto",
        "Tendenza a emozioni neutre/negative"
      ],
      "expectedBenefits": [
        "Aumento della produzione di endorfine",
        "Miglioramento del ritmo circadiano",
        "Riduzione dello stress e ansia",
        "Incremento dell'energia fisica"
      ]
    }
  ],
  "trendSummary": "Trend emozionale: calo graduale della valence negli ultimi giorni.",
  "overallScore": 65,
  "focus": "Miglioramento dell'umore"
}

Rispondi SOLO con il JSON, senza testo aggiuntivo.`;
  }

  /**
   * Build skin analysis prompt
   */
  private buildSkinPrompt(skinData: any): string {
    // Estrai dati specifici dalla struttura dati
    const latestSession = skinData?.latestCapture || skinData?.latestSession || skinData?.latest_skin || skinData;
    const skinHistory = skinData?.skinHistory || skinData?.skin_history || [];
    const trend = skinData?.trend || skinData?.skinTrend || 'stable';

    // Valori attuali - supporta sia SkinCapture (con scores) che altre strutture
    const scores = latestSession?.scores || {};
    // SkinCapture usa scores.overall, non overallScore
    const overallScore = scores?.overall ?? scores?.overallScore ?? latestSession?.overallScore ?? latestSession?.overall_score ?? 70;
    const hydrationScore = scores?.hydration ?? latestSession?.hydrationScore ?? latestSession?.hydration_score ?? latestSession?.hydration ?? 50;
    const oilinessScore = scores?.oiliness ?? latestSession?.oilinessScore ?? latestSession?.oiliness_score ?? latestSession?.oiliness ?? 50;
    const textureScore = scores?.texture ?? latestSession?.textureScore ?? latestSession?.texture_score ?? latestSession?.texture ?? 50;
    const pigmentationScore = scores?.pigmentation ?? latestSession?.pigmentationScore ?? latestSession?.pigmentation_score ?? latestSession?.pigmentation ?? 50;
    const elasticityScore = scores?.elasticity ?? latestSession?.elasticityScore ?? latestSession?.elasticity_score ?? latestSession?.elasticity ?? 50;
    const currentDate = latestSession?.date || (latestSession?.timestamp ? new Date(latestSession.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

    // Analizza trend storico
    let hydrationTrend = 'stabile';
    let textureTrend = 'stabile';
    let overallTrend = 'stabile';
    
    if (skinHistory && skinHistory.length > 0) {
      const recentSessions = skinHistory.slice(-5);
      const scores = recentSessions.map((s: any) => {
        const sessionScores = s.scores || {};
        return {
          overall: sessionScores.overall ?? sessionScores.overallScore ?? s.overallScore ?? s.overall_score ?? 70,
          hydration: sessionScores.hydration ?? s.hydrationScore ?? s.hydration_score ?? s.hydration ?? 50,
          texture: sessionScores.texture ?? s.textureScore ?? s.texture_score ?? s.texture ?? 50,
        };
      });

      if (scores.length > 1) {
        const avgOverall = scores.reduce((sum: number, s: any) => sum + s.overall, 0) / scores.length;
        if (overallScore > avgOverall + 5) overallTrend = 'miglioramento';
        else if (overallScore < avgOverall - 5) overallTrend = 'peggioramento';

        const avgHydration = scores.reduce((sum: number, s: any) => sum + s.hydration, 0) / scores.length;
        if (hydrationScore > avgHydration + 5) hydrationTrend = 'miglioramento';
        else if (hydrationScore < avgHydration - 5) hydrationTrend = 'peggioramento';

        const avgTexture = scores.reduce((sum: number, s: any) => sum + s.texture, 0) / scores.length;
        if (textureScore > avgTexture + 5) textureTrend = 'miglioramento';
        else if (textureScore < avgTexture - 5) textureTrend = 'peggioramento';
      }
    }

    // Identifica aree critiche
    const criticalAreas: string[] = [];
    if (hydrationScore < 40) criticalAreas.push('idratazione molto bassa');
    if (textureScore < 40) criticalAreas.push('texture ruvida');
    if (oilinessScore > 70) criticalAreas.push('eccesso di sebo');
    if (oilinessScore < 30) criticalAreas.push('pelle molto secca');
    if (pigmentationScore > 60) criticalAreas.push('pigmentazione elevata');
    if (elasticityScore < 40) criticalAreas.push('elasticità ridotta');

    return `Sei un assistente wellness specializzato in skincare. 
Analizza i dati specifici dell'utente e fornisci insight pratici e personalizzati basati sui valori reali.

📊 STATO PELLE ATTUALE (${currentDate}):
- Punteggio complessivo: ${overallScore}/100
- Idratazione: ${hydrationScore}/100 ${hydrationScore < 40 ? '⚠️ CRITICO' : hydrationScore < 60 ? '⚠️ BASSO' : '✅'}
- Texture: ${textureScore}/100 ${textureScore < 40 ? '⚠️ CRITICO' : textureScore < 60 ? '⚠️ BASSO' : '✅'}
- Sebo/Oleosità: ${oilinessScore}/100 ${oilinessScore > 70 ? '⚠️ ECCESSO' : oilinessScore < 30 ? '⚠️ CARENZA' : '✅'}
- Pigmentazione: ${pigmentationScore}/100
- Elasticità: ${elasticityScore}/100 ${elasticityScore < 40 ? '⚠️ BASSO' : '✅'}

📈 TREND E PATTERN:
- Trend generale: ${trend === 'improving' ? 'miglioramento' : trend === 'declining' ? 'peggioramento' : 'stabile'}
- Trend idratazione: ${hydrationTrend}
- Trend texture: ${textureTrend}
- Trend complessivo: ${overallTrend}
${skinHistory.length > 0 ? `- Storia disponibile: ${skinHistory.length} analisi precedenti` : '- Nessuna storia precedente disponibile'}

${criticalAreas.length > 0 ? `\n⚠️ AREE CRITICHE IDENTIFICATE:\n${criticalAreas.map((a: string) => `- ${a}`).join('\n')}` : '\n✅ Nessuna area critica identificata - la pelle è in buone condizioni'}

🎯 ISTRUZIONI PER GLI INSIGHT:
1. **Usa i valori specifici**: Riferisciti esplicitamente ai punteggi reali (es. "idratazione ${hydrationScore}/100", "texture ${textureScore}/100") nei tuoi insight.
2. **Prioritizza aree critiche**: ${criticalAreas.length > 0 ? `Concentrati su: ${criticalAreas.join(', ')}` : 'Mantieni e migliora le aree già in buone condizioni'}.
3. **Basati sul trend**: Se il trend è "${trend}", crea insight che supportino o contrastino questo trend in modo appropriato.
4. **Action-oriented**: Ogni insight deve essere una **routine concreta** che l'utente può fare OGGI (es. "Applica crema idratante entro 30 min dalla doccia", "Aggiungi un siero con acido ialuronico alla routine serale").
5. **Specifico e pratico**: Non dire "idrata di più" ma "bevi 2 bicchieri d'acqua ora e applica crema idratante dopo la doccia".
6. **Massimo 3 insight**: Scegli i 3 più rilevanti basati sui dati reali e sulle aree critiche.

IMPORTANTE: Rispondi SOLO con un JSON valido nel seguente formato:

{
  "insights": [
    {
      "id": "skin-insight-1",
      "title": "Aumenta l'idratazione",
      "description": "La tua pelle è più secca del solito. Applica una crema idratante entro 30 minuti dalla doccia.",
      "actionType": "routine",
      "estimatedTime": "5 min",
      "priority": "high",
      "category": "skin",
      "actionable": true,
      "detailedExplanation": "L'idratazione cutanea è fondamentale per mantenere la barriera protettiva della pelle. Applicare la crema entro 30 minuti dalla doccia massimizza l'assorbimento quando la pelle è ancora leggermente umida.",
      "correlations": [
        "Idratazione in calo negli ultimi 3 giorni",
        "Texture leggermente ruvida",
        "Luminosità stabile ma migliorabile"
      ],
      "expectedBenefits": [
        "Miglioramento della texture cutanea",
        "Riduzione della secchezza",
        "Aumento della luminosità naturale",
        "Rafforzamento della barriera cutanea"
      ]
    }
  ],
  "trendSummary": "Idratazione in calo negli ultimi 3 giorni.",
  "overallScore": 70,
  "focus": "Idratazione e texture"
}

Rispondi SOLO con il JSON, senza testo aggiuntivo.`;
  }

  /**
   * Build food analysis prompt
   */
  buildFoodPrompt(foodData: any): string {
    const identifiedFoods = foodData?.identified_foods || foodData?.identifiedFoods || [];
    const macronutrients = foodData?.macronutrients || {};
    const healthScore = foodData?.health_score ?? foodData?.healthScore ?? 70;
    const recommendations = foodData?.recommendations || [];
    const observations = foodData?.observations || [];
    const calories = foodData?.calories || macronutrients?.calories || 0;
    const mealType = foodData?.mealType || foodData?.meal_type || 'meal';

    // Estrai valori macronutrienti
    const carbs = macronutrients?.carbohydrates || macronutrients?.carbs || 0;
    const proteins = macronutrients?.proteins || macronutrients?.protein || 0;
    const fats = macronutrients?.fats || macronutrients?.fat || 0;
    const fiber = macronutrients?.fiber || 0;
    const totalMacros = carbs + proteins + fats;

    // Calcola percentuali
    const carbsPct = totalMacros > 0 ? Math.round((carbs / totalMacros) * 100) : 0;
    const proteinPct = totalMacros > 0 ? Math.round((proteins / totalMacros) * 100) : 0;
    const fatsPct = totalMacros > 0 ? Math.round((fats / totalMacros) * 100) : 0;

    // Identifica squilibri
    const imbalances: string[] = [];
    if (carbsPct > 65) imbalances.push(`eccesso di carboidrati (${carbsPct}%, target 35-65%)`);
    if (carbsPct < 35) imbalances.push(`carenza di carboidrati (${carbsPct}%, target 35-65%)`);
    if (proteinPct > 35) imbalances.push(`eccesso di proteine (${proteinPct}%, target 15-35%)`);
    if (proteinPct < 15) imbalances.push(`carenza di proteine (${proteinPct}%, target 15-35%)`);
    if (fatsPct > 35) imbalances.push(`eccesso di grassi (${fatsPct}%, target 15-35%)`);
    if (fatsPct < 15) imbalances.push(`carenza di grassi (${fatsPct}%, target 15-35%)`);
    if (fiber < 5) imbalances.push(`basso contenuto di fibre (${fiber.toFixed(1)}g, target 5-10g per pasto)`);

    // Valuta il pasto
    let mealQuality = 'equilibrato';
    if (healthScore >= 80) mealQuality = 'eccellente';
    else if (healthScore >= 60) mealQuality = 'buono';
    else if (healthScore >= 40) mealQuality = 'discreto';
    else mealQuality = 'da migliorare';

    return `Sei un nutrizionista digitale specializzato in alimentazione equilibrata.
Analizza i dati specifici del pasto dell'utente e genera insight pratici e personalizzati basati sui valori reali.

📊 ANALISI PASTO (${mealType}):
- Alimenti identificati: ${identifiedFoods.length ? identifiedFoods.join(', ') : 'non specificati'}
- Calorie totali: ${calories > 0 ? `${calories} kcal` : 'non disponibili'}
- Punteggio salute: ${healthScore}/100 (${mealQuality})

🥗 MACRONUTRIENTI:
- Carboidrati: ${carbs.toFixed(1)}g (${carbsPct}%) ${carbsPct < 35 || carbsPct > 65 ? '⚠️' : '✅'}
- Proteine: ${proteins.toFixed(1)}g (${proteinPct}%) ${proteinPct < 15 || proteinPct > 35 ? '⚠️' : '✅'}
- Grassi: ${fats.toFixed(1)}g (${fatsPct}%) ${fatsPct < 15 || fatsPct > 35 ? '⚠️' : '✅'}
- Fibre: ${fiber.toFixed(1)}g ${fiber < 5 ? '⚠️ BASSO' : '✅'}

${imbalances.length > 0 ? `\n⚠️ SQUILIBRI IDENTIFICATI:\n${imbalances.map((i: string) => `- ${i}`).join('\n')}` : '\n✅ Nessuno squilibrio significativo - il pasto è ben bilanciato'}

${observations.length > 0 ? `\n👁️ OSSERVAZIONI AI:\n${observations.map((o: string) => `- ${o}`).join('\n')}` : ''}

${recommendations.length > 0 ? `\n💡 SUGGERIMENTI INIZIALI:\n${recommendations.map((r: string) => `- ${r}`).join('\n')}` : ''}

🎯 ISTRUZIONI PER GLI INSIGHT:
1. **Usa i valori specifici**: Riferisciti esplicitamente ai valori reali (es. "carboidrati ${carbsPct}%", "proteine ${proteins.toFixed(1)}g", "fibre ${fiber.toFixed(1)}g") nei tuoi insight.
2. **Prioritizza squilibri**: ${imbalances.length > 0 ? `Concentrati su: ${imbalances.slice(0, 2).join(', ')}` : 'Mantieni l'equilibrio attuale e suggerisci miglioramenti incrementali'}.
3. **Action-oriented**: Ogni insight deve essere una **modifica concreta** per il prossimo pasto (es. "Aggiungi 100g di petto di pollo al prossimo pasto per aumentare le proteine", "Sostituisci metà riso con verdure per bilanciare i carboidrati").
4. **Specifico e pratico**: Non dire "mangia più proteine" ma "aggiungi ${(30 - proteins).toFixed(0)}g di proteine magre (es. petto di pollo, tofu, legumi) al prossimo pasto".
5. **Considera il tipo di pasto**: Se è ${mealType}, adatta i consigli di conseguenza (colazione = energia, pranzo = bilanciato, cena = leggero).
6. **Massimo 3 insight**: Scegli i 3 più rilevanti basati sui dati reali e sugli squilibri identificati.

Rispondi in italiano nella lingua dell'utente e limita la lunghezza a poche frasi per insight.`;
  }

  /**
   * Parse AI analysis response
   */
  private parseAIAnalysis(analysisText: string, request: InsightAnalysisRequest): InsightAnalysisResponse {
    console.log('🤖 Parsing AI insight analysis:', analysisText);

    try {
      // Try to parse the entire response as JSON first
      let parsedData = null;
      try {
        parsedData = JSON.parse(analysisText);
        console.log('📋 Direct JSON parse successful:', parsedData);
      } catch {
        // Attempt to repair malformed JSON using jsonrepair
        try {
          const repaired = jsonrepair(analysisText);
          parsedData = JSON.parse(repaired);
          console.log('🛠️ Repaired malformed JSON successfully');
        } catch (repairError) {
          console.log('⚠️ jsonrepair failed, falling back to regex extraction:', repairError);
        }

        if (!parsedData) {
        // Try to extract JSON from the response with better regex
        const jsonMatch = analysisText.match(/\{[\s\S]*?\}(?=\s*$|\s*[^}])/);
        if (jsonMatch) {
          try {
            // Try to fix incomplete JSON by adding missing closing braces
            let jsonStr = jsonMatch[0];

            // Count opening and closing braces
            const openBraces = (jsonStr.match(/\{/g) || []).length;
            const closeBraces = (jsonStr.match(/\}/g) || []).length;

            // Add missing closing braces
            if (openBraces > closeBraces) {
              jsonStr += '}'.repeat(openBraces - closeBraces);
            }

            // Try to fix incomplete strings
            if (jsonStr.includes('"description": "') && !jsonStr.includes('",')) {
              // Find the last incomplete description and close it
              const lastDescMatch = jsonStr.match(/"description":\s*"([^"]*?)(?:"|$)/g);
              if (lastDescMatch) {
                const lastMatch = lastDescMatch[lastDescMatch.length - 1];
                const fixedMatch = lastMatch.replace(/([^"]*?)(?:"|$)/, '$1"');
                jsonStr = jsonStr.replace(lastMatch, fixedMatch);
              }
            }

            parsedData = JSON.parse(jsonStr);
            console.log('📋 Extracted and fixed JSON parse successful:', parsedData);
          } catch (fixError) {
            console.log('⚠️ Could not fix JSON, trying partial parsing:', fixError);
            // Try to extract individual insights even if the overall JSON is broken
            parsedData = this.extractPartialInsights(analysisText, request.category);
          }
        }
        }
      }

      if (parsedData && parsedData.insights && Array.isArray(parsedData.insights)) {
        console.log('🎯 Using AI-generated insights');

        return {
          insights: parsedData.insights.map((insight: any, index: number) => ({
            id: insight.id || `${request.category}-insight-${index}`,
            title: insight.title || 'Insight generico',
            description: insight.description || 'Descrizione non disponibile',
            actionType: insight.actionType || 'routine',
            estimatedTime: insight.estimatedTime || '5 min',
            priority: insight.priority || 'medium',
            category: request.category,
            actionable: true,
            detailedExplanation: insight.detailedExplanation || insight.description || 'Spiegazione dettagliata non disponibile',
            correlations: insight.correlations || [],
            expectedBenefits: insight.expectedBenefits || []
          })),
          trendSummary: parsedData.trendSummary || '',
          overallScore: parsedData.overallScore || 70,
          focus: parsedData.focus || 'Miglioramento generale'
        };
      }
    } catch (error) {
      console.log('⚠️ Could not parse AI JSON, using fallback:', error);
    }

    // Fallback to basic insights
    return this.getFallbackInsights(request.category);
  }

  /**
   * Extract partial insights from broken JSON
   */
  private extractPartialInsights(text: string, category: string): any {
    try {
      // Try to find individual insight objects
      const insightMatches = text.match(/\{[^}]*"title"[^}]*\}/g);
      if (insightMatches && insightMatches.length > 0) {
        const insights = insightMatches.map((match, index) => {
          try {
            return JSON.parse(match);
          } catch {
            // Create a basic insight from the text
            const titleMatch = match.match(/"title":\s*"([^"]*)"/);
            const descMatch = match.match(/"description":\s*"([^"]*)"/);
            return {
              id: `${category}-insight-${index}`,
              title: titleMatch ? titleMatch[1] : 'Insight generico',
              description: descMatch ? descMatch[1] : 'Descrizione non disponibile',
              actionType: 'routine',
              estimatedTime: '5 min',
              priority: 'medium'
            };
          }
        });

        return { insights };
      }
    } catch (error) {
      console.log('⚠️ Could not extract partial insights:', error);
    }

    return null;
  }

  /**
   * Get fallback insights when AI fails
   */
  private getFallbackInsights(category: 'emotion' | 'skin' | 'food'): InsightAnalysisResponse {
    if (category === 'emotion') {
      return {
        insights: [
          {
            id: 'emotion-fallback-1',
            title: 'Respirazione profonda',
            description: 'Pratica 5 minuti di respirazione profonda per migliorare il tuo stato emotivo.',
            actionType: 'routine',
            estimatedTime: '5 min',
            priority: 'medium',
            category: 'emotion',
            actionable: true,
            detailedExplanation: 'La respirazione profonda attiva il sistema nervoso parasimpatico, riducendo lo stress e migliorando l\'umore.',
            correlations: ['Stress elevato', 'Arousal alto'],
            expectedBenefits: ['Riduzione dello stress', 'Miglioramento dell\'umore', 'Rilassamento generale']
          }
        ],
        trendSummary: 'Stato emotivo stabile con margini di miglioramento.',
        overallScore: 65,
        focus: 'Gestione dello stress'
      };
    } else if (category === 'skin') {
      return {
        insights: [
          {
            id: 'skin-fallback-1',
            title: 'Idratazione quotidiana',
            description: 'Mantieni una routine di idratazione quotidiana per migliorare la salute della tua pelle.',
            actionType: 'routine',
            estimatedTime: '5 min',
            priority: 'high',
            category: 'skin',
            actionable: true,
            detailedExplanation: 'L\'idratazione regolare mantiene la barriera cutanea sana e previene la secchezza.',
            correlations: ['Idratazione variabile', 'Texture migliorabile'],
            expectedBenefits: ['Miglioramento della texture', 'Riduzione della secchezza', 'Pelle più luminosa']
          }
        ],
        trendSummary: 'Condizione cutanea stabile con potenziale di miglioramento.',
        overallScore: 70,
        focus: 'Idratazione e cura quotidiana'
      };
    } else {
      return {
        insights: [
          {
            id: 'food-fallback-1',
            title: 'Componi il piatto bilanciato',
            description: 'Riempi metà piatto con verdure, un quarto con proteine magre e un quarto con carboidrati integrali.',
            actionType: 'routine',
            estimatedTime: '10 min',
            priority: 'medium',
            category: 'food',
            actionable: true,
            expectedBenefits: ['Energia stabile', 'Maggiore sazietà'],
          },
          {
            id: 'food-fallback-2',
            title: 'Fibra ad ogni pasto',
            description: 'Aggiungi una fonte di fibre (legumi, frutta, semi) per supportare digestione e microbiota.',
            actionType: 'tracking',
            estimatedTime: '5 min',
            priority: 'low',
            category: 'food',
            actionable: true,
          },
          {
            id: 'food-fallback-3',
            title: 'Idratazione consapevole',
            description: 'Bevi un bicchiere d’acqua prima dei pasti per migliorare digestione e controllare la fame.',
            actionType: 'reminder',
            estimatedTime: '2 min',
            priority: 'low',
            category: 'food',
            actionable: true,
          },
        ],
        trendSummary: 'Suggerimenti base per mantenere il pasto equilibrato.',
        overallScore: 70,
        focus: 'Alimentazione consapevole'
      };
    }
  }

  /**
   * Cache management
   */
  private getCachedInsights(key: string): InsightAnalysisResponse | null {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    return null;
  }

  private setCachedInsights(key: string, insights: InsightAnalysisResponse): void {
    this.cache.set(key, insights);

    // Clean up old cache entries
    setTimeout(() => {
      this.cache.delete(key);
    }, this.CACHE_DURATION);
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Intelligent insights cache cleared');
  }
}

export default IntelligentInsightService;
