export interface UserProfile {
  userId: string;
  age?: number;
  skinType?: 'dry' | 'oily' | 'combination' | 'sensitive' | 'normal';
  lifestyle?: string[];
  medicalConditions?: string[];
  preferences?: string[];
  goals?: string[];
}

export interface PersonalizedRange {
  min: number;
  max: number;
  optimal: number;
  personalAverage: number;
  standardDeviation: number;
}

export interface PatternInfo {
  type: 'temporal' | 'seasonal' | 'lifestyle' | 'stress';
  description: string;
  confidence: number;
  actionable: boolean;
  suggestions: string[];
}

export interface AdaptiveThresholds {
  metric: string;
  personalized: {
    low: number;
    medium: number;
    high: number;
  };
  default: {
    low: number;
    medium: number;
    high: number;
  };
  difference: {
    low: number;
    medium: number;
    high: number;
  };
}

export class PersonalizationService {
  // Calcola range personalizzato per utente
  static getPersonalizedRange(
    userId: string, 
    metric: string, 
    historicalData: number[], 
    userProfile?: UserProfile
  ): PersonalizedRange {
    if (historicalData.length < 3) {
      return this.getDefaultRange(metric);
    }

    const sorted = [...historicalData].sort((a, b) => a - b);
    const personalAverage = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
    const standardDeviation = this.calculateStandardDeviation(historicalData, personalAverage);

    // Calcola percentili personalizzati
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q2 = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];

    // Aggiusta range basato su profilo utente
    let adjustedMin = q1;
    let adjustedMax = q3;
    let adjustedOptimal = q2;

    if (userProfile) {
      const adjustments = this.getProfileAdjustments(metric, userProfile);
      adjustedMin = Math.max(0, q1 + adjustments.min);
      adjustedMax = Math.min(100, q3 + adjustments.max);
      adjustedOptimal = Math.max(adjustedMin, Math.min(adjustedMax, q2 + adjustments.optimal));
    }

    return {
      min: adjustedMin,
      max: adjustedMax,
      optimal: adjustedOptimal,
      personalAverage,
      standardDeviation
    };
  }

  // Calcola deviazione standard
  private static calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // Ottieni range di default per metrica
  private static getDefaultRange(metric: string): PersonalizedRange {
    const defaultRanges: Record<string, PersonalizedRange> = {
      texture: { min: 40, max: 80, optimal: 60, personalAverage: 60, standardDeviation: 10 },
      redness: { min: 20, max: 60, optimal: 40, personalAverage: 40, standardDeviation: 8 },
      hydration: { min: 40, max: 75, optimal: 55, personalAverage: 55, standardDeviation: 12 },
      oiliness: { min: 30, max: 65, optimal: 50, personalAverage: 50, standardDeviation: 10 },
      overall: { min: 40, max: 80, optimal: 60, personalAverage: 60, standardDeviation: 12 },
      valence: { min: -0.3, max: 0.5, optimal: 0.1, personalAverage: 0.1, standardDeviation: 0.2 },
      arousal: { min: 0.3, max: 0.8, optimal: 0.6, personalAverage: 0.6, standardDeviation: 0.15 }
    };

    return defaultRanges[metric] || { min: 30, max: 70, optimal: 50, personalAverage: 50, standardDeviation: 10 };
  }

  // Aggiustamenti basati su profilo utente
  private static getProfileAdjustments(metric: string, profile: UserProfile): {
    min: number;
    max: number;
    optimal: number;
  } {
    let adjustments = { min: 0, max: 0, optimal: 0 };

    // Aggiustamenti per età
    if (profile.age) {
      if (profile.age < 25) {
        // Pelle giovane: range più alti per texture e hydration
        if (metric === 'texture') adjustments = { min: 5, max: 5, optimal: 5 };
        if (metric === 'hydration') adjustments = { min: 5, max: 5, optimal: 5 };
      } else if (profile.age > 50) {
        // Pelle matura: range più bassi per texture
        if (metric === 'texture') adjustments = { min: -5, max: -5, optimal: -5 };
      }
    }

    // Aggiustamenti per tipo di pelle
    if (profile.skinType) {
      switch (profile.skinType) {
        case 'dry':
          if (metric === 'hydration') adjustments = { min: -10, max: 5, optimal: -5 };
          if (metric === 'oiliness') adjustments = { min: -15, max: -5, optimal: -10 };
          break;
        case 'oily':
          if (metric === 'oiliness') adjustments = { min: 5, max: 15, optimal: 10 };
          if (metric === 'hydration') adjustments = { min: 5, max: 10, optimal: 5 };
          break;
        case 'sensitive':
          if (metric === 'redness') adjustments = { min: 5, max: 10, optimal: 5 };
          break;
      }
    }

    // Aggiustamenti per condizioni mediche
    if (profile.medicalConditions?.includes('rosacea')) {
      if (metric === 'redness') adjustments = { min: 10, max: 20, optimal: 15 };
    }

    if (profile.medicalConditions?.includes('eczema')) {
      if (metric === 'texture') adjustments = { min: -10, max: -5, optimal: -7 };
      if (metric === 'redness') adjustments = { min: 5, max: 15, optimal: 10 };
    }

    return adjustments;
  }

  // Rileva pattern temporali
  static detectTemporalPatterns(
    userId: string, 
    metric: string, 
    historicalData: Array<{ timestamp: Date; value: number }>
  ): PatternInfo[] {
    const patterns: PatternInfo[] = [];

    if (historicalData.length < 7) return patterns;

    // Pattern giornaliero
    const dailyPattern = this.detectDailyPattern(historicalData);
    if (dailyPattern) {
      patterns.push(dailyPattern);
    }

    // Pattern settimanale
    const weeklyPattern = this.detectWeeklyPattern(historicalData);
    if (weeklyPattern) {
      patterns.push(weeklyPattern);
    }

    // Pattern stagionale
    const seasonalPattern = this.detectSeasonalPattern(historicalData);
    if (seasonalPattern) {
      patterns.push(seasonalPattern);
    }

    return patterns;
  }

  // Rileva pattern giornaliero
  private static detectDailyPattern(data: Array<{ timestamp: Date; value: number }>): PatternInfo | null {
    const hourlyData: Record<number, number[]> = {};

    data.forEach(({ timestamp, value }) => {
      const hour = timestamp.getHours();
      if (!hourlyData[hour]) hourlyData[hour] = [];
      hourlyData[hour].push(value);
    });

    // Trova ore con valori significativamente diversi
    const hourAverages = Object.entries(hourlyData).map(([hour, values]) => ({
      hour: parseInt(hour),
      average: values.reduce((a, b) => a + b, 0) / values.length
    }));

    if (hourAverages.length < 3) return null;

    const overallAverage = hourAverages.reduce((sum, h) => sum + h.average, 0) / hourAverages.length;
    const significantHours = hourAverages.filter(h => Math.abs(h.average - overallAverage) > overallAverage * 0.1);

    if (significantHours.length > 0) {
      const peakHour = significantHours.reduce((max, h) => h.average > max.average ? h : max);
      const lowHour = significantHours.reduce((min, h) => h.average < min.average ? h : min);

      return {
        type: 'temporal',
        description: `Valori più alti alle ${peakHour.hour}:00, più bassi alle ${lowHour.hour}:00`,
        confidence: 0.7,
        actionable: true,
        suggestions: [
          `Programma analisi alle ${peakHour.hour}:00 per risultati ottimali`,
          `Evita analisi alle ${lowHour.hour}:00`
        ]
      };
    }

    return null;
  }

  // Rileva pattern settimanale
  private static detectWeeklyPattern(data: Array<{ timestamp: Date; value: number }>): PatternInfo | null {
    const weeklyData: Record<number, number[]> = {};

    data.forEach(({ timestamp, value }) => {
      const dayOfWeek = timestamp.getDay();
      if (!weeklyData[dayOfWeek]) weeklyData[dayOfWeek] = [];
      weeklyData[dayOfWeek].push(value);
    });

    const dayAverages = Object.entries(weeklyData).map(([day, values]) => ({
      day: parseInt(day),
      average: values.reduce((a, b) => a + b, 0) / values.length
    }));

    if (dayAverages.length < 3) return null;

    const overallAverage = dayAverages.reduce((sum, d) => sum + d.average, 0) / dayAverages.length;
    const significantDays = dayAverages.filter(d => Math.abs(d.average - overallAverage) > overallAverage * 0.15);

    if (significantDays.length > 0) {
      const bestDay = significantDays.reduce((max, d) => d.average > max.average ? d : max);
      const worstDay = significantDays.reduce((min, d) => d.average < min.average ? d : min);

      const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

      return {
        type: 'temporal',
        description: `Migliori risultati il ${dayNames[bestDay.day]}, peggiori il ${dayNames[worstDay.day]}`,
        confidence: 0.6,
        actionable: true,
        suggestions: [
          `Programma analisi il ${dayNames[bestDay.day]}`,
          `Evita analisi il ${dayNames[worstDay.day]}`
        ]
      };
    }

    return null;
  }

  // Rileva pattern stagionale
  private static detectSeasonalPattern(data: Array<{ timestamp: Date; value: number }>): PatternInfo | null {
    const seasonalData: Record<string, number[]> = {};

    data.forEach(({ timestamp, value }) => {
      const month = timestamp.getMonth();
      let season: string;
      
      if (month >= 2 && month <= 4) season = 'spring';
      else if (month >= 5 && month <= 7) season = 'summer';
      else if (month >= 8 && month <= 10) season = 'autumn';
      else season = 'winter';

      if (!seasonalData[season]) seasonalData[season] = [];
      seasonalData[season].push(value);
    });

    const seasonAverages = Object.entries(seasonalData).map(([season, values]) => ({
      season,
      average: values.reduce((a, b) => a + b, 0) / values.length
    }));

    if (seasonAverages.length < 2) return null;

    const overallAverage = seasonAverages.reduce((sum, s) => sum + s.average, 0) / seasonAverages.length;
    const significantSeasons = seasonAverages.filter(s => Math.abs(s.average - overallAverage) > overallAverage * 0.2);

    if (significantSeasons.length > 0) {
      const bestSeason = significantSeasons.reduce((max, s) => s.average > max.average ? s : max);
      const worstSeason = significantSeasons.reduce((min, s) => s.average < min.average ? s : min);

      const seasonNames: Record<string, string> = {
        spring: 'Primavera',
        summer: 'Estate',
        autumn: 'Autunno',
        winter: 'Inverno'
      };

      return {
        type: 'seasonal',
        description: `Migliori risultati in ${seasonNames[bestSeason.season]}, peggiori in ${seasonNames[worstSeason.season]}`,
        confidence: 0.5,
        actionable: true,
        suggestions: [
          `Adatta routine per ${seasonNames[worstSeason.season]}`,
          `Mantieni routine per ${seasonNames[bestSeason.season]}`
        ]
      };
    }

    return null;
  }

  // Genera soglie adattive
  static generateAdaptiveThresholds(
    userId: string,
    metric: string,
    historicalData: number[],
    userProfile?: UserProfile
  ): AdaptiveThresholds {
    const personalizedRange = this.getPersonalizedRange(userId, metric, historicalData, userProfile);
    const defaultRange = this.getDefaultRange(metric);

    return {
      metric,
      personalized: {
        low: personalizedRange.min,
        medium: personalizedRange.optimal,
        high: personalizedRange.max
      },
      default: {
        low: defaultRange.min,
        medium: defaultRange.optimal,
        high: defaultRange.max
      },
      difference: {
        low: personalizedRange.min - defaultRange.min,
        medium: personalizedRange.optimal - defaultRange.optimal,
        high: personalizedRange.max - defaultRange.max
      }
    };
  }

  // Valida se un valore è nel range personalizzato
  static isInPersonalizedRange(
    value: number,
    personalizedRange: PersonalizedRange,
    tolerance: number = 0.1
  ): boolean {
    const toleranceRange = (personalizedRange.max - personalizedRange.min) * tolerance;
    return value >= (personalizedRange.min - toleranceRange) && 
           value <= (personalizedRange.max + toleranceRange);
  }

  // Genera messaggio personalizzato per trend
  static getPersonalizedTrendMessage(
    current: number,
    personalizedRange: PersonalizedRange,
    historicalData: number[]
  ): string {
    if (historicalData.length === 0) {
      return 'Prima misurazione';
    }

    const personalAverage = personalizedRange.personalAverage;
    const diff = current - personalAverage;
    const percentage = Math.abs(diff / personalAverage * 100);

    if (diff > 0) {
      return `↑ ${Math.round(percentage)}% sopra la tua media (${Math.round(personalAverage)})`;
    } else if (diff < 0) {
      return `↓ ${Math.round(percentage)}% sotto la tua media (${Math.round(personalAverage)})`;
    } else {
      return `→ in linea con la tua media (${Math.round(personalAverage)})`;
    }
  }

  // Calcola score di personalizzazione
  static calculatePersonalizationScore(
    userId: string,
    metric: string,
    historicalData: number[]
  ): number {
    if (historicalData.length < 5) return 0;

    const personalizedRange = this.getPersonalizedRange(userId, metric, historicalData);
    const defaultRange = this.getDefaultRange(metric);

    // Calcola quanto il range personalizzato si discosta da quello di default
    const minDiff = Math.abs(personalizedRange.min - defaultRange.min);
    const maxDiff = Math.abs(personalizedRange.max - defaultRange.max);
    const optimalDiff = Math.abs(personalizedRange.optimal - defaultRange.optimal);

    const totalDiff = (minDiff + maxDiff + optimalDiff) / 3;
    const maxPossibleDiff = 50; // Range massimo possibile

    return Math.min(1, totalDiff / maxPossibleDiff);
  }
}
