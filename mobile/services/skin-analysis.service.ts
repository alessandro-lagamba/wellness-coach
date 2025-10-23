import { supabase, Tables, SkinAnalysis } from '../lib/supabase';

export class SkinAnalysisService {
  /**
   * Salva una nuova analisi della pelle nel database
   */
  static async saveSkinAnalysis(
    userId: string,
    analysis: {
      overallScore: number;
      hydrationScore?: number;
      oilinessScore?: number;
      textureScore?: number;
      pigmentationScore?: number;
      rednessScore?: number;  // Added redness score
      strengths: string[];
      improvements: string[];
      recommendations: string[];
      analysisData?: Record<string, any>;
      imageUrl?: string;
    }
  ): Promise<SkinAnalysis | null> {
    try {
      const { data, error } = await supabase
        .from(Tables.SKIN_ANALYSES)
        .insert({
          user_id: userId,
          overall_score: analysis.overallScore,
          hydration_score: analysis.hydrationScore,
          oiliness_score: analysis.oilinessScore,
          texture_score: analysis.textureScore,
          pigmentation_score: analysis.pigmentationScore,
          redness_score: analysis.rednessScore,  // Added redness score
          strengths: analysis.strengths,
          improvements: analysis.improvements,
          recommendations: analysis.recommendations,
          analysis_data: analysis.analysisData || {},
          image_url: analysis.imageUrl,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving skin analysis:', error);
        return null;
      }

      console.log('✅ Skin analysis saved:', data.id);
      return data;
    } catch (error) {
      console.error('Error in saveSkinAnalysis:', error);
      return null;
    }
  }

  /**
   * Ottiene l'ultima analisi della pelle di un utente
   */
  static async getLatestSkinAnalysis(userId: string): Promise<SkinAnalysis | null> {
    try {
      const { data, error } = await supabase
        .from(Tables.SKIN_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error getting latest skin analysis:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getLatestSkinAnalysis:', error);
      return null;
    }
  }

  /**
   * Ottiene le ultime N analisi della pelle di un utente
   */
  static async getSkinHistory(userId: string, limit: number = 5): Promise<SkinAnalysis[]> {
    try {
      const { data, error } = await supabase
        .from(Tables.SKIN_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting skin history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSkinHistory:', error);
      return [];
    }
  }

  /**
   * Ottiene il contesto della pelle completo per l'AI
   */
  static async getSkinContextForAI(userId: string): Promise<{
    current: SkinAnalysis | null;
    history: SkinAnalysis[];
    trend: 'improving' | 'stable' | 'declining';
  }> {
    try {
      const [current, history] = await Promise.all([
        this.getLatestSkinAnalysis(userId),
        this.getSkinHistory(userId, 5)
      ]);

      // Calcola il trend basato sul punteggio generale
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      
      if (history.length >= 3) {
        const recent = history.slice(0, 3);
        const older = history.slice(3);
        
        if (recent.length > 0 && older.length > 0) {
          const recentAvgScore = recent.reduce((sum, h) => sum + h.overall_score, 0) / recent.length;
          const olderAvgScore = older.reduce((sum, h) => sum + h.overall_score, 0) / older.length;
          
          if (recentAvgScore > olderAvgScore + 5) {
            trend = 'improving';
          } else if (recentAvgScore < olderAvgScore - 5) {
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
      console.error('Error in getSkinContextForAI:', error);
      return {
        current: null,
        history: [],
        trend: 'stable'
      };
    }
  }

  /**
   * Ottiene statistiche della pelle per un periodo
   */
  static async getSkinStats(
    userId: string, 
    days: number = 30
  ): Promise<{
    totalAnalyses: number;
    averageOverallScore: number;
    averageHydrationScore: number;
    averageOilinessScore: number;
    averageTextureScore: number;
    averagePigmentationScore: number;
    commonStrengths: Record<string, number>;
    commonImprovements: Record<string, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from(Tables.SKIN_ANALYSES)
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error getting skin stats:', error);
        return {
          totalAnalyses: 0,
          averageOverallScore: 0,
          averageHydrationScore: 0,
          averageOilinessScore: 0,
          averageTextureScore: 0,
          averagePigmentationScore: 0,
          commonStrengths: {},
          commonImprovements: {}
        };
      }

      const analyses = data || [];
      const commonStrengths: Record<string, number> = {};
      const commonImprovements: Record<string, number> = {};
      
      let totalOverall = 0;
      let totalHydration = 0;
      let totalOiliness = 0;
      let totalTexture = 0;
      let totalPigmentation = 0;
      let hydrationCount = 0;
      let oilinessCount = 0;
      let textureCount = 0;
      let pigmentationCount = 0;

      analyses.forEach(analysis => {
        totalOverall += analysis.overall_score;
        
        if (analysis.hydration_score !== null) {
          totalHydration += analysis.hydration_score;
          hydrationCount++;
        }
        if (analysis.oiliness_score !== null) {
          totalOiliness += analysis.oiliness_score;
          oilinessCount++;
        }
        if (analysis.texture_score !== null) {
          totalTexture += analysis.texture_score;
          textureCount++;
        }
        if (analysis.pigmentation_score !== null) {
          totalPigmentation += analysis.pigmentation_score;
          pigmentationCount++;
        }

        // Conta strengths comuni
        analysis.strengths.forEach(strength => {
          commonStrengths[strength] = (commonStrengths[strength] || 0) + 1;
        });

        // Conta improvements comuni
        analysis.improvements.forEach(improvement => {
          commonImprovements[improvement] = (commonImprovements[improvement] || 0) + 1;
        });
      });

      return {
        totalAnalyses: analyses.length,
        averageOverallScore: analyses.length > 0 ? totalOverall / analyses.length : 0,
        averageHydrationScore: hydrationCount > 0 ? totalHydration / hydrationCount : 0,
        averageOilinessScore: oilinessCount > 0 ? totalOiliness / oilinessCount : 0,
        averageTextureScore: textureCount > 0 ? totalTexture / textureCount : 0,
        averagePigmentationScore: pigmentationCount > 0 ? totalPigmentation / pigmentationCount : 0,
        commonStrengths,
        commonImprovements
      };
    } catch (error) {
      console.error('Error in getSkinStats:', error);
      return {
        totalAnalyses: 0,
        averageOverallScore: 0,
        averageHydrationScore: 0,
        averageOilinessScore: 0,
        averageTextureScore: 0,
        averagePigmentationScore: 0,
        commonStrengths: {},
        commonImprovements: {}
      };
    }
  }

  /**
   * Trova correlazioni tra emozioni e pelle
   */
  static async getEmotionSkinCorrelations(userId: string): Promise<{
    correlations: Array<{
      emotion: string;
      skinScore: number;
      correlation: number;
    }>;
    insights: string[];
  }> {
    try {
      // Questa funzione potrebbe essere implementata con query più complesse
      // Per ora restituiamo dati di esempio
      return {
        correlations: [],
        insights: [
          'Lo stress può influenzare negativamente la qualità della pelle',
          'Le emozioni positive sono correlate a una pelle più luminosa',
          'L\'ansia può aumentare la produzione di sebo'
        ]
      };
    } catch (error) {
      console.error('Error in getEmotionSkinCorrelations:', error);
      return {
        correlations: [],
        insights: []
      };
    }
  }
}


