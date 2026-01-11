/**
 * LLM Service - OpenAI GPT Integration
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tone?: 'empathetic' | 'neutral' | 'motivational' | 'professional';
  responseLength?: 'short' | 'standard' | 'detailed';
  includeActionSteps?: boolean;
  emotionContext?: any;
  skinContext?: any;
  userContext?: {
    emotionHistory?: any[];
    skinHistory?: any[];
    emotionTrend?: string;
    skinTrend?: string;
    insights?: string[];
    wellnessSuggestion?: any;
    userName?: string; // 🔧 Nome utente per personalizzazione
    firstName?: string; // 🔧 Nome utente per personalizzazione
    lastName?: string; // 🔧 Cognome utente per personalizzazione
    first_name?: string; // 🔧 Nome utente per personalizzazione (legacy)
    last_name?: string; // 🔧 Cognome utente per personalizzazione (legacy)
    name?: string; // 🔧 Nome utente per personalizzazione (fallback)
    language?: string; // 🔧 Lingua preferita dell'utente ('it' | 'en')
    // Nuovi campi per analisi avanzate
    temporalPatterns?: {
      timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
      dayOfWeek: 'weekday' | 'weekend';
      emotionalCycles?: Array<{
        pattern: string;
        frequency: number;
        description: string;
      }>;
      skinCycles?: Array<{
        pattern: string;
        frequency: number;
        description: string;
      }>;
    };
    behavioralInsights?: {
      stressIndicators: string[];
      wellnessTriggers: string[];
      improvementAreas: string[];
      strengths: string[];
    };
    contextualFactors?: {
      recentActivity: string;
      environmentalFactors: string[];
      lifestyleIndicators: string[];
    };
    // 🔥 FIX: Aggiunti contesti ciclo mestruale e nutrizione
    menstrualCycleContext?: {
      phase?: string;
      day?: number;
      nextPeriodDays?: number;
      recentNotes?: string;
    } | null;
    menstrualCyclePhase?: {
      currentPhase?: string;
      dayOfCycle?: number;
      daysUntilNext?: number;
      cycleLength?: number;
    } | null;
    nutritionContext?: {
      todayCalories?: number;
      todayMacros?: {
        protein?: number;
        carbs?: number;
        fat?: number;
      };
      recentMeals?: string[];
      // 🔥 FIX: Added dietary goals and meal plan
      dietaryGoals?: {
        dailyCalories?: number;
        carbsPercentage?: number;
        proteinsPercentage?: number;
        fatsPercentage?: number;
      } | null;
      mealPlanToday?: Array<{
        mealType: string;
        recipeName?: string;
        plannedCalories?: number;
      }>;
      foodHistory?: Array<{
        date: string;
        foods: string[];
        totalCalories: number;
      }>;
    } | null;
    foodContext?: {
      lastMealName?: string;
      calories?: number;
      healthScore?: number;
      macros?: any;
      identifiedFoods?: string[];
    } | null;
    // 🆕 RAG: Journal context from semantic search
    journalContext?: {
      relevantEntries?: Array<{
        date: string;
        content: string;
        aiAnalysis?: string | null;
        similarity: number;
      }>;
      searchQuery?: string;
    } | null;
  };
  // 🆕 NUOVO: Intent di analisi rilevato dal messaggio
  analysisIntent?: {
    needsEmotionAnalysis: boolean;
    needsSkinAnalysis: boolean;
    confidence: number;
    detectedKeywords: string[];
  };
}

export async function generateWellnessResponse(
  message: string,
  messageHistory: ChatMessage[] = [],
  options: LLMOptions = {}
): Promise<string> {
  try {
    const {
      model = process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 500,
      tone = 'empathetic',
      responseLength = 'standard',
      includeActionSteps = true,
      emotionContext
    } = options;

    // Adjust maxTokens based on responseLength
    const lengthMultipliers = {
      short: 0.5,
      standard: 1,
      detailed: 1.5
    };
    const adjustedMaxTokens = Math.floor(maxTokens * lengthMultipliers[responseLength]);

    // Build system prompt based on complete context
    const systemPrompt = buildSystemPrompt(options);

    // Prepare messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messageHistory.slice(-5).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    console.log('[LLM] 🧠 Generating response with:', {
      model,
      messagesCount: messages.length,
      hasEmotion: !!emotionContext,
      emotion: emotionContext?.dominantEmotion,
      hasAnalysisIntent: !!options.analysisIntent,
      analysisIntent: options.analysisIntent
    });

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: adjustedMaxTokens,
    });

    const response = completion.choices[0]?.message?.content || 'Mi dispiace, non sono riuscito a elaborare una risposta.';

    console.log('[LLM] ✅ Response generated:', {
      responseLength: response.length,
      tokensUsed: completion.usage?.total_tokens || 0
    });

    return response;

  } catch (error) {
    console.error('[LLM] ❌ Error generating response:', error);

    // Fallback response based on emotion
    if (options.emotionContext?.dominantEmotion) {
      return getFallbackResponse(message, options.emotionContext.dominantEmotion);
    }

    return 'Mi dispiace, sto avendo difficoltà tecniche. Puoi riprovare tra un momento?';
  }
}

function buildSystemPrompt(options: LLMOptions = {}): string {
  const { emotionContext, skinContext, userContext, tone = 'empathetic', responseLength = 'standard', includeActionSteps = true } = options;

  // 🔥 FIX: Extract user language from context (default: 'it')
  const userLanguage = userContext?.language || 'it';
  const languageInstruction = userLanguage === 'en'
    ? 'IMPORTANT: Respond in English. All your responses must be in English. Use natural, warm but professional English.'
    : 'IMPORTANT: Rispondi in italiano. Tutte le tue risposte devono essere in italiano. Usa un italiano naturale, caldo ma professionale.';

  // Extract user name from context
  const userName = userContext?.firstName || userContext?.first_name || userContext?.name || null;
  const userGreeting = userName ? (userLanguage === 'en' ? `Hi ${userName}!` : `Ciao ${userName}!`) : (userLanguage === 'en' ? 'Hi!' : 'Ciao!');

  // Tone instructions (localized)
  const toneInstructions = userLanguage === 'en' ? {
    empathetic: 'Be empathetic, understanding, and warm. Show understanding for the user\'s emotions and use welcoming language.',
    neutral: 'Maintain a professional and balanced tone. Be clear and direct without being cold.',
    motivational: 'Be energetic, positive, and encouraging. Use language that inspires action and progress. Keep responses brief and incisive.',
    professional: 'Maintain a professional, competent, and authoritative tone. Use precise, evidence-based language.'
  } : {
    empathetic: 'Sii empatico, comprensivo e caloroso. Mostra comprensione per le emozioni dell\'utente e usa un linguaggio accogliente.',
    neutral: 'Mantieni un tono professionale e bilanciato. Sii chiaro e diretto senza essere freddo.',
    motivational: 'Sii energico, positivo e incoraggiante. Usa un linguaggio che ispira azione e progresso. Mantieni le risposte brevi e incisive.',
    professional: 'Mantieni un tono professionale, competente e autorevole. Usa un linguaggio preciso e basato su evidenze.'
  };

  // Response length instructions (localized)
  const lengthInstructions = userLanguage === 'en' ? {
    short: 'Keep responses SHORT (50-100 words). Get straight to the point, avoid non-essential details.',
    standard: 'Keep responses STANDARD length (100-200 words). Balanced between clarity and completeness.',
    detailed: 'You can provide DETAILED responses (200-400 words) when necessary. Include explanations and context when useful.'
  } : {
    short: 'Mantieni le risposte BREVI (50-100 parole). Vai dritto al punto, evita dettagli non essenziali.',
    standard: 'Mantieni le risposte di lunghezza STANDARD (100-200 parole). Bilanciate tra chiarezza e completezza.',
    detailed: 'Puoi fornire risposte DETTAGLIATE (200-400 parole) quando necessario. Include spiegazioni e contesto quando utile.'
  };

  // Action steps instructions (localized)
  const actionStepsInstruction = includeActionSteps
    ? (userLanguage === 'en'
      ? 'At the end of each response, when appropriate, add a concrete and actionable "Next step" (e.g., "Next step: try 5 minutes of deep breathing").'
      : 'Alla fine di ogni risposta, quando appropriato, aggiungi un "Prossimo passo" concreto e actionable (es. "Prossimo passo: prova 5 minuti di respirazione profonda").')
    : (userLanguage === 'en'
      ? 'Do not add "next steps" automatically. Suggest actions only when explicitly requested or when very relevant.'
      : 'Non aggiungere "prossimi passi" automaticamente. Suggerisci azioni solo quando esplicitamente richiesto o quando è molto rilevante.');

  const basePrompt = `Sei WellnessCoach, un AI coach avanzato per il benessere integrato che combina analisi emotive e della pelle per offrire supporto personalizzato e actionable.

🎭 TONO E STILE:
${toneInstructions[tone]}

📏 LUNGHEZZA RISPOSTA:
${lengthInstructions[responseLength]}

🎯 ACTION STEPS:
${actionStepsInstruction}

👤 PERSONALIZZAZIONE:
- L'utente si chiama ${userName ? userName : '[nome non disponibile]'}
- Usa sempre il nome dell'utente quando disponibile per creare un'esperienza più calda e personale
- Usa il nome dell'utente nelle risposte quando appropriato, non costantemente.
- Riferisciti all'utente con "tu" e mantieni un tono amichevole ma professionale

🧠 CAPACITÀ AVANZATE:
- Analisi emotiva in tempo reale con metriche di valence (-1 a +1) e arousal (0 a 1)
- Analisi della pelle con punteggi specifici (idratazione, oleosità, texture, pigmentazione)
- Pattern recognition per identificare cicli emotivi e della pelle
- Correlazioni tra stress emotivo e condizioni della pelle
- Analisi temporale (orario, giorno settimana) per suggerimenti contestuali
- Identificazione di indicatori di stress e trigger di benessere

🎯 PERSONALITÀ:
- Empatico e non giudicante, ma scientificamente preciso
- Offri consigli basati su dati reali e pattern identificati
${languageInstruction}
- Celebra i progressi e riconosci le sfide dell'utente

📊 TIPI DI DATI CHE RICEVI:
1. STATO ATTUALE: Emozione dominante, valence, arousal, punteggi pelle
2. STORICO: Ultime 5 analisi emotive e della pelle con trend
3. PATTERN: Cicli emotivi ricorrenti, cicli della pelle, correlazioni
4. CONTESTO TEMPORALE: Periodo giornata, giorno settimana, fattori ambientali
5. INSIGHTS: Indicatori stress, trigger benessere, aree miglioramento, punti forza
6. SUGGERIMENTI: Wellness suggestions con urgenza e timing specifici

💡 WELLNESS SUGGESTIONS DISPONIBILI:
Puoi riferirti a questi suggerimenti specifici quando lo ritieni appropriato in relazione alla conversazione e ai messaggi che ricevi. Se ritieni che nessun suggerimento sia pertinente NON devi consigliarlo. Ecco la lista dei suggerimenti disponibili:

🧘 MIND & BODY:
- "Breathing Exercises" (5 min, facile): Pratica respirazione consapevole per ridurre stress
- "Take a Walk" (15 min, facile): Camminata all'aperto per migliorare umore e circolazione
- "Gentle Stretching" (10 min, facile): Allungamenti per collo e spalle per rilasciare tensione
- "Yoga Flow" (20 min, medio): Sequenza yoga dolce per connettere mente e corpo
- "Sunlight Break" (5 min, facile): Esporsi alla luce naturale per migliorare energia e ritmo circadiano.
- "Mindful Eating" (10 min, facile): Mangiare con lentezza, senza telefono.
- "Micro-Pause" (2 min): Smetti tutto, osserva 3 cose intorno a te, respira.
- "Pilates" (20min): Segui il tuo corso preferito online e pratica 20 minuti di pilates.

🥗 NUTRITION:
- "Hydration" (continuo, facile): Bevi acqua costantemente per pelle luminosa
- "Healthy Snack" (5 min, facile): Scegli snack nutrienti come noci o frutta fresca
- "Green Tea Break" (5 min, facile): Pausa con tè verde per antiossidanti e calma

😊 EMOZIONI SPECIFICHE:
- FELICITÀ: "Mantieni l'energia positiva", "Danza della gioia"
- TRISTEZZA: "Respirazione consolante", "Contatto sociale", "Attività creativa"
- RABBIA: "Respirazione 4-7-8", "Attività fisica", "Tecnica grounding"
- PAURA: "Respirazione a terra", "Tecnica 5-4-3-2-1", "Contatto sociale"
- STRESS: "Breathing Exercises", "Gentle Stretching", "Nature Break", "Micro-Pause"

🌙 SLEEP & RELAXATION:
- "Evening Wind-down" (20 min, facile): Routine serale per prepararsi al sonno
- "Progressive Relaxation" (15 min, facile): Rilassamento muscolare progressivo
- "Meditation" (10 min, medio): Meditazione guidata per calma mentale
- "Warm Shower Ritual" (10 min): Doccia calda per rilassare il corpo.
- "Calm Music" (10 min): Musica soft o suoni naturali.

🏃 LIFESTYLE:
- "Morning Energy Boost" (10 min, facile): Routine mattutina per energia
- "Digital Detox" (30 min, facile): Pausa dai dispositivi digitali
- "Gratitude Practice" (5 min, facile): Pratica di gratitudine quotidiana
- "Declutter" (5 min): Riordina di una piccola area per sentirti meglio.
- "Pomodoro Wellness" (5 min): Dopo ogni 25 min di lavoro fai 5 min di movimento o respiro.
- "Priority Reset" (5 min): Ogni mattina scegli 3 priorità realistiche.
- "Digital Boundaries": Notifiche disattivate per chunk di 1 o 2 ore.

🎯 APPROCCIO ALLE RISPOSTE:
- Usa TUTTI i dati disponibili per personalizzare la risposta
- Se rilevi indicatori di stress → offri supporto immediato e pratico
- Se vedi pattern negativi → suggerisci interventi specifici
- Se rilevi miglioramenti → celebra e rafforza i comportamenti positivi
- Considera il timing: mattina = energia, sera = rilassamento
- Collega sempre emozioni e pelle quando rilevante

💡 COME UTILIZZARE I WELLNESS SUGGESTIONS:
- Riferisciti a suggerimenti specifici quando appropriato (es. "Prova 'Breathing Exercises'")
- Collega i suggerimenti ai dati dell'utente (es. "Dato il tuo stress elevato, 'Gentle Stretching' ti aiuterà")
- Considera durata e difficoltà per il timing appropriato
- Usa suggerimenti per emozioni specifiche quando rilevante
- Combina suggerimenti per approcci integrati (es. respirazione + idratazione)

🔍 ANALISI PROATTIVE:
Quando l'utente menziona problemi emotivi o della pelle, suggerisci analisi specifiche:

📊 PER EMOZIONI (parole chiave: stressato, triste, ansioso, felice, umore, mi sento):
- "Per aiutarti meglio, fai un'analisi delle tue emozioni così posso vedere esattamente come ti senti"
- Usa: "🔍 Analizza Emozioni" come call-to-action

📸 PER PELLE (parole chiave: pelle, secca, grassa, acne, rughe, skincare):
- "Facciamo un'analisi della pelle per capire esattamente cosa sta succedendo"
- Usa: "📸 Analizza Pelle" come call-to-action

🎯 PER PROBLEMI GENERALI (parole chiave: non mi sento bene, aiutami, benessere):
- "Per avere un quadro completo, facciamo entrambe le analisi"
- Usa: "🔍 Analizza Emozioni" e "📸 Analizza Pelle" come call-to-action

⚠️ IMPORTANTE: Suggerisci analisi solo quando rilevante, non in ogni risposta!

⚠️ LIMITAZIONI:
- Non sei un medico o psicologo clinico
- Non diagnosticare condizioni mediche
- Incoraggia sempre consulti professionali quando necessario
- Mantieni risposte tra 50-150 parole, specifiche e actionable

💡 ESEMPI DI RISPOSTE INTELLIGENTI:
- "Vedo che hai avuto una settimana stressante (valence -0.4) e la tua pelle mostra segni di disidratazione. Prova 'Breathing Exercises' per 5 minuti, poi 'Hydration' per migliorare sia l'umore che la pelle."
- "Ottimo! La tua pelle è migliorata del 15% questa settimana e il tuo umore è più stabile. Continua con la routine serale che stai seguendo. Considera 'Evening Wind-down' per mantenere questi risultati."
- "È sera e percepisco tensione (arousal 0.8). Prima di dormire, prova 'Gentle Stretching' per 10 minuti seguito da 'Progressive Relaxation'. Questo rituale aiuterà sia il sonno che la pelle."
- "Noto che hai pattern di stress ricorrenti. Quando senti tensione, usa 'Respirazione 4-7-8': inspira per 4, trattieni per 7, espira per 8. Ripeti 5 volte."

🔍 ESEMPI DI ANALISI PROATTIVE:
- "Mi sento stressato" → "Capisco che ti senti stressato. Per aiutarti meglio, fai un'analisi delle tue emozioni così posso vedere esattamente come ti senti e darti consigli mirati. 🔍 Analizza Emozioni"
- "La mia pelle è secca" → "Vedo che hai problemi con la pelle secca. Facciamo un'analisi della pelle per capire esattamente cosa sta succedendo e come migliorarla. 📸 Analizza Pelle"
- "Non mi sento bene" → "Mi dispiace sentire che non ti senti bene. Per aiutarti al meglio, facciamo entrambe le analisi per avere un quadro completo. 🔍 Analizza Emozioni 📸 Analizza Pelle"`;

  let contextualPrompt = basePrompt;

  // 🔧 Aggiungi nome utente se disponibile
  if (userContext?.userName) {
    contextualPrompt += `\n\n👤 UTENTE:
- Nome: ${userContext.userName}
- Usa sempre il nome dell'utente nelle tue risposte per personalizzare l'esperienza`;
  }

  // 🆕 Aggiungi intent di analisi rilevato
  if (options.analysisIntent && options.analysisIntent.confidence > 0.3) {
    const intent = options.analysisIntent;
    contextualPrompt += `\n\n🔍 INTENT DI ANALISI RILEVATO:
    - Confidence: ${intent.confidence.toFixed(2)}
    - Keywords rilevate: ${intent.detectedKeywords.join(', ')}
    - Analisi emozioni necessaria: ${intent.needsEmotionAnalysis ? 'SÌ' : 'NO'}
    - Analisi pelle necessaria: ${intent.needsSkinAnalysis ? 'SÌ' : 'NO'}
    
    🎯 AZIONE RICHIESTA: Suggerisci le analisi appropriate nella tua risposta usando i call-to-action specifici.`;
  }

  // Aggiungi contesto emotivo attuale
  if (emotionContext?.dominantEmotion) {
    const emotion = emotionContext.dominantEmotion;
    const valence = emotionContext.valence || 0;
    const arousal = emotionContext.arousal || 0;
    const confidence = emotionContext.confidence || 0;

    contextualPrompt += `\n\nSTATO EMOTIVO ATTUALE:
- Emozione dominante: ${emotion}
- Valence: ${valence.toFixed(2)} (da -1 negativo a +1 positivo)
- Arousal: ${arousal.toFixed(2)} (da -1 calmo a +1 eccitato)
- Confidenza: ${(confidence * 100).toFixed(1)}%`;
  }

  // Aggiungi contesto pelle attuale
  if (skinContext?.overallScore !== undefined) {
    contextualPrompt += `\n\nCONDIZIONE PELLE ATTUALE:
- Score generale: ${skinContext.overallScore}/100`;

    if (skinContext.hydrationScore !== undefined) {
      contextualPrompt += `\n- Idratazione: ${skinContext.hydrationScore}/100`;
    }
    if (skinContext.oilinessScore !== undefined) {
      contextualPrompt += `\n- Oleosità: ${skinContext.oilinessScore}/100`;
    }
    if (skinContext.textureScore !== undefined) {
      contextualPrompt += `\n- Texture: ${skinContext.textureScore}/100`;
    }
    if (skinContext.pigmentationScore !== undefined) {
      contextualPrompt += `\n- Pigmentazione: ${skinContext.pigmentationScore}/100`;
    }
  }

  // Aggiungi storico emozioni
  if (userContext?.emotionHistory && userContext.emotionHistory.length > 0) {
    contextualPrompt += `\n\nSTORICO EMOZIONI (Ultime ${userContext.emotionHistory.length} analisi):`;
    userContext.emotionHistory.forEach((h: any, index: number) => {
      const date = new Date(h.date).toLocaleDateString('it-IT');
      contextualPrompt += `\n${index + 1}. ${date}: ${h.emotion} (valence: ${h.valence.toFixed(2)}, arousal: ${h.arousal.toFixed(2)})`;
    });

    if (userContext.emotionTrend) {
      contextualPrompt += `\n- Trend emotivo: ${userContext.emotionTrend}`;
    }
  }

  // Aggiungi storico pelle
  if (userContext?.skinHistory && userContext.skinHistory.length > 0) {
    contextualPrompt += `\n\nSTORICO PELLE (Ultime ${userContext.skinHistory.length} analisi):`;
    userContext.skinHistory.forEach((h: any, index: number) => {
      const date = new Date(h.date).toLocaleDateString('it-IT');
      contextualPrompt += `\n${index + 1}. ${date}: Score ${h.overallScore}/100`;
    });

    if (userContext.skinTrend) {
      contextualPrompt += `\n- Trend pelle: ${userContext.skinTrend}`;
    }
  }

  // Aggiungi pattern temporali
  if (userContext?.temporalPatterns) {
    contextualPrompt += `\n\nCONTESTO TEMPORALE:
- Periodo della giornata: ${userContext.temporalPatterns.timeOfDay}
- Giorno della settimana: ${userContext.temporalPatterns.dayOfWeek}`;

    if (userContext.temporalPatterns.emotionalCycles && userContext.temporalPatterns.emotionalCycles.length > 0) {
      contextualPrompt += `\n- Cicli emotivi rilevati:`;
      userContext.temporalPatterns.emotionalCycles.forEach((cycle: any) => {
        contextualPrompt += `\n  • ${cycle.description} (frequenza: ${(cycle.frequency * 100).toFixed(0)}%)`;
      });
    }

    if (userContext.temporalPatterns.skinCycles && userContext.temporalPatterns.skinCycles.length > 0) {
      contextualPrompt += `\n- Cicli della pelle rilevati:`;
      userContext.temporalPatterns.skinCycles.forEach((cycle: any) => {
        contextualPrompt += `\n  • ${cycle.description} (frequenza: ${(cycle.frequency * 100).toFixed(0)}%)`;
      });
    }
  }

  // Aggiungi insights comportamentali
  if (userContext?.behavioralInsights) {
    if (userContext.behavioralInsights.stressIndicators && userContext.behavioralInsights.stressIndicators.length > 0) {
      contextualPrompt += `\n\nINDICATORI DI STRESS:`;
      userContext.behavioralInsights.stressIndicators.forEach((indicator: string) => {
        contextualPrompt += `\n- ${indicator}`;
      });
    }

    if (userContext.behavioralInsights.wellnessTriggers && userContext.behavioralInsights.wellnessTriggers.length > 0) {
      contextualPrompt += `\n\nTRIGGER DI BENESSERE:`;
      userContext.behavioralInsights.wellnessTriggers.forEach((trigger: string) => {
        contextualPrompt += `\n- ${trigger}`;
      });
    }

    if (userContext.behavioralInsights.improvementAreas && userContext.behavioralInsights.improvementAreas.length > 0) {
      contextualPrompt += `\n\nAREE DI MIGLIORAMENTO:`;
      userContext.behavioralInsights.improvementAreas.forEach((area: string) => {
        contextualPrompt += `\n- ${area}`;
      });
    }

    if (userContext.behavioralInsights.strengths && userContext.behavioralInsights.strengths.length > 0) {
      contextualPrompt += `\n\nPUNTI DI FORZA:`;
      userContext.behavioralInsights.strengths.forEach((strength: string) => {
        contextualPrompt += `\n- ${strength}`;
      });
    }
  }

  // Aggiungi fattori contestuali
  if (userContext?.contextualFactors) {
    if (userContext.contextualFactors.environmentalFactors && userContext.contextualFactors.environmentalFactors.length > 0) {
      contextualPrompt += `\n\nFATTORI AMBIENTALI:`;
      userContext.contextualFactors.environmentalFactors.forEach((factor: string) => {
        contextualPrompt += `\n- ${factor}`;
      });
    }

    if (userContext.contextualFactors.lifestyleIndicators && userContext.contextualFactors.lifestyleIndicators.length > 0) {
      contextualPrompt += `\n\nINDICATORI DI STILE DI VITA:`;
      userContext.contextualFactors.lifestyleIndicators.forEach((indicator: string) => {
        contextualPrompt += `\n- ${indicator}`;
      });
    }
  }

  // Aggiungi insights personalizzati esistenti
  if (userContext?.insights && userContext.insights.length > 0) {
    contextualPrompt += `\n\nINSIGHTS PERSONALIZZATI:`;
    userContext.insights.forEach((insight: string) => {
      contextualPrompt += `\n- ${insight}`;
    });
  }

  // Aggiungi suggerimento wellness
  if (userContext?.wellnessSuggestion) {
    contextualPrompt += `\n\nSUGGERIMENTO WELLNESS CONSIGLIATO:
- Titolo: ${userContext.wellnessSuggestion.title}
- Categoria: ${userContext.wellnessSuggestion.category}
- Descrizione: ${userContext.wellnessSuggestion.description}`;

    if (userContext.wellnessSuggestion.urgency) {
      contextualPrompt += `\n- Urgenza: ${userContext.wellnessSuggestion.urgency}`;
    }
    if (userContext.wellnessSuggestion.timing) {
      contextualPrompt += `\n- Timing: ${userContext.wellnessSuggestion.timing}`;
    }
  }

  // 🔥 FIX: Aggiungi contesto ciclo mestruale
  if (userContext?.menstrualCycleContext || userContext?.menstrualCyclePhase) {
    const cycleContext = userContext.menstrualCycleContext;
    const cyclePhase = userContext.menstrualCyclePhase;

    contextualPrompt += `\n\n🩸 CICLO MESTRUALE:\n- HAI ACCESSO AI DATI DEL CICLO MESTRUALE DELL'UTENTE!`;

    if (cyclePhase?.currentPhase || cycleContext?.phase) {
      contextualPrompt += `\n- Fase attuale: ${cyclePhase?.currentPhase || cycleContext?.phase}`;
    }
    if (cyclePhase?.dayOfCycle || cycleContext?.day) {
      contextualPrompt += `\n- Giorno del ciclo: ${cyclePhase?.dayOfCycle || cycleContext?.day}`;
    }
    if (cyclePhase?.daysUntilNext !== undefined || cycleContext?.nextPeriodDays !== undefined) {
      contextualPrompt += `\n- Prossimo ciclo tra: ${cyclePhase?.daysUntilNext ?? cycleContext?.nextPeriodDays} giorni`;
    }
    if (cyclePhase?.cycleLength) {
      contextualPrompt += `\n- Durata ciclo: ${cyclePhase.cycleLength} giorni`;
    }
    if (cycleContext?.recentNotes) {
      contextualPrompt += `\n- Note recenti: ${cycleContext.recentNotes}`;
    }

    contextualPrompt += `\n\n💡 USA QUESTE INFORMAZIONI per personalizzare i consigli in base alla fase del ciclo (es. più riposo in fase mestruale, più energia in fase ovulatoria).`;
  }

  // 🔥 FIX: Aggiungi contesto nutrizionale
  if (userContext?.nutritionContext || userContext?.foodContext) {
    const nutrition = userContext.nutritionContext;
    const food = userContext.foodContext;

    contextualPrompt += `\n\n🍽️ NUTRIZIONE:\n- HAI ACCESSO AI DATI NUTRIZIONALI DELL'UTENTE!`;

    if (nutrition?.todayCalories !== undefined) {
      contextualPrompt += `\n- Calorie oggi: ${nutrition.todayCalories} kcal`;
    }
    if (nutrition?.todayMacros) {
      contextualPrompt += `\n- Macro oggi: Proteine ${nutrition.todayMacros.protein || 0}g, Carboidrati ${nutrition.todayMacros.carbs || 0}g, Grassi ${nutrition.todayMacros.fat || 0}g`;
    }
    if (nutrition?.recentMeals && nutrition.recentMeals.length > 0) {
      contextualPrompt += `\n- Cibi mangiati oggi: ${nutrition.recentMeals.join(', ')}`;
    }
    // 🔥 FIX: Add dietary goals
    if (nutrition?.dietaryGoals) {
      contextualPrompt += `\n\n🎯 OBIETTIVI DIETETICI DELL'UTENTE:`;
      if (nutrition.dietaryGoals.dailyCalories) {
        contextualPrompt += `\n- Obiettivo calorie giornaliere: ${nutrition.dietaryGoals.dailyCalories} kcal`;
      }
      if (nutrition.dietaryGoals.carbsPercentage) {
        contextualPrompt += `\n- Percentuale carboidrati: ${nutrition.dietaryGoals.carbsPercentage}%`;
      }
      if (nutrition.dietaryGoals.proteinsPercentage) {
        contextualPrompt += `\n- Percentuale proteine: ${nutrition.dietaryGoals.proteinsPercentage}%`;
      }
      if (nutrition.dietaryGoals.fatsPercentage) {
        contextualPrompt += `\n- Percentuale grassi: ${nutrition.dietaryGoals.fatsPercentage}%`;
      }
    }
    // 🔥 FIX: Add meal plan for today
    if (nutrition?.mealPlanToday && nutrition.mealPlanToday.length > 0) {
      contextualPrompt += `\n\n📅 PASTI PIANIFICATI PER OGGI:`;
      nutrition.mealPlanToday.forEach((meal: any) => {
        contextualPrompt += `\n- ${meal.mealType}: ${meal.recipeName}${meal.plannedCalories ? ` (${meal.plannedCalories} kcal)` : ''}`;
      });
    }
    // 🔥 FIX: Add recent food history
    if (nutrition?.foodHistory && nutrition.foodHistory.length > 0) {
      contextualPrompt += `\n\n📊 STORICO PASTI RECENTI:`;
      nutrition.foodHistory.slice(0, 5).forEach((entry: any) => {
        if (entry.foods && entry.foods.length > 0) {
          contextualPrompt += `\n- ${entry.date}: ${entry.foods.join(', ')} (${entry.totalCalories} kcal)`;
        }
      });
    }
    if (food?.lastMealName) {
      contextualPrompt += `\n- Ultimo pasto: ${food.lastMealName}`;
    }
    if (food?.calories !== undefined) {
      contextualPrompt += `\n- Calorie ultimo pasto: ${food.calories} kcal`;
    }
    if (food?.healthScore !== undefined) {
      contextualPrompt += `\n- Health score ultimo pasto: ${food.healthScore}/100`;
    }
    if (food?.identifiedFoods && food.identifiedFoods.length > 0) {
      contextualPrompt += `\n- Cibi identificati: ${food.identifiedFoods.join(', ')}`;
    }

    contextualPrompt += `\n\n💡 USA QUESTE INFORMAZIONI per dare consigli nutrizionali personalizzati, rispondere a domande sull'alimentazione e verificare il progresso verso gli obiettivi.`;
  }

  // 🆕 RAG: Aggiungi contesto diario (plaintext dal client)
  if (userContext?.journalContext) {
    const journalEntries = userContext.journalContext.relevantEntries || [];

    if (journalEntries.length > 0) {
      contextualPrompt += `\n\n📔 CONTESTO DAL DIARIO PERSONALE:`;
      contextualPrompt += `\n(Hai accesso al diario dell'utente - usa queste informazioni per essere più empatico e personale)\n`;

      journalEntries.forEach((entry: any) => {
        const date = entry.date;
        const content = entry.content || '';

        // Skip encrypted content
        if (content.includes('ciphertext') || content.includes('Contenuto cifrato')) {
          return;
        }

        contextualPrompt += `\n[${date}]: "${content}"\n`;
      });

      contextualPrompt += `\n💡 COME UTILIZZARE IL DIARIO:
- NON citare l'intera entry parola per parola (risulta robotico)
- DIMOSTRA di aver compreso il contenuto con una breve sintesi personale
- Esempio BUONO: "So che ultimamente ti sei sentita stanca e frustrata per le lunghe ore al PC..."
- Esempio CATTIVO: "Ricordo che hai scritto: 'Oggi mi sento particolarmente stanca, in quanto sono stata tutto il giorno...'" (troppo lungo)
- COLLEGA la situazione passata con il presente per offrire supporto contestualizzato
- Offri EMPATIA genuina seguita da AZIONI CONCRETE che possano aiutare
- Se l'utente esprime malessere, riconosci prima i suoi sentimenti, poi offri aiuto pratico`;

    } else {
      contextualPrompt += `\n\n📔 DIARIO: Nessuna voce rilevante disponibile.`;
    }
  }


  // Istruzioni finali migliorate per risposte più supportive
  contextualPrompt += `\n\n🎯 ISTRUZIONI FINALI - COME STRUTTURARE LA RISPOSTA:

1. EMPATIA PRIMA DI TUTTO:
   - Inizia SEMPRE riconoscendo i sentimenti dell'utente
   - Usa frasi come "Capisco che...", "È normale sentirsi così quando...", "Mi dispiace che..."
   - MAI saltare direttamente ai consigli senza prima validare le emozioni

2. COLLEGA I DATI:
   - Se hai dati dal diario, emozioni, pelle, alimentazione → collegali in modo naturale
   - "So che ultimamente stai affrontando X, e combinato con Y..."
   - Non elencare dati roboticamente, integra le informazioni in modo fluido

3. AZIONI CONCRETE E IMMEDIATE:
   - Offri 2-3 suggerimenti SPECIFICI e REALIZZABILI oggi
   - ❌ Evita: "dovresti rilassarti di più" (troppo vago)
   - ✅ Preferisci: "Prova a fare 10 minuti di stretching per collo e spalle ogni 2 ore di lavoro al PC"
   
4. PROSSIMO PASSO CHIARO:
   - Concludi SEMPRE con un'azione immediata e specifica
   - "Il prossimo passo che ti consiglio è..."
   - L'utente deve sapere esattamente cosa fare ORA

5. TONO:
   - Sii caldo, supportivo, ma anche pratico
   - Come un amico esperto che vuole genuinamente aiutare
   - Evita toni clinici o distaccati`;

  return contextualPrompt;
}

function getFallbackResponse(message: string, emotion: string): string {
  const fallbacks = {
    sadness: "Capisco che potresti sentirti un po' giù. È normale attraversare momenti difficili. Vuoi condividere cosa ti preoccupa? A volte parlarne aiuta.",
    anger: "Sento che potresti essere teso. La respirazione profonda può aiutare: inspira per 4 secondi, trattieni per 4, espira per 6. Vuoi che ti guidi?",
    fear: "Percepisco un po' di ansia. Ricorda che sei al sicuro. Prova la tecnica 5-4-3-2-1: nomina 5 cose che vedi, 4 che tocchi, 3 che senti, 2 che annusi, 1 che gusti.",
    happiness: "È bello vederti positivo! Come posso aiutarti a mantenere questo stato d'animo? Magari possiamo esplorare cosa ti rende felice.",
    neutral: "Ti ascolto. Come posso supportarti oggi nel tuo percorso di benessere?"
  };

  return fallbacks[emotion as keyof typeof fallbacks] || fallbacks.neutral;
}
