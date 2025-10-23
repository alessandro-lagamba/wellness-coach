import { supabase, Tables } from '../lib/supabase';

export interface MomentumData {
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  completedTasks: number;
  totalTasks: number;
  period: '7days' | '30days';
}

export class MomentumService {
  /**
   * Calcola il Momentum basato sui task completati negli ultimi 7 giorni
   */
  static async calculateMomentum(userId: string, period: '7days' | '30days' = '7days'): Promise<MomentumData> {
    try {
      const days = period === '7days' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Simula il calcolo del Momentum basato su attività completate
      // In una implementazione reale, questo dovrebbe essere basato su dati reali
      const mockData = this.generateMockMomentumData(period);
      
      return mockData;
    } catch (error) {
      console.error('Error calculating momentum:', error);
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
   * Genera dati mock per il Momentum (da sostituire con dati reali)
   */
  private static generateMockMomentumData(period: '7days' | '30days'): MomentumData {
    // Simula dati realistici per il Momentum
    const basePercentage = Math.floor(Math.random() * 40) + 60; // 60-100%
    const trendVariation = Math.floor(Math.random() * 20) - 10; // -10% to +10%
    const trendPercentage = Math.abs(trendVariation);
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (trendVariation > 2) trend = 'up';
    else if (trendVariation < -2) trend = 'down';

    const totalTasks = period === '7days' ? 14 : 60; // 2 tasks per giorno in media
    const completedTasks = Math.floor((basePercentage / 100) * totalTasks);

    return {
      percentage: basePercentage,
      trend,
      trendPercentage,
      completedTasks,
      totalTasks,
      period
    };
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
