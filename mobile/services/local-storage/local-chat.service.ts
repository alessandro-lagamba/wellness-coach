/**
 * Local Chat Service
 * 
 * Handles CRUD operations for chat sessions and messages stored locally in SQLite.
 * Replaces the Supabase-based chat storage.
 */

import { getDatabase, generateId, nowISO, initDatabase } from './database';

export interface LocalChatSession {
    id: string;
    name: string | null;
    created_at: string;
    updated_at: string;
}

export interface LocalChatMessage {
    id: string;
    session_id: string | null;
    role: 'user' | 'assistant' | 'system';
    content: string;
    emotion_context: string | null;
    wellness_context: string | null;
    created_at: string;
}

class LocalChatServiceClass {
    private initialized = false;

    private async ensureInit(): Promise<void> {
        if (!this.initialized) {
            await initDatabase();
            this.initialized = true;
        }
    }

    // ============ SESSION METHODS ============

    /**
     * Create a new chat session
     */
    async createSession(name?: string): Promise<LocalChatSession> {
        await this.ensureInit();
        const db = getDatabase();

        const id = generateId();
        const now = nowISO();

        await db.runAsync(
            'INSERT INTO chat_sessions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
            [id, name ?? null, now, now]
        );

        return { id, name: name ?? null, created_at: now, updated_at: now };
    }

    /**
     * Get a session by ID
     */
    async getSession(id: string): Promise<LocalChatSession | null> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getFirstAsync<LocalChatSession>(
            'SELECT * FROM chat_sessions WHERE id = ?',
            [id]
        );
    }

    /**
     * List all sessions
     */
    async listSessions(): Promise<LocalChatSession[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalChatSession>(
            'SELECT * FROM chat_sessions ORDER BY updated_at DESC'
        );
    }

    /**
     * Update session name
     */
    async updateSessionName(id: string, name: string): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        await db.runAsync(
            'UPDATE chat_sessions SET name = ?, updated_at = ? WHERE id = ?',
            [name, nowISO(), id]
        );
    }

    /**
     * Delete a session and all its messages
     */
    async deleteSession(id: string): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        // Messages will be deleted via CASCADE
        await db.runAsync('DELETE FROM chat_sessions WHERE id = ?', [id]);
    }

    // ============ MESSAGE METHODS ============

    /**
     * Add a message to a session
     */
    async addMessage(
        sessionId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        options?: {
            emotionContext?: string;
            wellnessContext?: string;
        }
    ): Promise<LocalChatMessage> {
        await this.ensureInit();
        const db = getDatabase();

        const id = generateId();
        const now = nowISO();

        await db.runAsync(
            `INSERT INTO chat_messages (id, session_id, role, content, emotion_context, wellness_context, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                sessionId,
                role,
                content,
                options?.emotionContext ?? null,
                options?.wellnessContext ?? null,
                now
            ]
        );

        // Update session's updated_at
        await db.runAsync(
            'UPDATE chat_sessions SET updated_at = ? WHERE id = ?',
            [now, sessionId]
        );

        return {
            id,
            session_id: sessionId,
            role,
            content,
            emotion_context: options?.emotionContext ?? null,
            wellness_context: options?.wellnessContext ?? null,
            created_at: now
        };
    }

    /**
     * Get all messages for a session
     */
    async getMessages(sessionId: string): Promise<LocalChatMessage[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalChatMessage>(
            'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
            [sessionId]
        );
    }

    /**
     * Get recent messages across all sessions
     */
    async getRecentMessages(limit: number = 50): Promise<LocalChatMessage[]> {
        await this.ensureInit();
        const db = getDatabase();

        return await db.getAllAsync<LocalChatMessage>(
            'SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT ?',
            [limit]
        );
    }

    /**
     * Delete a specific message
     */
    async deleteMessage(id: string): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        await db.runAsync('DELETE FROM chat_messages WHERE id = ?', [id]);
    }

    // ============ BACKUP/RESTORE METHODS ============

    /**
     * Get all sessions with their messages (for backup)
     */
    async getAllForBackup(): Promise<{ sessions: LocalChatSession[]; messages: LocalChatMessage[] }> {
        await this.ensureInit();
        const db = getDatabase();

        const sessions = await db.getAllAsync<LocalChatSession>('SELECT * FROM chat_sessions');
        const messages = await db.getAllAsync<LocalChatMessage>('SELECT * FROM chat_messages');

        return { sessions, messages };
    }

    /**
     * Restore sessions and messages from backup
     */
    async restoreFromBackup(data: { sessions: LocalChatSession[]; messages: LocalChatMessage[] }): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        // Insert sessions first
        for (const session of data.sessions) {
            await db.runAsync(
                'INSERT OR REPLACE INTO chat_sessions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
                [session.id, session.name, session.created_at, session.updated_at]
            );
        }

        // Then insert messages
        for (const message of data.messages) {
            await db.runAsync(
                `INSERT OR REPLACE INTO chat_messages (id, session_id, role, content, emotion_context, wellness_context, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    message.id,
                    message.session_id,
                    message.role,
                    message.content,
                    message.emotion_context,
                    message.wellness_context,
                    message.created_at
                ]
            );
        }
    }

    /**
     * Clear all chat data
     */
    async clearAll(): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        await db.runAsync('DELETE FROM chat_messages');
        await db.runAsync('DELETE FROM chat_sessions');
    }

    /**
     * Prune messages older than specified days
     */
    async pruneOldMessages(days: number = 7): Promise<void> {
        await this.ensureInit();
        const db = getDatabase();

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffISO = cutoffDate.toISOString();

        await db.runAsync(
            'DELETE FROM chat_messages WHERE created_at < ?',
            [cutoffISO]
        );

        // Optionally clean up empty sessions (sessions with no messages)
        // await db.runAsync(
        //    'DELETE FROM chat_sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM chat_messages)'
        // );
    }
}

export const LocalChatService = new LocalChatServiceClass();
