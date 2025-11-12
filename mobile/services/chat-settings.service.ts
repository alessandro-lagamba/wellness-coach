import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatTone = 'empathetic' | 'neutral' | 'motivational' | 'professional';
export type ResponseLength = 'short' | 'standard' | 'detailed';

export interface ChatSettings {
  tone: ChatTone;
  responseLength: ResponseLength;
  includeActionSteps: boolean;
  localHistoryEnabled: boolean;
}

const STORAGE_KEY = '@wellness:chat_settings';
const DEFAULT_SETTINGS: ChatSettings = {
  tone: 'empathetic',
  responseLength: 'standard',
  includeActionSteps: true,
  localHistoryEnabled: true,
};

export class ChatSettingsService {
  /**
   * Carica le impostazioni chat dallo storage
   */
  static async getSettings(): Promise<ChatSettings> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge con default per garantire che tutti i campi esistano
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('[ChatSettings] Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Salva le impostazioni chat nello storage
   */
  static async saveSettings(settings: Partial<ChatSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[ChatSettings] Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Resetta le impostazioni ai valori di default
   */
  static async resetSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (error) {
      console.error('[ChatSettings] Error resetting settings:', error);
      throw error;
    }
  }

  /**
   * Ottiene il tone corrente
   */
  static async getTone(): Promise<ChatTone> {
    const settings = await this.getSettings();
    return settings.tone;
  }

  /**
   * Ottiene la lunghezza risposta corrente
   */
  static async getResponseLength(): Promise<ResponseLength> {
    const settings = await this.getSettings();
    return settings.responseLength;
  }

  /**
   * Verifica se gli action steps sono abilitati
   */
  static async getIncludeActionSteps(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.includeActionSteps;
  }

  /**
   * Verifica se la cronologia locale è abilitata
   */
  static async isLocalHistoryEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.localHistoryEnabled;
  }
}

