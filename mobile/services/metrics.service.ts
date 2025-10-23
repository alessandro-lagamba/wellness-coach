export interface BucketInfo {
  label: string;
  color: string;
  icon: string;
  description: string;
}

export interface TrendInfo {
  trend: '↑' | '↓' | '→';
  text: string;
  percentage: number;
}

export interface Thresholds {
  low: number;
  medium: number;
  high: number;
}

export class MetricsService {
  // Bucketing per Skin Metrics
  static getSkinBucket(metric: string, value: number): BucketInfo {
    switch (metric) {
      case 'texture':
        return this.getTextureBucket(value);
      case 'redness':
        return this.getRednessBucket(value);
      case 'hydration':
        return this.getHydrationBucket(value);
      case 'oiliness':
        return this.getOilinessBucket(value);
      case 'overall':
        return this.getOverallBucket(value);
      default:
        return this.getDefaultBucket(value);
    }
  }

  // Bucketing per Emotion Metrics
  static getEmotionBucket(metric: string, value: number): BucketInfo {
    switch (metric) {
      case 'valence':
        return this.getValenceBucket(value);
      case 'arousal':
        return this.getArousalBucket(value);
      default:
        return this.getDefaultBucket(value);
    }
  }

  // Skin Metric Buckets
  private static getTextureBucket(value: number): BucketInfo {
    if (value < 40) return { label: "Rough", color: "#ef4444", icon: "⚠️", description: "Pelle ruvida e irregolare" };
    if (value < 60) return { label: "Fair", color: "#f59e0b", icon: "⚠️", description: "Texture migliorabile" };
    if (value < 80) return { label: "Good", color: "#10b981", icon: "✅", description: "Texture buona" };
    return { label: "Excellent", color: "#06b6d4", icon: "🌟", description: "Texture eccellente" };
  }

  private static getRednessBucket(value: number): BucketInfo {
    if (value < 20) return { label: "Low", color: "#10b981", icon: "✅", description: "Pelle calma e sana" };
    if (value < 40) return { label: "Mild", color: "#f59e0b", icon: "⚠️", description: "Leggero arrossamento" };
    if (value < 60) return { label: "Moderate", color: "#ef4444", icon: "⚠️", description: "Arrossamento moderato" };
    return { label: "High", color: "#dc2626", icon: "🚨", description: "Arrossamento significativo" };
  }

  private static getHydrationBucket(value: number): BucketInfo {
    if (value < 40) return { label: "Low", color: "#ef4444", icon: "⚠️", description: "Pelle disidratata" };
    if (value < 55) return { label: "Below Optimal", color: "#f59e0b", icon: "⚠️", description: "Sotto l'ottimale" };
    if (value < 75) return { label: "Optimal", color: "#10b981", icon: "✅", description: "Idratazione ottimale" };
    return { label: "High", color: "#06b6d4", icon: "💧", description: "Molto idratata" };
  }

  private static getOilinessBucket(value: number): BucketInfo {
    if (value < 30) return { label: "Dry", color: "#ef4444", icon: "⚠️", description: "Pelle secca" };
    if (value < 50) return { label: "Balanced", color: "#10b981", icon: "✅", description: "Equilibrio ottimale" };
    if (value < 65) return { label: "Oily", color: "#f59e0b", icon: "⚠️", description: "Pelle oleosa" };
    return { label: "Very Oily", color: "#dc2626", icon: "🚨", description: "Pelle molto oleosa" };
  }

  private static getOverallBucket(value: number): BucketInfo {
    if (value < 40) return { label: "Poor", color: "#ef4444", icon: "⚠️", description: "Salute cutanea da migliorare" };
    if (value < 60) return { label: "Fair", color: "#f59e0b", icon: "⚠️", description: "Salute cutanea discreta" };
    if (value < 80) return { label: "Good", color: "#10b981", icon: "✅", description: "Salute cutanea buona" };
    return { label: "Excellent", color: "#06b6d4", icon: "🌟", description: "Salute cutanea eccellente" };
  }

  // Emotion Metric Buckets
  private static getValenceBucket(value: number): BucketInfo {
    if (value < -0.3) return { label: "Negative", color: "#ef4444", icon: "😞", description: "Espressione negativa" };
    if (value < 0.1) return { label: "Neutral", color: "#6b7280", icon: "😐", description: "Espressione neutra" };
    if (value < 0.5) return { label: "Positive", color: "#10b981", icon: "😊", description: "Espressione positiva" };
    return { label: "Very Positive", color: "#06b6d4", icon: "😄", description: "Espressione molto positiva" };
  }

  private static getArousalBucket(value: number): BucketInfo {
    if (value < 0.3) return { label: "Low", color: "#6b7280", icon: "😴", description: "Bassa energia" };
    if (value < 0.6) return { label: "Medium", color: "#f59e0b", icon: "😐", description: "Energia moderata" };
    if (value < 0.8) return { label: "High", color: "#ef4444", icon: "😤", description: "Alta energia" };
    return { label: "Very High", color: "#dc2626", icon: "🔥", description: "Energia molto alta" };
  }

  private static getDefaultBucket(value: number): BucketInfo {
    if (value < 30) return { label: "Low", color: "#ef4444", icon: "⚠️", description: "Valore basso" };
    if (value < 70) return { label: "Medium", color: "#f59e0b", icon: "⚠️", description: "Valore medio" };
    return { label: "High", color: "#10b981", icon: "✅", description: "Valore alto" };
  }

  // Helper per estrarre valori storici per una metrica specifica
  static extractHistoricalValues(historical: any[], metric: string): number[] {
    if (!historical || !Array.isArray(historical)) return [];
    
    return historical.reduce((acc, item) => {
      if (!item) return acc;
      
      let value: number | null = null;
      
      if (metric === 'valence' && item.avg_valence !== undefined) {
        value = item.avg_valence;
      } else if (metric === 'arousal' && item.avg_arousal !== undefined) {
        value = item.avg_arousal;
      } else if (metric === 'texture' && item.scores?.texture !== undefined) {
        value = item.scores.texture;
      } else if (metric === 'redness' && item.scores?.redness !== undefined) {
        value = item.scores.redness;
      } else if (metric === 'hydration' && item.scores?.hydration !== undefined) {
        value = item.scores.hydration;
      } else if (metric === 'oiliness' && item.scores?.oiliness !== undefined) {
        value = item.scores.oiliness;
      } else if (metric === 'overall' && item.scores?.overall !== undefined) {
        value = item.scores.overall;
      }
      
      if (value !== null && value !== undefined && !isNaN(value)) {
        acc.push(value);
      }
      
      return acc;
    }, [] as number[]);
  }

  // Trend personalizzato "vs tuo solito" - versione con metrica
  static getPersonalizedTrendForMetric(metric: string, currentValue: number, historical: any[]): TrendInfo {
    const historicalValues = this.extractHistoricalValues(historical, metric);
    return this.getPersonalizedTrend(currentValue, historicalValues);
  }

  // Trend personalizzato "vs tuo solito"
  static getPersonalizedTrend(current: number, historical: number[]): TrendInfo {
    // Controllo di sicurezza per dati undefined/null
    if (!historical || !Array.isArray(historical) || historical.length === 0) {
      return { trend: '→', text: 'Prima misurazione', percentage: 0 };
    }

    const avg = historical.reduce((a, b) => a + b, 0) / historical.length;
    const diff = current - avg;
    const percentage = Math.abs(diff / avg * 100);

    if (diff > 5) {
      return { trend: '↑', text: 'sopra il tuo solito', percentage: Math.round(percentage) };
    } else if (diff < -5) {
      return { trend: '↓', text: 'sotto il tuo solito', percentage: Math.round(percentage) };
    } else {
      return { trend: '→', text: 'in linea con il tuo solito', percentage: Math.round(percentage) };
    }
  }

  // Soglie adattive basate su storico utente
  static getAdaptiveThresholds(historicalData: number[], metric: string): Thresholds {
    if (historicalData.length < 5) {
      return this.getDefaultThresholds(metric);
    }

    const sorted = [...historicalData].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q2 = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];

    return {
      low: q1,
      medium: q2,
      high: q3
    };
  }

  // Soglie di default per ogni metrica
  private static getDefaultThresholds(metric: string): Thresholds {
    switch (metric) {
      case 'texture':
        return { low: 40, medium: 60, high: 80 };
      case 'redness':
        return { low: 20, medium: 40, high: 60 };
      case 'hydration':
        return { low: 40, medium: 55, high: 75 };
      case 'oiliness':
        return { low: 30, medium: 50, high: 65 };
      case 'overall':
        return { low: 40, medium: 60, high: 80 };
      case 'valence':
        return { low: -0.3, medium: 0.1, high: 0.5 };
      case 'arousal':
        return { low: 0.3, medium: 0.6, high: 0.8 };
      default:
        return { low: 30, medium: 50, high: 70 };
    }
  }

  // Calcola range ottimale per utente
  static getPersonalizedRange(historicalData: number[], metric: string): { min: number; max: number; optimal: number } {
    if (historicalData.length < 3) {
      const defaultThresholds = this.getDefaultThresholds(metric);
      return {
        min: defaultThresholds.low,
        max: defaultThresholds.high,
        optimal: defaultThresholds.medium
      };
    }

    const sorted = [...historicalData].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const optimal = sorted[Math.floor(sorted.length * 0.5)];

    return { min, max, optimal };
  }

  // Valida se un valore è nel range ottimale
  static isInOptimalRange(value: number, range: { min: number; max: number; optimal: number }): boolean {
    return value >= range.min && value <= range.max;
  }

  // Genera messaggio di stato per metrica
  static getStatusMessage(metric: string, value: number, bucket: BucketInfo, trend: TrendInfo): string {
    const baseMessage = `${bucket.description}`;
    const trendMessage = trend.percentage > 10 ? ` (${trend.trend} ${trend.percentage}% ${trend.text})` : '';
    return `${baseMessage}${trendMessage}`;
  }
}
