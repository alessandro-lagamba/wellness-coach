/**
 * Local Check-ins Service
 * 
 * Handles CRUD operations for daily check-ins (mood/sleep notes) stored locally in SQLite.
 */

import { getDatabase, generateId, nowISO, initDatabase } from './database';

export interface LocalCheckin {
    id: string;
    date: string; // YYYY-MM-DD format
    mood_value: number | null;
    mood_note: string | null;
    sleep_value: number | null;
    sleep_note: string | null;
    energy_level: string | null;
    focus_level: string | null;
    created_at: string;
    updated_at: string;
}

export interface CheckinInput {
    date: string;
    mood_value?: number;
    mood_note?: string;
    sleep_value?: number;
    sleep_note?: string;
    energy_level?: string;
    focus_level?: string;
}

class LocalCheckinsServiceClass {
    private initialized = false;

    private async ensureInit(): Promise<void> {
        if (!this.initialized) {
            await initDatabase();
            this.initialized = true;
        }
    }

    /**
     * Get check-in by date
     */
    async getByDate(date: string): Promise<LocalCheckin | null> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getFirstAsync<LocalCheckin>(
            'SELECT * FROM daily_checkins WHERE date = ?',
            [date]
        );
    }

    /**
     * Create or update a check-in (upsert)
     */
    async upsert(input: CheckinInput): Promise<LocalCheckin> {
        await this.ensureInit();
        const db = getDatabase();

        const existing = await this.getByDate(input.date);
        const now = nowISO();

        if (existing) {
            await db.runAsync(
                `UPDATE daily_checkins 
         SET mood_value = COALESCE(?, mood_value),
             mood_note = COALESCE(?, mood_note),
             sleep_value = COALESCE(?, sleep_value),
             sleep_note = COALESCE(?, sleep_note),
             energy_level = COALESCE(?, energy_level),
             focus_level = COALESCE(?, focus_level),
             updated_at = ?
         WHERE id = ?`,
                [
                    input.mood_value ?? null,
                    input.mood_note ?? null,
                    input.sleep_value ?? null,
                    input.sleep_note ?? null,
                    input.energy_level ?? null,
                    input.focus_level ?? null,
                    now,
                    existing.id
                ]
            );

            return (await this.getByDate(input.date))!;
        } else {
            const id = generateId();
            await db.runAsync(
                `INSERT INTO daily_checkins (id, date, mood_value, mood_note, sleep_value, sleep_note, energy_level, focus_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    input.date,
                    input.mood_value ?? null,
                    input.mood_note ?? null,
                    input.sleep_value ?? null,
                    input.sleep_note ?? null,
                    input.energy_level ?? null,
                    input.focus_level ?? null,
                    now,
                    now
                ]
            );

            return (await this.getByDate(input.date))!;
        }
    }

    /**
     * List check-ins by date range
     */
    async listByDateRange(startDate: string, endDate: string): Promise<LocalCheckin[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalCheckin>(
            'SELECT * FROM daily_checkins WHERE date >= ? AND date <= ? ORDER BY date DESC',
            [startDate, endDate]
        );
    }

    /**
     * Get all check-ins (for backup)
     */
    async getAll(): Promise<LocalCheckin[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalCheckin>(
            'SELECT * FROM daily_checkins ORDER BY date DESC'
        );
    }

    /**
     * Bulk insert check-ins (for restore)
     */
    async bulkInsert(checkins: LocalCheckin[]): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        for (const checkin of checkins) {
            await db.runAsync(
                `INSERT OR REPLACE INTO daily_checkins (id, date, mood_value, mood_note, sleep_value, sleep_note, energy_level, focus_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    checkin.id,
                    checkin.date,
                    checkin.mood_value,
                    checkin.mood_note,
                    checkin.sleep_value,
                    checkin.sleep_note,
                    checkin.energy_level,
                    checkin.focus_level,
                    checkin.created_at,
                    checkin.updated_at
                ]
            );
        }
    }

    /**
     * Clear all check-ins
     */
    async clearAll(): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        await db.runAsync('DELETE FROM daily_checkins');
    }
}

export const LocalCheckinsService = new LocalCheckinsServiceClass();
