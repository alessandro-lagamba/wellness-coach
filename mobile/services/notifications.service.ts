// @ts-nocheck
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fridgeItemsService } from './fridge-items.service';
import { AuthService } from './auth.service';
import i18n from '../i18n';

export type NotificationCategory =
  | 'daily_check_in' // Renamed from emotion_skin_reminder
  | 'journal_reminder'
  | 'breathing_break'
  | 'hydration_reminder'
  | 'morning_greeting'
  | 'daily_copilot'
  | 'meal_reminder';

export interface ScheduleOptions {
  // For time-based triggers
  hour?: number; // 0-23
  minute?: number; // 0-59
  weekday?: number; // 1-7 (Mon=1) for weekly triggers
  repeats?: boolean;

  // For relative triggers
  secondsFromNow?: number;
}

// 👇 Idempotenza: util per "unique scheduling"
const UNIQUE_KEY = 'key';
const DEFAULTS_FLAG = '@notifications:defaults_scheduled';
const PREFERENCES_KEY = '@notifications:preferences';

export interface NotificationPreferences {
  dailyCheckIn: boolean; // Renamed from emotionSkin
  diary: boolean;
  breathing: boolean;
  hydration: boolean;
  morningGreeting: boolean;
  mealReminder: boolean;
  diaryTime?: { hour: number; minute: number };
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  dailyCheckIn: true,
  diary: true,
  breathing: true, // Changed default to true as it's less spammy now
  hydration: true,
  morningGreeting: true,
  mealReminder: true,
  diaryTime: { hour: 21, minute: 30 }
};

// Debug helper (opzionale, attiva solo in dev se necessario)
const DEBUG_NOTIF = __DEV__ && false;
const debug = (...args: any[]) => DEBUG_NOTIF && console.log('[Notif]', ...args);

// Trova una notifica già schedulata con la stessa key
async function findScheduledByKey(key: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.find(n => n?.content?.data?.[UNIQUE_KEY] === key);
}

// Trova notifiche simili (stessa categoria) entro una finestra di tempo
// Utile per coalescenza delle one-shot (goal/streak/fridge)
async function findSimilarScheduled(category: NotificationCategory, withinMinutes = 10) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const now = Date.now();
  const soon = withinMinutes * 60 * 1000;

  return all.find(n => {
    const sameCategory = n?.content?.data?.category === category;
    if (!sameCategory) return false;

    // I trigger di tipo "time interval" non espongono la data, quindi usiamo la nostra chiave
    const k = n?.content?.data?.[UNIQUE_KEY];

    // Se la chiave contiene un timestamp, valutiamo la finestra (vicinanza di SCHEDULE-TIME)
    if (k && typeof k === 'string') {
      const parts = k.split(':');
      const ts = Number(parts[parts.length - 1]); // timestamp generato al momento del schedule
      if (!Number.isNaN(ts)) {
        // Coalesciamo se la SCHEDULE-TIME di una notifica simile è entro la finestra
        if (Math.abs(now - ts) <= soon) return true;
      }
    }

    // Fallback: già ce n'è una del tipo (per notifiche immediate/relative)
    return true;
  });
}

// Schedula in modo idempotente
async function scheduleUnique(key: string, args: Parameters<typeof Notifications.scheduleNotificationAsync>[0]) {
  const existing = await findScheduledByKey(key);
  if (existing) {
    debug('Already scheduled:', key, existing.identifier);
    return existing.identifier; // già schedulata
  }

  // imbusta la key nel data.content
  args.content = {
    ...(args.content || {}),
    data: { ...(args.content?.data || {}), [UNIQUE_KEY]: key },
  };

  const id = await Notifications.scheduleNotificationAsync(args);
  debug('Scheduled:', key, id);
  return id;
}

// Flag per evitare duplicazioni in scheduleDefaults()
let defaultsScheduled = false;

export const NotificationService = {
  async getPermissionStatus(): Promise<boolean> {
    try {
      const settings = await Notifications.getPermissionsAsync();
      return (
        settings.granted ||
        settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      );
    } catch (error) {
      console.error('[NotificationService] ❌ Error checking permission status:', error);
      return false;
    }
  },

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
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Could not set lockscreenVisibility, using default channel config:', error);
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

    const baseKey = `${category}`;

    // Time-based (specific hour/minute, optional weekday)
    if (options.hour !== undefined && options.minute !== undefined) {
      const repeats = options.repeats ?? true;

      // 🔧 FIX #2: USA SEMPRE L'ORARIO ORIGINALE NELLA CHIAVE
      // Expo Notifications gestisce automaticamente le notifiche passate (le schedula per il giorno successivo)
      // Non serve "bumpare" l'orario manualmente - questo causava chiavi diverse e duplicazioni
      const originalHour = options.hour;
      const originalMinute = options.minute;
      const weekday = options.weekday; // Expo: 1=Mon ... 7=Sun

      // 🔑 Key stabile con orario ORIGINALE (sempre uguale, indipendentemente da quando viene chiamato)
      const key = weekday
        ? `${baseKey}:${weekday}:${originalHour}:${originalMinute}:s0`
        : `${baseKey}:daily:${originalHour}:${originalMinute}:s0`;

      // 🔔 Trigger con orario ORIGINALE e second fissato a 0
      const trigger = weekday
        ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          hour: originalHour,
          minute: originalMinute,
          second: 0,
          weekday,
          repeats
        }
        : {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: originalHour,
          minute: originalMinute,
          second: 0,
          repeats
        };

      return scheduleUnique(key, { content, trigger });
    }

    // Relative time
    if (options.secondsFromNow !== undefined) {
      // Coalescenza: evita spam se ci sono già notifiche simili in coda
      const existing = await findSimilarScheduled(category, 10);
      if (existing) {
        debug('Coalesced relative notification:', category, existing.identifier);
        return existing.identifier;
      }

      const key = `${baseKey}:in:${Math.max(1, options.secondsFromNow)}s:${Date.now()}`;
      const trigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, options.secondsFromNow),
        repeats: options.repeats ?? false,
      };
      return scheduleUnique(key, { content, trigger });
    }

    // Immediate
    // Coalescenza: evita spam se ci sono già notifiche simili in coda
    const existing = await findSimilarScheduled(category, 10);
    if (existing) {
      debug('Coalesced immediate notification:', category, existing.identifier);
      return existing.identifier;
    }

    // 🔧 FIX: trigger deve avere type esplicito per expo-notifications 0.32+
    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      repeats: false,
    };
    return scheduleUnique(`${baseKey}:now:${Date.now()}`, { content, trigger });
  },

  async cancel(id: string) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch { }
  },

  // Presets
  // ⚠️ NOTA: Expo weekday: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun

  // 🔥 UPDATED: Replaces scheduleEmotionSkinWeekly
  // Daily at 13:30 with custom text
  async scheduleDailyCheckIn() {
    return this.schedule(
      'daily_check_in',
      i18n.t('notifications.content.dailyCheckIn.title', { defaultValue: 'Analisi benessere' }),
      i18n.t('notifications.content.dailyCheckIn.body', { defaultValue: 'Ricordati di fare il tuo check giornaliero! ✨' }),
      { hour: 13, minute: 30, repeats: true },
      { screen: 'analysis' }
    );
  },

  async scheduleDiaryDaily() {
    // Default: daily 21:30
    return this.schedule(
      'journal_reminder',
      i18n.t('notifications.content.diary.title', { defaultValue: 'Diario' }),
      i18n.t('notifications.content.diary.body', { defaultValue: 'Ti va di scrivere una breve voce nel diario?' }),
      { hour: 21, minute: 30, repeats: true },
      { screen: 'journal' }
    );
  },

  // 🔥 UPDATED: Single daily breathing notification, no meditation logic
  async scheduleBreathingNudges() {
    // Weekdays at 16:00 (single)
    // ⚠️ NOTA: Expo weekday: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
    const ids: string[] = [];
    for (const weekday of [1, 2, 3, 4, 5]) { // Monday to Friday
      ids.push(
        await this.schedule(
          'breathing_break',
          i18n.t('notifications.content.breathing.title', { defaultValue: 'Pausa respiro' }),
          i18n.t('notifications.content.breathing.body', { defaultValue: 'Prenditi 1 minuto per respirare profondamente 🌬️' }),
          { hour: 16, minute: 0, weekday, repeats: true },
          { screen: 'breathing' }
        )
      );
    }
    return ids;
  },

  async scheduleDailyCopilot(hour: number = 18, minute: number = 0) {
    // Prima cancella eventuali notifiche della stessa categoria per evitare doppioni
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const existing = all.filter(n => n.content.data?.category === 'daily_copilot');
    for (const n of existing) {
      await this.cancel(n.identifier);
    }

    return this.schedule(
      'daily_copilot',
      i18n.t('notifications.content.dailyCopilot.title', { defaultValue: 'Daily Copilot: Il tuo piano 🎯' }),
      i18n.t('notifications.content.dailyCopilot.body', { defaultValue: 'Le tue raccomandazioni per domani sono pronte! Scopri come ottimizzare la tua giornata. 💡' }),
      { hour, minute, repeats: true },
      { screen: 'home', tab: 'dashboard' }
    );
  },

  async scheduleMorningGreeting() {
    // Daily at 8:00
    return this.schedule(
      'morning_greeting',
      i18n.t('notifications.content.morningGreeting.title', { defaultValue: 'Buongiorno! ☀️' }),
      i18n.t('notifications.content.morningGreeting.body', { defaultValue: 'Come ti senti oggi? Inizia la giornata con un check del benessere' }),
      { hour: 8, minute: 0, repeats: true },
      { screen: 'home' }
    );
  },

  async scheduleMealReminder() {
    return this.schedule(
      'meal_reminder',
      i18n.t('notifications.content.mealReminder.title', { defaultValue: '🍽️ Promemoria Pasto' }),
      i18n.t('notifications.content.mealReminder.body', { defaultValue: 'È ora di inserire il tuo pasto! Ricorda di aggiungere un pasto alla tua pianificazione. 🥗' }),
      { hour: 13, minute: 0, repeats: true },
      { screen: 'nutrients' }
    );
  },

  // 🔥 NEW: Reschedule all notifications with updated language
  async updateLocalization() {
    try {
      const hasPermission = await this.getPermissionStatus();
      if (!hasPermission) return;

      // 1. Get current preferences
      const saved = await AsyncStorage.getItem(PREFERENCES_KEY);
      const preferences: NotificationPreferences = saved
        ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) }
        : DEFAULT_PREFERENCES;

      // 2. Cancel all scheduled notifications to avoid duplicates/wrong language
      // Note: This cancels ALL notifications from the app.
      // If there are specific ones we want to keep (e.g. pending alarms), we should filter.
      // But for language switch, a full reset is safer and cleaner.
      await Notifications.cancelAllScheduledNotificationsAsync();

      // 3. Reschedule active ones
      if (preferences.dailyCheckIn) await this.scheduleDailyCheckIn();
      if (preferences.diary) await this.scheduleDiaryDaily();
      if (preferences.breathing) await this.scheduleBreathingNudges(); // Includes weekday logic
      if (preferences.hydration) await this.scheduleHydrationReminders();
      if (preferences.morningGreeting) await this.scheduleMorningGreeting();
      if (preferences.mealReminder) await this.scheduleMealReminder();
      // Daily Copilot is usually triggered by analysis, but if we have a default daily schedule logic:
      await this.scheduleDailyCopilot();

      console.log('[NotificationService] ✅ Notifications updated with new language');
    } catch (error) {
      console.error('[NotificationService] ❌ Error updating localization:', error);
    }
  },


  // Preferences Management
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const saved = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[NotificationService] Failed to load preferences:', e);
    }
    return DEFAULT_PREFERENCES;
  },

  async savePreferences(prefs: Partial<NotificationPreferences>) {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...prefs };
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('[NotificationService] Failed to save preferences:', e);
      throw e;
    }
  },

  /**
   * Sincronizza le notifiche schedulate con le preferenze dell'utente.
   * Cancella tutto e rischedula solo ciò che è abilitato.
   */
  async sync() {
    debug('Syncing notifications with preferences...');
    const prefs = await this.getPreferences();
    await this.cancelAll();

    // Segnamo come "defaults scheduled" per evitare che scheduleDefaults sovrascriva tutto
    await AsyncStorage.setItem(DEFAULTS_FLAG, '1');
    defaultsScheduled = true;

    const ids: string[] = [];

    // 🔥 UPDATED: Schedule daily check-in instead of weekly emotion/skin
    if (prefs.dailyCheckIn) ids.push(await this.scheduleDailyCheckIn());

    if (prefs.diary && prefs.diaryTime) {
      ids.push(await this.schedule(
        'journal_reminder',
        'Diario',
        'Ti va di scrivere una breve voce nel diario?',
        { hour: prefs.diaryTime.hour, minute: prefs.diaryTime.minute, repeats: true },
        { screen: 'journal' }
      ));
    }

    if (prefs.breathing) ids.push(...(await this.scheduleBreathingNudges()));
    if (prefs.hydration) ids.push(...(await this.scheduleHydrationReminders()));
    if (prefs.morningGreeting) ids.push(await this.scheduleMorningGreeting());
    if (prefs.mealReminder) ids.push(await this.scheduleMealReminder());

    // Daily Copilot - recupera orario
    try {
      const { AuthService } = await import('./auth.service');
      const user = await AuthService.getCurrentUser();
      let preferredHour = 18;
      if (user) {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase
          .from('user_profiles')
          .select('recommendation_time')
          .eq('id', user.id)
          .maybeSingle();
        preferredHour = data?.recommendation_time ?? 18;
      }
      ids.push(await this.scheduleDailyCopilot(preferredHour, 0));
    } catch (e) {
      console.warn('[NotificationService] Failed to schedule Daily Copilot with custom time during sync, using default:', e);
      ids.push(await this.scheduleDailyCopilot(18, 0));
    }

    debug('Sync complete. Scheduled:', ids.length);
    return ids;
  },

  // Bundle of defaults
  async scheduleDefaults() {
    await this.initialize();

    const persisted = await AsyncStorage.getItem(DEFAULTS_FLAG);
    if (persisted === '1' || defaultsScheduled) {
      debug('Defaults already scheduled, skipping');
      return [];
    }

    return this.sync();
  },

  // Cancel all scheduled notifications
  async cancelAll() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      await this.cancel(notif.identifier);
    }
    defaultsScheduled = false;
    await AsyncStorage.removeItem(DEFAULTS_FLAG);
    debug('All notifications cancelled, flag reset');
  },
};
