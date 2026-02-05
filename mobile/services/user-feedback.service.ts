import { Alert } from 'react-native';
import i18n from '../i18n';

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
        text: i18n.t('common.retry'),
        onPress: retryAction,
        style: 'default',
      });
    }

    buttons.push({
      text: i18n.t('common.ok'),
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
      title: title || i18n.t('common.success'),
      message,
      type: 'success',
    });
  }

  /**
   * Mostra un messaggio di errore
   */
  static showError(message: string, title?: string, retryAction?: () => void): void {
    this.show({
      title: title || i18n.t('common.error'),
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
      title: title || i18n.t('common.warning'),
      message,
      type: 'warning',
    });
  }

  /**
   * Mostra un messaggio informativo
   */
  static showInfo(message: string, title?: string): void {
    this.show({
      title: title || i18n.t('common.info'),
      message,
      type: 'info',
    });
  }

  /**
   * Mostra un errore di salvataggio con opzione di retry
   */
  static showSaveError(
    entityType: 'analisi' | 'check-in' | 'dati salute' | 'dati' | 'pasto',
    retryAction?: () => void
  ): void {
    const translatedEntity = i18n.t(`feedback.entities.${entityType}`);
    this.showError(
      i18n.t('feedback.saveError', { entity: translatedEntity }),
      i18n.t('feedback.saveErrorTitle'),
      retryAction
    );
  }

  /**
   * Mostra un successo di salvataggio
   */
  static showSaveSuccess(entityType: 'analisi' | 'check-in' | 'dati salute' | 'dati' | 'pasto'): void {
    const translatedEntity = i18n.t(`feedback.entities.${entityType}`);

    // In Italian, we have specific keys for feminine entities to avoid "Analisi salvato"
    const successKey = i18n.exists(`feedback.saveSuccess_${entityType}`)
      ? `feedback.saveSuccess_${entityType}`
      : 'feedback.saveSuccess';

    this.showSuccess(i18n.t(successKey, { entity: translatedEntity }));
  }

  /**
   * Ottiene il titolo di default in base al tipo
   */
  private static getDefaultTitle(type: FeedbackType): string {
    switch (type) {
      case 'success':
        return i18n.t('common.success');
      case 'error':
        return i18n.t('common.error');
      case 'warning':
        return i18n.t('common.warning');
      case 'info':
      default:
        return i18n.t('common.info');
    }
  }
}

