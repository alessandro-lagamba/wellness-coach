/**
 * Daily Journal DB Service (Local Storage Adapter)
 * 
 * This is a drop-in replacement for the original Supabase-based DailyJournalDBService.
 * It provides the same interface but stores data locally in SQLite.
 * 
 * This eliminates all encryption/decryption overhead and HMAC verification errors.
 */

import { LocalJournalService, LocalJournalEntry } from './local-storage';

// Maintain the same interface as the original service
export interface DailyJournalEntry {
    id: string;
    user_id: string;
    entry_date: string;
    content: string;
    voice_url?: string | null;
    ai_prompt?: string | null;
    ai_score?: number | null;
    ai_analysis?: string | null;
    analyzed_at?: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Convert local entry to the expected interface format
 */
function toPublicEntry(local: LocalJournalEntry, userId: string): DailyJournalEntry {
    return {
        id: local.id,
        user_id: userId,
        entry_date: local.entry_date,
        content: local.content || '',
        voice_url: null, // Voice URLs not supported in local storage
        ai_prompt: local.ai_prompt,
        ai_score: local.ai_score,
        ai_analysis: local.ai_analysis,
        analyzed_at: local.ai_score ? local.updated_at : null,
        created_at: local.created_at,
        updated_at: local.updated_at,
    };
}

/**
 * Local Storage implementation of the Daily Journal DB Service
 * 
 * Note: userId is accepted for API compatibility but ignored since data is local
 */
export const DailyJournalDBService = {
    /**
     * Get a journal entry by date
     */
    async getEntryByDate(userId: string, isoDate: string): Promise<DailyJournalEntry | null> {
        const local = await LocalJournalService.getByDate(isoDate);
        if (!local) return null;
        return toPublicEntry(local, userId);
    },

    /**
     * Create or update a journal entry
     */
    async upsertEntry(params: {
        userId: string;
        isoDate: string;
        content: string;
        voiceUrl?: string;
        aiPrompt?: string;
        aiScore?: number;
        aiAnalysis?: string;
    }): Promise<DailyJournalEntry | null> {
        const local = await LocalJournalService.upsert({
            entry_date: params.isoDate,
            content: params.content,
            ai_prompt: params.aiPrompt,
            ai_score: params.aiScore,
            ai_analysis: params.aiAnalysis,
        });

        return toPublicEntry(local, params.userId);
    },

    /**
     * List recent journal entries
     */
    async listRecent(userId: string, limit: number = 10): Promise<DailyJournalEntry[]> {
        const entries = await LocalJournalService.listRecent(limit);
        return entries.map(e => toPublicEntry(e, userId));
    },

    /**
     * List journal entries by date range
     */
    async listByDateRange(userId: string, startIso: string, endIso: string): Promise<DailyJournalEntry[]> {
        const entries = await LocalJournalService.listByDateRange(startIso, endIso);
        return entries.map(e => toPublicEntry(e, userId));
    },

    /**
     * Delete a journal entry
     */
    async deleteEntry(userId: string, isoDate: string): Promise<void> {
        await LocalJournalService.deleteByDate(isoDate);
    },

    /**
     * Re-embed all entries (no-op in local storage version)
     * This was used for Supabase vector embeddings which are not needed locally
     */
    async reEmbedAllEntries(userId: string): Promise<{ success: number; failed: number }> {
        // No embedding needed for local storage
        const entries = await LocalJournalService.getAll();
        return { success: entries.length, failed: 0 };
    },

    /**
     * Generate embedding async (no-op in local storage version)
     */
    async generateEmbeddingAsync(entryId: string, content: string, aiAnalysis?: string): Promise<void> {
        // No embedding needed for local storage
    },
};
