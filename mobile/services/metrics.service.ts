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
    if (value < 40) return { label: "ROUGH", color: "#ef4444", icon: "⚠️", description: "Texture ruvida con irregolarità evidenti. Potrebbero essere presenti pori dilatati o imperfezioni. Consigliato esfoliare regolarmente." };
    if (value < 60) return { label: "FAIR", color: "#f59e0b", icon: "⚠️", description: "Texture con alcune irregolarità. La pelle potrebbe beneficiare di trattamenti leviganti e idratazione costante." };
    if (value < 80) return { label: "GOOD", color: "#10b981", icon: "✅", description: "Texture morbida e uniforme. La pelle appare sana con pori poco visibili. Mantieni la routine attuale." };
    return { label: "EXCELLENT", color: "#06b6d4", icon: "🌟", description: "Texture eccellente, liscia e setosa. Pori quasi invisibili, pelle ben curata e luminosa." };
  }

  private static getRednessBucket(value: number): BucketInfo {
    if (value < 20) return { label: "LOW", color: "#10b981", icon: "✅", description: "Tono uniforme senza arrossamenti. La pelle appare calma e in equilibrio. Ottimo stato di salute cutanea." };
    if (value < 40) return { label: "MILD", color: "#f59e0b", icon: "⚠️", description: "Leggero rossore in alcune zone. Potrebbe indicare sensibilità o lieve irritazione. Considera prodotti lenitivi." };
    if (value < 60) return { label: "MODERATE", color: "#ef4444", icon: "⚠️", description: "Arrossamento moderato visibile. La pelle mostra segni di irritazione o sensibilità. Evita prodotti aggressivi." };
    return { label: "HIGH", color: "#dc2626", icon: "🚨", description: "Arrossamento significativo. Potrebbero essere presenti irritazioni o condizioni che richiedono attenzione. Consulta uno specialista." };
  }

  private static getHydrationBucket(value: number): BucketInfo {
    if (value < 40) return { label: "LOW", color: "#ef4444", icon: "⚠️", description: "Pelle disidratata che può apparire opaca, tesa o squamosa. Necessita di idratazione profonda e costante." };
    if (value < 55) return { label: "BELOW OPTIMAL", color: "#f59e0b", icon: "⚠️", description: "Idratazione sotto il livello ottimale. Aumenta l'apporto di acqua e usa creme idratanti più ricche." };
    if (value < 75) return { label: "OPTIMAL", color: "#10b981", icon: "✅", description: "Idratazione ottimale. La pelle è elastica, morbida e luminosa. La barriera cutanea funziona correttamente." };
    return { label: "EXCELLENT", color: "#06b6d4", icon: "💧", description: "Pelle perfettamente idratata, elastica e radiosa. Eccellente equilibrio di acqua nella pelle." };
  }

  private static getOilinessBucket(value: number): BucketInfo {
    if (value < 30) return { label: "DRY", color: "#ef4444", icon: "⚠️", description: "Pelle secca con bassa produzione di sebo. Può apparire opaca e tendere a desquamarsi. Usa prodotti nutrienti." };
    if (value < 50) return { label: "BALANCED", color: "#10b981", icon: "✅", description: "Produzione di sebo equilibrata. La pelle non è né troppo secca né troppo grassa. Stato ideale." };
    if (value < 65) return { label: "OILY", color: "#f59e0b", icon: "⚠️", description: "Pelle tendenzialmente oleosa, specialmente nella zona T. Usa prodotti opacizzanti e detergenti delicati." };
    return { label: "VERY OILY", color: "#dc2626", icon: "🚨", description: "Pelle molto oleosa con eccesso di sebo. I pori potrebbero apparire dilatati. Controlla la produzione con prodotti specifici." };
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
    if (normalizedValue < 20) return { label: "gauge.buckets.veryNegative", color: "#dc2626", icon: "😢", description: "Stato emotivo difficile" };
    if (normalizedValue < 40) return { label: "gauge.buckets.negative", color: "#ef4444", icon: "😞", description: "Più segnali negativi che positivi" };
    if (normalizedValue < 60) return { label: "gauge.buckets.neutral", color: "#6b7280", icon: "😐", description: "Espressione neutra, nessuna direzione emotiva forte" };
    if (normalizedValue < 80) return { label: "gauge.buckets.positive", color: "#10b981", icon: "😊", description: "Più segnali positivi che neutri" };
    return { label: "gauge.buckets.veryPositive", color: "#06b6d4", icon: "😄", description: "Stato chiaramente positivo" };
  }

  private static getArousalBucket(value: number): BucketInfo {
    // 🆕 If value is in old -1 to 1 range, normalize to 0-100 (same as valence!)
    const normalizedValue = value <= 1 && value >= -1 ? ((value + 1) / 2) * 100 : value;

    // User's scale: 0-19 Molto basso, 20-39 Basso, 40-59 Moderato, 60-79 Alto, 80-100 Molto alto
    if (normalizedValue < 20) return { label: "gauge.buckets.veryLow", color: "#3b82f6", icon: "😴", description: "Stato molto calmo o affaticato" };
    if (normalizedValue < 40) return { label: "gauge.buckets.low", color: "#6b7280", icon: "😌", description: "Energia ridotta / rilassata" };
    if (normalizedValue < 60) return { label: "gauge.buckets.medium", color: "#f59e0b", icon: "😐", description: "Attivazione nella norma" };
    if (normalizedValue < 80) return { label: "gauge.buckets.high", color: "#ef4444", icon: "⚡", description: "Stato attivo / vigile" };
    return { label: "gauge.buckets.veryHigh", color: "#dc2626", icon: "🔥", description: "Forte attivazione" };
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
