import { supabase } from '../lib/supabase';

export type DailyJournalEntry = {
  id: string;
  user_id: string;
  entry_date: string; // ISO date
  content: string;
  voice_url?: string | null;
  ai_prompt?: string | null;
  ai_summary?: string | null;
  created_at: string;
  updated_at: string;
};

export class DailyJournalDBService {
  static async getEntryByDate(userId: string, isoDate: string) {
    const { data, error } = await supabase
      .from<DailyJournalEntry>('daily_journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_date', isoDate)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  static async upsertEntry(params: {
    userId: string;
    isoDate: string;
    content: string;
    voiceUrl?: string;
    aiPrompt?: string;
    aiSummary?: string;
    aiScore?: number;
    aiLabel?: string;
    aiAnalysis?: string;
  }) {
    const { userId, isoDate, content, voiceUrl, aiPrompt, aiSummary, aiScore, aiLabel, aiAnalysis } = params;
    const { data, error } = await supabase
      .from('daily_journal_entries')
      .upsert({
        user_id: userId,
        entry_date: isoDate,
        content,
        voice_url: voiceUrl ?? null,
        ai_prompt: aiPrompt ?? null,
        ai_summary: aiSummary ?? null,
        ai_score: aiScore ?? null,
        ai_label: aiLabel ?? null,
        ai_analysis: aiAnalysis ?? null,
      }, { onConflict: 'user_id,entry_date' })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as DailyJournalEntry;
  }

  static async listRecent(userId: string, limit = 10) {
    const { data, error } = await supabase
      .from<DailyJournalEntry>('daily_journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async listByDateRange(userId: string, startIso: string, endIso: string) {
    const { data, error } = await supabase
      .from<DailyJournalEntry>('daily_journal_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('entry_date', startIso)
      .lte('entry_date', endIso)
      .order('entry_date', { ascending: true });
    if (error) throw error;
    return data || [];
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


