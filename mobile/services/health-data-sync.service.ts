import { supabase, Tables } from '../lib/supabase';
import { HealthData } from '../types/health.types';

export interface HealthDataRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD format
  steps: number;
  distance: number; // meters
  calories: number;
  active_minutes: number;
  heart_rate: number; // bpm
  resting_heart_rate: number; // bpm
  hrv: number; // Heart Rate Variability in ms (numeric in DB)
  sleep_hours: number;
  sleep_quality: number; // 0-100
  deep_sleep_minutes: number;
  rem_sleep_minutes: number;
  light_sleep_minutes: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  weight?: number; // kg
  body_fat?: number; // percentage
  hydration?: number; // ml
  mindfulness_minutes?: number;
  bedtime?: string;
  waketime?: string;
  // 🔥 REMOVED: source column dropped from database
  created_at: string;
  updated_at: string;
}

export interface HealthDataSyncResult {
  success: boolean;
  recordsInserted: number;
  recordsUpdated: number;
  error?: string;
}

export class HealthDataSyncService {
  private static instance: HealthDataSyncService;

  public static getInstance(): HealthDataSyncService {
    if (!HealthDataSyncService.instance) {
      HealthDataSyncService.instance = new HealthDataSyncService();
    }
    return HealthDataSyncService.instance;
  }

  /**
   * Sync health data to Supabase
   * 🔥 Simplified: removed source parameter since column was dropped
   */
  private calculateSleepHoursFromTimes(bedtime?: string, waketime?: string): number {
    if (!bedtime || !waketime) return 0;

    try {
      // Formato atteso: "HH:mm"
      const [bHour, bMin] = bedtime.split(':').map(Number);
      const [wHour, wMin] = waketime.split(':').map(Number);

      if (isNaN(bHour) || isNaN(bMin) || isNaN(wHour) || isNaN(wMin)) return 0;

      // Crea date fittizie per calcolare la differenza
      const bDate = new Date(2024, 0, 1, bHour, bMin);
      let wDate = new Date(2024, 0, 1, wHour, wMin);

      // Se l'orario di sveglia è "prima" di quello per andare a letto, 
      // assumiamo che sia il giorno successivo (sonno notturno)
      if (wDate <= bDate) {
        wDate = new Date(2024, 0, 2, wHour, wMin);
      }

      const diffMs = wDate.getTime() - bDate.getTime();
      return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    } catch (e) {
      console.warn('⚠️ [SYNC] Error calculating sleep duration from times:', e);
      return 0;
    }
  }

  async syncHealthData(
    userId: string,
    healthData: HealthData
  ): Promise<HealthDataSyncResult> {
    try {
      const roundInt = (value?: number | null) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return 0;
        return Math.round(value);
      };
      const toDecimal = (value?: number | null, precision = 2) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return 0;
        return parseFloat(value.toFixed(precision));
      };
      const pickOrKeep = <T>(next: T | undefined, prev: T | undefined, fallback: T) =>
        next !== undefined ? next : (prev ?? fallback);

      // come sopra ma per number, con normalizzazione
      const pickNumOrKeep = (next: number | undefined, prev: any, fallback = 0) =>
        next !== undefined ? next : (typeof prev === 'number' ? prev : fallback);


      // 🔥 FIX: Use local date string (YYYY-MM-DD) instead of UTC to match user's calendar day
      const now = new Date();
      const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
      ].join('-');

      // 1. Recupera prima il record esistente per oggi
      const { data: existingRecord } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      const wasInserted = !existingRecord;

      // 2. Prepara il record unendo i dati nuovi con quelli esistenti
      const healthRecord: Partial<HealthDataRecord> = {
        user_id: userId,
        date: today,

        // Dati attività: prendi il valore più alto tra nuovo e vecchio
        steps: Math.max(roundInt(healthData.steps), existingRecord?.steps || 0),
        distance: Math.max(toDecimal(healthData.distance ?? 0), existingRecord?.distance || 0),
        calories: Math.max(roundInt(healthData.calories), existingRecord?.calories || 0),
        active_minutes: Math.max(roundInt(healthData.activeMinutes), existingRecord?.active_minutes || 0),

        // Dati istantanei: usa il nuovo se disponibile (>0), altrimenti tieni il vecchio
        heart_rate: pickOrKeep(
          (healthData.heartRate !== undefined && healthData.heartRate > 0) ? roundInt(healthData.heartRate) : undefined,
          existingRecord?.heart_rate,
          0
        ),
        resting_heart_rate: pickOrKeep(
          (healthData.restingHeartRate !== undefined && healthData.restingHeartRate > 0) ? roundInt(healthData.restingHeartRate) : undefined,
          existingRecord?.resting_heart_rate,
          0
        ),
        hrv: pickOrKeep(
          (healthData.hrv !== undefined && healthData.hrv > 0) ? toDecimal(healthData.hrv) : undefined,
          existingRecord?.hrv,
          0
        ),

        // Sonno
        sleep_hours: pickOrKeep(
          (healthData.sleepHours !== undefined && healthData.sleepHours > 0)
            ? toDecimal(healthData.sleepHours)
            : (healthData.bedtime && healthData.waketime)
              ? this.calculateSleepHoursFromTimes(healthData.bedtime, healthData.waketime)
              : undefined,
          existingRecord?.sleep_hours,
          0
        ),
        sleep_quality: pickOrKeep(
          (healthData.sleepQuality !== undefined && healthData.sleepQuality > 0) ? roundInt(healthData.sleepQuality) : undefined,
          existingRecord?.sleep_quality,
          0
        ),
        deep_sleep_minutes: pickOrKeep(
          (healthData.deepSleepMinutes !== undefined && healthData.deepSleepMinutes > 0) ? roundInt(healthData.deepSleepMinutes) : undefined,
          existingRecord?.deep_sleep_minutes,
          0
        ),
        rem_sleep_minutes: pickOrKeep(
          (healthData.remSleepMinutes !== undefined && healthData.remSleepMinutes > 0) ? roundInt(healthData.remSleepMinutes) : undefined,
          existingRecord?.rem_sleep_minutes,
          0
        ),
        light_sleep_minutes: pickOrKeep(
          (healthData.lightSleepMinutes !== undefined && healthData.lightSleepMinutes > 0) ? roundInt(healthData.lightSleepMinutes) : undefined,
          existingRecord?.light_sleep_minutes,
          0
        ),

        // Parametri medici (Pressione, Peso, ecc.)
        blood_pressure_systolic: pickOrKeep(
          healthData.bloodPressure?.systolic !== undefined ? roundInt(healthData.bloodPressure.systolic) : undefined,
          existingRecord?.blood_pressure_systolic,
          null
        ),
        blood_pressure_diastolic: pickOrKeep(
          healthData.bloodPressure?.diastolic !== undefined ? roundInt(healthData.bloodPressure.diastolic) : undefined,
          existingRecord?.blood_pressure_diastolic,
          null
        ),
        weight: pickOrKeep(
          typeof healthData.weight === 'number' ? parseFloat(healthData.weight.toFixed(2)) : undefined,
          existingRecord?.weight,
          null
        ),
        body_fat: pickOrKeep(
          typeof healthData.bodyFat === 'number' ? parseFloat(healthData.bodyFat.toFixed(2)) : undefined,
          existingRecord?.body_fat,
          null
        ),

        // 🔥 Hydration and meditation: Allow overwriting if value is provided (to support removal)
        // If the new value is explicitly provided (even 0), we use it. 
        // We rely on the caller (TodayGlanceService) to pass the correct cumulative value.
        hydration: healthData.hydration !== undefined ? roundInt(healthData.hydration) : (existingRecord?.hydration || 0),
        mindfulness_minutes: healthData.mindfulnessMinutes !== undefined ? roundInt(healthData.mindfulnessMinutes) : (existingRecord?.mindfulness_minutes || 0),
        bedtime: healthData.bedtime !== undefined ? healthData.bedtime : (existingRecord?.bedtime || null),
        waketime: healthData.waketime !== undefined ? healthData.waketime : (existingRecord?.waketime || null),
      };

      // ✅ OPTIM: se non cambia niente rispetto al record esistente, skip upsert
      if (existingRecord) {
        const next = {
          steps: healthRecord.steps ?? 0,
          distance: healthRecord.distance ?? 0,
          calories: healthRecord.calories ?? 0,
          active_minutes: healthRecord.active_minutes ?? 0,
          heart_rate: healthRecord.heart_rate ?? 0,
          resting_heart_rate: healthRecord.resting_heart_rate ?? 0,
          hrv: healthRecord.hrv ?? 0,
          sleep_hours: healthRecord.sleep_hours ?? 0,
          sleep_quality: healthRecord.sleep_quality ?? 0,
          deep_sleep_minutes: healthRecord.deep_sleep_minutes ?? 0,
          rem_sleep_minutes: healthRecord.rem_sleep_minutes ?? 0,
          light_sleep_minutes: healthRecord.light_sleep_minutes ?? 0,
          hydration: healthRecord.hydration ?? 0,
          mindfulness_minutes: healthRecord.mindfulness_minutes ?? 0,
          bedtime: healthRecord.bedtime ?? null,
          waketime: healthRecord.waketime ?? null,
        };

        const prev = {
          steps: existingRecord.steps ?? 0,
          distance: toDecimal(Number(existingRecord.distance ?? 0)),
          calories: existingRecord.calories ?? 0,
          active_minutes: existingRecord.active_minutes ?? 0,
          heart_rate: existingRecord.heart_rate ?? 0,
          resting_heart_rate: existingRecord.resting_heart_rate ?? 0,
          hrv: existingRecord.hrv ?? 0,
          sleep_hours: toDecimal(Number(existingRecord.sleep_hours ?? 0)),
          sleep_quality: existingRecord.sleep_quality ?? 0,
          deep_sleep_minutes: existingRecord.deep_sleep_minutes ?? 0,
          rem_sleep_minutes: existingRecord.rem_sleep_minutes ?? 0,
          light_sleep_minutes: existingRecord.light_sleep_minutes ?? 0,
          hydration: existingRecord.hydration ?? 0,
          mindfulness_minutes: existingRecord.mindfulness_minutes ?? 0,
          bedtime: existingRecord.bedtime ?? null,
          waketime: existingRecord.waketime ?? null,
        };

        if (__DEV__) {
          console.log('🔍 [SYNC DEBUG] Next (New) Record:', JSON.stringify(next, null, 2));
          console.log('🔍 [SYNC DEBUG] Prev (DB) Record:', JSON.stringify(prev, null, 2));
        }

        const unchanged = Object.keys(next).every((k) => (next as any)[k] === (prev as any)[k]);

        if (unchanged) {
          console.log('✅ [SYNC DEBUG] No changes vs DB -> skip upsert');
          return {
            success: true,
            recordsInserted: 0,
            recordsUpdated: 0,
          };
        }
      }

      const upsertData = {
        ...healthRecord,
        created_at: existingRecord?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 3. Esegui l'upsert finale
      console.log('🔄 [SYNC DEBUG] Syncing health data for date:', today, '(Local)');
      console.log('🔄 [SYNC DEBUG] Input Data (Steps):', healthData.steps);
      console.log('🔄 [SYNC DEBUG] Existing DB Data (Steps):', existingRecord?.steps);

      const { data: upsertedData, error: upsertError } = await supabase
        .from('health_data')
        .upsert(upsertData, {
          onConflict: 'user_id,date',
        })
        .select()
        .single();

      if (!upsertError) {
        console.log('✅ [SYNC DEBUG] Upsert success. New Steps in DB:', upsertedData?.steps);
      }

      if (upsertError) {
        if ((upsertError as any)?.code === '42501') {
          if (__DEV__) {
            console.log('ℹ️ [SYNC DEBUG] Supabase upsert skipped by RLS (likely legal gate pending)');
          }
          return {
            success: true,
            recordsInserted: 0,
            recordsUpdated: 0,
          };
        }

        console.error('❌ Error upserting health data:', upsertError);
        return {
          success: false,
          recordsInserted: 0,
          recordsUpdated: 0,
          error: upsertError.message,
        };
      }

      return {
        success: true,
        recordsInserted: wasInserted ? 1 : 0,
        recordsUpdated: wasInserted ? 0 : 1,
      };
    } catch (error) {
      console.error('❌ Unexpected error syncing health data:', error);
      return {
        success: false,
        recordsInserted: 0,
        recordsUpdated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get health data for a specific date range
   */
  async getHealthData(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<HealthDataRecord[]> {
    try {
      const { data, error } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        console.error('❌ Error fetching health data:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Unexpected error fetching health data:', error);
      return [];
    }
  }

  /**
   * Get latest health data for a user
   */
  async getLatestHealthData(userId: string): Promise<HealthDataRecord | null> {
    try {
      const { data, error } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No records found
          return null;
        }
        console.error('❌ Error fetching latest health data:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Unexpected error fetching latest health data:', error);
      return null;
    }
  }

  /**
   * Get health data statistics for a user
   */
  async getHealthDataStats(userId: string, days: number = 30): Promise<{
    totalSteps: number;
    avgSteps: number;
    totalSleepHours: number;
    avgSleepHours: number;
    avgHRV: number;
    avgHeartRate: number;
    totalActiveMinutes: number;
    avgActiveMinutes: number;
  }> {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('health_data')
        .select('steps, sleep_hours, hrv, heart_rate, active_minutes')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('❌ Error fetching health data stats:', error);
        return {
          totalSteps: 0,
          avgSteps: 0,
          totalSleepHours: 0,
          avgSleepHours: 0,
          avgHRV: 0,
          avgHeartRate: 0,
          totalActiveMinutes: 0,
          avgActiveMinutes: 0,
        };
      }

      if (!data || data.length === 0) {
        return {
          totalSteps: 0,
          avgSteps: 0,
          totalSleepHours: 0,
          avgSleepHours: 0,
          avgHRV: 0,
          avgHeartRate: 0,
          totalActiveMinutes: 0,
          avgActiveMinutes: 0,
        };
      }

      const totalSteps = data.reduce((sum, record) => sum + (record.steps || 0), 0);
      const totalSleepHours = data.reduce((sum, record) => sum + (record.sleep_hours || 0), 0);
      const totalHRV = data.reduce((sum, record) => sum + (record.hrv || 0), 0);
      const totalHeartRate = data.reduce((sum, record) => sum + (record.heart_rate || 0), 0);
      const totalActiveMinutes = data.reduce((sum, record) => sum + (record.active_minutes || 0), 0);

      const recordCount = data.length;

      return {
        totalSteps,
        avgSteps: Math.round(totalSteps / recordCount),
        totalSleepHours,
        avgSleepHours: Math.round((totalSleepHours / recordCount) * 10) / 10,
        avgHRV: Math.round(totalHRV / recordCount),
        avgHeartRate: Math.round(totalHeartRate / recordCount),
        totalActiveMinutes,
        avgActiveMinutes: Math.round(totalActiveMinutes / recordCount),
      };
    } catch (error) {
      console.error('❌ Unexpected error calculating health data stats:', error);
      return {
        totalSteps: 0,
        avgSteps: 0,
        totalSleepHours: 0,
        avgSleepHours: 0,
        avgHRV: 0,
        avgHeartRate: 0,
        totalActiveMinutes: 0,
        avgActiveMinutes: 0,
      };
    }
  }

  /**
   * Get daily health data for trend charts (default 7 days, can be extended)
   */
  async getTrendData(userId: string, days: number = 7): Promise<{
    steps: number[];
    sleepHours: number[];
    hrv: number[];
    heartRate: number[];
    hydration: number[];
    meditation: number[];
  }> {
    try {
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999); // Fine della giornata di oggi
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1)); // -6 giorni per avere 7 giorni totali
      startDate.setHours(0, 0, 0, 0); // Inizio della giornata
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('health_data')
        .select('date, steps, sleep_hours, hrv, heart_rate, hydration, mindfulness_minutes')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      if (error) {
        console.error('❌ Error fetching weekly trend data:', error);
        return {
          steps: [],
          sleepHours: [],
          hrv: [],
          heartRate: [],
          hydration: [],
          meditation: [],
        };
      }

      if (!data || data.length === 0) {
        return {
          steps: [],
          sleepHours: [],
          hrv: [],
          heartRate: [],
          hydration: [],
          meditation: [],
        };
      }

      // Crea un array per gli ultimi N giorni
      const daysMap: { [key: string]: { steps: number; sleepHours: number; hrv: number; heartRate: number; hydration: number; meditation: number } } = {};

      // Inizializza tutti i giorni con 0
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        date.setHours(12, 0, 0, 0); // Usa mezzogiorno per evitare problemi di timezone
        const dateStr = date.toISOString().split('T')[0];
        daysMap[dateStr] = { steps: 0, sleepHours: 0, hrv: 0, heartRate: 0, hydration: 0, meditation: 0 };
      }

      // Popola con i dati reali
      data.forEach((record) => {
        const dateStr = record.date;
        if (daysMap[dateStr]) {
          daysMap[dateStr].steps = record.steps || 0;
          daysMap[dateStr].sleepHours = record.sleep_hours || 0;
          daysMap[dateStr].hrv = record.hrv || 0;
          daysMap[dateStr].heartRate = record.heart_rate || 0;
          daysMap[dateStr].hydration = record.hydration || 0;
          daysMap[dateStr].meditation = record.mindfulness_minutes || 0;
        }
      });

      // Converti in array ordinato per data
      const sortedDates = Object.keys(daysMap).sort();
      const steps = sortedDates.map(date => daysMap[date].steps);
      const sleepHours = sortedDates.map(date => daysMap[date].sleepHours);
      const hrv = sortedDates.map(date => daysMap[date].hrv);
      const heartRate = sortedDates.map(date => daysMap[date].heartRate);
      const hydration = sortedDates.map(date => daysMap[date].hydration);
      const meditation = sortedDates.map(date => daysMap[date].meditation);

      return { steps, sleepHours, hrv, heartRate, hydration, meditation };
    } catch (error) {
      console.error('❌ Error in getTrendData:', error);
      return {
        steps: [],
        sleepHours: [],
        hrv: [],
        heartRate: [],
        hydration: [],
        meditation: [],
      };
    }
  }

  /**
   * Get weekly trend data (7 days) - retrocompatibilità
   */
  async getWeeklyTrendData(userId: string): Promise<{
    steps: number[];
    sleepHours: number[];
    hrv: number[];
    heartRate: number[];
    hydration: number[];
    meditation: number[];
  }> {
    return this.getTrendData(userId, 7);
  }

  /**
   * Delete health data for a specific date
   */
  async deleteHealthData(userId: string, date: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('health_data')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);

      if (error) {
        console.error('❌ Error deleting health data:', error);
        return false;
      }

      console.log('✅ Health data deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Unexpected error deleting health data:', error);
      return false;
    }
  }
}
