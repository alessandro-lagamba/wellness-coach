import { supabase } from '../lib/supabase';
import { encryptText, decryptText } from './encryption.service';

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
      
      // Cifra ai_response prima di salvare
      let encryptedAiResponse: string | null = null;
      try {
        encryptedAiResponse = await encryptText(aiResponse, userId);
      } catch (encError) {
        console.warn('[DetailedAnalysis] ⚠️ Encryption failed, saving as plaintext (fallback):', encError);
        encryptedAiResponse = aiResponse; // Fallback
      }
      
      const recordData = {
        user_id: userId,
        analysis_type: analysisType,
        analysis_date: date,
        analysis_data: analysisData,
        ai_response: encryptedAiResponse,
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
      
      // Decifra ai_response prima di restituire
      const record = result.data as DetailedAnalysisRecord;
      if (record.ai_response) {
        const decrypted = await decryptText(record.ai_response, userId);
        if (decrypted !== null) {
          record.ai_response = decrypted;
        }
      }
      
      return { success: true, data: record };
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
        
        // Decifra ai_response prima di restituire
        const record = data as DetailedAnalysisRecord;
        if (record.ai_response) {
          const decrypted = await decryptText(record.ai_response, userId);
          if (decrypted !== null) {
            record.ai_response = decrypted;
          }
        }
        
        return { success: true, data: record };
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
      
      // Decifra ai_response per tutti i record
      const records = (data || []) as DetailedAnalysisRecord[];
      for (const record of records) {
        if (record.ai_response) {
          const decrypted = await decryptText(record.ai_response, userId);
          if (decrypted !== null) {
            record.ai_response = decrypted;
          }
        }
      }
      
      return { success: true, data: records };
    } catch (error) {
      console.error('Error in getDetailedAnalysisHistory:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

