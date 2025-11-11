import { supabase, Tables } from '../lib/supabase';
import { widgetGoalsService } from './widget-goals.service';

export interface MomentumData {
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  completedTasks: number;
  totalTasks: number;
  period: '7days' | '30days';
}

export class MomentumService {
  // 🔥 FIX: Cache per evitare che il progresso cambi ad ogni chiamata
  private static momentumCache: Map<string, { data: MomentumData; timestamp: number }> = new Map();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

  /**
   * Calcola il Progresso basato su dati reali:
   * - Giorni consecutivi di login (da daily_copilot_analyses)
   * - Obiettivi raggiunti (confrontando health_data con widget goals)
   * - Trend settimanale
   */
  static async calculateMomentum(userId: string, period: '7days' | '30days' = '7days'): Promise<MomentumData> {
    try {
      const cacheKey = `${userId}:${period}`;
      const cached = this.momentumCache.get(cacheKey);
      const now = Date.now();
      
      // 🔥 FIX: Ritorna dati dalla cache se sono ancora validi
      if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
        return cached.data;
      }
      
      const days = period === '7days' ? 7 : 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // 1. Calcola giorni consecutivi di login (da daily_copilot_analyses)
      const { data: copilotData, error: copilotError } = await supabase
        .from('daily_copilot_analyses')
        .select('date')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false });

      if (copilotError) {
        console.error('❌ Error fetching copilot data for progress:', copilotError);
      }

      // 2. Calcola giorni con obiettivi raggiunti (da health_data e widget goals)
      const goals = await widgetGoalsService.getGoals();
      const stepsGoal = goals?.steps ?? 10000;
      const hydrationGoal = goals?.hydration ?? 8;
      const meditationGoal = goals?.meditation ?? 30;
      const sleepGoal = goals?.sleep ?? 8;

      const { data: healthData, error: healthError } = await supabase
        .from('health_data')
        .select('date, steps, hydration, mindfulness_minutes, sleep_hours')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (healthError) {
        console.error('❌ Error fetching health data for progress:', healthError);
      }

      // 3. Calcola metriche
      const loginDays = new Set(copilotData?.map(d => d.date) || []);
      const totalDays = days;
      const loginPercentage = (loginDays.size / totalDays) * 100;

      // Calcola giorni con obiettivi raggiunti
      const healthDataMap = new Map<string, any>();
      healthData?.forEach(h => {
        healthDataMap.set(h.date, h);
      });

      let daysWithGoalsReached = 0;
      const datesWithData = new Set<string>();
      
      // Per ogni giorno nel periodo, controlla se gli obiettivi sono stati raggiunti
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayHealthData = healthDataMap.get(dateStr);
        if (dayHealthData) {
          datesWithData.add(dateStr);
          
          let goalsReached = 0;
          let totalGoals = 0;
          
          // Steps goal
          if (stepsGoal > 0) {
            totalGoals++;
            if ((dayHealthData.steps || 0) >= stepsGoal) goalsReached++;
          }
          
          // Hydration goal (converti ml in bicchieri, assumendo 250ml per bicchiere)
          if (hydrationGoal > 0) {
            totalGoals++;
            const glasses = Math.round((dayHealthData.hydration || 0) / 250);
            if (glasses >= hydrationGoal) goalsReached++;
          }
          
          // Meditation goal
          if (meditationGoal > 0) {
            totalGoals++;
            if ((dayHealthData.mindfulness_minutes || 0) >= meditationGoal) goalsReached++;
          }
          
          // Sleep goal
          if (sleepGoal > 0) {
            totalGoals++;
            if ((dayHealthData.sleep_hours || 0) >= sleepGoal) goalsReached++;
          }
          
          // Se almeno il 50% degli obiettivi è stato raggiunto, conta il giorno
          if (totalGoals > 0 && (goalsReached / totalGoals) >= 0.5) {
            daysWithGoalsReached++;
          }
        }
      }

      const goalsPercentage = totalDays > 0 ? (daysWithGoalsReached / totalDays) * 100 : 0;

      // 4. Calcola il progresso complessivo (media pesata: 40% login, 60% obiettivi)
      const overallPercentage = Math.round((loginPercentage * 0.4) + (goalsPercentage * 0.6));

      // 5. Calcola trend confrontando la settimana corrente con la precedente
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendPercentage = 0;

      if (period === '7days') {
        const previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        const previousStartDateStr = previousStartDate.toISOString().split('T')[0];
        const previousEndDateStr = startDate.toISOString().split('T')[0];

        const { data: previousCopilotData } = await supabase
          .from('daily_copilot_analyses')
          .select('date')
          .eq('user_id', userId)
          .gte('date', previousStartDateStr)
          .lt('date', previousEndDateStr);

        const { data: previousHealthData } = await supabase
          .from('health_data')
          .select('date, steps, hydration, mindfulness_minutes, sleep_hours')
          .eq('user_id', userId)
          .gte('date', previousStartDateStr)
          .lt('date', previousEndDateStr);

        const previousLoginDays = new Set(previousCopilotData?.map(d => d.date) || []);
        const previousLoginPercentage = (previousLoginDays.size / 7) * 100;

        const previousHealthDataMap = new Map<string, any>();
        previousHealthData?.forEach(h => {
          previousHealthDataMap.set(h.date, h);
        });

        let previousDaysWithGoalsReached = 0;
        for (let i = 0; i < 7; i++) {
          const date = new Date(previousStartDate);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          
          const dayHealthData = previousHealthDataMap.get(dateStr);
          if (dayHealthData) {
            let goalsReached = 0;
            let totalGoals = 0;
            
            if (stepsGoal > 0) {
              totalGoals++;
              if ((dayHealthData.steps || 0) >= stepsGoal) goalsReached++;
            }
            if (hydrationGoal > 0) {
              totalGoals++;
              const glasses = Math.round((dayHealthData.hydration || 0) / 250);
              if (glasses >= hydrationGoal) goalsReached++;
            }
            if (meditationGoal > 0) {
              totalGoals++;
              if ((dayHealthData.mindfulness_minutes || 0) >= meditationGoal) goalsReached++;
            }
            if (sleepGoal > 0) {
              totalGoals++;
              if ((dayHealthData.sleep_hours || 0) >= sleepGoal) goalsReached++;
            }
            
            if (totalGoals > 0 && (goalsReached / totalGoals) >= 0.5) {
              previousDaysWithGoalsReached++;
            }
          }
        }

        const previousGoalsPercentage = (previousDaysWithGoalsReached / 7) * 100;
        const previousOverallPercentage = (previousLoginPercentage * 0.4) + (previousGoalsPercentage * 0.6);

        const difference = overallPercentage - previousOverallPercentage;
        trendPercentage = Math.abs(difference);

        if (difference > 3) trend = 'up';
        else if (difference < -3) trend = 'down';
        else trend = 'stable';
      }

      // 6. Calcola completedTasks e totalTasks
      const totalTasks = days * 2; // 2 task per giorno (login + obiettivi)
      const completedTasks = Math.round((overallPercentage / 100) * totalTasks);

      const result: MomentumData = {
        percentage: Math.min(100, Math.max(0, overallPercentage)),
        trend,
        trendPercentage: Math.round(trendPercentage),
        completedTasks,
        totalTasks,
        period
      };

      // 🔥 FIX: Salva in cache
      this.momentumCache.set(cacheKey, { data: result, timestamp: now });
      
      return result;
    } catch (error) {
      console.error('❌ Error calculating progress:', error);
      return {
        percentage: 0,
        trend: 'stable',
        trendPercentage: 0,
        completedTasks: 0,
        totalTasks: 0,
        period
      };
    }
  }

  /**
   * Ottiene il simbolo della freccia per il trend
   */
  static getTrendArrow(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      case 'stable': return '→';
      default: return '→';
    }
  }

  /**
   * Ottiene il colore per il trend
   */
  static getTrendColor(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up': return '#10b981'; // Green
      case 'down': return '#ef4444'; // Red
      case 'stable': return '#6b7280'; // Gray
      default: return '#6b7280';
    }
  }

  /**
   * Formatta il valore del Momentum per la UI
   */
  static formatMomentumValue(momentum: MomentumData): string {
    const arrow = this.getTrendArrow(momentum.trend);
    return `${momentum.percentage}% (${arrow})`;
  }
}
