import { Alert, Platform } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';

export type FeedbackType = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackOptions {
  title?: string;
  message: string;
  type?: FeedbackType;
  duration?: number;
  onPress?: () => void;
  showRetry?: boolean;
  retryAction?: () => void;
}

/**
 * Service per mostrare feedback all'utente
 * Supporta Alert (cross-platform) e può essere esteso con Toast in futuro
 */
export class UserFeedbackService {
  /**
   * Mostra un messaggio di feedback all'utente
   */
  static show(options: FeedbackOptions): void {
    const { title, message, type = 'info', onPress, showRetry, retryAction } = options;

    // Determina il titolo in base al tipo
    const defaultTitle = this.getDefaultTitle(type);

    // Crea i pulsanti
    const buttons: any[] = [];

    if (showRetry && retryAction) {
      buttons.push({
        text: 'Riprova',
        onPress: retryAction,
        style: 'default',
      });
    }

    buttons.push({
      text: 'OK',
      onPress: onPress,
      style: type === 'error' ? 'destructive' : 'default',
    });

    Alert.alert(title || defaultTitle, message, buttons);
  }

  /**
   * Mostra un messaggio di successo
   */
  static showSuccess(message: string, title?: string): void {
    this.show({
      title: title || 'Successo',
      message,
      type: 'success',
    });
  }

  /**
   * Mostra un messaggio di errore
   */
  static showError(message: string, title?: string, retryAction?: () => void): void {
    this.show({
      title: title || 'Errore',
      message,
      type: 'error',
      showRetry: !!retryAction,
      retryAction,
    });
  }

  /**
   * Mostra un messaggio di warning
   */
  static showWarning(message: string, title?: string): void {
    this.show({
      title: title || 'Attenzione',
      message,
      type: 'warning',
    });
  }

  /**
   * Mostra un messaggio informativo
   */
  static showInfo(message: string, title?: string): void {
    this.show({
      title: title || 'Informazione',
      message,
      type: 'info',
    });
  }

  /**
   * Mostra un errore di salvataggio con opzione di retry
   */
  static showSaveError(
    entityType: 'analisi' | 'check-in' | 'dati salute' | 'dati',
    retryAction?: () => void
  ): void {
    this.showError(
      `Impossibile salvare ${entityType}. Riprova più tardi o controlla la connessione.`,
      'Errore di salvataggio',
      retryAction
    );
  }

  /**
   * Mostra un successo di salvataggio
   */
  static showSaveSuccess(entityType: 'analisi' | 'check-in' | 'dati salute' | 'dati'): void {
    this.showSuccess(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} salvato con successo.`);
  }

  /**
   * Ottiene il titolo di default in base al tipo
   */
  private static getDefaultTitle(type: FeedbackType): string {
    switch (type) {
      case 'success':
        return 'Successo';
      case 'error':
        return 'Errore';
      case 'warning':
        return 'Attenzione';
      case 'info':
      default:
        return 'Informazione';
    }
  }
}

