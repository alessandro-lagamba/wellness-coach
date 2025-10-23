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
  hrv: number; // Heart Rate Variability in ms
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
  source: 'healthkit' | 'health_connect' | 'manual' | 'mock';
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
   */
  async syncHealthData(
    userId: string, 
    healthData: HealthData, 
    source: 'healthkit' | 'health_connect' | 'manual' | 'mock' = 'mock'
  ): Promise<HealthDataSyncResult> {
    try {
      console.log('🔄 Syncing health data to Supabase...');
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Check if record already exists for today
      const { data: existingRecord, error: fetchError } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Error fetching existing health data:', fetchError);
        return {
          success: false,
          recordsInserted: 0,
          recordsUpdated: 0,
          error: fetchError.message,
        };
      }

      const healthRecord: Partial<HealthDataRecord> = {
        user_id: userId,
        date: today,
        steps: healthData.steps,
        distance: healthData.distance,
        calories: healthData.calories,
        active_minutes: healthData.activeMinutes,
        heart_rate: healthData.heartRate,
        resting_heart_rate: healthData.restingHeartRate,
        hrv: healthData.hrv,
        sleep_hours: healthData.sleepHours,
        sleep_quality: healthData.sleepQuality,
        deep_sleep_minutes: healthData.deepSleepMinutes,
        rem_sleep_minutes: healthData.remSleepMinutes,
        light_sleep_minutes: healthData.lightSleepMinutes,
        blood_pressure_systolic: healthData.bloodPressure?.systolic,
        blood_pressure_diastolic: healthData.bloodPressure?.diastolic,
        weight: healthData.weight,
        body_fat: healthData.bodyFat,
        hydration: healthData.hydration,
        mindfulness_minutes: healthData.mindfulnessMinutes,
        source,
        updated_at: new Date().toISOString(),
      };

      let result: HealthDataSyncResult;

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('health_data')
          .update(healthRecord)
          .eq('id', existingRecord.id);

        if (updateError) {
          console.error('❌ Error updating health data:', updateError);
          result = {
            success: false,
            recordsInserted: 0,
            recordsUpdated: 0,
            error: updateError.message,
          };
        } else {
          console.log('✅ Health data updated successfully');
          result = {
            success: true,
            recordsInserted: 0,
            recordsUpdated: 1,
          };
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('health_data')
          .insert({
            ...healthRecord,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('❌ Error inserting health data:', insertError);
          result = {
            success: false,
            recordsInserted: 0,
            recordsUpdated: 0,
            error: insertError.message,
          };
        } else {
          console.log('✅ Health data inserted successfully');
          result = {
            success: true,
            recordsInserted: 1,
            recordsUpdated: 0,
          };
        }
      }

      return result;
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

