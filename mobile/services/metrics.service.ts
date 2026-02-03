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
    if (value < 40) return { label: "analysis.skin.metrics.buckets.rough.label", color: "#ef4444", icon: "⚠️", description: "analysis.skin.metrics.buckets.rough.description" };
    if (value < 60) return { label: "analysis.skin.metrics.buckets.fair.label", color: "#f59e0b", icon: "⚠️", description: "analysis.skin.metrics.buckets.fair.description" };
    if (value < 80) return { label: "analysis.skin.metrics.buckets.good.label", color: "#10b981", icon: "✅", description: "analysis.skin.metrics.buckets.good.description" };
    return { label: "analysis.skin.metrics.buckets.excellent.label", color: "#06b6d4", icon: "🌟", description: "analysis.skin.metrics.buckets.excellent.description" };
  }

  private static getRednessBucket(value: number): BucketInfo {
    if (value < 20) return { label: "analysis.skin.metrics.buckets.low.label", color: "#10b981", icon: "✅", description: "analysis.skin.metrics.buckets.calm.description" };
    if (value < 40) return { label: "analysis.skin.metrics.buckets.mild.label", color: "#f59e0b", icon: "⚠️", description: "analysis.skin.metrics.buckets.mild_redness.description" };
    if (value < 60) return { label: "analysis.skin.metrics.buckets.moderate.label", color: "#ef4444", icon: "⚠️", description: "analysis.skin.metrics.buckets.moderate_redness.description" };
    return { label: "analysis.skin.metrics.buckets.high.label", color: "#dc2626", icon: "🚨", description: "analysis.skin.metrics.buckets.high_redness.description" };
  }

  private static getHydrationBucket(value: number): BucketInfo {
    if (value < 40) return { label: "analysis.skin.metrics.buckets.low.label", color: "#ef4444", icon: "⚠️", description: "analysis.skin.metrics.buckets.dehydrated.description" };
    if (value < 55) return { label: "analysis.skin.metrics.buckets.below_optimal.label", color: "#f59e0b", icon: "⚠️", description: "analysis.skin.metrics.buckets.below_optimal.description" };
    if (value < 75) return { label: "analysis.skin.metrics.buckets.optimal.label", color: "#10b981", icon: "✅", description: "analysis.skin.metrics.buckets.optimal.description" };
    return { label: "analysis.skin.metrics.buckets.excellent.label", color: "#06b6d4", icon: "💧", description: "analysis.skin.metrics.buckets.hydrated_excellent.description" };
  }

  private static getOilinessBucket(value: number): BucketInfo {
    if (value < 30) return { label: "analysis.skin.metrics.buckets.dry.label", color: "#ef4444", icon: "⚠️", description: "analysis.skin.metrics.buckets.dry.description" };
    if (value < 50) return { label: "analysis.skin.metrics.buckets.balanced.label", color: "#10b981", icon: "✅", description: "analysis.skin.metrics.buckets.balanced.description" };
    if (value < 65) return { label: "analysis.skin.metrics.buckets.oily.label", color: "#f59e0b", icon: "⚠️", description: "analysis.skin.metrics.buckets.oily.description" };
    return { label: "analysis.skin.metrics.buckets.very_oily.label", color: "#dc2626", icon: "🚨", description: "analysis.skin.metrics.buckets.very_oily.description" };
  }

  private static getOverallBucket(value: number): BucketInfo {
    if (value < 40) return { label: "POOR", color: "#ef4444", icon: "⚠️", description: "La pelle presenta diverse criticità che richiedono attenzione. Considera di consultare un dermatologo." };
    if (value < 60) return { label: "FAIR", color: "#f59e0b", icon: "⚠️", description: "Salute cutanea nella media con margini di miglioramento. Una routine costante può aiutare." };
    if (value < 80) return { label: "GOOD", color: "#10b981", icon: "✅", description: "Buona salute della pelle. I parametri sono generalmente positivi. Mantieni le buone abitudini." };
    return { label: "EXCELLENT", color: "#06b6d4", icon: "🌟", description: "Pelle in ottima salute! Tutti i parametri sono eccellenti. Complimenti per la tua routine di cura." };
  }

  // Emotion Metric Buckets (normalized to 0-100 scale)
  private static getValenceBucket(value: number): BucketInfo {
    // 🆕 If value is in old -1 to 1 range, normalize to 0-100
    const normalizedValue = value <= 1 && value >= -1 ? ((value + 1) / 2) * 100 : value;

    // User's scale: 0-19 Molto negativo, 20-39 Tendenzialmente negativo, 40-59 Neutro, 60-79 Tendenzialmente positivo, 80-100 Molto positivo
    if (normalizedValue < 20) return { label: "analysis.emotion.metrics.buckets.veryNegative", color: "#dc2626", icon: "😢", description: "analysis.emotion.metrics.descriptions.veryNegative" };
    if (normalizedValue < 40) return { label: "analysis.emotion.metrics.buckets.negative", color: "#ef4444", icon: "😞", description: "analysis.emotion.metrics.descriptions.negative" };
    if (normalizedValue < 60) return { label: "analysis.emotion.metrics.buckets.neutral", color: "#6b7280", icon: "😐", description: "analysis.emotion.metrics.descriptions.neutral" };
    if (normalizedValue < 80) return { label: "analysis.emotion.metrics.buckets.positive", color: "#10b981", icon: "😊", description: "analysis.emotion.metrics.descriptions.positive" };
    return { label: "analysis.emotion.metrics.buckets.veryPositive", color: "#06b6d4", icon: "😄", description: "analysis.emotion.metrics.descriptions.veryPositive" };
  }

  private static getArousalBucket(value: number): BucketInfo {
    // 🆕 If value is in old -1 to 1 range, normalize to 0-100 (same as valence!)
    const normalizedValue = value <= 1 && value >= -1 ? ((value + 1) / 2) * 100 : value;

    // User's scale: 0-19 Molto basso, 20-39 Basso, 40-59 Moderato, 60-79 Alto, 80-100 Molto alto
    if (normalizedValue < 20) return { label: "analysis.emotion.metrics.buckets.veryLow", color: "#3b82f6", icon: "😴", description: "analysis.emotion.metrics.descriptions.veryLow" };
    if (normalizedValue < 40) return { label: "analysis.emotion.metrics.buckets.low", color: "#6b7280", icon: "😌", description: "analysis.emotion.metrics.descriptions.low" };
    if (normalizedValue < 60) return { label: "analysis.emotion.metrics.buckets.medium", color: "#f59e0b", icon: "😐", description: "analysis.emotion.metrics.descriptions.medium" };
    if (normalizedValue < 80) return { label: "analysis.emotion.metrics.buckets.high", color: "#ef4444", icon: "⚡", description: "analysis.emotion.metrics.descriptions.high" };
    return { label: "analysis.emotion.metrics.buckets.veryHigh", color: "#dc2626", icon: "🔥", description: "analysis.emotion.metrics.descriptions.veryHigh" };
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
      return { trend: '→', text: 'analysis.trend.first', percentage: 0 };
    }

    const avg = historical.reduce((a, b) => a + b, 0) / historical.length;
    const diff = current - avg;
    const percentage = Math.abs(diff / avg * 100);

    if (diff > 5) {
      return { trend: '↑', text: 'analysis.trend.above', percentage: Math.round(percentage) };
    } else if (diff < -5) {
      return { trend: '↓', text: 'analysis.trend.below', percentage: Math.round(percentage) };
    } else {
      return { trend: '→', text: 'analysis.trend.even', percentage: Math.round(percentage) };
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
