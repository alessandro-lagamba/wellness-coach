import { supabase, Tables } from '../lib/supabase';
import { HealthDataService } from './health-data.service';
import { HealthData as RealHealthData } from '../types/health.types';

export interface WidgetData {
  id: string;
  title: string;
  icon: string;
  value: string;
  subtitle: string;
  progress?: number; // 0-100
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color: string;
  backgroundColor: string;
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
      const syncResult = await healthService.syncHealthData();
      
      if (syncResult.success && syncResult.data) {
        // Convert real health data to our format
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
    } catch (error) {
      console.warn('Failed to get real health data, using mock:', error);
    }
    
    // Fallback to mock data
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
          value: healthData.steps.toLocaleString(),
          subtitle: `Goal: ${10000}`,
          progress: Math.min((healthData.steps / 10000) * 100, 100),
          trend: healthData.steps > 8000 ? 'up' : 'stable',
          trendValue: '+12%',
          color: '#10b981',
          backgroundColor: '#ecfdf5',
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
          value: `${healthData.mindfulnessMinutes}m`,
          subtitle: `Goal: ${30}m`,
          progress: Math.min((healthData.mindfulnessMinutes / 30) * 100, 100),
          trend: healthData.mindfulnessMinutes > 15 ? 'up' : 'stable',
          trendValue: '+5m',
          color: '#8b5cf6',
          backgroundColor: '#f3f4f6',
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
          value: `${healthData.hydration}`,
          subtitle: 'glasses',
          progress: (healthData.hydration / 8) * 100,
          trend: healthData.hydration >= 6 ? 'up' : 'stable',
          trendValue: '+1',
          color: '#0ea5e9',
          backgroundColor: '#f0f9ff',
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
          value: `${healthData.sleepHours}h`,
          subtitle: `${healthData.sleepQuality}% quality`,
          progress: healthData.sleepQuality,
          trend: healthData.sleepHours >= 7 ? 'up' : 'down',
          trendValue: healthData.sleepHours >= 7 ? '+0.5h' : '-0.5h',
          color: '#6366f1',
          backgroundColor: '#eef2ff',
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
          value: `${healthData.hrv}ms`,
          subtitle: `HR: ${healthData.restingHR}bpm`,
          progress: Math.min((healthData.hrv / 50) * 100, 100),
          trend: healthData.hrv > 30 ? 'up' : 'stable',
          trendValue: '+2ms',
          color: '#ef4444',
          backgroundColor: '#fef2f2',
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
          backgroundColor: healthData.analysesCompleted > 0 ? '#ecfdf5' : '#fffbeb',
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
   * Gestisce le azioni rapide per ogni widget
   */
  static async handleQuickAction(widgetId: string, action: string): Promise<boolean> {
    try {
      switch (widgetId) {
        case 'hydration':
          if (action === 'add_water') {
            // Aggiungi un bicchiere d'acqua
            console.log('Adding water glass...');
            return true;
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
