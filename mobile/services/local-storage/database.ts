/**
 * Local SQLite Database Service
 * 
 * Manages the local SQLite database for sensitive user data.
 * This replaces the encrypted Supabase storage for privacy-critical data.
 */

import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'wellness_local.db';
const SCHEMA_VERSION = 1;

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database and create tables if they don't exist
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (db) return db;

    db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    // Enable WAL mode for better performance
    await db.execAsync('PRAGMA journal_mode = WAL;');

    // Create tables
    await db.execAsync(`
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
    
    -- Journal Entries
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL UNIQUE,
      content TEXT,
      ai_prompt TEXT,
      ai_score INTEGER,
      ai_analysis TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Chat Sessions
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Chat Messages
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      emotion_context TEXT,
      wellness_context TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
    
    -- Daily Check-ins (mood/sleep notes)
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      mood_value INTEGER,
      mood_note TEXT,
      sleep_value INTEGER,
      sleep_note TEXT,
      energy_level TEXT,
      focus_level TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Emotion Analyses
    CREATE TABLE IF NOT EXISTS emotion_analyses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      dominant_emotion TEXT,
      valence REAL,
      arousal REAL,
      emotions_json TEXT,
      ai_observations TEXT,
      image_uri TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Skin Analyses
    CREATE TABLE IF NOT EXISTS skin_analyses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      overall_score REAL,
      texture_score REAL,
      oiliness_score REAL,
      hydration_score REAL,
      redness_score REAL,
      pigmentation_score REAL,
      ai_analysis TEXT,
      image_uri TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Menstrual Cycle Notes
    CREATE TABLE IF NOT EXISTS menstrual_cycle_notes (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      note TEXT,
      symptoms_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create indexes for faster lookups
    CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_date ON daily_checkins(date);
    CREATE INDEX IF NOT EXISTS idx_emotion_date ON emotion_analyses(date);
    CREATE INDEX IF NOT EXISTS idx_skin_date ON skin_analyses(date);
    CREATE INDEX IF NOT EXISTS idx_cycle_date ON menstrual_cycle_notes(date);
  `);

    // Track schema version
    const result = await db.getFirstAsync<{ version: number }>('SELECT version FROM schema_version LIMIT 1');
    if (!result) {
        await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', SCHEMA_VERSION);
    }

    console.log('[LocalDB] Database initialized with schema version', SCHEMA_VERSION);
    return db;
}

/**
 * Get the database instance (must be initialized first)
 */
export function getDatabase(): SQLite.SQLiteDatabase {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.closeAsync();
        db = null;
        console.log('[LocalDB] Database closed');
    }
}

/**
 * Generate a unique ID for new records
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
    return new Date().toISOString();
}
