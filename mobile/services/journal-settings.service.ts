import AsyncStorage from '@react-native-async-storage/async-storage';

export type JournalTemplate = 
  | 'free' 
  | 'gratitude' 
  | 'reflection' 
  | 'goals' 
  | 'emotions';

export interface JournalTemplateConfig {
  id: JournalTemplate;
  name: string;
  description: string;
  prompt: string;
}

export const JOURNAL_TEMPLATES: Record<JournalTemplate, JournalTemplateConfig> = {
  free: {
    id: 'free',
    name: 'Riflesso quotidiano',
    description: 'Uno spunto basato sul tuo umore, sonno e trend recenti',
    prompt: 'Scrivi due righe su come ti senti oggi e su cosa è successo.',
  },
  gratitude: {
    id: 'gratitude',
    name: 'Gratitudine',
    description: 'Focus sugli aspetti positivi della giornata',
    prompt: 'Scrivi tre cose per cui sei grato oggi. Puoi includere persone, momenti, esperienze o semplici gesti che ti hanno fatto sentire bene.',
  },
  reflection: {
    id: 'reflection',
    name: 'Riflessione sul giorno',
    description: 'Analisi generale della giornata',
    prompt: 'Rifletti sulla tua giornata: cosa è andato bene? Cosa avresti potuto fare diversamente? Quali lezioni puoi portare con te?',
  },
  goals: {
    id: 'goals',
    name: 'Obiettivi e progressi',
    description: 'Focus su obiettivi e traguardi raggiunti',
    prompt: 'Racconta i progressi verso i tuoi obiettivi di oggi. Cosa hai completato? Quali ostacoli hai incontrato? Cosa vuoi migliorare domani?',
  },
  emotions: {
    id: 'emotions',
    name: 'Emozioni della giornata',
    description: 'Focus sulle emozioni provate',
    prompt: 'Descrivi le emozioni principali che hai provato oggi. Cosa le ha scatenate? Come le hai gestite? Come ti senti ora?',
  },
};

const STORAGE_KEY = '@wellness:journal_settings';
const DEFAULT_TEMPLATE: JournalTemplate = 'free';

export class JournalSettingsService {
  /**
   * Ottiene il template corrente
   */
  static async getTemplate(): Promise<JournalTemplate> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.template || DEFAULT_TEMPLATE;
      }
      return DEFAULT_TEMPLATE;
    } catch (error) {
      console.error('[JournalSettings] Error loading template:', error);
      return DEFAULT_TEMPLATE;
    }
  }

  /**
   * Salva il template selezionato
   */
  static async saveTemplate(template: JournalTemplate): Promise<void> {
    try {
      const current = await this.getTemplate();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ template }));
    } catch (error) {
      console.error('[JournalSettings] Error saving template:', error);
      throw error;
    }
  }

  /**
   * Ottiene il prompt per il template corrente
   */
  static async getTemplatePrompt(): Promise<string> {
    const template = await this.getTemplate();
    return JOURNAL_TEMPLATES[template].prompt;
  }

  /**
   * Ottiene la configurazione del template corrente
   */
  static async getTemplateConfig(): Promise<JournalTemplateConfig> {
    const template = await this.getTemplate();
    return JOURNAL_TEMPLATES[template];
  }

  /**
   * Ottiene tutti i template disponibili
   */
  static getAvailableTemplates(): JournalTemplateConfig[] {
    return Object.values(JOURNAL_TEMPLATES);
  }
}


