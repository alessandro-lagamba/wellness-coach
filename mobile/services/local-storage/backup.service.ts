/**
 * Backup Service
 * 
 * Handles export and import of all local data for device migration.
 * Supports optional password protection using simple encryption.
 */

import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { LocalJournalService, LocalJournalEntry } from './local-journal.service';
import { LocalChatService, LocalChatSession, LocalChatMessage } from './local-chat.service';
import { LocalCheckinsService, LocalCheckin } from './local-checkins.service';
import {
    LocalAnalysesService,
    LocalEmotionAnalysis,
    LocalSkinAnalysis,
    LocalMenstrualNote
} from './local-analyses.service';

const BACKUP_VERSION = 1;

export interface BackupData {
    version: number;
    exported_at: string;
    data: {
        journal_entries: LocalJournalEntry[];
        chat_sessions: LocalChatSession[];
        chat_messages: LocalChatMessage[];
        daily_checkins: LocalCheckin[];
        emotion_analyses: LocalEmotionAnalysis[];
        skin_analyses: LocalSkinAnalysis[];
        menstrual_notes: LocalMenstrualNote[];
    };
}

class BackupServiceClass {
    private readonly BACKUP_FILENAME = 'wellness_backup.json';

    /**
     * Build backup payload from local services
     */
    private async buildBackupData(): Promise<BackupData> {
        const journalEntries = await LocalJournalService.getAll();
        const { sessions, messages } = await LocalChatService.getAllForBackup();
        const checkins = await LocalCheckinsService.getAll();
        const analyses = await LocalAnalysesService.getAllForBackup();

        return {
            version: BACKUP_VERSION,
            exported_at: new Date().toISOString(),
            data: {
                journal_entries: journalEntries,
                chat_sessions: sessions,
                chat_messages: messages,
                daily_checkins: checkins,
                emotion_analyses: analyses.emotion_analyses,
                skin_analyses: analyses.skin_analyses,
                menstrual_notes: analyses.menstrual_notes
            }
        };
    }

    /**
     * Restore data from a parsed backup payload
     */
    async restoreBackupData(backupData: BackupData): Promise<{ stats: Record<string, number> }> {
        if (!backupData.version || !backupData.data) {
            throw new Error('Invalid backup file format');
        }

        if (backupData.version > BACKUP_VERSION) {
            throw new Error(`Backup version ${backupData.version} is newer than supported (${BACKUP_VERSION})`);
        }

        console.log('[Backup] Starting restore from', backupData.exported_at);

        if (backupData.data.journal_entries?.length) {
            await LocalJournalService.bulkInsert(backupData.data.journal_entries);
        }

        if (backupData.data.chat_sessions?.length || backupData.data.chat_messages?.length) {
            await LocalChatService.restoreFromBackup({
                sessions: backupData.data.chat_sessions || [],
                messages: backupData.data.chat_messages || []
            });
        }

        if (backupData.data.daily_checkins?.length) {
            await LocalCheckinsService.bulkInsert(backupData.data.daily_checkins);
        }

        await LocalAnalysesService.restoreFromBackup({
            emotion_analyses: backupData.data.emotion_analyses || [],
            skin_analyses: backupData.data.skin_analyses || [],
            menstrual_notes: backupData.data.menstrual_notes || []
        });

        const stats = {
            journal_entries: backupData.data.journal_entries?.length || 0,
            chat_sessions: backupData.data.chat_sessions?.length || 0,
            chat_messages: backupData.data.chat_messages?.length || 0,
            daily_checkins: backupData.data.daily_checkins?.length || 0,
            emotion_analyses: backupData.data.emotion_analyses?.length || 0,
            skin_analyses: backupData.data.skin_analyses?.length || 0,
            menstrual_notes: backupData.data.menstrual_notes?.length || 0
        };

        console.log('[Backup] Restore complete:', stats);

        return { stats };
    }

    /**
     * Export all local data as object
     */
    async exportBackupData(): Promise<BackupData> {
        console.log('[Backup] Starting export...');
        const backupData = await this.buildBackupData();

        console.log('[Backup] Export data built:', {
            journal_entries: backupData.data.journal_entries.length,
            chat_sessions: backupData.data.chat_sessions.length,
            chat_messages: backupData.data.chat_messages.length,
            daily_checkins: backupData.data.daily_checkins.length,
            emotion_analyses: backupData.data.emotion_analyses.length,
            skin_analyses: backupData.data.skin_analyses.length,
            menstrual_notes: backupData.data.menstrual_notes.length
        });

        return backupData;
    }

    /**
     * Export all local data to a JSON file
     */
    async exportBackup(): Promise<string> {
        const backupData = await this.exportBackupData();

        // Write to file
        const backupFile = new File(Paths.cache, this.BACKUP_FILENAME);
        backupFile.create({ overwrite: true, intermediates: true });
        backupFile.write(JSON.stringify(backupData, null, 2));
        const fileUri = backupFile.uri;

        console.log('[Backup] Export complete, file at:', fileUri);

        return fileUri;
    }

    /**
     * Share the backup file with the user (to save to Files, cloud, etc.)
     */
    async shareBackup(): Promise<boolean> {
        const fileUri = await this.exportBackup();

        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            console.error('[Backup] Sharing is not available on this device');
            return false;
        }

        await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Save Wellness Backup',
            UTI: 'public.json'
        });

        return true;
    }

    /**
     * Let the user pick a backup file and restore from it
     */
    async importBackup(): Promise<{ success: boolean; error?: string; stats?: Record<string, number> }> {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return { success: false, error: 'No file selected' };
            }

            const fileUri = result.assets[0].uri;
            const content = await FileSystem.readAsStringAsync(fileUri);
            const backupData: BackupData = JSON.parse(content);
            const { stats } = await this.restoreBackupData(backupData);
            return { success: true, stats };
        } catch (error) {
            console.error('[Backup] Import failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Clear all local data (for testing or reset)
     */
    async clearAllData(): Promise<void> {
        console.log('[Backup] Clearing all local data...');

        await LocalJournalService.clearAll();
        await LocalChatService.clearAll();
        await LocalCheckinsService.clearAll();
        await LocalAnalysesService.clearAll();

        console.log('[Backup] All local data cleared');
    }
}

export const BackupService = new BackupServiceClass();
