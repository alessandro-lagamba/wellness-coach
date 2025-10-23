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

  static async syncToRemote(userId: string, dayKey: string, content: string, aiPrompt?: string, aiSummary?: string, aiScore?: number, aiLabel?: string, aiAnalysis?: string) {
    return await DailyJournalDBService.upsertEntry({
      userId,
      isoDate: dayKey,
      content,
      aiPrompt,
      aiSummary,
      aiScore,
      aiLabel,
      aiAnalysis,
    });
  }

  static colorForScore(score?: number) {
    if (!score) return '#e2e8f0';
    if (score <= 1) return '#ef4444';
    if (score === 2) return '#f59e0b';
    if (score === 3) return '#facc15';
    if (score === 4) return '#10b981';
    return '#059669';
  }

  static buildAIJudgmentPrompt(content: string, moodNote?: string, sleepNote?: string) {
    return `Sei un coach del benessere. Analizza questa entry giornaliera e restituisci JSON con i campi: ai_score (1-5), ai_label (string), ai_summary (max 3 frasi), ai_analysis (testo completo).\nEntry:\n${content}\nNote mood:${moodNote||''}\nNote sleep:${sleepNote||''}`;
  }

  static async generateAIJudgment(userId: string, content: string, moodNote?: string, sleepNote?: string): Promise<{ ai_score: number; ai_label: string; ai_summary: string; ai_analysis: string } | null> {
    try {
      const { getBackendURL } = await import('../constants/env');
      const backendURL = await getBackendURL();
      
      const response = await fetch(`${backendURL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: this.buildAIJudgmentPrompt(content, moodNote, sleepNote),
          userId,
          context: 'journal_analysis',
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
          return {
            ai_score: Math.max(1, Math.min(5, parsed.ai_score || 3)),
            ai_label: parsed.ai_label || 'Neutrale',
            ai_summary: parsed.ai_summary || 'Analisi non disponibile',
            ai_analysis: parsed.ai_analysis || aiResponse,
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse AI JSON response:', parseError);
      }

      // Fallback: create a basic judgment from the response
      return {
        ai_score: 3,
        ai_label: 'Analizzato',
        ai_summary: aiResponse.slice(0, 200) + (aiResponse.length > 200 ? '...' : ''),
        ai_analysis: aiResponse,
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


