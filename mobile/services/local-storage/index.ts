/**
 * Local Storage Barrel Export
 * 
 * Provides a unified import point for all local storage services.
 */

export { initDatabase, closeDatabase, getDatabase, generateId, nowISO } from './database';
export { LocalJournalService, type LocalJournalEntry, type JournalEntryInput } from './local-journal.service';
export { LocalChatService, type LocalChatSession, type LocalChatMessage } from './local-chat.service';
export { LocalCheckinsService, type LocalCheckin, type CheckinInput } from './local-checkins.service';
export {
    LocalAnalysesService,
    type LocalEmotionAnalysis,
    type EmotionAnalysisInput,
    type LocalSkinAnalysis,
    type SkinAnalysisInput,
    type LocalMenstrualNote,
    type MenstrualNoteInput
} from './local-analyses.service';

// NOTE: BackupService is NOT exported here to avoid eager loading of expo-sharing/expo-document-picker
// which require native modules not available in Expo Go. Use dynamic import instead:
// const { BackupService } = await import('../services/local-storage/backup.service');
