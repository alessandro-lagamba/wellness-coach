import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyJournalDBService } from './daily-journal-db.service';

const STORAGE_KEYS = {
  journal: (d: string) => `journal:entry:${d}`,
  prompt: (d: string) => `journal:prompt:${d}`,
};

export class DailyJournalService {
  static todayKey(date = new Date()) {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
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
    - Brief acknowledgment of their specific situation (1-2 sentences)
    - Interpretation of what might be causing their feelings/issues (1-2 sentences)
    - 2-3 SPECIFIC, CONCRETE solutions or actions they can take (this is the most important part - be detailed and practical)
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
3. Offrire 2-3 soluzioni o passi SPECIFICI e ACTIONABLE che possono intraprendere (questa è la parte più importante - sii dettagliato e pratico)
4. Includere almeno un'azione immediata che possono fare subito (sii molto specifico)

Restituisci un oggetto JSON con i seguenti campi:

- ai_score (1–3):
    1 = Basso / Richiede attenzione (emozioni negative, problemi, preoccupazioni)
    2 = Medio / Monitorare (sentimenti misti, problemi minori)
    3 = Buono / Positivo (emozioni positive, progressi, soddisfazione)

- ai_analysis (testo, 150-250 parole):
    Un'analisi personalizzata e actionable. Strutturala così:
    - Breve riconoscimento della loro situazione specifica (1-2 frasi)
    - Interpretazione di cosa potrebbe causare i loro sentimenti/problemi (1-2 frasi)
    - 2-3 soluzioni o azioni SPECIFICHE e CONCRETE che possono intraprendere (questa è la parte più importante - sii dettagliato e pratico)
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

  // Build daily AI prompt from mood/sleep notes (short, helpful)
  static buildAIPrompt(params: { moodNote?: string; sleepNote?: string }) {
    const parts: string[] = [];
    if (params.moodNote) parts.push(`Mood note: ${params.moodNote}`);
    if (params.sleepNote) parts.push(`Sleep note: ${params.sleepNote}`);
    if (parts.length === 0) return 'Scrivi due righe su come ti senti oggi e su cosa è successo.';
    return `Suggerimento per il diario di oggi basato sui tuoi appunti:\n${parts.join('\n')}\nRispondi con una domanda o spunto breve (<=150 caratteri).`;
  }
}


