import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyJournalDBService } from './daily-journal-db-local.service';

const STORAGE_KEYS = {
  journal: (d: string) => `journal:entry:${d}`,
  prompt: (d: string) => `journal:prompt:${d}`,
};

type DailyPromptOptions = {
  userId?: string;
  language?: string;
  mood?: number | null;
  moodNote?: string | null;
  sleepHours?: number | null;
  sleepQuality?: number | null;
  sleepNote?: string | null;
  energy?: string | null;
  focus?: string | null;
  goals?: string[] | null;
  stressTrend?: string | null;
};

export class DailyJournalService {
  static todayKey(date = new Date()) {
    // ✅ FIX: Use local timezone for "today" to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static async getLocalEntry(dayKey: string) {
    const [content, prompt] = await AsyncStorage.multiGet([
      STORAGE_KEYS.journal(dayKey),
      STORAGE_KEYS.prompt(dayKey),
    ]);
    return {
      content: content?.[1] || '',
      aiPrompt: prompt?.[1] || '',
    };
  }

  static async saveLocalEntry(dayKey: string, content: string, aiPrompt?: string) {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.journal(dayKey), content],
      [STORAGE_KEYS.prompt(dayKey), aiPrompt || ''],
    ]);
  }

  static async syncToRemote(userId: string, dayKey: string, content: string, aiPrompt?: string, aiScore?: number, aiAnalysis?: string) {
    return await DailyJournalDBService.upsertEntry({
      userId,
      isoDate: dayKey,
      content,
      aiPrompt,
      aiScore,
      aiAnalysis,
    });
  }

  static colorForScore(score?: number) {
    if (!score) return '#e2e8f0';
    // Sistema semplificato: 1=rosso, 2=giallo, 3=verde
    if (score === 1) return '#ef4444'; // Rosso
    if (score === 2) return '#facc15'; // Giallo
    if (score === 3) return '#10b981'; // Verde
    // Fallback per valori legacy (4-5) - converti a verde
    if (score >= 4) return '#10b981'; // 4-5 -> verde
    // Fallback per valori < 1 - converti a rosso
    return '#ef4444'; // < 1 -> rosso
  }

  static async buildAIJudgmentPrompt(content: string, moodNote?: string, sleepNote?: string): Promise<string> {
    const { getUserLanguage, getLanguageInstruction } = await import('./language.service');
    const userLanguage = await getUserLanguage();
    const languageInstruction = getLanguageInstruction(userLanguage);

    if (userLanguage === 'en') {
      return `You are a supportive and empathetic wellness coach with expertise in providing actionable, concrete solutions.

${languageInstruction}

Analyze the user's daily journal entry and produce a JSON response in the exact format requested, with no additional text.

CRITICAL REQUIREMENTS:
- Your response MUST be practical, actionable, and solution-oriented
- Provide SPECIFIC, CONCRETE suggestions that the user can implement immediately
- Address the user's concerns directly with clear, helpful solutions
- Avoid generic or vague advice - be specific and detailed
- If the user mentions physical issues, provide specific remedies or actions
- If the user mentions emotional concerns, provide specific coping strategies
- Always end with at least one concrete, actionable step the user can take TODAY

Your analysis should:
1. Acknowledge what the user is experiencing (be specific, reference their exact words)
2. Provide a brief interpretation of why this might be happening
3. Offer 2-3 SPECIFIC, ACTIONABLE solutions or steps they can take
4. Include at least one immediate action they can do right now

Return a JSON object with the following fields:

- ai_score (1–3):
    1 = Low / Needs attention (negative emotions, problems, concerns)
    2 = Medium / Monitor (mixed feelings, minor issues)
    3 = Good / Positive (positive emotions, progress, satisfaction)

- ai_analysis (text, 150-250 words):
    A personalized, actionable analysis. Structure it as:
    - Brief acknowledgment of their specific situation (1 sentence max)
    - Interpretation of what might be causing their feelings/issues (1-2 sentences)
    - 2-3 SPECIFIC, CONCRETE solutions or actions they can take (this is the most important part - be detailed, and practical)
    - One immediate action they can do today (be very specific)

Additional context to consider:
- Mood note: ${moodNote || 'None'}
- Sleep note: ${sleepNote || 'None'}

JOURNAL ENTRY:

${content}

Respond ONLY with a valid JSON object.`;
    } else {
      return `Sei un coach del benessere supportivo ed empatico con competenze nel fornire soluzioni concrete e actionable.

${languageInstruction}

Analizza l'entry giornaliera dell'utente e produci una risposta JSON nel formato esatto richiesto, senza testo aggiuntivo.

REQUISITI CRITICI:
- La tua risposta DEVE essere pratica, actionable e orientata alle soluzioni
- Fornisci suggerimenti SPECIFICI e CONCRETI che l'utente possa implementare immediatamente
- Affronta direttamente le preoccupazioni dell'utente con soluzioni chiare e utili
- Evita consigli generici o vaghi - sii specifico e dettagliato
- Se l'utente menziona problemi fisici, fornisci rimedi o azioni specifiche
- Se l'utente menziona preoccupazioni emotive, fornisci strategie di coping specifiche
- Concludi sempre con almeno un passo concreto e actionable che l'utente possa fare OGGI

La tua analisi dovrebbe:
1. Riconoscere ciò che l'utente sta vivendo (sii specifico, cita le sue esatte parole)
2. Fornire una breve interpretazione del perché questo potrebbe accadere
3. Offrire 2-3 soluzioni o passi SPECIFICI e ACTIONABLE che possono intraprendere
4. Includere almeno un'azione immediata che possono fare subito

Restituisci un oggetto JSON con i seguenti campi:

- ai_score (1–3) - CRITERI PRECISI:
    1 = NEGATIVO (USA QUESTO SE PRESENTI): stanchezza, frustrazione, stress, ansia, problemi fisici, 
        disagio, tensione, preoccupazione, tristezza, rabbia, fatica, dolore, malessere
        ESEMPI SCORE 1: "mi sento stanca", "sono stressata", "mi fa male", "sono frustrata", 
        "non ce la faccio", "gambe pesanti", "collo teso", "sono esausta"
    
    2 = MISTO/NEUTRO: sentimenti ambivalenti, giornata normale senza problemi né entusiasmo,
        piccole difficoltà bilanciate da aspetti positivi
        ESEMPI SCORE 2: "giornata nella norma", "un po' stanca ma è andata bene", "niente di speciale"
    
    3 = POSITIVO (USA QUESTO SE PRESENTI): felicità, soddisfazione, energia, gratitudine,
        risultati positivi, progressi, benessere, relax, serenità
        ESEMPI SCORE 3: "giornata fantastica", "mi sento bene", "sono felice", "ho fatto progressi"

    ⚠️ IMPORTANTE: Se l'entry contiene QUALSIASI termine negativo (stanca, frustrata, stress, dolore, 
    tensione, pesante, male, esausta, etc.), assegna score 1. Non bilanciare con altri fattori.

- ai_analysis (testo, 150-250 parole):
    Un'analisi personalizzata e actionable. Strutturala così:
    - Breve riconoscimento della loro situazione specifica (1-2 frasi)
    - Interpretazione di cosa potrebbe causare i loro sentimenti/problemi (1-2 frasi)
    - 2-3 soluzioni o azioni SPECIFICHE e CONCRETE che possono intraprendere
    - Un'azione immediata che possono fare oggi (sii molto specifico)

Contesto aggiuntivo da considerare:
- Nota umore: ${moodNote || 'Nessuna'}
- Nota sonno: ${sleepNote || 'Nessuna'}

ENTRY DEL DIARIO:

${content}

Rispondi SOLO con un oggetto JSON valido.`;
    }
  }

  static async generateAIJudgment(userId: string, content: string, moodNote?: string, sleepNote?: string): Promise<{ ai_score: number; ai_analysis: string } | null> {
    try {
      const { getBackendURL } = await import('../constants/env');
      const { getUserLanguage } = await import('./language.service');
      const backendURL = await getBackendURL();
      const userLanguage = await getUserLanguage();

      const prompt = await this.buildAIJudgmentPrompt(content, moodNote, sleepNote);

      const response = await fetch(`${backendURL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: prompt,
          userId,
          context: 'journal_analysis',
          userContext: {
            language: userLanguage
          },
        }),
      });

      if (!response.ok) {
        console.error('AI Judgment failed:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      const aiResponse = data.response || data.message || '';

      // Try to parse JSON from the response
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Normalizza lo score a 1-3
          let normalizedScore = parsed.ai_score || 2;
          if (normalizedScore > 3) {
            normalizedScore = 3;
          } else if (normalizedScore < 1) {
            normalizedScore = 1;
          }

          return {
            ai_score: Math.max(1, Math.min(3, Math.round(normalizedScore))),
            ai_analysis: parsed.ai_analysis || (userLanguage === 'en' ? 'Analysis not available' : 'Analisi non disponibile'),
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse AI JSON response:', parseError);
      }

      // Fallback: create a basic judgment from the response (default: 2 = medio)
      return {
        ai_score: 2,
        ai_analysis: aiResponse || (userLanguage === 'en' ? 'Analysis not available' : 'Analisi non disponibile'),
      };
    } catch (error) {
      console.error('Error calling AI Judgment:', error);
      return null;
    }
  }

  static async generateDailyPrompt(options: DailyPromptOptions): Promise<string | null> {
    const { getUserLanguage } = await import('./language.service');
    const language = options.language || (await getUserLanguage());

    try {
      const { getBackendURL } = await import('../constants/env');
      const backendURL = await getBackendURL();
      const instruction = this.buildPromptInstruction(language, options);

      const response = await fetch(`${backendURL}/api/chat/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: instruction,
          userId: options.userId,
          context: 'journal_daily_prompt',
          userContext: {
            language,
            mood: options.mood,
            energy: options.energy,
            focus: options.focus,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiText = data.response || data.message || data.text || '';
        const cleaned = this.cleanPromptText(aiText);
        if (cleaned) {
          return cleaned;
        }
      } else {
        console.warn('Daily prompt generation failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.warn('Error generating daily journal prompt:', error);
    }

    return this.createFallbackPrompt(language, options);
  }

  private static cleanPromptText(text: string) {
    if (!text) return '';
    return text.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim();
  }

  private static buildPromptInstruction(language: string, context: DailyPromptOptions) {
    const baseInstruction =
      language === 'en'
        ? `You are an empathetic journaling coach. Based on the context below, craft ONE meaningful question (maximum 12 words) that helps the user reflect. Use plain language, no emoji, no numbering, no quotes, and return only the question text.`
        : `Sei un coach empatico del journaling. In base al contesto seguente, genera UNA domanda significativa (massimo 12 parole) che aiuti l'utente a riflettere. Usa un linguaggio semplice, senza emoji, numeri o virgolette, e restituisci solo il testo della domanda.`;

    const contextLines: string[] = [];
    if (context.mood) contextLines.push(`Mood score: ${context.mood}/5`);
    if (context.moodNote) contextLines.push(`Mood note: ${context.moodNote}`);
    if (context.sleepHours || context.sleepQuality) {
      const hours = context.sleepHours ? `${context.sleepHours}h` : 'unknown';
      const quality = context.sleepQuality ? `${context.sleepQuality}%` : 'unknown';
      contextLines.push(`Sleep: ${hours}, quality ${quality}`);
    }
    if (context.sleepNote) contextLines.push(`Sleep note: ${context.sleepNote}`);
    if (context.energy) contextLines.push(`Energy: ${context.energy}`);
    if (context.focus) contextLines.push(`Focus: ${context.focus}`);
    if (context.goals?.length) contextLines.push(`Goals: ${context.goals.join(', ')}`);
    if (context.stressTrend) contextLines.push(`Stress trend: ${context.stressTrend}`);

    if (contextLines.length === 0) {
      contextLines.push(
        language === 'en'
          ? 'No recent context provided.'
          : 'Nessun contesto recente disponibile.'
      );
    }

    return `${baseInstruction}\nContext:\n- ${contextLines.join('\n- ')}`;
  }

  private static createFallbackPrompt(language: string, context: DailyPromptOptions) {
    const dictionaries = {
      en: {
        lowMood: 'What felt toughest about today?',
        sleep: 'What disrupted your rest last night?',
        positive: 'What brightened your day today?',
        energy: 'What would help you recharge tonight?',
        focus: 'What step moves you toward {focus}?',
        default: 'What do you want to remember today?',
      },
      it: {
        lowMood: "Cos'ha pesato di più sulla tua giornata?",
        sleep: 'Cosa ha disturbato il tuo sonno ieri?',
        positive: 'Qual è stato il momento più bello di oggi?',
        energy: 'Cosa ti aiuterebbe a ricaricare energie stasera?',
        focus: 'Quale passo ti avvicina a {focus}?',
        default: 'Cosa vuoi ricordare di oggi?',
      },
    };

    const dict = language === 'en' ? dictionaries.en : dictionaries.it;
    const moodScore = context.mood ?? 3;

    if (moodScore <= 2 || this.hasNegativeTone(context.moodNote)) {
      return dict.lowMood;
    }
    if (
      (context.sleepQuality !== null && context.sleepQuality !== undefined && context.sleepQuality < 60) ||
      this.hasNegativeTone(context.sleepNote)
    ) {
      return dict.sleep;
    }
    if (moodScore >= 4) {
      return dict.positive;
    }
    if (context.energy && context.energy.toLowerCase() === 'low') {
      return dict.energy;
    }
    if (context.focus) {
      return dict.focus.replace('{focus}', context.focus);
    }

    return dict.default;
  }

  private static hasNegativeTone(note?: string | null) {
    if (!note) return false;
    const normalized = note.toLowerCase();
    const negativeKeywords = [
      'stress',
      'stanco',
      'ansia',
      'anxious',
      'tired',
      'exhausted',
      'triste',
      'sad',
      'preoccupat',
      'fatica',
      'worry',
    ];
    return negativeKeywords.some((keyword) => normalized.includes(keyword));
  }
}


