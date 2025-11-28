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
    return `Sei un assistente wellness specializzato in benessere emotivo. 
Analizza i dati storici delle analisi emozionali e fornisci insight pratici per aiutare l'utente a mantenere o migliorare il proprio stato.

Dati recenti:
${JSON.stringify(emotionData)}

Osservazioni rilevate dall'AI visiva:
${emotionData.observations ? emotionData.observations.join('\n- ') : 'Nessuna osservazione specifica.'}

Raccomandazioni iniziali:
${emotionData.recommendations ? emotionData.recommendations.join('\n- ') : 'Nessuna raccomandazione iniziale.'}

Istruzioni:
1. Analizza trend di valence, arousal e categorie emotive (positive, neutre, negative).
2. Usa le osservazioni visive per contestualizzare i consigli.
3. Espandi le raccomandazioni iniziali in insight pratici e dettagliati.
4. Fornisci massimo 3 insight pratici, brevi e personalizzati.
5. Suggerisci routine giornaliere per migliorare umore o gestire eventuali cali (es. attività fisica leggera, respirazione, journaling).
6. Rispondi solo con raccomandazioni pratiche, non spiegazioni scientifiche.

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
    return `Sei un assistente wellness specializzato in skincare. 
Analizza i dati storici dell'utente relativi alla pelle e fornisci insight pratici e personalizzati.

Dati recenti:
${JSON.stringify(skinData)}

Istruzioni:
1. Analizza trend (miglioramento, peggioramento, stabilità) per ciascun parametro rilevante: idratazione, texture, luminosità, elasticità, secchezza.
2. Fornisci massimo 3 insight pratici e personalizzati per migliorare la condizione della pelle.
3. Se possibile, collega l'insight a routine giornaliere semplici (es. idratazione, alimentazione, abitudini).
4. Non dare spiegazioni teoriche: le risposte devono essere **brevi, chiare e action-oriented**.

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

    return `Sei un nutrizionista digitale specializzato in alimentazione equilibrata.
Analizza gli ultimi dati nutrizionali del pasto e genera insight pratici per aiutare l'utente a migliorare la qualità della propria alimentazione quotidiana.

Dati disponibili:
- Alimenti identificati: ${identifiedFoods.length ? identifiedFoods.join(', ') : 'non specificati'}
- Macronutrienti stimati: ${JSON.stringify(macronutrients)}
- Punteggio salute pasto: ${healthScore}
- Osservazioni AI: ${observations.length ? observations.join('; ') : 'nessuna osservazione specifica'}
- Suggerimenti AI iniziali: ${recommendations.length ? recommendations.join('; ') : 'nessun suggerimento iniziale'}

Istruzioni:
1. Analizza equilibrio tra carboidrati, proteine e grassi rispetto ai range consigliati (Carb 35-65%, Prot 15-35%, Grassi 15-35%).
2. Evidenzia eventuali eccessi o carenze nutrizionali e suggerisci modifiche concrete per il prossimo pasto.
3. Includi consigli su porzioni, abbinamenti alimentari o timing (es. integrare fibre, aumentare proteine magre, idratazione).
4. Mantieni un tono positivo e orientato all'azione, con massimo tre insight numerati.

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
