import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

// Dynamic import per expo-sharing (può non essere installato)
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  console.warn('[Export] expo-sharing not available');
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export interface JournalEntry {
  date: string;
  content: string;
  aiSummary?: string;
  aiScore?: number;
  aiLabel?: string;
}

export class ExportService {
  /**
   * Esporta conversazione chat in formato TXT
   */
  static async exportChatToTXT(messages: ChatMessage[], filename?: string): Promise<void> {
    try {
      const content = messages
        .map(msg => {
          const sender = msg.sender === 'user' ? 'Tu' : 'WellnessCoach';
          const time = msg.timestamp.toLocaleString('it-IT');
          return `[${time}] ${sender}:\n${msg.text}\n`;
        })
        .join('\n---\n\n');

      const fullContent = `Conversazione WellnessCoach\n${'='.repeat(50)}\n\n${content}`;
      
      const fileUri = FileSystem.documentDirectory + (filename || `chat_${Date.now()}.txt`);
      await FileSystem.writeAsStringAsync(fileUri, fullContent);

      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Esportazione completata', `File salvato in: ${fileUri}`);
      }
    } catch (error) {
      console.error('[Export] Error exporting chat to TXT:', error);
      Alert.alert('Errore', 'Impossibile esportare la conversazione');
      throw error;
    }
  }

  /**
   * Esporta conversazione chat in formato Markdown
   */
  static async exportChatToMD(messages: ChatMessage[], filename?: string): Promise<void> {
    try {
      const content = messages
        .map(msg => {
          const sender = msg.sender === 'user' ? '**Tu**' : '**WellnessCoach**';
          const time = msg.timestamp.toLocaleString('it-IT');
          return `### ${sender} - ${time}\n\n${msg.text}\n`;
        })
        .join('\n---\n\n');

      const fullContent = `# Conversazione WellnessCoach\n\n${content}`;
      
      const fileUri = FileSystem.documentDirectory + (filename || `chat_${Date.now()}.md`);
      await FileSystem.writeAsStringAsync(fileUri, fullContent);

      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Esportazione completata', `File salvato in: ${fileUri}`);
      }
    } catch (error) {
      console.error('[Export] Error exporting chat to MD:', error);
      Alert.alert('Errore', 'Impossibile esportare la conversazione');
      throw error;
    }
  }

  /**
   * Esporta journal entry in formato TXT
   */
  static async exportJournalToTXT(entry: JournalEntry, filename?: string): Promise<void> {
    try {
      let content = `Entry Journal - ${entry.date}\n${'='.repeat(50)}\n\n`;
      content += `## Contenuto\n\n${entry.content}\n\n`;

      if (entry.aiSummary) {
        content += `## Analisi AI\n\n${entry.aiSummary}\n\n`;
      }

      if (entry.aiScore !== undefined) {
        content += `## Score: ${entry.aiScore}/5\n\n`;
      }

      if (entry.aiLabel) {
        content += `## Label: ${entry.aiLabel}\n\n`;
      }

      const fileUri = FileSystem.documentDirectory + (filename || `journal_${entry.date}.txt`);
      await FileSystem.writeAsStringAsync(fileUri, content);

      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Esportazione completata', `File salvato in: ${fileUri}`);
      }
    } catch (error) {
      console.error('[Export] Error exporting journal to TXT:', error);
      Alert.alert('Errore', 'Impossibile esportare il journal');
      throw error;
    }
  }

  /**
   * Esporta journal entry in formato Markdown
   */
  static async exportJournalToMD(entry: JournalEntry, filename?: string): Promise<void> {
    try {
      let content = `# Entry Journal - ${entry.date}\n\n`;
      content += `## Contenuto\n\n${entry.content}\n\n`;

      if (entry.aiSummary) {
        content += `## Analisi AI\n\n${entry.aiSummary}\n\n`;
      }

      if (entry.aiScore !== undefined) {
        content += `## Score: ${entry.aiScore}/5\n\n`;
      }

      if (entry.aiLabel) {
        content += `## Label: ${entry.aiLabel}\n\n`;
      }

      const fileUri = FileSystem.documentDirectory + (filename || `journal_${entry.date}.md`);
      await FileSystem.writeAsStringAsync(fileUri, content);

      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Esportazione completata', `File salvato in: ${fileUri}`);
      }
    } catch (error) {
      console.error('[Export] Error exporting journal to MD:', error);
      Alert.alert('Errore', 'Impossibile esportare il journal');
      throw error;
    }
  }
}

