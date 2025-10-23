import { supabase } from '../lib/supabase';

export interface DetailedAnalysisRecord {
  id: string;
  user_id: string;
  analysis_type: 'emotion' | 'skin';
  analysis_date: string;
  analysis_data: any;
  ai_response: string;
  created_at: string;
  updated_at: string;
}

export class DetailedAnalysisDBService {
  private static instance: DetailedAnalysisDBService;

  public static getInstance(): DetailedAnalysisDBService {
    if (!DetailedAnalysisDBService.instance) {
      DetailedAnalysisDBService.instance = new DetailedAnalysisDBService();
    }
    return DetailedAnalysisDBService.instance;
  }

  /**
   * Salva una nuova analisi dettagliata nel database
   */
  async saveDetailedAnalysis(
    userId: string,
    analysisType: 'emotion' | 'skin',
    analysisData: any,
    aiResponse: string
  ): Promise<{ success: boolean; error?: string; data?: DetailedAnalysisRecord }> {
    try {
      const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      
      const recordData = {
        user_id: userId,
        analysis_type: analysisType,
        analysis_date: date,
        analysis_data: analysisData,
        ai_response: aiResponse,
        updated_at: new Date().toISOString(),
      };

      // Controlla se esiste già un record per oggi
      const { data: existingRecord, error: fetchError } = await supabase
        .from('detailed_analysis')
        .select('id')
        .eq('user_id', userId)
        .eq('analysis_type', analysisType)
        .eq('analysis_date', date)
        .maybeSingle();

      let result;
      if (existingRecord) {
        // Aggiorna il record esistente
        console.log(`📝 Updating existing detailed analysis for ${analysisType} on ${date}`);
        result = await supabase
          .from('detailed_analysis')
          .update(recordData)
          .eq('id', existingRecord.id)
          .select()
          .single();
      } else {
        // Crea un nuovo record
        console.log(`📝 Inserting new detailed analysis for ${analysisType} on ${date}`);
        result = await supabase
          .from('detailed_analysis')
          .insert({
            ...recordData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
      }

      if (result.error) {
        console.error('Error saving detailed analysis:', result.error);
        return { success: false, error: result.error.message };
      }

      console.log('✅ Detailed analysis saved successfully');
      return { success: true, data: result.data };
    } catch (error) {
      console.error('Error in saveDetailedAnalysis:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Ottiene l'analisi dettagliata per oggi se esiste
   */
  async getTodaysDetailedAnalysis(
    userId: string,
    analysisType: 'emotion' | 'skin'
  ): Promise<{ success: boolean; data?: DetailedAnalysisRecord; error?: string }> {
    try {
      const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      
      const { data, error } = await supabase
        .from('detailed_analysis')
        .select('*')
        .eq('user_id', userId)
        .eq('analysis_type', analysisType)
        .eq('analysis_date', date)
        .maybeSingle();

      if (error) {
        console.error('Error fetching detailed analysis:', error);
        return { success: false, error: error.message };
      }

      if (data) {
        console.log(`✅ Found existing detailed analysis for ${analysisType} on ${date}`);
        return { success: true, data };
      } else {
        console.log(`ℹ️ No existing detailed analysis found for ${analysisType} on ${date}`);
        return { success: true, data: undefined };
      }
    } catch (error) {
      console.error('Error in getTodaysDetailedAnalysis:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Ottiene la cronologia delle analisi dettagliate
   */
  async getDetailedAnalysisHistory(
    userId: string,
    analysisType: 'emotion' | 'skin',
    limit: number = 10
  ): Promise<{ success: boolean; data?: DetailedAnalysisRecord[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('detailed_analysis')
        .select('*')
        .eq('user_id', userId)
        .eq('analysis_type', analysisType)
        .order('analysis_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching detailed analysis history:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Fetched ${data?.length || 0} detailed analysis records for ${analysisType}`);
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error in getDetailedAnalysisHistory:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

