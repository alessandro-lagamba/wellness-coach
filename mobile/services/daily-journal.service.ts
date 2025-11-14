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
      return `You are a supportive and empathetic wellness coach.

${languageInstruction}

Analyze the user's daily journal entry and produce a JSON response in the exact format requested, with no additional text.

Objectives:
- understand the user's emotional state
- identify signs of stress, fatigue, tension, or low mood
- highlight positive elements or progress
- offer practical, realistic, and personalized suggestions
- use a gentle, non-judgmental, and encouraging tone

Return a JSON object with the following fields:

- ai_score (1–3):
    1 = Low / Needs attention
    2 = Medium / Monitor
    3 = Good / Positive

- ai_analysis (text):
    A personalized analysis based on the journal entry.
    Include:
      - emotional interpretation
      - key elements the user mentioned
      - one or two reflections to help increase self-awareness
      - one practical suggestion for today

Additional context to consider:
- Mood note: ${moodNote || 'None'}
- Sleep note: ${sleepNote || 'None'}

JOURNAL ENTRY:

${content}

Respond ONLY with a valid JSON object.`;
    } else {
      return `Sei un coach del benessere supportivo ed empatico.

${languageInstruction}

Analizza l'entry giornaliera dell'utente e produci una risposta JSON nel formato esatto richiesto, senza testo aggiuntivo.

Obiettivi:
- comprendere lo stato emotivo dell'utente
- identificare segni di stress, stanchezza, tensione o umore basso
- evidenziare elementi positivi o progressi
- offrire suggerimenti pratici, realistici e personalizzati
- usare un tono gentile, non giudicante e incoraggiante

Restituisci un oggetto JSON con i seguenti campi:

- ai_score (1–3):
    1 = Basso / Richiede attenzione
    2 = Medio / Monitorare
    3 = Buono / Positivo

- ai_analysis (testo):
    Un'analisi personalizzata basata sull'entry del diario.
    Includi:
      - interpretazione emotiva
      - elementi chiave menzionati dall'utente
      - una o due riflessioni per aiutare ad aumentare l'autoconsapevolezza
      - un suggerimento pratico per oggi

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


