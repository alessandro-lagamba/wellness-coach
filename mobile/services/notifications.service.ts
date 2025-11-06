// @ts-nocheck
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fridgeItemsService } from './fridge-items.service';
import { AuthService } from './auth.service';

export type NotificationCategory =
  | 'emotion_skin_reminder'
  | 'journal_reminder'
  | 'fridge_expiry'
  | 'breathing_break'
  | 'hydration_reminder'
  | 'morning_greeting'
  | 'evening_winddown'
  | 'goal_progress'
  | 'streak_celebration'
  | 'sleep_preparation';

export interface ScheduleOptions {
  // For time-based triggers
  hour?: number; // 0-23
  minute?: number; // 0-59
  weekday?: number; // 1-7 (Mon=1) for weekly triggers
  repeats?: boolean;

  // For relative triggers
  secondsFromNow?: number;
}

export const NotificationService = {
  async ensurePermission(): Promise<boolean> {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true, allowProvisional: true },
    });
    return req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  },

  async configureChannels() {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [250, 250],
          // Use numeric value for AndroidVisibility (1 = PUBLIC)
          lockscreenVisibility: 1, // AndroidVisibility.PUBLIC
          enableLights: true,
          enableVibrate: true,
          lightColor: '#22c55e',
        });
      } catch (error) {
        // If AndroidVisibility enum is not available, try without lockscreenVisibility
        console.warn('Could not set lockscreenVisibility, using default channel config:', error);
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [250, 250],
          enableLights: true,
          enableVibrate: true,
          lightColor: '#22c55e',
        });
      }
    }
  },

  async initialize(): Promise<boolean> {
    const ok = await this.ensurePermission();
    await this.configureChannels();
    return ok;
  },

  async schedule(category: NotificationCategory, title: string, body: string, options: ScheduleOptions = {}, data?: Record<string, any>) {
    const content: Notifications.NotificationContentInput = {
      title,
      body,
      sound: Platform.OS === 'ios' ? 'default' : undefined,
      data: { category, ...(data || {}) },
    };

    // Time-based (specific hour/minute, optional weekday)
    if (options.hour !== undefined && options.minute !== undefined) {
      const repeats = options.repeats ?? true;
      
      // Per notifiche ricorrenti, Expo gestisce automaticamente il scheduling futuro
      // Con repeats: true, Expo non invia notifiche immediate se l'orario è già passato
      // ma le schedula per il prossimo evento futuro
      const trigger: Notifications.DailyTriggerInput | Notifications.WeeklyTriggerInput = options.weekday
        ? { hour: options.hour, minute: options.minute, weekday: options.weekday, repeats }
        : { hour: options.hour, minute: options.minute, repeats };
      
      // Expo con repeats: true gestisce automaticamente il scheduling futuro
      // Non invia notifiche immediate se l'orario è già passato
      return Notifications.scheduleNotificationAsync({ content, trigger });
    }

    // Relative time
    if (options.secondsFromNow !== undefined) {
      const trigger: Notifications.TimeIntervalTriggerInput = {
        seconds: Math.max(1, options.secondsFromNow),
        repeats: options.repeats ?? false,
      };
      return Notifications.scheduleNotificationAsync({ content, trigger });
    }

    // Immediate
    return Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async cancel(id: string) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  },

  // Presets
  async scheduleEmotionSkinWeekly() {
    // Default: Tue and Fri at 19:00
    const ids: string[] = [];
    ids.push(
      await this.schedule(
        'emotion_skin_reminder',
        'Analisi benessere',
        'È ora di fare un check su emozioni o pelle ✨',
        { hour: 19, minute: 0, weekday: 2, repeats: true },
        { screen: 'analysis' }
      )
    );
    ids.push(
      await this.schedule(
        'emotion_skin_reminder',
        'Analisi benessere',
        'Piccolo promemoria per la tua analisi 🧘‍♀️',
        { hour: 19, minute: 0, weekday: 5, repeats: true },
        { screen: 'analysis' }
      )
    );
    return ids;
  },

  async scheduleDiaryDaily() {
    // Default: daily 21:30
    return this.schedule(
      'journal_reminder',
      'Diario',
      'Ti va di scrivere una breve voce nel diario?',
      { hour: 21, minute: 30, repeats: true },
      { screen: 'journal' }
    );
  },

  async scheduleBreathingNudges() {
    // Weekdays 11:30 and 16:00
    const ids: string[] = [];
    for (const weekday of [1, 2, 3, 4, 5]) {
      ids.push(
        await this.schedule(
          'breathing_break',
          'Pausa respiro',
          '1 minuto di respirazione guidata?',
          { hour: 11, minute: 30, weekday, repeats: true },
          { screen: 'breathing' }
        )
      );
      ids.push(
        await this.schedule(
          'breathing_break',
          'Reset pomeridiano',
          '2 minuti di respirazione/meditazione?',
          { hour: 16, minute: 0, weekday, repeats: true },
          { screen: 'breathing' }
        )
      );
    }
    return ids;
  },

  // Schedule daily fridge expiry check (default: 18:00)
  async scheduleFridgeExpiryCheck(hour: number = 18, minute: number = 0) {
    return this.schedule(
      'fridge_expiry',
      'Controllo ingredienti',
      'Verifica ingredienti in scadenza',
      { hour, minute, repeats: true },
      { screen: 'food', action: 'CHECK_FRIDGE' }
    );
  },

  // Check fridge expiries and notify (called by scheduled notification or manually)
  async notifyFridgeExpiries() {
    const user = await AuthService.getCurrentUser();
    if (!user) return [];

    const items = await fridgeItemsService.getFridgeItems(user.id);
    const now = new Date();
    const soon = new Date();
    soon.setDate(now.getDate() + 3);

    const expiring = (items || []).filter((it: any) => it.expiry_date && new Date(it.expiry_date) <= soon);
    if (!expiring.length) return [];

    const top3 = expiring
      .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
      .slice(0, 3);
    const list = top3.map((i: any) => `${i.name} (${new Date(i.expiry_date).toLocaleDateString()})`).join(', ');

    // Send immediate notification (not scheduled)
    return await this.schedule(
      'fridge_expiry',
      'Ingredienti in scadenza',
      `Stanno per scadere: ${list}. Vuoi una ricetta?`,
      { secondsFromNow: 1 },
      { screen: 'food', action: 'OPEN_FRIDGE_RECIPES' }
    );
  },

  async scheduleHydrationReminders() {
    // Every 2-3 hours during active hours (9:00-21:00)
    const ids: string[] = [];
    const hours = [9, 11, 14, 16, 18, 20];
    for (const hour of hours) {
      ids.push(
        await this.schedule(
          'hydration_reminder',
          '💧 Idratazione',
          'Ricorda di bere un bicchiere d\'acqua!',
          { hour, minute: 0, repeats: true },
          { screen: 'hydration' }
        )
      );
    }
    return ids;
  },

  async scheduleMorningGreeting() {
    // Daily at 8:00
    return this.schedule(
      'morning_greeting',
      'Buongiorno! ☀️',
      'Come ti senti oggi? Inizia la giornata con un check del benessere',
      { hour: 8, minute: 0, repeats: true },
      { screen: 'home' }
    );
  },

  async scheduleEveningWinddown() {
    // Daily at 22:00
    return this.schedule(
      'evening_winddown',
      'Buona serata 🌙',
      'Preparati per il riposo. Vuoi scrivere nel diario o fare una breve meditazione?',
      { hour: 22, minute: 0, repeats: true },
      { screen: 'journal' }
    );
  },

  async scheduleSleepPreparation() {
    // Daily 1 hour before average bedtime (default 23:00, so 22:00)
    return this.schedule(
      'sleep_preparation',
      'Preparati per dormire 😴',
      'È quasi ora di andare a letto. Spegni gli schermi e rilassati',
      { hour: 22, minute: 30, repeats: true },
      { screen: 'breathing' }
    );
  },

  // Dynamic notifications (call when events happen)
  async notifyGoalProgress(metric: 'calories' | 'protein' | 'carbs' | 'fats', current: number, target: number) {
    const percent = Math.round((current / target) * 100);
    if (percent >= 75 && percent < 100) {
      return this.schedule(
        'goal_progress',
        'Obiettivo in arrivo! 🎯',
        `Hai raggiunto il ${percent}% del tuo obiettivo ${metric === 'calories' ? 'calorico' : metric === 'protein' ? 'proteico' : metric === 'carbs' ? 'di carboidrati' : 'di grassi'} oggi!`,
        { secondsFromNow: 1 },
        { screen: 'food', metric }
      );
    }
    return null;
  },

  async notifyStreak(streakType: 'journal' | 'analysis', days: number) {
    if (days % 7 === 0 && days > 0) {
      return this.schedule(
        'streak_celebration',
        `Streak di ${days} giorni! 🎉`,
        `Incredibile! Hai mantenuto la tua abitudine per ${days} giorni consecutivi. Continua così!`,
        { secondsFromNow: 1 },
        { screen: streakType === 'journal' ? 'journal' : 'analysis' }
      );
    }
    return null;
  },

  // Bundle of defaults - schedules all notifications at their specific times
  async scheduleDefaults() {
    await this.initialize();
    const ids: string[] = [];
    ids.push(...(await this.scheduleEmotionSkinWeekly()));
    ids.push(await this.scheduleDiaryDaily());
    ids.push(...(await this.scheduleBreathingNudges()));
    ids.push(...(await this.scheduleHydrationReminders()));
    ids.push(await this.scheduleMorningGreeting());
    ids.push(await this.scheduleEveningWinddown());
    ids.push(await this.scheduleSleepPreparation());
    ids.push(await this.scheduleFridgeExpiryCheck()); // Daily check at 18:00
    return ids;
  },

  // Cancel all scheduled notifications
  async cancelAll() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      await this.cancel(notif.identifier);
    }
    // Cancella il flag quando tutte le notifiche vengono cancellate
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem('@notifications_scheduled');
    } catch (error) {
      // Ignora errori se AsyncStorage non è disponibile
    }
  },
};


