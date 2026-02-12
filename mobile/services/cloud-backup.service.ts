import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { BackupData } from './local-storage/backup.service';

const CLOUD_BACKUP_CONFIG_KEY = '@yachai_cloud_backup_config_v1';
const CLOUD_BACKUP_FOLDER = 'YachaiBackups';
const CLOUD_BACKUP_PREFIX = 'yachai_backup_';
const CLOUD_BACKUP_EXT = '.json';
const MAX_CLOUD_BACKUPS = 5;

export type CloudBackupProvider = 'google_drive' | 'icloud_drive';

type CloudBackupMode = 'directory_picker';

interface CloudBackupConfig {
  version: number;
  provider: CloudBackupProvider;
  mode: CloudBackupMode;
  directoryUri: string;
  configuredAt: string;
  lastBackupAt: string | null;
  lastBackupFileName: string | null;
}

export interface CloudBackupStatus {
  isSupported: boolean;
  provider: CloudBackupProvider | null;
  isConfigured: boolean;
  directoryUri: string | null;
  configuredAt: string | null;
  lastBackupAt: string | null;
  lastBackupFileName: string | null;
}

export interface CloudBackupRunResult {
  fileName: string;
  stats: Record<string, number>;
}

export interface CloudBackupRestoreResult {
  fileName: string;
  stats: Record<string, number>;
  exportedAt: string;
}

interface CloudBackupFileItem {
  file: File;
  fileName: string;
  modifiedAt: number;
}

class CloudBackupServiceClass {
  private readonly CONFIG_VERSION = 1;

  private getExpectedProvider(): CloudBackupProvider | null {
    if (Platform.OS === 'android') return 'google_drive';
    if (Platform.OS === 'ios') return 'icloud_drive';
    return null;
  }

  private isSupportedPlatform(): boolean {
    return this.getExpectedProvider() !== null;
  }

  private isGoogleDriveUri(uri: string): boolean {
    return uri.includes('com.google.android.apps.docs') || uri.includes('com.google.android.apps.docs.storage');
  }

  private makeBackupFileName(date = new Date()): string {
    const safeIso = date.toISOString().replace(/[:.]/g, '-');
    return `${CLOUD_BACKUP_PREFIX}${safeIso}${CLOUD_BACKUP_EXT}`;
  }

  private computeStats(backupData: BackupData): Record<string, number> {
    return {
      journal_entries: backupData.data.journal_entries?.length || 0,
      chat_sessions: backupData.data.chat_sessions?.length || 0,
      chat_messages: backupData.data.chat_messages?.length || 0,
      daily_checkins: backupData.data.daily_checkins?.length || 0,
      emotion_analyses: backupData.data.emotion_analyses?.length || 0,
      skin_analyses: backupData.data.skin_analyses?.length || 0,
      menstrual_notes: backupData.data.menstrual_notes?.length || 0,
    };
  }

  private async readConfig(): Promise<CloudBackupConfig | null> {
    try {
      const raw = await AsyncStorage.getItem(CLOUD_BACKUP_CONFIG_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CloudBackupConfig;
      if (!parsed.directoryUri || !parsed.provider) return null;
      return parsed;
    } catch (error) {
      console.error('[CloudBackup] Failed to read config:', error);
      return null;
    }
  }

  private async writeConfig(config: CloudBackupConfig): Promise<void> {
    await AsyncStorage.setItem(CLOUD_BACKUP_CONFIG_KEY, JSON.stringify(config));
  }

  private async requireConfig(): Promise<CloudBackupConfig> {
    const config = await this.readConfig();
    if (!config) {
      throw new Error('Cloud backup destination is not configured');
    }
    return config;
  }

  private resolveBackupsDirectory(config: CloudBackupConfig): Directory {
    const rootDirectory = new Directory(config.directoryUri);
    if (!rootDirectory.exists) {
      throw new Error('Cloud backup destination is no longer accessible. Please reconnect it.');
    }

    const backupsDirectory = new Directory(rootDirectory, CLOUD_BACKUP_FOLDER);
    backupsDirectory.create({ intermediates: true, idempotent: true });
    return backupsDirectory;
  }

  private async listBackupFilesInternal(config: CloudBackupConfig): Promise<CloudBackupFileItem[]> {
    const backupsDirectory = this.resolveBackupsDirectory(config);
    const items = backupsDirectory.list();

    return items
      .filter((item): item is File => item instanceof File)
      .filter((file) => file.name.startsWith(CLOUD_BACKUP_PREFIX) && file.name.endsWith(CLOUD_BACKUP_EXT))
      .map((file) => ({
        file,
        fileName: file.name,
        modifiedAt: file.modificationTime || 0,
      }))
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  private async pruneOldBackups(config: CloudBackupConfig): Promise<void> {
    const files = await this.listBackupFilesInternal(config);
    const stale = files.slice(MAX_CLOUD_BACKUPS);
    for (const item of stale) {
      try {
        item.file.delete();
      } catch (error) {
        console.warn('[CloudBackup] Failed to delete stale backup', item.fileName, error);
      }
    }
  }

  async getStatus(): Promise<CloudBackupStatus> {
    const expectedProvider = this.getExpectedProvider();
    const config = await this.readConfig();

    return {
      isSupported: this.isSupportedPlatform(),
      provider: expectedProvider,
      isConfigured: Boolean(config),
      directoryUri: config?.directoryUri ?? null,
      configuredAt: config?.configuredAt ?? null,
      lastBackupAt: config?.lastBackupAt ?? null,
      lastBackupFileName: config?.lastBackupFileName ?? null,
    };
  }

  async clearConfiguration(): Promise<void> {
    await AsyncStorage.removeItem(CLOUD_BACKUP_CONFIG_KEY);
  }

  async configureBackupDestination(): Promise<CloudBackupStatus> {
    const expectedProvider = this.getExpectedProvider();
    if (!expectedProvider) {
      throw new Error('Cloud backup is available only on iOS and Android');
    }

    const previousConfig = await this.readConfig();
    const initialUri = previousConfig?.directoryUri;
    const selectedDirectory = await Directory.pickDirectoryAsync(initialUri || undefined);

    if (Platform.OS === 'android' && !this.isGoogleDriveUri(selectedDirectory.uri)) {
      throw new Error('Please select a folder inside Google Drive');
    }

    const now = new Date().toISOString();
    const config: CloudBackupConfig = {
      version: this.CONFIG_VERSION,
      provider: expectedProvider,
      mode: 'directory_picker',
      directoryUri: selectedDirectory.uri,
      configuredAt: previousConfig?.configuredAt || now,
      lastBackupAt: previousConfig?.lastBackupAt || null,
      lastBackupFileName: previousConfig?.lastBackupFileName || null,
    };

    await this.writeConfig(config);
    return this.getStatus();
  }

  async backupNow(): Promise<CloudBackupRunResult> {
    const config = await this.requireConfig();
    const { BackupService } = await import('./local-storage/backup.service');

    const backupData = await BackupService.exportBackupData();
    const backupsDirectory = this.resolveBackupsDirectory(config);

    const fileName = this.makeBackupFileName();
    const destinationFile = new File(backupsDirectory, fileName);
    destinationFile.create({ intermediates: true, overwrite: true });
    destinationFile.write(JSON.stringify(backupData, null, 2));

    const now = new Date().toISOString();
    await this.writeConfig({
      ...config,
      lastBackupAt: now,
      lastBackupFileName: fileName,
    });

    await this.pruneOldBackups(config);

    return {
      fileName,
      stats: this.computeStats(backupData),
    };
  }

  async restoreLatest(): Promise<CloudBackupRestoreResult> {
    const config = await this.requireConfig();
    const { BackupService } = await import('./local-storage/backup.service');

    const files = await this.listBackupFilesInternal(config);
    const latest = files[0];
    if (!latest) {
      throw new Error('No cloud backup found in selected folder');
    }

    const raw = await latest.file.text();
    const backupData = JSON.parse(raw) as BackupData;
    const { stats } = await BackupService.restoreBackupData(backupData);

    return {
      fileName: latest.fileName,
      stats,
      exportedAt: backupData.exported_at,
    };
  }
}

export const CloudBackupService = new CloudBackupServiceClass();
