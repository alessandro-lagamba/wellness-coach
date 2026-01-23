/**
 * Local Analyses Service
 * 
 * Handles CRUD operations for emotion and skin analyses stored locally in SQLite.
 */

import { getDatabase, generateId, nowISO, initDatabase } from './database';

// ============ EMOTION ANALYSIS TYPES ============

export interface LocalEmotionAnalysis {
    id: string;
    date: string;
    dominant_emotion: string | null;
    valence: number | null;
    arousal: number | null;
    emotions_json: string | null; // JSON string of emotion scores
    ai_observations: string | null;
    image_uri: string | null;
    created_at: string;
}

export interface EmotionAnalysisInput {
    date: string;
    dominant_emotion?: string;
    valence?: number;
    arousal?: number;
    emotions?: Record<string, number>;
    ai_observations?: string;
    image_uri?: string;
}

// ============ SKIN ANALYSIS TYPES ============

export interface LocalSkinAnalysis {
    id: string;
    date: string;
    overall_score: number | null;
    texture_score: number | null;
    oiliness_score: number | null;
    hydration_score: number | null;
    redness_score: number | null;
    pigmentation_score: number | null;
    ai_analysis: string | null;
    image_uri: string | null;
    created_at: string;
}

export interface SkinAnalysisInput {
    date: string;
    overall_score?: number;
    texture_score?: number;
    oiliness_score?: number;
    hydration_score?: number;
    redness_score?: number;
    pigmentation_score?: number;
    ai_analysis?: string;
    image_uri?: string;
}

// ============ MENSTRUAL CYCLE TYPES ============

export interface LocalMenstrualNote {
    id: string;
    date: string;
    note: string | null;
    symptoms_json: string | null;
    created_at: string;
}

export interface MenstrualNoteInput {
    date: string;
    note?: string;
    symptoms?: string[];
}

class LocalAnalysesServiceClass {
    private initialized = false;

    private async ensureInit(): Promise<void> {
        if (!this.initialized) {
            await initDatabase();
            this.initialized = true;
        }
    }

    // ============ EMOTION ANALYSIS METHODS ============

    /**
     * Save an emotion analysis
     */
    async saveEmotionAnalysis(input: EmotionAnalysisInput): Promise<LocalEmotionAnalysis> {
        await this.ensureInit();
        const db = getDatabase();

        const id = generateId();
        const now = nowISO();
        const emotionsJson = input.emotions ? JSON.stringify(input.emotions) : null;

        await db.runAsync(
            `INSERT INTO emotion_analyses (id, date, dominant_emotion, valence, arousal, emotions_json, ai_observations, image_uri, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                input.date,
                input.dominant_emotion ?? null,
                input.valence ?? null,
                input.arousal ?? null,
                emotionsJson,
                input.ai_observations ?? null,
                input.image_uri ?? null,
                now
            ]
        );

        return (await db.getFirstAsync<LocalEmotionAnalysis>(
            'SELECT * FROM emotion_analyses WHERE id = ?',
            [id]
        ))!;
    }

    /**
     * Get emotion analyses by date
     */
    async getEmotionAnalysesByDate(date: string): Promise<LocalEmotionAnalysis[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalEmotionAnalysis>(
            'SELECT * FROM emotion_analyses WHERE date = ? ORDER BY created_at DESC',
            [date]
        );
    }

    /**
     * Get latest emotion analysis
     */
    async getLatestEmotionAnalysis(): Promise<LocalEmotionAnalysis | null> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getFirstAsync<LocalEmotionAnalysis>(
            'SELECT * FROM emotion_analyses ORDER BY created_at DESC LIMIT 1'
        );
    }

    /**
     * Get emotion analyses by date range
     */
    async getEmotionAnalysesByDateRange(startDate: string, endDate: string): Promise<LocalEmotionAnalysis[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalEmotionAnalysis>(
            'SELECT * FROM emotion_analyses WHERE date >= ? AND date <= ? ORDER BY date DESC',
            [startDate, endDate]
        );
    }

    // ============ SKIN ANALYSIS METHODS ============

    /**
     * Save a skin analysis
     */
    async saveSkinAnalysis(input: SkinAnalysisInput): Promise<LocalSkinAnalysis> {
        await this.ensureInit();
        const db = getDatabase();

        const id = generateId();
        const now = nowISO();

        await db.runAsync(
            `INSERT INTO skin_analyses (id, date, overall_score, texture_score, oiliness_score, hydration_score, redness_score, pigmentation_score, ai_analysis, image_uri, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                input.date,
                input.overall_score ?? null,
                input.texture_score ?? null,
                input.oiliness_score ?? null,
                input.hydration_score ?? null,
                input.redness_score ?? null,
                input.pigmentation_score ?? null,
                input.ai_analysis ?? null,
                input.image_uri ?? null,
                now
            ]
        );

        return (await db.getFirstAsync<LocalSkinAnalysis>(
            'SELECT * FROM skin_analyses WHERE id = ?',
            [id]
        ))!;
    }

    /**
     * Get skin analyses by date
     */
    async getSkinAnalysesByDate(date: string): Promise<LocalSkinAnalysis[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalSkinAnalysis>(
            'SELECT * FROM skin_analyses WHERE date = ? ORDER BY created_at DESC',
            [date]
        );
    }

    /**
     * Get latest skin analysis
     */
    async getLatestSkinAnalysis(): Promise<LocalSkinAnalysis | null> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getFirstAsync<LocalSkinAnalysis>(
            'SELECT * FROM skin_analyses ORDER BY created_at DESC LIMIT 1'
        );
    }

    // ============ MENSTRUAL CYCLE METHODS ============

    /**
     * Save a menstrual note
     */
    async saveMenstrualNote(input: MenstrualNoteInput): Promise<LocalMenstrualNote> {
        await this.ensureInit();
        const db = getDatabase();

        const existing = await db.getFirstAsync<LocalMenstrualNote>(
            'SELECT * FROM menstrual_cycle_notes WHERE date = ?',
            [input.date]
        );

        const now = nowISO();
        const symptomsJson = input.symptoms ? JSON.stringify(input.symptoms) : null;

        if (existing) {
            await db.runAsync(
                `UPDATE menstrual_cycle_notes 
         SET note = COALESCE(?, note),
             symptoms_json = COALESCE(?, symptoms_json)
         WHERE id = ?`,
                [input.note ?? null, symptomsJson, existing.id]
            );
            return (await db.getFirstAsync<LocalMenstrualNote>(
                'SELECT * FROM menstrual_cycle_notes WHERE id = ?',
                [existing.id]
            ))!;
        } else {
            const id = generateId();
            await db.runAsync(
                `INSERT INTO menstrual_cycle_notes (id, date, note, symptoms_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
                [id, input.date, input.note ?? null, symptomsJson, now]
            );
            return (await db.getFirstAsync<LocalMenstrualNote>(
                'SELECT * FROM menstrual_cycle_notes WHERE id = ?',
                [id]
            ))!;
        }
    }

    /**
     * Get menstrual notes by date range
     */
    async getMenstrualNotesByDateRange(startDate: string, endDate: string): Promise<LocalMenstrualNote[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalMenstrualNote>(
            'SELECT * FROM menstrual_cycle_notes WHERE date >= ? AND date <= ? ORDER BY date DESC',
            [startDate, endDate]
        );
    }

    // ============ BACKUP/RESTORE METHODS ============

    async getAllForBackup(): Promise<{
        emotion_analyses: LocalEmotionAnalysis[];
        skin_analyses: LocalSkinAnalysis[];
        menstrual_notes: LocalMenstrualNote[];
    }> {
        await this.ensureInit();
        const db = getDatabase();

        const emotion_analyses = await db.getAllAsync<LocalEmotionAnalysis>('SELECT * FROM emotion_analyses');
        const skin_analyses = await db.getAllAsync<LocalSkinAnalysis>('SELECT * FROM skin_analyses');
        const menstrual_notes = await db.getAllAsync<LocalMenstrualNote>('SELECT * FROM menstrual_cycle_notes');

        return { emotion_analyses, skin_analyses, menstrual_notes };
    }

    async restoreFromBackup(data: {
        emotion_analyses: LocalEmotionAnalysis[];
        skin_analyses: LocalSkinAnalysis[];
        menstrual_notes: LocalMenstrualNote[];
    }): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        for (const e of data.emotion_analyses) {
            await db.runAsync(
                `INSERT OR REPLACE INTO emotion_analyses (id, date, dominant_emotion, valence, arousal, emotions_json, ai_observations, image_uri, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [e.id, e.date, e.dominant_emotion, e.valence, e.arousal, e.emotions_json, e.ai_observations, e.image_uri, e.created_at]
            );
        }

        for (const s of data.skin_analyses) {
            await db.runAsync(
                `INSERT OR REPLACE INTO skin_analyses (id, date, overall_score, texture_score, oiliness_score, hydration_score, redness_score, pigmentation_score, ai_analysis, image_uri, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [s.id, s.date, s.overall_score, s.texture_score, s.oiliness_score, s.hydration_score, s.redness_score, s.pigmentation_score, s.ai_analysis, s.image_uri, s.created_at]
            );
        }

        for (const m of data.menstrual_notes) {
            await db.runAsync(
                `INSERT OR REPLACE INTO menstrual_cycle_notes (id, date, note, symptoms_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
                [m.id, m.date, m.note, m.symptoms_json, m.created_at]
            );
        }
    }

    async clearAll(): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        await db.runAsync('DELETE FROM emotion_analyses');
        await db.runAsync('DELETE FROM skin_analyses');
        await db.runAsync('DELETE FROM menstrual_cycle_notes');
    }
}

export const LocalAnalysesService = new LocalAnalysesServiceClass();
