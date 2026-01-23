/**
 * Local Journal Service
 * 
 * Handles CRUD operations for journal entries stored locally in SQLite.
 * Replaces the encrypted Supabase-based DailyJournalDBService.
 */

import { getDatabase, generateId, nowISO, initDatabase } from './database';

export interface LocalJournalEntry {
    id: string;
    entry_date: string; // YYYY-MM-DD format
    content: string | null;
    ai_prompt: string | null;
    ai_score: number | null;
    ai_analysis: string | null;
    created_at: string;
    updated_at: string;
}

export interface JournalEntryInput {
    entry_date: string;
    content?: string;
    ai_prompt?: string;
    ai_score?: number;
    ai_analysis?: string;
}

class LocalJournalServiceClass {
    private initialized = false;

    private async ensureInit(): Promise<void> {
        if (!this.initialized) {
            await initDatabase();
            this.initialized = true;
        }
    }

    /**
     * Get a journal entry by date
     */
    async getByDate(date: string): Promise<LocalJournalEntry | null> {
        await this.ensureInit();
        const db = getDatabase();

        const result = await db.getFirstAsync<LocalJournalEntry>(
            'SELECT * FROM journal_entries WHERE entry_date = ?',
            [date]
        );

        return result || null;
    }

    /**
     * Get journal entry by ID
     */
    async getById(id: string): Promise<LocalJournalEntry | null> {
        await this.ensureInit();
        const db = getDatabase();

        const result = await db.getFirstAsync<LocalJournalEntry>(
            'SELECT * FROM journal_entries WHERE id = ?',
            [id]
        );

        return result || null;
    }

    /**
     * Create or update a journal entry (upsert)
     */
    async upsert(input: JournalEntryInput): Promise<LocalJournalEntry> {
        await this.ensureInit();
        const db = getDatabase();

        const existing = await this.getByDate(input.entry_date);
        const now = nowISO();

        if (existing) {
            // Update existing entry
            await db.runAsync(
                `UPDATE journal_entries 
         SET content = COALESCE(?, content),
             ai_prompt = COALESCE(?, ai_prompt),
             ai_score = COALESCE(?, ai_score),
             ai_analysis = COALESCE(?, ai_analysis),
             updated_at = ?
         WHERE id = ?`,
                [
                    input.content ?? null,
                    input.ai_prompt ?? null,
                    input.ai_score ?? null,
                    input.ai_analysis ?? null,
                    now,
                    existing.id
                ]
            );

            return (await this.getById(existing.id))!;
        } else {
            // Create new entry
            const id = generateId();
            await db.runAsync(
                `INSERT INTO journal_entries (id, entry_date, content, ai_prompt, ai_score, ai_analysis, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    input.entry_date,
                    input.content ?? null,
                    input.ai_prompt ?? null,
                    input.ai_score ?? null,
                    input.ai_analysis ?? null,
                    now,
                    now
                ]
            );

            return (await this.getById(id))!;
        }
    }

    /**
     * List entries by date range
     */
    async listByDateRange(startDate: string, endDate: string): Promise<LocalJournalEntry[]> {
        await this.ensureInit();
        const db = getDatabase();

        const results = await db.getAllAsync<LocalJournalEntry>(
            'SELECT * FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date DESC',
            [startDate, endDate]
        );

        return results;
    }

    /**
     * List recent entries
     */
    async listRecent(limit: number = 30): Promise<LocalJournalEntry[]> {
        await this.ensureInit();
        const db = getDatabase();

        const results = await db.getAllAsync<LocalJournalEntry>(
            'SELECT * FROM journal_entries ORDER BY entry_date DESC LIMIT ?',
            [limit]
        );

        return results;
    }

    /**
     * Delete an entry by date
     */
    async deleteByDate(date: string): Promise<boolean> {
        await this.ensureInit();
        const db = getDatabase();

        const result = await db.runAsync(
            'DELETE FROM journal_entries WHERE entry_date = ?',
            [date]
        );

        return result.changes > 0;
    }

    /**
     * Get all entries (for backup)
     */
    async getAll(): Promise<LocalJournalEntry[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalJournalEntry>(
            'SELECT * FROM journal_entries ORDER BY entry_date DESC'
        );
    }

    /**
     * Bulk insert entries (for restore)
     */
    async bulkInsert(entries: LocalJournalEntry[]): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        for (const entry of entries) {
            await db.runAsync(
                `INSERT OR REPLACE INTO journal_entries (id, entry_date, content, ai_prompt, ai_score, ai_analysis, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    entry.id,
                    entry.entry_date,
                    entry.content,
                    entry.ai_prompt,
                    entry.ai_score,
                    entry.ai_analysis,
                    entry.created_at,
                    entry.updated_at
                ]
            );
        }
    }

    /**
     * Clear all entries (for reset)
     */
    async clearAll(): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        await db.runAsync('DELETE FROM journal_entries');
    }
}

export const LocalJournalService = new LocalJournalServiceClass();
