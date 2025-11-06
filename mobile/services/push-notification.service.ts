/**
 * Push Notification Service
 * Sistema intelligente per inviare notifiche contestuali e non invadenti
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmotionAnalysisService } from './emotion-analysis.service';

const NOTIFICATION_STORAGE_KEY = '@wellness:push_notifications';
const LAST_MOOD_NOTIFICATION_KEY = '@wellness:last_mood_notification';

interface NotificationRule {
  id: string;
  name: string;
  condition: (data: any) => Promise<boolean> | boolean;
  message: (data: any) => string;
  title: string;
  enabled: boolean;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private notificationPermissionGranted: boolean = false;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * 🆕 Inizializza il servizio e richiede i permessi
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Richiedi permessi
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      this.notificationPermissionGranted = finalStatus === 'granted';

      if (!this.notificationPermissionGranted) {
        console.log('[PushNotifications] ❌ Permission not granted');
        return false;
      }

      // Configura handler per le notifiche
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      console.log('[PushNotifications] ✅ Initialized and permission granted');
      return true;
    } catch (error) {
      console.error('[PushNotifications] ❌ Error initializing:', error);
      return false;
    }
  }

  /**
   * 🆕 Regola: Mood in calo per 3 giorni consecutivi
   */
  async checkMoodDeclineRule(userId: string): Promise<boolean> {
    try {
      // 🆕 Controlla se abbiamo già inviato una notifica oggi (throttling)
      const lastNotification = await AsyncStorage.getItem(`${LAST_MOOD_NOTIFICATION_KEY}:${userId}`);
      const today = new Date().toISOString().slice(0, 10);
      if (lastNotification === today) {
        console.log('[PushNotifications] ⏭️ Mood decline notification already sent today');
        return false;
      }

      // 🆕 Ottieni ultime 3 analisi emotive
      const history = await EmotionAnalysisService.getEmotionHistory(userId, 3);
      
      if (history.length < 3) {
        console.log('[PushNotifications] ⏭️ Not enough emotion history (need 3, have', history.length, ')');
        return false;
      }

      // 🆕 Ordina per data (più recente prima)
      const sortedHistory = history.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // 🆕 Controlla se c'è un declino: valence diminuisce per 3 giorni
      const recentValence = sortedHistory[0].valence;
      const olderValence = sortedHistory[2].valence;
      const middleValence = sortedHistory[1].valence;

      // 🆕 Declino: valence più recente < middle < older (trend negativo)
      const isDeclining = recentValence < middleValence && middleValence < olderValence;
      const declineAmount = olderValence - recentValence;

      // 🆕 Solo se il declino è significativo (>= 0.3)
      if (isDeclining && declineAmount >= 0.3) {
        console.log('[PushNotifications] ✅ Mood decline detected:', {
          recent: recentValence,
          middle: middleValence,
          older: olderValence,
          decline: declineAmount,
        });

        // 🆕 Invia notifica
        await this.sendMoodDeclineNotification(userId);
        
        // 🆕 Salva che abbiamo inviato oggi
        await AsyncStorage.setItem(`${LAST_MOOD_NOTIFICATION_KEY}:${userId}`, today);
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('[PushNotifications] ❌ Error checking mood decline rule:', error);
      return false;
    }
  }

  /**
   * 🆕 Invia notifica per mood decline
   */
  private async sendMoodDeclineNotification(userId: string): Promise<void> {
    try {
      // 🆕 Carica traduzione corrente (fallback a ITA se i18n non disponibile)
      let title = 'Stai bene?';
      let body = 'Hai notato un calo del tuo umore negli ultimi 3 giorni. Vuoi parlare con il tuo coach?';
      
      try {
        const i18n = (await import('../i18n')).default;
        const lang = i18n.language || 'it';
        if (lang === 'en') {
          title = 'Are you okay?';
          body = "You've noticed a decline in your mood over the last 3 days. Would you like to talk with your coach?";
        }
      } catch (e) {
        // Fallback a ITA se i18n non disponibile
      }
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          data: {
            type: 'mood_decline',
            userId: userId,
            action: 'open_chat',
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT, // Soft notification
        },
        trigger: null, // Immediate
      });

      console.log('[PushNotifications] ✅ Mood decline notification sent');
    } catch (error) {
      console.error('[PushNotifications] ❌ Error sending mood decline notification:', error);
    }
  }

  /**
   * 🆕 Esegui tutti i controlli delle regole
   */
  async checkAllRules(userId: string): Promise<void> {
    if (!this.notificationPermissionGranted) {
      console.log('[PushNotifications] ⏭️ Skipping checks - permission not granted');
      return;
    }

    try {
      // 🆕 Controlla regola mood decline
      await this.checkMoodDeclineRule(userId);
      
      // 🆕 Qui puoi aggiungere altre regole in futuro
      // await this.checkSleepQualityRule(userId);
      // await this.checkStreakRule(userId);
      
    } catch (error) {
      console.error('[PushNotifications] ❌ Error checking rules:', error);
    }
  }

  /**
   * 🆕 Abilita/disabilita notifiche push
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({ enabled }));
  }

  /**
   * 🆕 Verifica se le notifiche sono abilitate
   */
  async isEnabled(): Promise<boolean> {
    try {
      const saved = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.enabled !== false; // Default true
      }
      return true; // Default enabled
    } catch (e) {
      return true;
    }
  }
}

export default PushNotificationService;

