import { EnhancedLoggingService } from './enhanced-logging.service';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Service per validare i dati prima del salvataggio
 */
export class DataValidationService {
  /**
   * Valida i dati di un'analisi della pelle
   */
  static validateSkinAnalysis(data: {
    overallScore?: number;
    hydrationScore?: number;
    oilinessScore?: number;
    textureScore?: number;
    pigmentationScore?: number;
    rednessScore?: number;
    strengths?: string[];
    improvements?: string[];
    recommendations?: string[];
  }): ValidationResult {
    const errors: string[] = [];

    // Valida overallScore
    if (data.overallScore !== undefined) {
      if (typeof data.overallScore !== 'number' || data.overallScore < 0 || data.overallScore > 100) {
        errors.push('overallScore deve essere un numero tra 0 e 100');
      }
    }

    // Valida hydrationScore
    if (data.hydrationScore !== undefined) {
      if (typeof data.hydrationScore !== 'number' || data.hydrationScore < 0 || data.hydrationScore > 100) {
        errors.push('hydrationScore deve essere un numero tra 0 e 100');
      }
    }

    // Valida oilinessScore
    if (data.oilinessScore !== undefined) {
      if (typeof data.oilinessScore !== 'number' || data.oilinessScore < 0 || data.oilinessScore > 100) {
        errors.push('oilinessScore deve essere un numero tra 0 e 100');
      }
    }

    // Valida textureScore
    if (data.textureScore !== undefined) {
      if (typeof data.textureScore !== 'number' || data.textureScore < 0 || data.textureScore > 100) {
        errors.push('textureScore deve essere un numero tra 0 e 100');
      }
    }

    // Valida pigmentationScore
    if (data.pigmentationScore !== undefined) {
      if (typeof data.pigmentationScore !== 'number' || data.pigmentationScore < 0 || data.pigmentationScore > 100) {
        errors.push('pigmentationScore deve essere un numero tra 0 e 100');
      }
    }

    // Valida rednessScore
    if (data.rednessScore !== undefined) {
      if (typeof data.rednessScore !== 'number' || data.rednessScore < 0 || data.rednessScore > 100) {
        errors.push('rednessScore deve essere un numero tra 0 e 100');
      }
    }

    // Valida arrays
    if (data.strengths && !Array.isArray(data.strengths)) {
      errors.push('strengths deve essere un array');
    }

    if (data.improvements && !Array.isArray(data.improvements)) {
      errors.push('improvements deve essere un array');
    }

    if (data.recommendations && !Array.isArray(data.recommendations)) {
      errors.push('recommendations deve essere un array');
    }

    const valid = errors.length === 0;
    EnhancedLoggingService.logValidation('skin_analysis', valid, errors.length > 0 ? errors : undefined);

    return { valid, errors };
  }

  /**
   * Valida i dati di un'analisi emotiva
   */
  static validateEmotionAnalysis(data: {
    dominantEmotion?: string;
    valence?: number;
    arousal?: number;
    confidence?: number;
  }): ValidationResult {
    const errors: string[] = [];

    // Valida dominantEmotion
    if (data.dominantEmotion !== undefined) {
      if (typeof data.dominantEmotion !== 'string' || data.dominantEmotion.trim().length === 0) {
        errors.push('dominantEmotion deve essere una stringa non vuota');
      }
    }

    // Valida valence
    if (data.valence !== undefined) {
      if (typeof data.valence !== 'number' || data.valence < -1 || data.valence > 1) {
        errors.push('valence deve essere un numero tra -1 e 1');
      }
    }

    // Valida arousal
    if (data.arousal !== undefined) {
      if (typeof data.arousal !== 'number' || data.arousal < -1 || data.arousal > 1) {
        errors.push('arousal deve essere un numero tra -1 e 1');
      }
    }

    // Valida confidence
    if (data.confidence !== undefined) {
      if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
        errors.push('confidence deve essere un numero tra 0 e 1');
      }
    }

    const valid = errors.length === 0;
    EnhancedLoggingService.logValidation('emotion_analysis', valid, errors.length > 0 ? errors : undefined);

    return { valid, errors };
  }

  /**
   * Valida i dati di un'analisi del cibo
   */
  static validateFoodAnalysis(data: {
    calories?: number;
    carbohydrates?: number;
    proteins?: number;
    fats?: number;
    fiber?: number;
    identifiedFoods?: string[];
    recommendations?: string[];
    observations?: string[];
  }): ValidationResult {
    const errors: string[] = [];

    // Valida calories
    if (data.calories !== undefined) {
      if (typeof data.calories !== 'number' || data.calories < 0) {
        errors.push('calories deve essere un numero positivo');
      }
    }

    // Valida carbohydrates
    if (data.carbohydrates !== undefined) {
      if (typeof data.carbohydrates !== 'number' || data.carbohydrates < 0) {
        errors.push('carbohydrates deve essere un numero positivo');
      }
    }

    // Valida proteins
    if (data.proteins !== undefined) {
      if (typeof data.proteins !== 'number' || data.proteins < 0) {
        errors.push('proteins deve essere un numero positivo');
      }
    }

    // Valida fats
    if (data.fats !== undefined) {
      if (typeof data.fats !== 'number' || data.fats < 0) {
        errors.push('fats deve essere un numero positivo');
      }
    }

    // Valida fiber
    if (data.fiber !== undefined) {
      if (typeof data.fiber !== 'number' || data.fiber < 0) {
        errors.push('fiber deve essere un numero positivo');
      }
    }

    // Valida arrays
    if (data.identifiedFoods && !Array.isArray(data.identifiedFoods)) {
      errors.push('identifiedFoods deve essere un array');
    }

    if (data.recommendations && !Array.isArray(data.recommendations)) {
      errors.push('recommendations deve essere un array');
    }

    if (data.observations && !Array.isArray(data.observations)) {
      errors.push('observations deve essere un array');
    }

    const valid = errors.length === 0;
    EnhancedLoggingService.logValidation('food_analysis', valid, errors.length > 0 ? errors : undefined);

    return { valid, errors };
  }

  /**
   * Valida i dati di un check-in mood
   */
  static validateMoodCheckin(data: {
    value?: number;
    note?: string;
  }): ValidationResult {
    const errors: string[] = [];

    // Valida value
    if (data.value !== undefined) {
      if (typeof data.value !== 'number' || data.value < 1 || data.value > 5) {
        errors.push('value deve essere un numero tra 1 e 5');
      }
    }

    // Valida note (opzionale)
    if (data.note !== undefined && typeof data.note !== 'string') {
      errors.push('note deve essere una stringa');
    }

    const valid = errors.length === 0;
    EnhancedLoggingService.logValidation('mood_checkin', valid, errors.length > 0 ? errors : undefined);

    return { valid, errors };
  }

  /**
   * Valida i dati di un check-in sleep
   */
  static validateSleepCheckin(data: {
    quality?: number;
    hours?: number;
    note?: string;
  }): ValidationResult {
    const errors: string[] = [];

    // Valida quality
    if (data.quality !== undefined) {
      if (typeof data.quality !== 'number' || data.quality < 0 || data.quality > 100) {
        errors.push('quality deve essere un numero tra 0 e 100');
      }
    }

    // Valida hours
    if (data.hours !== undefined) {
      if (typeof data.hours !== 'number' || data.hours < 0 || data.hours > 24) {
        errors.push('hours deve essere un numero tra 0 e 24');
      }
    }

    // Valida note (opzionale)
    if (data.note !== undefined && typeof data.note !== 'string') {
      errors.push('note deve essere una stringa');
    }

    const valid = errors.length === 0;
    EnhancedLoggingService.logValidation('sleep_checkin', valid, errors.length > 0 ? errors : undefined);

    return { valid, errors };
  }
}

