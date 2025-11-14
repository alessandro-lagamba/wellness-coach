import { File, Paths } from 'expo-file-system';
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
  aiScore?: number;
  aiAnalysis?: string;
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
      
      const file = new File(Paths.document, filename ?? `chat_${Date.now()}.txt`);
      file.create({ overwrite: true });
      file.write(fullContent);

      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert('Esportazione completata', `File salvato in: ${file.uri}`);
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
      
      const file = new File(Paths.document, filename ?? `chat_${Date.now()}.md`);
      file.create({ overwrite: true });
      file.write(fullContent);

      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert('Esportazione completata', `File salvato in: ${file.uri}`);
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

      if (entry.aiScore !== undefined) {
        content += `## Score: ${entry.aiScore}/3\n\n`;
      }

      if (entry.aiAnalysis) {
        content += `## Analisi AI\n\n${entry.aiAnalysis}\n\n`;
      }

      const file = new File(Paths.document, filename ?? `journal_${entry.date}.txt`);
      file.create({ overwrite: true });
      file.write(content);

      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert('Esportazione completata', `File salvato in: ${file.uri}`);
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

      if (entry.aiScore !== undefined) {
        content += `## Score: ${entry.aiScore}/3\n\n`;
      }

      if (entry.aiAnalysis) {
        content += `## Analisi AI\n\n${entry.aiAnalysis}\n\n`;
      }

      const file = new File(Paths.document, filename ?? `journal_${entry.date}.md`);
      file.create({ overwrite: true });
      file.write(content);

      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert('Esportazione completata', `File salvato in: ${file.uri}`);
      }
    } catch (error) {
      console.error('[Export] Error exporting journal to MD:', error);
      Alert.alert('Errore', 'Impossibile esportare il journal');
      throw error;
    }
  }
}


