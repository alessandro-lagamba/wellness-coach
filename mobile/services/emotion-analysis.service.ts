import { supabase, Tables, EmotionAnalysis } from '../lib/supabase';

export class EmotionAnalysisService {
  /**
   * Salva una nuova analisi emotiva nel database
   */
  static async saveEmotionAnalysis(
    userId: string,
    analysis: {
      dominantEmotion: string;
      valence: number;
      arousal: number;
      confidence: number;
      analysisData?: Record<string, any>;
      sessionDuration?: number;
    }
  ): Promise<EmotionAnalysis | null> {
    try {
      const { data, error } = await supabase
        .from(Tables.EMOTION_ANALYSES)
        .insert({
          user_id: userId,
          dominant_emotion: analysis.dominantEmotion,
          valence: analysis.valence,
          arousal: analysis.arousal,
          confidence: analysis.confidence,
          analysis_data: analysis.analysisData || {},
          session_duration: analysis.sessionDuration,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving emotion analysis:', error);
        return null;
      }

      console.log('✅ Emotion analysis saved:', data.id);
      return data;
    } catch (error) {
      console.error('Error in saveEmotionAnalysis:', error);
      return null;
    }
  }

  /**
   * Ottiene l'ultima analisi emotiva di un utente
   */
  static async getLatestEmotionAnalysis(userId: string): Promise<EmotionAnalysis | null> {
    try {
      const { data, error } = await supabase
        .from(Tables.EMOTION_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error getting latest emotion analysis:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getLatestEmotionAnalysis:', error);
      return null;
    }
  }

  /**
   * Ottiene le ultime N analisi emotive di un utente
   */
  static async getEmotionHistory(userId: string, limit: number = 5): Promise<EmotionAnalysis[]> {
    try {
      const { data, error } = await supabase
        .from(Tables.EMOTION_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting emotion history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getEmotionHistory:', error);
      return [];
    }
  }

  /**
   * Ottiene il contesto emotivo completo per l'AI
   */
  static async getEmotionContextForAI(userId: string): Promise<{
    current: EmotionAnalysis | null;
    history: EmotionAnalysis[];
    trend: 'improving' | 'stable' | 'declining';
  }> {
    try {
      const [current, history] = await Promise.all([
        this.getLatestEmotionAnalysis(userId),
        this.getEmotionHistory(userId, 5)
      ]);

      // Calcola il trend basato sulle ultime analisi
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      
      if (history.length >= 3) {
        const recent = history.slice(0, 3);
        const older = history.slice(3);
        
        if (recent.length > 0 && older.length > 0) {
          const recentAvgValence = recent.reduce((sum, h) => sum + h.valence, 0) / recent.length;
          const olderAvgValence = older.reduce((sum, h) => sum + h.valence, 0) / older.length;
          
          if (recentAvgValence > olderAvgValence + 0.1) {
            trend = 'improving';
          } else if (recentAvgValence < olderAvgValence - 0.1) {
            trend = 'declining';
          }
        }
      }

      return {
        current,
        history,
        trend
      };
    } catch (error) {
      console.error('Error in getEmotionContextForAI:', error);
      return {
        current: null,
        history: [],
        trend: 'stable'
      };
    }
  }

  /**
   * Ottiene statistiche emotive per un periodo
   */
  static async getEmotionStats(
    userId: string, 
    days: number = 30
  ): Promise<{
    totalAnalyses: number;
    dominantEmotions: Record<string, number>;
    averageValence: number;
    averageArousal: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from(Tables.EMOTION_ANALYSES)
        .select('dominant_emotion, valence, arousal')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error getting emotion stats:', error);
        return {
          totalAnalyses: 0,
          dominantEmotions: {},
          averageValence: 0,
          averageArousal: 0
        };
      }

      const analyses = data || [];
      const dominantEmotions: Record<string, number> = {};
      let totalValence = 0;
      let totalArousal = 0;

      analyses.forEach(analysis => {
        dominantEmotions[analysis.dominant_emotion] = 
          (dominantEmotions[analysis.dominant_emotion] || 0) + 1;
        totalValence += analysis.valence;
        totalArousal += analysis.arousal;
      });

      return {
        totalAnalyses: analyses.length,
        dominantEmotions,
        averageValence: analyses.length > 0 ? totalValence / analyses.length : 0,
        averageArousal: analyses.length > 0 ? totalArousal / analyses.length : 0
      };
    } catch (error) {
      console.error('Error in getEmotionStats:', error);
      return {
        totalAnalyses: 0,
        dominantEmotions: {},
        averageValence: 0,
        averageArousal: 0
      };
    }
  }
}


