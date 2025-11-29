/**
 * Menstrual Cycle Service
 * 
 * Gestisce il tracking del ciclo mestruale per il widget.
 * Calcola giorno del ciclo, fase corrente, e prossimo periodo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface CycleData {
  day: number; // Giorno del ciclo (1-35)
  phase: CyclePhase;
  phaseName: string; // Nome localizzato della fase
  nextPeriodDays: number; // Giorni fino al prossimo periodo
  cycleLength: number; // Lunghezza media del ciclo (default 28)
  lastPeriodDate: string; // Data ultimo periodo (ISO)
}

const STORAGE_KEY = 'menstrual_cycle_data';
const DEFAULT_CYCLE_LENGTH = 28;

/**
 * Calcola la fase del ciclo basandosi sul giorno
 */
function calculatePhase(day: number, cycleLength: number = DEFAULT_CYCLE_LENGTH): CyclePhase {
  if (day <= 5) return 'menstrual';
  if (day <= 13) return 'follicular';
  if (day <= 16) return 'ovulation';
  return 'luteal';
}

/**
 * Calcola i giorni fino al prossimo periodo
 */
function calculateNextPeriodDays(day: number, cycleLength: number = DEFAULT_CYCLE_LENGTH): number {
  return cycleLength - day + 1;
}

/**
 * Calcola il giorno del ciclo dalla data dell'ultimo periodo
 */
function calculateCycleDay(lastPeriodDate: string, cycleLength: number = DEFAULT_CYCLE_LENGTH): number {
  const lastPeriod = new Date(lastPeriodDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastPeriod.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - lastPeriod.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    // Se la data è nel futuro, ritorna 1 (inizio ciclo)
    return 1;
  }
  
  // Se è passato più di un ciclo, calcola il giorno nel ciclo corrente
  const day = (diffDays % cycleLength) + 1;
  
  return day;
}

export class MenstrualCycleService {
  private static instance: MenstrualCycleService;

  static getInstance(): MenstrualCycleService {
    if (!MenstrualCycleService.instance) {
      MenstrualCycleService.instance = new MenstrualCycleService();
    }
    return MenstrualCycleService.instance;
  }

  /**
   * Salva la data dell'ultimo periodo
   */
  async setLastPeriodDate(date: string): Promise<void> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        // Fallback a AsyncStorage se non autenticato
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ lastPeriodDate: date }));
        return;
      }

      // Salva su Supabase (tabella user_profiles o nuova tabella)
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          last_period_date: date,
          cycle_length: DEFAULT_CYCLE_LENGTH, // Default, può essere personalizzato
        })
        .eq('id', currentUser.id);

      if (error) {
        console.warn('[Cycle] Failed to save to Supabase, using AsyncStorage:', error);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ lastPeriodDate: date }));
      }
    } catch (error) {
      console.error('[Cycle] Error saving last period date:', error);
      // Fallback a AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ lastPeriodDate: date }));
    }
  }

  /**
   * Recupera la data dell'ultimo periodo
   */
  async getLastPeriodDate(): Promise<string | null> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser?.id) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('last_period_date, cycle_length')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (!error && data?.last_period_date) {
          return data.last_period_date;
        }
      }

      // Fallback a AsyncStorage
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.lastPeriodDate || null;
      }
    } catch (error) {
      console.error('[Cycle] Error getting last period date:', error);
    }
    return null;
  }

  /**
   * Recupera la lunghezza del ciclo (default 28)
   */
  async getCycleLength(): Promise<number> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser?.id) {
        const { data } = await supabase
          .from('user_profiles')
          .select('cycle_length')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (data?.cycle_length && data.cycle_length > 0) {
          return data.cycle_length;
        }
      }
    } catch (error) {
      console.error('[Cycle] Error getting cycle length:', error);
    }
    return DEFAULT_CYCLE_LENGTH;
  }

  /**
   * Salva la lunghezza del ciclo
   */
  async setCycleLength(length: number): Promise<void> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        console.warn('[Cycle] Cannot save cycle length: user not authenticated');
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ cycle_length: length })
        .eq('id', currentUser.id);

      if (error) {
        console.error('[Cycle] Error saving cycle length:', error);
        throw error;
      }
    } catch (error) {
      console.error('[Cycle] Error saving cycle length:', error);
      throw error;
    }
  }

  /**
   * Calcola i dati del ciclo per oggi
   */
  async getCycleData(): Promise<CycleData | null> {
    const lastPeriodDate = await this.getLastPeriodDate();
    if (!lastPeriodDate) {
      return null; // Nessun dato disponibile
    }

    const cycleLength = await this.getCycleLength();
    const day = calculateCycleDay(lastPeriodDate, cycleLength);
    const phase = calculatePhase(day, cycleLength);
    const nextPeriodDays = calculateNextPeriodDays(day, cycleLength);

    // I nomi delle fasi verranno localizzati nel componente
    const phaseNames: Record<CyclePhase, string> = {
      menstrual: 'Menstrual',
      follicular: 'Follicular',
      ovulation: 'Ovulation',
      luteal: 'Luteal',
    };

    return {
      day,
      phase,
      phaseName: phaseNames[phase],
      nextPeriodDays,
      cycleLength,
      lastPeriodDate,
    };
  }

  /**
   * Verifica se l'utente ha configurato il ciclo
   */
  async isConfigured(): Promise<boolean> {
    const lastPeriodDate = await this.getLastPeriodDate();
    return lastPeriodDate !== null;
  }
}

export const menstrualCycleService = MenstrualCycleService.getInstance();

