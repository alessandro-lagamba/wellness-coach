export interface Insight {
  id: string;
  type: 'correlation' | 'pattern' | 'anomaly' | 'trend';
  title: string;
  message: string;
  confidence: number;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  category: 'skin' | 'emotion' | 'lifestyle' | 'health';
  relatedMetrics: string[];
  suggestions?: string[];
}

export interface SkinCapture {
  id: string;
  timestamp: Date;
  scores: {
    texture: number;
    redness: number;
    hydration: number;
    oiliness: number;
    overall: number;
  };
  confidence: number;
  quality: {
    lighting: number;
    focus: number;
    roi_coverage: number;
  };
}

export interface EmotionSession {
  id: string;
  timestamp: Date;
  dominant: string;
  avg_valence: number;
  avg_arousal: number;
  confidence: number;
}

export class CorrelationService {
  // Rileva correlazioni tra dati di pelle ed emozioni
  static getInsights(skinData: SkinCapture | SkinCapture[] | null, emotionData: EmotionSession | EmotionSession[] | null): Insight[] {
    const insights: Insight[] = [];

    // Gestisce sia oggetti singoli che array
    const latestSkinData = Array.isArray(skinData) ? skinData[skinData.length - 1] : skinData;
    const latestEmotionData = Array.isArray(emotionData) ? emotionData[emotionData.length - 1] : emotionData;

    // Se non ci sono dati sufficienti, restituisce insights generici
    if (!latestSkinData && !latestEmotionData) {
      return this.getGenericInsights();
    }

    // Se abbiamo solo dati di pelle
    if (latestSkinData && !latestEmotionData) {
      return this.getSkinOnlyInsights(latestSkinData);
    }

    // Se abbiamo solo dati di emozioni
    if (!latestSkinData && latestEmotionData) {
      return this.getEmotionOnlyInsights(latestEmotionData);
    }

    // Se abbiamo entrambi i tipi di dati
    if (latestSkinData && latestEmotionData) {
      return this.getCombinedInsights(latestSkinData, latestEmotionData);
    }

    return insights;
  }

  // Insights generici quando non ci sono dati
  private static getGenericInsights(): Insight[] {
    return [
      {
        id: 'welcome_insight',
        type: 'pattern',
        title: 'Benvenuto!',
        message: 'Inizia le tue analisi per ricevere insights personalizzati',
        confidence: 0.9,
        actionable: true,
        priority: 'low',
        category: 'health',
        relatedMetrics: [],
        suggestions: ['Fai la tua prima analisi della pelle', 'Prova l\'analisi delle emozioni']
      }
    ];
  }

  // Insights solo per dati di pelle
  private static getSkinOnlyInsights(skinData: SkinCapture): Insight[] {
    const insights: Insight[] = [];

    // Correlazione Texture + Hydration
    if (skinData.scores.texture < 50 && skinData.scores.hydration < 55) {
      insights.push({
        id: 'texture_hydration_correlation',
        type: 'correlation',
        title: 'Secchezza Superficiale',
        message: 'Texture bassa + Hydration bassa → probabile secchezza superficiale',
        confidence: 0.8,
        actionable: true,
        priority: 'high',
        category: 'skin',
        relatedMetrics: ['texture', 'hydration'],
        suggestions: [
          'Focus su idratazione profonda',
          'Usa prodotti con acido ialuronico',
          'Bevi più acqua'
        ]
      });
    }

    // Correlazione Oiliness + Redness
    if (skinData.scores.oiliness > 65 && skinData.scores.redness > 50) {
      insights.push({
        id: 'oiliness_redness_correlation',
        type: 'correlation',
        title: 'Irritazione da Sebo',
        message: 'Oiliness alta + Redness alta → possibile irritazione da eccesso di sebo',
        confidence: 0.7,
        actionable: true,
        priority: 'medium',
        category: 'skin',
        relatedMetrics: ['oiliness', 'redness'],
        suggestions: [
          'Detergente astringente',
          'Tonico equilibrante',
          'Crema oil-free'
        ]
      });
    }

    // Pattern di pelle sana
    if (skinData.scores.overall > 80) {
      insights.push({
        id: 'healthy_skin_pattern',
        type: 'anomaly',
        title: 'Pelle Sana',
        message: 'Ottima salute della pelle! Continua così.',
        confidence: 0.9,
        actionable: false,
        priority: 'low',
        category: 'skin',
        relatedMetrics: ['overall'],
        suggestions: [
          'Continua con la routine attuale',
          'Mantieni le abitudini positive'
        ]
      });
    }

    return insights;
  }

  // Insights solo per dati di emozioni
  private static getEmotionOnlyInsights(emotionData: EmotionSession): Insight[] {
    const insights: Insight[] = [];

    // Combinazione Valence x Arousal
    const combination = this.getValenceArousalCombination(emotionData.avg_valence, emotionData.avg_arousal);
    insights.push({
      id: 'valence_arousal_combination',
      type: 'correlation',
      title: 'Stato Emotivo',
      message: combination.message,
      confidence: 0.9,
      actionable: combination.actionable,
      priority: combination.priority,
      category: 'emotion',
      relatedMetrics: ['valence', 'arousal'],
      suggestions: combination.suggestions
    });

    return insights;
  }

  // Insights combinati per pelle ed emozioni
  private static getCombinedInsights(skinData: SkinCapture, emotionData: EmotionSession): Insight[] {
    const insights: Insight[] = [];

    // Correlazione Redness + Arousal
    if (skinData.scores.redness > 60 && emotionData.avg_arousal > 0.7) {
      insights.push({
        id: 'redness_arousal_correlation',
        type: 'correlation',
        title: 'Stress Cutaneo',
        message: 'Redness alta + Arousal alta → stress potrebbe accentuare rossore',
        confidence: 0.75,
        actionable: true,
        priority: 'high',
        category: 'health',
        relatedMetrics: ['redness', 'arousal'],
        suggestions: [
          'Tecniche di rilassamento',
          'Skincare delicata',
          'Evita prodotti aggressivi'
        ]
      });
    }

    // Correlazione Valence + Overall Skin Health
    if (emotionData.avg_valence < -0.2 && skinData.scores.overall < 60) {
      insights.push({
        id: 'valence_skin_correlation',
        type: 'correlation',
        title: 'Umore e Pelle',
        message: 'Valence negativa + Skin Health bassa → umore potrebbe influenzare la pelle',
        confidence: 0.65,
        actionable: true,
        priority: 'medium',
        category: 'health',
        relatedMetrics: ['valence', 'overall'],
        suggestions: [
          'Attività rilassanti',
          'Skincare routine rilassante',
          'Consulta un professionista se necessario'
        ]
      });
    }

    // Pattern di stress cronico
    if (emotionData.avg_arousal > 0.8 && skinData.scores.redness > 40 && skinData.scores.texture < 60) {
      insights.push({
        id: 'chronic_stress_pattern',
        type: 'pattern',
        title: 'Pattern di Stress',
        message: 'Alta attivazione + rossore + texture compromessa → possibile stress cronico',
        confidence: 0.7,
        actionable: true,
        priority: 'high',
        category: 'health',
        relatedMetrics: ['arousal', 'redness', 'texture'],
        suggestions: [
          'Tecniche di gestione dello stress',
          'Routine skincare anti-stress',
          'Considera supporto professionale'
        ]
      });
    }

    // Anomalia positiva
    if (skinData.scores.overall > 80 && emotionData.avg_valence > 0.3) {
      insights.push({
        id: 'positive_anomaly',
        type: 'anomaly',
        title: 'Stato Ottimale',
        message: 'Pelle sana + umore positivo → mantieni questo equilibrio!',
        confidence: 0.9,
        actionable: false,
        priority: 'low',
        category: 'health',
        relatedMetrics: ['overall', 'valence'],
        suggestions: [
          'Continua con la routine attuale',
          'Mantieni le abitudini positive'
        ]
      });
    }

    return insights;
  }

  // Rileva pattern temporali
  static detectTemporalPatterns(data: Array<{ timestamp: Date; value: number }>, metric: string): Insight[] {
    const insights: Insight[] = [];

    if (data.length < 3) return insights;

    // Calcola trend
    const values = data.map(d => d.value);
    const trend = this.calculateTrend(values);

    // Pattern di miglioramento
    if (trend > 0.1) {
      insights.push({
        id: `${metric}_improvement_trend`,
        type: 'trend',
        title: 'Miglioramento in Corso',
        message: `${metric} sta migliorando nel tempo`,
        confidence: 0.8,
        actionable: false,
        priority: 'low',
        category: 'skin',
        relatedMetrics: [metric],
        suggestions: ['Continua con la routine attuale']
      });
    }

    // Pattern di peggioramento
    if (trend < -0.1) {
      insights.push({
        id: `${metric}_decline_trend`,
        type: 'trend',
        title: 'Attenzione al Trend',
        message: `${metric} sta peggiorando nel tempo`,
        confidence: 0.8,
        actionable: true,
        priority: 'high',
        category: 'skin',
        relatedMetrics: [metric],
        suggestions: ['Rivedi la routine', 'Considera cambiamenti']
      });
    }

    return insights;
  }

  // Calcola trend da serie di valori
  private static calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  // Genera insight per combinazioni specifiche
  static getCombinationInsights(metrics: Record<string, number>): Insight[] {
    const insights: Insight[] = [];

    // Combinazione Valence x Arousal
    if (metrics.valence !== undefined && metrics.arousal !== undefined) {
      const combination = this.getValenceArousalCombination(metrics.valence, metrics.arousal);
      insights.push({
        id: 'valence_arousal_combination',
        type: 'correlation',
        title: 'Stato Emotivo',
        message: combination.message,
        confidence: 0.9,
        actionable: combination.actionable,
        priority: combination.priority,
        category: 'emotion',
        relatedMetrics: ['valence', 'arousal'],
        suggestions: combination.suggestions
      });
    }

    return insights;
  }

  // Ottieni combinazione Valence x Arousal
  private static getValenceArousalCombination(valence: number, arousal: number): {
    message: string;
    actionable: boolean;
    priority: 'low' | 'medium' | 'high';
    suggestions: string[];
  } {
    if (valence > 0.3 && arousal > 0.7) {
      return {
        message: 'Positiva + Alta → entusiasta',
        actionable: false,
        priority: 'low',
        suggestions: ['Mantieni questo stato positivo!']
      };
    } else if (valence < -0.2 && arousal > 0.7) {
      return {
        message: 'Negativa + Alta → stressato/irritato',
        actionable: true,
        priority: 'high',
        suggestions: [
          'Tecniche di rilassamento',
          'Respirazione profonda',
          'Attività calmanti'
        ]
      };
    } else if (valence > 0.3 && arousal < 0.4) {
      return {
        message: 'Positiva + Bassa → sereno/composto',
        actionable: false,
        priority: 'low',
        suggestions: ['Stato emotivo equilibrato']
      };
    } else if (valence < -0.2 && arousal < 0.4) {
      return {
        message: 'Negativa + Bassa → triste/apatia',
        actionable: true,
        priority: 'medium',
        suggestions: [
          'Attività piacevoli',
          'Contatto sociale',
          'Movimento leggero'
        ]
      };
    } else {
      return {
        message: 'Stato emotivo neutro',
        actionable: false,
        priority: 'low',
        suggestions: ['Mantieni l\'equilibrio']
      };
    }
  }

  // Filtra insight per rilevanza
  static filterRelevantInsights(insights: Insight[], maxInsights: number = 3): Insight[] {
    return insights
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, maxInsights);
  }

  // Genera messaggio di disclaimer
  static getDisclaimerMessage(): string {
    return 'Valutazione cosmetica, non diagnostica. Per dubbi clinici rivolgiti a un professionista.';
  }

  // Valida se un insight è appropriato per l'utente
  static isInsightAppropriate(insight: Insight, userContext?: any): boolean {
    // Filtra insight troppo tecnici per utenti generali
    if (insight.confidence < 0.5) {
      return false;
    }

    // Filtra insight medici se l'utente non ha condizioni specifiche
    if (insight.category === 'health' && insight.priority === 'high' && !userContext?.medicalConditions) {
      return false;
    }

    return true;
  }
}
