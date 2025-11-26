import { supabase } from '../lib/supabase';
import { Tables } from '../constants/database.types';
import { DailyCopilotData } from './daily-copilot.service';

export interface DailyCopilotRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD format
  overall_score: number;
  mood: number;
  sleep_hours: number;
  sleep_quality: number;
  health_metrics: {
    steps: number;
    hrv: number;
    hydration: number;
    resting_hr?: number;
  };
  recommendations: {
    id: string;
    priority: 'high' | 'medium' | 'low';
    category: 'nutrition' | 'movement' | 'recovery' | 'mindfulness' | 'energy';
    action: string;
    reason: string;
    icon: string;
    estimated_time?: string;
    actionable: boolean;
  }[];
  summary: {
    focus: string;
    energy: 'high' | 'medium' | 'low';
    recovery: 'excellent' | 'good' | 'needs_attention';
    mood: 'positive' | 'neutral' | 'low';
  };
  created_at: string;
  updated_at: string;
}

class DailyCopilotDBService {
  private static instance: DailyCopilotDBService;

  static getInstance(): DailyCopilotDBService {
    if (!DailyCopilotDBService.instance) {
      DailyCopilotDBService.instance = new DailyCopilotDBService();
    }
    return DailyCopilotDBService.instance;
  }

  /**
   * Salva i dati del Daily Copilot nel database
   */
  async saveDailyCopilotData(
    userId: string,
    copilotData: DailyCopilotData
  ): Promise<{ success: boolean; error?: string; data?: DailyCopilotRecord }> {
    try {
      // ✅ FIX: Use local timezone for "today" to avoid timezone issues
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const recordData = {
        user_id: userId,
        date: date,
        overall_score: copilotData.overallScore,
        mood: copilotData.mood,
        sleep_hours: copilotData.sleep.hours,
        sleep_quality: copilotData.sleep.quality,
        health_metrics: copilotData.healthMetrics,
        recommendations: copilotData.recommendations,
        summary: copilotData.summary,
        updated_at: new Date().toISOString(),
      };

      // Controlla se esiste già un record per oggi
      const { data: existingRecord, error: fetchError } = await supabase
        .from('daily_copilot_analyses')
        .select('id')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle(); // Use maybeSingle instead of single

      let result;
      if (existingRecord) {
        // Aggiorna il record esistente
        console.log(`📝 Updating existing Daily Copilot data for ${date}`);
        result = await supabase
          .from('daily_copilot_analyses')
          .update(recordData)
          .eq('id', existingRecord.id)
          .select()
          .single();
      } else {
        // Crea un nuovo record
        console.log(`📝 Inserting new Daily Copilot data for ${date}`);
        result = await supabase
          .from('daily_copilot_analyses')
          .insert({
            ...recordData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
      }

      if (result.error) {
        console.error('Error saving Daily Copilot data:', result.error);
        return { success: false, error: result.error.message };
      }

      console.log('✅ Daily Copilot data saved successfully');
      return { success: true, data: result.data as DailyCopilotRecord };

    } catch (error) {
      console.error('Error in saveDailyCopilotData:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Recupera i dati del Daily Copilot per una data specifica
   */
  async getDailyCopilotData(
    userId: string,
    date?: string
  ): Promise<{ success: boolean; data?: DailyCopilotRecord; error?: string }> {
    try {
      // ✅ FIX: Use local timezone for "today" to avoid timezone issues
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const targetDate = date || today;
      
      const { data, error } = await supabase
        .from('daily_copilot_analyses')
        .select('*')
        .eq('user_id', userId)
        .eq('date', targetDate)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Nessun record trovato
          return { success: true, data: undefined };
        }
        console.error('Error fetching Daily Copilot data:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data as DailyCopilotRecord };

    } catch (error) {
      console.error('Error in getDailyCopilotData:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Recupera la cronologia del Daily Copilot
   */
  async getDailyCopilotHistory(
    userId: string,
    limit: number = 30
  ): Promise<{ success: boolean; data?: DailyCopilotRecord[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('daily_copilot_analyses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching Daily Copilot history:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data as DailyCopilotRecord[] };

    } catch (error) {
      console.error('Error in getDailyCopilotHistory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Recupera le statistiche aggregate del Daily Copilot
   */
  async getDailyCopilotStats(
    userId: string,
    days: number = 30
  ): Promise<{ 
    success: boolean; 
    data?: {
      averageScore: number;
      averageMood: number;
      averageSleepHours: number;
      averageSleepQuality: number;
      totalRecommendations: number;
      mostCommonCategory: string;
      trend: 'improving' | 'stable' | 'declining';
    }; 
    error?: string 
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('daily_copilot_analyses')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching Daily Copilot stats:', error);
        return { success: false, error: error.message };
      }

      if (!data || data.length === 0) {
        return { success: true, data: undefined };
      }

      // Calcola le statistiche
      const totalRecords = data.length;
      const averageScore = data.reduce((sum, record) => sum + record.overall_score, 0) / totalRecords;
      const averageMood = data.reduce((sum, record) => sum + record.mood, 0) / totalRecords;
      const averageSleepHours = data.reduce((sum, record) => sum + record.sleep_hours, 0) / totalRecords;
      const averageSleepQuality = data.reduce((sum, record) => sum + record.sleep_quality, 0) / totalRecords;
      
      // Conta le raccomandazioni per categoria
      const categoryCount: { [key: string]: number } = {};
      let totalRecommendations = 0;
      
      data.forEach(record => {
        record.recommendations.forEach(rec => {
          categoryCount[rec.category] = (categoryCount[rec.category] || 0) + 1;
          totalRecommendations++;
        });
      });

      const mostCommonCategory = Object.keys(categoryCount).reduce((a, b) => 
        categoryCount[a] > categoryCount[b] ? a : b, 'energy'
      );

      // Calcola il trend
      const recentScores = data.slice(-7).map(r => r.overall_score);
      const olderScores = data.slice(0, Math.min(7, data.length)).map(r => r.overall_score);
      
      const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
      const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
      
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (recentAvg > olderAvg + 5) trend = 'improving';
      else if (recentAvg < olderAvg - 5) trend = 'declining';

      const stats = {
        averageScore: Math.round(averageScore),
        averageMood: Math.round(averageMood * 10) / 10,
        averageSleepHours: Math.round(averageSleepHours * 10) / 10,
        averageSleepQuality: Math.round(averageSleepQuality),
        totalRecommendations,
        mostCommonCategory,
        trend,
      };

      return { success: true, data: stats };

    } catch (error) {
      console.error('Error in getDailyCopilotStats:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Elimina i dati del Daily Copilot per una data specifica
   */
  async deleteDailyCopilotData(
    userId: string,
    date: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('daily_copilot_analyses')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);

      if (error) {
        console.error('Error deleting Daily Copilot data:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Daily Copilot data deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('Error in deleteDailyCopilotData:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Recupera i dati per il grafico dei trend (solo score e date)
   */
  async getTrendData(
    userId: string,
    days: number = 14
  ): Promise<{ success: boolean; data?: { date: string; score: number; mood: number }[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('daily_copilot_analyses')
        .select('date, overall_score, mood')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(days);

      if (error) {
        console.error('Error fetching trend data:', error);
        return { success: false, error: error.message };
      }

      const trendData = data?.map(record => ({
        date: record.date,
        score: record.overall_score,
        mood: record.mood
      })) || [];

      return { success: true, data: trendData };
    } catch (error: any) {
      console.error('Error in getTrendData:', error);
      return { success: false, error: error.message };
    }
  }
}

export default DailyCopilotDBService;
