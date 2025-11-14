import { supabase } from '../lib/supabase';
import { IntelligentInsight, InsightAnalysisResponse } from './intelligent-insight.service';

interface InsightRecord {
  id: string;
  user_id: string;
  analysis_date: string;
  category: 'emotion' | 'skin';
  insights: IntelligentInsight[];
  trend_summary: string;
  overall_score?: number;
  focus?: string;
  created_at: string;
  updated_at: string;
}

interface InsightHistoryRecord {
  id: string;
  user_id: string;
  analysis_date: string;
  category: 'emotion' | 'skin';
  insights_count: number;
  trend_summary: string;
  overall_score?: number;
  focus?: string;
  created_at: string;
}

class IntelligentInsightDBService {
  private static instance: IntelligentInsightDBService;

  static getInstance(): IntelligentInsightDBService {
    if (!IntelligentInsightDBService.instance) {
      IntelligentInsightDBService.instance = new IntelligentInsightDBService();
    }
    return IntelligentInsightDBService.instance;
  }

  /**
   * Save intelligent insights to database
   */
  async saveIntelligentInsights(
    userId: string, 
    category: 'emotion' | 'skin',
    insightsData: InsightAnalysisResponse
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // First, try to get existing record
      const { data: existingData, error: fetchError } = await supabase
        .from('intelligent_insights')
        .select('id')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('analysis_date', today)
        .maybeSingle(); // Use maybeSingle instead of single

      if (fetchError) {
        console.error('Error checking existing insights:', fetchError);
        return { success: false, error: fetchError.message };
      }

      const record = {
        user_id: userId,
        analysis_date: today,
        category: category,
        insights: insightsData.insights,
        trend_summary: insightsData.trendSummary,
        overall_score: insightsData.overallScore,
        focus: insightsData.focus,
      };

      // Use UPSERT to handle both insert and update in one operation
      // This prevents race conditions and duplicate key errors
      const { error: upsertError } = await supabase
        .from('intelligent_insights')
        .upsert(record, {
          onConflict: 'user_id,category,analysis_date',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Error upserting intelligent insights:', upsertError);
        return { success: false, error: upsertError.message };
      }
      
      if (existingData) {
        console.log(`✅ Updated intelligent insights for ${category} on ${today}`);
      } else {
        console.log(`✅ Inserted new intelligent insights for ${category} on ${today}`);
      }
      return { success: true };
    } catch (error: any) {
      console.error('Error saving intelligent insights:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get intelligent insights for a specific date
   */
  async getIntelligentInsights(
    userId: string,
    category: 'emotion' | 'skin',
    date?: string
  ): Promise<{ success: boolean; data?: InsightRecord; error?: string }> {
    try {
      const targetDate = date || new Date().toISOString().slice(0, 10);
      
      const { data, error } = await supabase
        .from('intelligent_insights')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('analysis_date', targetDate)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Nessun record trovato
          return { success: true, data: undefined };
        }
        console.error('Error fetching intelligent insights:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data as InsightRecord };
    } catch (error: any) {
      console.error('Error getting intelligent insights:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get intelligent insights history
   */
  async getIntelligentInsightsHistory(
    userId: string,
    category: 'emotion' | 'skin',
    limit: number = 30
  ): Promise<{ success: boolean; data?: InsightHistoryRecord[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('intelligent_insights')
        .select('id, user_id, analysis_date, category, insights, trend_summary, overall_score, focus, created_at')
        .eq('user_id', userId)
        .eq('category', category)
        .order('analysis_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching insights history:', error);
        return { success: false, error: error.message };
      }

      // Transform data to include insights count
      const historyData: InsightHistoryRecord[] = (data || []).map(record => ({
        id: record.id,
        user_id: record.user_id,
        analysis_date: record.analysis_date,
        category: record.category,
        insights_count: Array.isArray(record.insights) ? record.insights.length : 0,
        trend_summary: record.trend_summary,
        overall_score: record.overall_score,
        focus: record.focus,
        created_at: record.created_at,
      }));

      return { success: true, data: historyData };
    } catch (error: any) {
      console.error('Error getting insights history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get trend data for charts
   */
  async getInsightsTrendData(
    userId: string,
    category: 'emotion' | 'skin',
    days: number = 30
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('intelligent_insights')
        .select('analysis_date, overall_score, focus')
        .eq('user_id', userId)
        .eq('category', category)
        .gte('analysis_date', startDateStr)
        .order('analysis_date', { ascending: true });

      if (error) {
        console.error('Error fetching insights trend data:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error getting insights trend data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert database record to InsightAnalysisResponse
   */
  convertDBRecordToInsightsData(record: InsightRecord): InsightAnalysisResponse {
    return {
      insights: record.insights || [],
      trendSummary: record.trend_summary || 'Nessun trend disponibile',
      overallScore: record.overall_score || 70,
      focus: record.focus || 'Miglioramento generale'
    };
  }

  /**
   * Delete old insights (cleanup)
   */
  async deleteOldInsights(
    userId: string,
    category: 'emotion' | 'skin',
    daysToKeep: number = 90
  ): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('intelligent_insights')
        .delete()
        .eq('user_id', userId)
        .eq('category', category)
        .lt('analysis_date', cutoffDateStr)
        .select('id');

      if (error) {
        console.error('Error deleting old insights:', error);
        return { success: false, error: error.message };
      }

      return { success: true, deletedCount: data?.length || 0 };
    } catch (error: any) {
      console.error('Error deleting old insights:', error);
      return { success: false, error: error.message };
    }
  }
}

export default IntelligentInsightDBService;
