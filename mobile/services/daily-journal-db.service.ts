import { supabase } from '../lib/supabase';
import { encryptText, decryptText } from './encryption.service';
import { logReadEvent, logWriteEvent, logDecryptionEvent, logEncryptionEvent } from './audit-log.service';

export type DailyJournalEntry = {
  id: string;
  user_id: string;
  entry_date: string; // ISO date
  content: string;
  voice_url?: string | null;
  ai_prompt?: string | null;
  ai_score?: number | null;
  ai_analysis?: string | null;
  analyzed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export class DailyJournalDBService {
  static async getEntryByDate(userId: string, isoDate: string) {
    const { data, error } = await supabase
      .from('daily_journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_date', isoDate)
      .maybeSingle();
    if (error) throw error;
    
    if (!data) return null;
    
    // Decifra il contenuto se è cifrato
    const entry = data as DailyJournalEntry;
    if (entry.content) {
      const decrypted = await decryptText(entry.content, userId);
      if (decrypted !== null) {
        entry.content = decrypted;
        await logDecryptionEvent('journal', entry.id);
      }
      // Se decrypted è null, potrebbe essere testo vecchio non cifrato, lo lasciamo così
    }
    
    // Decifra anche ai_analysis se presente
    if (entry.ai_analysis) {
      const decrypted = await decryptText(entry.ai_analysis, userId);
      if (decrypted !== null) {
        entry.ai_analysis = decrypted;
        await logDecryptionEvent('journal', entry.id);
      }
    }
    
    // Log accesso in lettura
    await logReadEvent('journal', entry.id);
    
    return entry;
  }

  static async upsertEntry(params: {
    userId: string;
    isoDate: string;
    content: string;
    voiceUrl?: string;
    aiPrompt?: string;
    aiScore?: number;
    aiAnalysis?: string;
  }) {
    const { userId, isoDate, content, voiceUrl, aiPrompt, aiScore, aiAnalysis } = params;
    
    // Cifra il contenuto prima di salvarlo
    let encryptedContent: string | null = null;
    let encryptedAnalysis: string | null = null;
    
    try {
      encryptedContent = await encryptText(content, userId);
      if (encryptedContent) {
        await logEncryptionEvent('journal');
      }
      if (aiAnalysis) {
        encryptedAnalysis = await encryptText(aiAnalysis, userId);
        if (encryptedAnalysis) {
          await logEncryptionEvent('journal');
        }
      }
    } catch (encError) {
      console.warn('[JournalDB] ⚠️ Encryption failed, saving as plaintext (fallback):', encError);
      // Fallback: se la cifratura fallisce, salviamo in chiaro (per backward compatibility)
      // In produzione, potresti voler bloccare il salvataggio invece
    }
    
    // Usa il contenuto cifrato se disponibile, altrimenti fallback al plaintext
    const finalContent = encryptedContent || content;
    const finalAnalysis = encryptedAnalysis || aiAnalysis || null;
    
    const { data, error } = await supabase
      .from('daily_journal_entries')
      .upsert({
        user_id: userId,
        entry_date: isoDate,
        content: finalContent,
        voice_url: voiceUrl ?? null,
        ai_prompt: aiPrompt ?? null,
        ai_score: aiScore ?? null,
        ai_analysis: finalAnalysis,
      }, { onConflict: 'user_id,entry_date' })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    
    // Decifra il risultato prima di restituirlo
    const entry = data as DailyJournalEntry;
    if (entry.content) {
      const decrypted = await decryptText(entry.content, userId);
      if (decrypted !== null) {
        entry.content = decrypted;
        await logDecryptionEvent('journal', entry.id);
      }
    }
    if (entry.ai_analysis) {
      const decrypted = await decryptText(entry.ai_analysis, userId);
      if (decrypted !== null) {
        entry.ai_analysis = decrypted;
        await logDecryptionEvent('journal', entry.id);
      }
    }
    
    // Log scrittura
    await logWriteEvent('journal', entry.id);
    
    return entry;
  }

  static async listRecent(userId: string, limit = 10) {
    const { data, error } = await supabase
      .from('daily_journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    
    // Decifra tutti i contenuti
    const entries = (data || []) as DailyJournalEntry[];
    for (const entry of entries) {
      if (entry.content) {
        const decrypted = await decryptText(entry.content, userId);
        if (decrypted !== null) {
          entry.content = decrypted;
          await logDecryptionEvent('journal', entry.id);
        }
      }
      if (entry.ai_analysis) {
        const decrypted = await decryptText(entry.ai_analysis, userId);
        if (decrypted !== null) {
          entry.ai_analysis = decrypted;
          await logDecryptionEvent('journal', entry.id);
        }
      }
      // Log accesso in lettura per ogni entry
      await logReadEvent('journal', entry.id);
    }
    
    return entries;
  }

  static async listByDateRange(userId: string, startIso: string, endIso: string) {
    const { data, error } = await supabase
      .from('daily_journal_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('entry_date', startIso)
      .lte('entry_date', endIso)
      .order('entry_date', { ascending: true });
    if (error) throw error;
    
    // Decifra tutti i contenuti
    const entries = (data || []) as DailyJournalEntry[];
    for (const entry of entries) {
      if (entry.content) {
        const decrypted = await decryptText(entry.content, userId);
        if (decrypted !== null) {
          entry.content = decrypted;
          await logDecryptionEvent('journal', entry.id);
        }
      }
      if (entry.ai_analysis) {
        const decrypted = await decryptText(entry.ai_analysis, userId);
        if (decrypted !== null) {
          entry.ai_analysis = decrypted;
          await logDecryptionEvent('journal', entry.id);
        }
      }
      // Log accesso in lettura per ogni entry
      await logReadEvent('journal', entry.id);
    }
    
    return entries;
  }

  static async deleteEntry(userId: string, isoDate: string) {
    const { error } = await supabase
      .from('daily_journal_entries')
      .delete()
      .eq('user_id', userId)
      .eq('entry_date', isoDate);
    if (error) throw error;
  }
}


