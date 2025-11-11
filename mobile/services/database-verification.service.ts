import { supabase, Tables } from '../lib/supabase';
import { EnhancedLoggingService } from './enhanced-logging.service';

export interface VerificationResult {
  verified: boolean;
  found?: boolean;
  error?: string;
  data?: any;
}

/**
 * Service per verificare che i dati salvati siano effettivamente nel database
 */
export class DatabaseVerificationService {
  /**
   * Verifica che un'analisi della pelle sia stata salvata
   */
  static async verifySkinAnalysis(
    userId: string,
    analysisId: string,
    timeout: number = 5000
  ): Promise<VerificationResult> {
    try {
      const startTime = Date.now();

      const { data, error } = await Promise.race([
        supabase
          .from(Tables.SKIN_ANALYSES)
          .select('*')
          .eq('id', analysisId)
          .eq('user_id', userId)
          .single(),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), timeout)
        ),
      ]) as any;

      const duration = Date.now() - startTime;

      if (error) {
        EnhancedLoggingService.logVerification('skin_analysis', userId, false, error);
        return {
          verified: false,
          found: false,
          error: error.message,
        };
      }

      const found = !!data;
      EnhancedLoggingService.logVerification('skin_analysis', userId, found, undefined);

      return {
        verified: true,
        found,
        data: found ? data : undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      EnhancedLoggingService.logVerification('skin_analysis', userId, false, err);
      return {
        verified: false,
        found: false,
        error: err.message,
      };
    }
  }

  /**
   * Verifica che un'analisi emotiva sia stata salvata
   */
  static async verifyEmotionAnalysis(
    userId: string,
    analysisId: string,
    timeout: number = 5000
  ): Promise<VerificationResult> {
    try {
      const startTime = Date.now();

      const { data, error } = await Promise.race([
        supabase
          .from(Tables.EMOTION_ANALYSES)
          .select('*')
          .eq('id', analysisId)
          .eq('user_id', userId)
          .single(),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), timeout)
        ),
      ]) as any;

      const duration = Date.now() - startTime;

      if (error) {
        EnhancedLoggingService.logVerification('emotion_analysis', userId, false, error);
        return {
          verified: false,
          found: false,
          error: error.message,
        };
      }

      const found = !!data;
      EnhancedLoggingService.logVerification('emotion_analysis', userId, found, undefined);

      return {
        verified: true,
        found,
        data: found ? data : undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      EnhancedLoggingService.logVerification('emotion_analysis', userId, false, err);
      return {
        verified: false,
        found: false,
        error: err.message,
      };
    }
  }

  /**
   * Verifica che un'analisi del cibo sia stata salvata
   */
  static async verifyFoodAnalysis(
    userId: string,
    analysisId: string,
    timeout: number = 5000
  ): Promise<VerificationResult> {
    try {
      const startTime = Date.now();

      const { data, error } = await Promise.race([
        supabase
          .from(Tables.FOOD_ANALYSES)
          .select('*')
          .eq('id', analysisId)
          .eq('user_id', userId)
          .single(),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), timeout)
        ),
      ]) as any;

      const duration = Date.now() - startTime;

      if (error) {
        EnhancedLoggingService.logVerification('food_analysis', userId, false, error);
        return {
          verified: false,
          found: false,
          error: error.message,
        };
      }

      const found = !!data;
      EnhancedLoggingService.logVerification('food_analysis', userId, found, undefined);

      return {
        verified: true,
        found,
        data: found ? data : undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      EnhancedLoggingService.logVerification('food_analysis', userId, false, err);
      return {
        verified: false,
        found: false,
        error: err.message,
      };
    }
  }

  /**
   * Verifica che un check-in mood sia stato salvato
   */
  static async verifyMoodCheckin(
    userId: string,
    date: string,
    timeout: number = 5000
  ): Promise<VerificationResult> {
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('daily_copilot_analyses')
          .select('id, mood, date')
          .eq('user_id', userId)
          .eq('date', date)
          .maybeSingle(),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), timeout)
        ),
      ]) as any;

      if (error && error.code !== 'PGRST116') {
        EnhancedLoggingService.logVerification('mood_checkin', userId, false, error);
        return {
          verified: false,
          found: false,
          error: error.message,
        };
      }

      const found = !!data && data.mood !== null && data.mood !== undefined;
      EnhancedLoggingService.logVerification('mood_checkin', userId, found, undefined);

      return {
        verified: true,
        found,
        data: found ? data : undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      EnhancedLoggingService.logVerification('mood_checkin', userId, false, err);
      return {
        verified: false,
        found: false,
        error: err.message,
      };
    }
  }

  /**
   * Verifica che un check-in sleep sia stato salvato
   */
  static async verifySleepCheckin(
    userId: string,
    date: string,
    timeout: number = 5000
  ): Promise<VerificationResult> {
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('daily_copilot_analyses')
          .select('id, sleep_quality, sleep_hours, date')
          .eq('user_id', userId)
          .eq('date', date)
          .maybeSingle(),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), timeout)
        ),
      ]) as any;

      if (error && error.code !== 'PGRST116') {
        EnhancedLoggingService.logVerification('sleep_checkin', userId, false, error);
        return {
          verified: false,
          found: false,
          error: error.message,
        };
      }

      const found = !!data && (data.sleep_quality !== null || data.sleep_hours !== null);
      EnhancedLoggingService.logVerification('sleep_checkin', userId, found, undefined);

      return {
        verified: true,
        found,
        data: found ? data : undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      EnhancedLoggingService.logVerification('sleep_checkin', userId, false, err);
      return {
        verified: false,
        found: false,
        error: err.message,
      };
    }
  }

  /**
   * Verifica che i dati salute siano stati salvati
   */
  static async verifyHealthData(
    userId: string,
    date: string,
    timeout: number = 5000
  ): Promise<VerificationResult> {
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('health_data')
          .select('id, date, steps, heart_rate')
          .eq('user_id', userId)
          .eq('date', date)
          .maybeSingle(),
        new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), timeout)
        ),
      ]) as any;

      if (error && error.code !== 'PGRST116') {
        EnhancedLoggingService.logVerification('health_data', userId, false, error);
        return {
          verified: false,
          found: false,
          error: error.message,
        };
      }

      const found = !!data;
      EnhancedLoggingService.logVerification('health_data', userId, found, undefined);

      return {
        verified: true,
        found,
        data: found ? data : undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      EnhancedLoggingService.logVerification('health_data', userId, false, err);
      return {
        verified: false,
        found: false,
        error: err.message,
      };
    }
  }
}

