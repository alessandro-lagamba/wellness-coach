import { supabase, Tables } from '../lib/supabase';
import { HealthDataService } from './health-data.service';
import { HealthDataSyncService } from './health-data-sync.service';
import { HealthData as RealHealthData } from '../types/health.types';

export interface WidgetData {
  id: string;
  title: string;
  icon: string; // Fallback emoji if no iconImage
  iconImage?: number; // require() result for custom PNG icon
  value: string;
  subtitle: string;
  progress?: number; // 0-100
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color: string;
  backgroundColor: string; // Light background color for widget
  size: 'small' | 'medium' | 'large'; // 1/3, 2/3, 3/3
  category: 'health' | 'wellness' | 'analysis';
  details?: any; // Additional data for each widget
}

export interface HealthData {
  steps: number;
  hydration: number; // glasses of water
  mindfulnessMinutes: number;
  hrv: number;
  restingHR: number;
  sleepHours: number;
  sleepQuality: number; // 0-100
  analysesCompleted: number;
  analysesGoal: number;
}

export class TodayGlanceService {
  /**
   * Get health data from device or fallback to mock
   */
  private static async getHealthData(): Promise<HealthData> {
    try {
      const healthService = HealthDataService.getInstance();

      // 🔥 CRITICO: Verifica se ci sono permessi concessi prima di sincronizzare
      const permissions = healthService.getPermissions();
      const hasAnyPermission = Object.values(permissions).some(Boolean);

      // 🔥 Se ci sono permessi concessi, forza la sincronizzazione
      const syncResult = await healthService.syncHealthData(hasAnyPermission);

      if (syncResult.success && syncResult.data) {
        // 🔥 Verifica che i dati siano reali (non mock) controllando se hanno valori significativi
        const hasRealData = (syncResult.data.steps && syncResult.data.steps > 0) ||
          (syncResult.data.heartRate && syncResult.data.heartRate > 0) ||
          (syncResult.data.sleepHours && syncResult.data.sleepHours > 0) ||
          (syncResult.data.hrv && syncResult.data.hrv > 0);

        // 🔥 SOLO se i dati sono reali, convertili e restituiscili
        if (hasRealData) {
          const realData = syncResult.data;
          return {
            steps: realData.steps,
            hydration: Math.round(realData.hydration / 250), // Convert ml to glasses
            mindfulnessMinutes: realData.mindfulnessMinutes || 0,
            hrv: realData.hrv,
            restingHR: realData.restingHeartRate,
            sleepHours: realData.sleepHours,
            sleepQuality: realData.sleepQuality,
            analysesCompleted: 0, // This will be fetched separately
            analysesGoal: 2,
          };
        }

        // 🔥 Se i permessi sono concessi ma i dati sono mock, prova a ottenere l'ultimo dato reale
        if (hasAnyPermission) {
          const latestData = await healthService.getLatestSyncedHealthData();
          if (latestData.data) {
            const hasRealLatestData = (latestData.data.steps && latestData.data.steps > 0) ||
              (latestData.data.heartRate && latestData.data.heartRate > 0) ||
              (latestData.data.sleepHours && latestData.data.sleepHours > 0) ||
              (latestData.data.hrv && latestData.data.hrv > 0);

            if (hasRealLatestData) {
              return {
                steps: latestData.data.steps,
                hydration: Math.round(latestData.data.hydration / 250),
                mindfulnessMinutes: latestData.data.mindfulnessMinutes || 0,
                hrv: latestData.data.hrv,
                restingHR: latestData.data.restingHeartRate,
                sleepHours: latestData.data.sleepHours,
                sleepQuality: latestData.data.sleepQuality,
                analysesCompleted: 0,
                analysesGoal: 2,
              };
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get real health data:', error);
    }

    // 🔥 SOLO se NON ci sono permessi concessi, usa i mock
    // Se ci sono permessi concessi, restituisci dati vuoti invece di mock
    try {
      const healthService = HealthDataService.getInstance();
      const permissions = healthService.getPermissions();
      const hasAnyPermission = Object.values(permissions).some(Boolean);

      if (hasAnyPermission) {
        // 🔥 Se ci sono permessi ma non ci sono dati, restituisci dati vuoti (non mock)
        return {
          steps: 0,
          hydration: 0,
          mindfulnessMinutes: 0,
          hrv: 0,
          restingHR: 0,
          sleepHours: 0,
          sleepQuality: 0,
          analysesCompleted: 0,
          analysesGoal: 2,
        };
      }
    } catch (error) {
      // Se c'è un errore nel controllo dei permessi, usa i mock come fallback
      console.warn('Error checking permissions, using mock data:', error);
    }

    // Fallback to mock data SOLO se non ci sono permessi concessi
    return this.generateMockHealthData();
  }

  /**
   * Ottiene tutti i dati per i widget "Today at a glance"
   */
  static async getTodayGlanceData(userId: string): Promise<WidgetData[]> {
    try {
      // Try to get real health data first, fallback to mock if needed
      const healthData = await this.getHealthData();

      return [
        // Riga 1: steps, meditation, hydration
        {
          id: 'steps',
          title: 'Steps',
          icon: '🪜',
          iconImage: require('../assets/images/widgets_logos/steps.png'),
          value: healthData.steps.toLocaleString(),
          subtitle: `Goal: ${10000}`,
          progress: Math.min((healthData.steps / 10000) * 100, 100),
          trend: healthData.steps > 8000 ? 'up' : 'stable',
          trendValue: '+12%',
          color: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)', // Light green
          size: 'small',
          category: 'health',
          details: {
            goal: 10000,
            km: Math.round(healthData.steps * 0.0008 * 100) / 100,
            calories: Math.round(healthData.steps * 0.04),
            avgSteps: 8500
          }
        },
        {
          id: 'mindfulness',
          title: 'Meditation',
          icon: '🧘',
          iconImage: require('../assets/images/widgets_logos/meditation.png'),
          value: `${healthData.mindfulnessMinutes}m`,
          subtitle: `Goal: ${30}m`,
          progress: Math.min((healthData.mindfulnessMinutes / 30) * 100, 100),
          trend: healthData.mindfulnessMinutes > 15 ? 'up' : 'stable',
          trendValue: '+5m',
          color: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.08)', // Light purple
          size: 'medium',
          category: 'wellness',
          details: {
            goal: 30,
            sessions: 2,
            streak: 5,
            favoriteType: 'Breathing'
          }
        },
        {
          id: 'hydration',
          title: 'Hydration',
          icon: '💧',
          iconImage: require('../assets/images/widgets_logos/hydration.png'),
          value: `${healthData.hydration}`,
          subtitle: 'glasses',
          progress: (healthData.hydration / 8) * 100,
          trend: healthData.hydration >= 6 ? 'up' : 'stable',
          trendValue: '+1',
          color: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.08)', // Light blue
          size: 'small',
          category: 'health',
          details: {
            goal: 8,
            ml: healthData.hydration * 250,
            lastDrink: '2h ago'
          }
        },
        // Riga 2: Sleep, HRV, analysis check in
        {
          id: 'sleep',
          title: 'Sleep',
          icon: '🌙',
          iconImage: require('../assets/images/widgets_logos/sleep.png'),
          value: `${healthData.sleepHours}h`,
          subtitle: `${healthData.sleepQuality}% quality`,
          progress: healthData.sleepQuality,
          trend: healthData.sleepHours >= 7 ? 'up' : 'down',
          trendValue: healthData.sleepHours >= 7 ? '+0.5h' : '-0.5h',
          color: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.08)', // Light indigo
          size: 'large',
          category: 'health',
          details: {
            goal: 8,
            deepSleep: '2h 15m',
            remSleep: '1h 45m',
            lightSleep: '4h 30m',
            bedtime: '11:30 PM',
            wakeTime: '7:30 AM'
          }
        },
        {
          id: 'hrv',
          title: 'HRV',
          icon: '🫀',
          iconImage: require('../assets/images/widgets_logos/hrv.png'),
          value: `${healthData.hrv}ms`,
          subtitle: `HR: ${healthData.restingHR}bpm`,
          progress: Math.min((healthData.hrv / 50) * 100, 100),
          trend: healthData.hrv > 30 ? 'up' : 'stable',
          trendValue: '+2ms',
          color: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)', // Light red
          size: 'small',
          category: 'health',
          details: {
            avgHRV: 35,
            restingHR: healthData.restingHR,
            maxHR: 180,
            recovery: 'Good'
          }
        },
        {
          id: 'analyses',
          title: 'Check-In',
          icon: '📊',
          value: healthData.analysesCompleted > 0 ? 'Done' : 'Pending',
          subtitle: 'Today',
          progress: healthData.analysesCompleted > 0 ? 100 : 0,
          trend: healthData.analysesCompleted > 0 ? 'up' : 'stable',
          trendValue: healthData.analysesCompleted > 0 ? '✓' : '!',
          color: healthData.analysesCompleted > 0 ? '#10b981' : '#f59e0b',
          backgroundColor: healthData.analysesCompleted > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          size: 'small',
          category: 'analysis',
          details: {
            completed: healthData.analysesCompleted,
            goal: healthData.analysesGoal,
            lastAnalysis: healthData.analysesCompleted > 0 ? '2h ago' : 'Yesterday',
            streak: 3
          }
        }
      ];
    } catch (error) {
      console.error('Error getting today glance data:', error);
      return [];
    }
  }

  /**
   * Genera dati mock per i widget (da sostituire con dati reali)
   */
  private static async generateMockHealthData(): Promise<HealthData> {
    // Simula dati realistici per il giorno corrente
    const currentHour = new Date().getHours();

    return {
      steps: Math.floor(Math.random() * 3000) + (currentHour > 12 ? 5000 : 2000), // Più passi se è pomeriggio
      hydration: Math.min(Math.floor(Math.random() * 3) + (currentHour > 10 ? 3 : 1), 8),
      mindfulnessMinutes: Math.floor(Math.random() * 20) + 5,
      hrv: Math.floor(Math.random() * 20) + 25,
      restingHR: Math.floor(Math.random() * 20) + 60,
      sleepHours: Math.floor(Math.random() * 2) + 7,
      sleepQuality: Math.floor(Math.random() * 30) + 70,
      analysesCompleted: Math.floor(Math.random() * 2) + 1,
      analysesGoal: 3
    };
  }

  /**
   * Rimuove un bicchiere d'acqua (250ml) dai dati di idratazione di oggi
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  static async removeWaterGlass(userId: string): Promise<{ success: boolean; error?: string; newHydration?: number }> {
    // 🔥 Use the batch function for a single glass
    return this.removeWaterGlasses(userId, 1);
  }

  /**
   * Rimuove più bicchieri d'acqua in una singola operazione
   * @param quantity - Numero di bicchieri da rimuovere
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  static async removeWaterGlasses(userId: string, quantity: number): Promise<{ success: boolean; error?: string; newHydration?: number }> {
    try {
      const { supabase } = await import('../lib/supabase');
      const { HealthDataSyncService } = await import('./health-data-sync.service');
      const { HealthDataService } = await import('./health-data.service');

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const GLASS_SIZE_ML = 250; // Un bicchiere standard è 250ml

      // Recupera i dati di salute attuali per oggi
      const { data: existingData } = await supabase
        .from('health_data')
        .select('hydration, steps, distance, calories, active_minutes, heart_rate, resting_heart_rate, hrv, sleep_hours, sleep_quality, deep_sleep_minutes, rem_sleep_minutes, light_sleep_minutes, mindfulness_minutes')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      // 🔥 Calcola la nuova idratazione (rimuovi tutti i bicchieri richiesti, minimo 0)
      const currentHydration = existingData?.hydration || 0;
      const newHydration = Math.max(0, currentHydration - (GLASS_SIZE_ML * quantity));

      // Se l'idratazione è già 0, non fare nulla
      if (currentHydration === 0) {
        return {
          success: false,
          error: 'Nessun bicchiere da rimuovere',
        };
      }

      // Recupera tutti i dati di salute attuali (o usa valori di default)
      const healthService = HealthDataService.getInstance();
      const currentHealthData = await healthService.getLatestSyncedHealthData();

      // Prepara i dati per il sync (preserva tutti i valori esistenti e aggiorna solo hydration)
      const healthDataToSync = {
        steps: existingData?.steps ?? currentHealthData.data?.steps ?? 0,
        distance: existingData?.distance ?? currentHealthData.data?.distance ?? 0,
        calories: existingData?.calories ?? currentHealthData.data?.calories ?? 0,
        activeMinutes: existingData?.active_minutes ?? currentHealthData.data?.activeMinutes ?? 0,
        heartRate: existingData?.heart_rate ?? currentHealthData.data?.heartRate ?? 0,
        restingHeartRate: existingData?.resting_heart_rate ?? currentHealthData.data?.restingHeartRate ?? 0,
        hrv: existingData?.hrv ?? currentHealthData.data?.hrv ?? 0,
        sleepHours: existingData?.sleep_hours ?? currentHealthData.data?.sleepHours ?? 0,
        sleepQuality: existingData?.sleep_quality ?? currentHealthData.data?.sleepQuality ?? 0,
        deepSleepMinutes: existingData?.deep_sleep_minutes ?? currentHealthData.data?.deepSleepMinutes ?? 0,
        remSleepMinutes: existingData?.rem_sleep_minutes ?? currentHealthData.data?.remSleepMinutes ?? 0,
        lightSleepMinutes: existingData?.light_sleep_minutes ?? currentHealthData.data?.lightSleepMinutes ?? 0,
        hydration: newHydration, // 🔥 Aggiorna con il nuovo valore totale
        mindfulnessMinutes: existingData?.mindfulness_minutes ?? currentHealthData.data?.mindfulnessMinutes ?? 0,
      };

      // Sincronizza i dati aggiornati nel database
      const syncService = HealthDataSyncService.getInstance();
      const syncResult = await syncService.syncHealthData(userId, healthDataToSync);

      if (syncResult.success) {
        return {
          success: true,
          newHydration,
        };
      } else {
        return {
          success: false,
          error: syncResult.error || 'Errore durante il salvataggio',
        };
      }
    } catch (error) {
      console.error('❌ Error removing water glasses:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Aggiunge un bicchiere d'acqua (250ml) ai dati di idratazione di oggi
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  static async addWaterGlass(userId: string): Promise<{ success: boolean; error?: string; newHydration?: number }> {
    // 🔥 Use the batch function for a single glass
    return this.addWaterGlasses(userId, 1);
  }

  /**
   * Aggiunge più bicchieri d'acqua in una singola operazione
   * @param quantity - Numero di bicchieri da aggiungere
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  static async addWaterGlasses(userId: string, quantity: number): Promise<{ success: boolean; error?: string; newHydration?: number }> {
    try {
      const { supabase } = await import('../lib/supabase');
      const { HealthDataSyncService } = await import('./health-data-sync.service');
      const { HealthDataService } = await import('./health-data.service');

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const GLASS_SIZE_ML = 250; // Un bicchiere standard è 250ml

      // Recupera i dati di salute attuali per oggi
      const { data: existingData } = await supabase
        .from('health_data')
        .select('hydration, steps, distance, calories, active_minutes, heart_rate, resting_heart_rate, hrv, sleep_hours, sleep_quality, deep_sleep_minutes, rem_sleep_minutes, light_sleep_minutes, mindfulness_minutes')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      // 🔥 Calcola la nuova idratazione (aggiungi tutti i bicchieri in una volta)
      const currentHydration = existingData?.hydration || 0;
      const newHydration = currentHydration + (GLASS_SIZE_ML * quantity);

      // Recupera tutti i dati di salute attuali (o usa valori di default)
      const healthService = HealthDataService.getInstance();
      const currentHealthData = await healthService.getLatestSyncedHealthData();

      // Prepara i dati per il sync (preserva tutti i valori esistenti e aggiorna solo hydration)
      const healthDataToSync = {
        steps: existingData?.steps ?? currentHealthData.data?.steps ?? 0,
        distance: existingData?.distance ?? currentHealthData.data?.distance ?? 0,
        calories: existingData?.calories ?? currentHealthData.data?.calories ?? 0,
        activeMinutes: existingData?.active_minutes ?? currentHealthData.data?.activeMinutes ?? 0,
        heartRate: existingData?.heart_rate ?? currentHealthData.data?.heartRate ?? 0,
        restingHeartRate: existingData?.resting_heart_rate ?? currentHealthData.data?.restingHeartRate ?? 0,
        hrv: existingData?.hrv ?? currentHealthData.data?.hrv ?? 0,
        sleepHours: existingData?.sleep_hours ?? currentHealthData.data?.sleepHours ?? 0,
        sleepQuality: existingData?.sleep_quality ?? currentHealthData.data?.sleepQuality ?? 0,
        deepSleepMinutes: existingData?.deep_sleep_minutes ?? currentHealthData.data?.deepSleepMinutes ?? 0,
        remSleepMinutes: existingData?.rem_sleep_minutes ?? currentHealthData.data?.remSleepMinutes ?? 0,
        lightSleepMinutes: existingData?.light_sleep_minutes ?? currentHealthData.data?.lightSleepMinutes ?? 0,
        hydration: newHydration, // 🔥 Aggiorna con il nuovo valore totale
        mindfulnessMinutes: existingData?.mindfulness_minutes ?? currentHealthData.data?.mindfulnessMinutes ?? 0,
      };

      // Sincronizza i dati aggiornati nel database
      const syncService = HealthDataSyncService.getInstance();
      const syncResult = await syncService.syncHealthData(userId, healthDataToSync);

      if (syncResult.success) {
        return {
          success: true,
          newHydration,
        };
      } else {
        return {
          success: false,
          error: syncResult.error || 'Errore durante il salvataggio',
        };
      }
    } catch (error) {
      console.error('❌ Error adding water glasses:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Aggiunge minuti di meditazione
   */
  static async addMeditationMinutes(userId: string, minutes: number): Promise<{ success: boolean; error?: string; newMinutes?: number }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Recupera i dati esistenti per oggi
      const { data: existingData, error: fetchError } = await supabase
        .from('health_data')
        .select('mindfulness_minutes, steps, distance, calories, active_minutes, heart_rate, resting_heart_rate, hrv, sleep_hours, sleep_quality, deep_sleep_minutes, rem_sleep_minutes, light_sleep_minutes, hydration')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, che è ok se non esiste ancora un record
        console.error('❌ Error fetching existing meditation data:', fetchError);
        return {
          success: false,
          error: fetchError.message,
        };
      }

      // Calcola i nuovi minuti di meditazione
      const currentMinutes = existingData?.mindfulness_minutes || 0;
      const newMinutes = currentMinutes + minutes;

      // Recupera tutti i dati di salute attuali (o usa valori di default)
      const healthService = HealthDataService.getInstance();
      const currentHealthData = await healthService.getLatestSyncedHealthData();

      // Prepara i dati per il sync (preserva tutti i valori esistenti e aggiorna solo mindfulness_minutes)
      const healthDataToSync = {
        steps: existingData?.steps ?? currentHealthData.data?.steps ?? 0,
        distance: existingData?.distance ?? currentHealthData.data?.distance ?? 0,
        calories: existingData?.calories ?? currentHealthData.data?.calories ?? 0,
        activeMinutes: existingData?.active_minutes ?? currentHealthData.data?.activeMinutes ?? 0,
        heartRate: existingData?.heart_rate ?? currentHealthData.data?.heartRate ?? 0,
        restingHeartRate: existingData?.resting_heart_rate ?? currentHealthData.data?.restingHeartRate ?? 0,
        hrv: existingData?.hrv ?? currentHealthData.data?.hrv ?? 0,
        sleepHours: existingData?.sleep_hours ?? currentHealthData.data?.sleepHours ?? 0,
        sleepQuality: existingData?.sleep_quality ?? currentHealthData.data?.sleepQuality ?? 0,
        deepSleepMinutes: existingData?.deep_sleep_minutes ?? currentHealthData.data?.deepSleepMinutes ?? 0,
        remSleepMinutes: existingData?.rem_sleep_minutes ?? currentHealthData.data?.remSleepMinutes ?? 0,
        lightSleepMinutes: existingData?.light_sleep_minutes ?? currentHealthData.data?.lightSleepMinutes ?? 0,
        hydration: existingData?.hydration ?? currentHealthData.data?.hydration ?? 0,
        mindfulnessMinutes: newMinutes, // 🔥 Aggiorna con il nuovo valore
      };

      // Sincronizza i dati aggiornati nel database
      const syncService = HealthDataSyncService.getInstance();
      const syncResult = await syncService.syncHealthData(userId, healthDataToSync);

      if (syncResult.success) {
        return {
          success: true,
          newMinutes,
        };
      } else {
        return {
          success: false,
          error: syncResult.error || 'Errore durante il salvataggio',
        };
      }
    } catch (error) {
      console.error('❌ Error adding meditation minutes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Rimuove minuti di meditazione
   */
  static async removeMeditationMinutes(userId: string, minutes: number): Promise<{ success: boolean; error?: string; newMinutes?: number }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Recupera i dati esistenti per oggi
      const { data: existingData, error: fetchError } = await supabase
        .from('health_data')
        .select('mindfulness_minutes, steps, distance, calories, active_minutes, heart_rate, resting_heart_rate, hrv, sleep_hours, sleep_quality, deep_sleep_minutes, rem_sleep_minutes, light_sleep_minutes, hydration')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Error fetching existing meditation data:', fetchError);
        return {
          success: false,
          error: fetchError.message,
        };
      }

      // Calcola i nuovi minuti di meditazione (rimuovi i minuti, minimo 0)
      const currentMinutes = existingData?.mindfulness_minutes || 0;
      const newMinutes = Math.max(0, currentMinutes - minutes);

      // Se i minuti sono già 0, non fare nulla
      if (currentMinutes === 0) {
        return {
          success: true,
          newMinutes: 0,
        };
      }

      // Recupera tutti i dati di salute attuali (o usa valori di default)
      const healthService = HealthDataService.getInstance();
      const currentHealthData = await healthService.getLatestSyncedHealthData();

      // Prepara i dati per il sync (preserva tutti i valori esistenti e aggiorna solo mindfulness_minutes)
      const healthDataToSync = {
        steps: existingData?.steps ?? currentHealthData.data?.steps ?? 0,
        distance: existingData?.distance ?? currentHealthData.data?.distance ?? 0,
        calories: existingData?.calories ?? currentHealthData.data?.calories ?? 0,
        activeMinutes: existingData?.active_minutes ?? currentHealthData.data?.activeMinutes ?? 0,
        heartRate: existingData?.heart_rate ?? currentHealthData.data?.heartRate ?? 0,
        restingHeartRate: existingData?.resting_heart_rate ?? currentHealthData.data?.restingHeartRate ?? 0,
        hrv: existingData?.hrv ?? currentHealthData.data?.hrv ?? 0,
        sleepHours: existingData?.sleep_hours ?? currentHealthData.data?.sleepHours ?? 0,
        sleepQuality: existingData?.sleep_quality ?? currentHealthData.data?.sleepQuality ?? 0,
        deepSleepMinutes: existingData?.deep_sleep_minutes ?? currentHealthData.data?.deepSleepMinutes ?? 0,
        remSleepMinutes: existingData?.rem_sleep_minutes ?? currentHealthData.data?.remSleepMinutes ?? 0,
        lightSleepMinutes: existingData?.light_sleep_minutes ?? currentHealthData.data?.lightSleepMinutes ?? 0,
        hydration: existingData?.hydration ?? currentHealthData.data?.hydration ?? 0,
        mindfulnessMinutes: newMinutes, // 🔥 Aggiorna con il nuovo valore
      };

      // Sincronizza i dati aggiornati nel database
      const syncService = HealthDataSyncService.getInstance();
      const syncResult = await syncService.syncHealthData(userId, healthDataToSync);

      if (syncResult.success) {
        return {
          success: true,
          newMinutes,
        };
      } else {
        return {
          success: false,
          error: syncResult.error || 'Errore durante il salvataggio',
        };
      }
    } catch (error) {
      console.error('❌ Error removing meditation minutes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Gestisce le azioni rapide per ogni widget
   */
  static async handleQuickAction(widgetId: string, action: string, userId?: string): Promise<boolean> {
    try {
      switch (widgetId) {
        case 'hydration':
          if (action === 'add_water') {
            // 🔥 FIX: Implementa l'aggiunta di un bicchiere d'acqua
            if (!userId) {
              // Prova a recuperare l'utente corrente
              const { AuthService } = await import('./auth.service');
              const currentUser = await AuthService.getCurrentUser();
              if (!currentUser?.id) {
                console.error('❌ Cannot add water: user not authenticated');
                return false;
              }
              userId = currentUser.id;
            }

            const result = await this.addWaterGlass(userId);
            return result.success;
          }
          break;
        case 'mindfulness':
          if (action === 'start_session') {
            // Avvia sessione mindfulness
            console.log('Starting mindfulness session...');
            return true;
          }
          break;
        case 'analyses':
          if (action === 'quick_checkin') {
            // Avvia check-in rapido
            console.log('Starting quick check-in...');
            return true;
          }
          break;
        case 'steps':
          if (action === 'view_details') {
            // Mostra dettagli passi
            console.log('Viewing steps details...');
            return true;
          }
          break;
        case 'sleep':
          if (action === 'view_details') {
            // Mostra dettagli sonno
            console.log('Viewing sleep details...');
            return true;
          }
          break;
        case 'hrv':
          if (action === 'view_details') {
            // Mostra dettagli HRV
            console.log('Viewing HRV details...');
            return true;
          }
          break;
        default:
          return false;
      }
      return false;
    } catch (error) {
      console.error('Error handling quick action:', error);
      return false;
    }
  }

  /**
   * Ottiene il colore del trend
   */
  static getTrendColor(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up': return '#10b981';
      case 'down': return '#ef4444';
      case 'stable': return '#6b7280';
      default: return '#6b7280';
    }
  }

  /**
   * Ottiene l'icona del trend
   */
  static getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      case 'stable': return '→';
      default: return '→';
    }
  }
}
