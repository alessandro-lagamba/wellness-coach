// @ts-nocheck
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// 👇 Idempotenza: util per "unique scheduling"
const UNIQUE_KEY = 'key';
const DEFAULTS_FLAG = '@notifications:defaults_scheduled';

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
      
      // 🔧 NORMALIZZA e POSTICIPA SE NECESSARIO
      const now = new Date();
      let hour = options.hour!;
      let minute = options.minute!;
      const weekday = options.weekday; // Expo: 1=Mon ... 7=Sun
      
      // cand: oggi all'ora/minuto richiesti
      const cand = new Date(now);
      cand.setSeconds(0, 0);
      cand.setHours(hour, minute, 0, 0);
      
      // Se DAILY e l'orario è già passato/uguale → sposta di 60s (per evitare "now")
      if (!weekday) {
        if (cand.getTime() <= now.getTime()) {
          const bumped = new Date(now.getTime() + 60 * 1000);
          hour = bumped.getHours();
          minute = bumped.getMinutes();
        }
      } else {
        // WEEKLY: se è il giorno giusto ma l'orario è passato/uguale → bump di 60s
        const nowExpoW = (now.getDay() === 0 ? 7 : now.getDay()); // 1..7
        if (nowExpoW === weekday && cand.getTime() <= now.getTime()) {
          const bumped = new Date(now.getTime() + 60 * 1000);
          hour = bumped.getHours();
          minute = bumped.getMinutes();
        }
        // (Se è un giorno diverso, lasciamo a Expo la prossima occorrenza)
      }
      
      // 🔑 Key stabile (includi second=0)
      const key = weekday
        ? `${baseKey}:${weekday}:${hour}:${minute}:s0`
        : `${baseKey}:daily:${hour}:${minute}:s0`;
      
      // 🔔 Trigger con second fissato a 0
      const trigger: Notifications.DailyTriggerInput | Notifications.WeeklyTriggerInput = weekday
        ? { hour, minute, second: 0, weekday, repeats }
        : { hour, minute, second: 0, repeats };
      
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
      const trigger: Notifications.TimeIntervalTriggerInput = {
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
    
    return scheduleUnique(`${baseKey}:now:${Date.now()}`, { content, trigger: null });
  },

  async cancel(id: string) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  },

  // Presets
  // ⚠️ NOTA: Expo weekday: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  async scheduleEmotionSkinWeekly() {
    // Default: Tue (2) and Fri (5) at 19:00
    const ids: string[] = [];
    ids.push(
      await this.schedule(
        'emotion_skin_reminder',
        'Analisi benessere',
        'È ora di fare un check su emozioni o pelle ✨',
        { hour: 19, minute: 0, weekday: 2, repeats: true }, // Tuesday
        { screen: 'analysis' }
      )
    );
    ids.push(
      await this.schedule(
        'emotion_skin_reminder',
        'Analisi benessere',
        'Piccolo promemoria per la tua analisi 🧘‍♀️',
        { hour: 19, minute: 0, weekday: 5, repeats: true }, // Friday
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
    // ⚠️ NOTA: Expo weekday: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    const ids: string[] = [];
    for (const weekday of [1, 2, 3, 4, 5]) { // Monday to Friday
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

    // Send immediate notification (not scheduled) - debounced con ritardo randomizzato per evitare valanghe
    const delay = 15_000 + Math.floor(Math.random() * 10_000); // 15-25 secondi
    setTimeout(async () => {
      await this.schedule(
        'fridge_expiry',
        'Ingredienti in scadenza',
        `Stanno per scadere: ${list}. Vuoi una ricetta?`,
        { secondsFromNow: 1 },
        { screen: 'food', action: 'OPEN_FRIDGE_RECIPES' }
      );
    }, delay);
    
    return null; // Non ritorniamo l'ID perché è asincrono
  },

  async scheduleHydrationReminders() {
    // ✅ OPTIMIZED: Reduced from 6 to 4 reminders per day (less invasive)
    // Strategic times: morning, lunch, afternoon, evening
    const ids: string[] = [];
    const hours = [9, 13, 17, 20]; // Reduced from [9, 11, 14, 16, 18, 20]
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
    // ✅ OPTIMIZED: Unified evening winddown and sleep preparation into one notification
    // Daily at 22:00 - combines journal reminder and sleep preparation
    return this.schedule(
      'evening_winddown',
      'Buona serata 🌙',
      'Preparati per il riposo. Vuoi scrivere nel diario o fare una breve meditazione?',
      { hour: 22, minute: 0, repeats: true },
      { screen: 'journal' }
    );
  },

  // ⚠️ DEPRECATED: scheduleSleepPreparation - now unified with scheduleEveningWinddown
  // Keeping for backward compatibility but not scheduling by default
  async scheduleSleepPreparation() {
    // This is now handled by scheduleEveningWinddown to avoid duplicate notifications
    // Daily 1 hour before average bedtime (default 23:00, so 22:00)
    // ⚠️ NOTE: This is NOT called in scheduleDefaults() anymore
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
  // Protegge da duplicazioni: non viene rilanciato se già eseguito (persistente in AsyncStorage)
  async scheduleDefaults() {
    await this.initialize();
    
    // 1) Controllo persistente (sopravvive ai riavvii)
    const persisted = await AsyncStorage.getItem(DEFAULTS_FLAG);
    if (persisted === '1' || defaultsScheduled) {
      debug('Defaults already scheduled, skipping');
      return [];
    }
    
    // 2) Segna subito (best-effort) per evitare race conditions
    defaultsScheduled = true;
    await AsyncStorage.setItem(DEFAULTS_FLAG, '1');
    
    debug('Scheduling defaults...');
    const ids: string[] = [];
    ids.push(...(await this.scheduleEmotionSkinWeekly()));
    ids.push(await this.scheduleDiaryDaily());
    ids.push(...(await this.scheduleBreathingNudges()));
    ids.push(...(await this.scheduleHydrationReminders()));
    ids.push(await this.scheduleMorningGreeting());
    ids.push(await this.scheduleEveningWinddown());
    // ✅ OPTIMIZED: Removed scheduleSleepPreparation - now unified with scheduleEveningWinddown
    ids.push(await this.scheduleFridgeExpiryCheck()); // Daily check at 18:00
    
    debug('Defaults scheduled:', ids.length, 'notifications');
    return ids;
  },

  // Cancel all scheduled notifications
  async cancelAll() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      await this.cancel(notif.identifier);
    }
    // Reset flag quando tutte le notifiche vengono cancellate (sia in RAM che persistente)
    defaultsScheduled = false;
    await AsyncStorage.removeItem(DEFAULTS_FLAG);
    debug('All notifications cancelled, flag reset');
  },
};


