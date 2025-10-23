export interface QualityMetrics {
  lighting: number;
  focus: number;
  roi_coverage: number;
}

export interface ConfidenceInfo {
  level: 'high' | 'medium' | 'low';
  score: number;
  label: string;
  icon: string;
  description: string;
}

export interface QualityMessage {
  type: 'lighting' | 'focus' | 'coverage' | 'general';
  message: string;
  priority: number;
  actionable: boolean;
  instructions?: string[];
}

export class QualityService {
  // Trasforma metriche tecniche in messaggi pratici
  static getQualityMessage(quality: QualityMetrics): QualityMessage | null {
    const messages: QualityMessage[] = [];

    // Controlla lighting
    if (quality.lighting < 0.6) {
      messages.push({
        type: 'lighting',
        message: 'Luce laterale: avvicinati a una finestra frontale',
        priority: 3,
        actionable: true,
        instructions: [
          'Trova una fonte di luce frontale',
          'Evita ombre sul viso',
          'Usa luce naturale se possibile'
        ]
      });
    }

    // Controlla focus
    if (quality.focus < 0.7) {
      messages.push({
        type: 'focus',
        message: 'Fuoco morbido: tieni fermo 1 sec e tocca il volto',
        priority: 2,
        actionable: true,
        instructions: [
          'Mantieni il telefono fermo',
          'Aspetta 1 secondo prima di scattare',
          'Tocca il volto per mettere a fuoco'
        ]
      });
    }

    // Controlla coverage
    if (quality.roi_coverage < 0.7) {
      messages.push({
        type: 'coverage',
        message: 'Copertura bassa: riprendi più vicino (≥70%)',
        priority: 1,
        actionable: true,
        instructions: [
          'Avvicinati al viso',
          'Assicurati che il viso occupi almeno il 70% dell\'immagine',
          'Centra il viso nell\'inquadratura'
        ]
      });
    }

    // Se non ci sono problemi specifici, controlla qualità generale
    if (messages.length === 0) {
      const overallQuality = (quality.lighting + quality.focus + quality.roi_coverage) / 3;
      if (overallQuality < 0.8) {
        messages.push({
          type: 'general',
          message: 'Qualità foto migliorabile: riprova con più attenzione',
          priority: 1,
          actionable: true,
          instructions: [
            'Controlla la luce',
            'Mantieni il telefono fermo',
            'Avvicinati al viso'
          ]
        });
      }
    }

    // Restituisci solo il messaggio con priorità più alta
    if (messages.length > 0) {
      return messages.sort((a, b) => a.priority - b.priority)[0];
    }

    return null;
  }

  // Calcola confidence score leggibile
  static getConfidenceScore(quality: QualityMetrics): ConfidenceInfo {
    const overallQuality = (quality.lighting + quality.focus + quality.roi_coverage) / 3;
    
    if (overallQuality >= 0.85) {
      return {
        level: 'high',
        score: overallQuality,
        label: 'Alta',
        icon: '✅',
        description: 'Risultato molto affidabile'
      };
    } else if (overallQuality >= 0.60) {
      return {
        level: 'medium',
        score: overallQuality,
        label: 'Media',
        icon: '⚠️',
        description: 'Risultato indicativo'
      };
    } else {
      return {
        level: 'low',
        score: overallQuality,
        label: 'Bassa',
        icon: '❌',
        description: 'Ripeti la foto per maggiore precisione'
      };
    }
  }

  // Valida se la qualità è sufficiente per l'analisi
  static isQualitySufficient(quality: QualityMetrics): boolean {
    const overallQuality = (quality.lighting + quality.focus + quality.roi_coverage) / 3;
    return overallQuality >= 0.6;
  }

  // Genera suggerimenti per migliorare la qualità
  static getQualityImprovementTips(quality: QualityMetrics): string[] {
    const tips: string[] = [];

    if (quality.lighting < 0.6) {
      tips.push('💡 Usa luce naturale frontale');
      tips.push('🌅 Evita ombre sul viso');
      tips.push('🔆 Non usare flash diretto');
    }

    if (quality.focus < 0.7) {
      tips.push('📱 Mantieni il telefono fermo');
      tips.push('👆 Tocca il volto per mettere a fuoco');
      tips.push('⏱️ Aspetta 1 secondo prima di scattare');
    }

    if (quality.roi_coverage < 0.7) {
      tips.push('📏 Avvicinati al viso');
      tips.push('🎯 Centra il viso nell\'inquadratura');
      tips.push('📐 Il viso deve occupare almeno il 70% dell\'immagine');
    }

    return tips;
  }

  // Calcola penalità per qualità bassa
  static calculateQualityPenalty(quality: QualityMetrics): number {
    const overallQuality = (quality.lighting + quality.focus + quality.roi_coverage) / 3;
    
    if (overallQuality >= 0.8) {
      return 0; // Nessuna penalità
    } else if (overallQuality >= 0.6) {
      return 0.1; // Penalità leggera
    } else if (overallQuality >= 0.4) {
      return 0.2; // Penalità media
    } else {
      return 0.3; // Penalità alta
    }
  }

  // Applica penalità al punteggio overall
  static applyQualityPenalty(overallScore: number, quality: QualityMetrics): number {
    const penalty = this.calculateQualityPenalty(quality);
    const penalizedScore = overallScore * (1 - penalty);
    return Math.max(0, Math.min(100, penalizedScore));
  }

  // Genera messaggio di qualità per l'utente
  static getQualityStatusMessage(quality: QualityMetrics): string {
    const confidence = this.getConfidenceScore(quality);
    const qualityMessage = this.getQualityMessage(quality);

    let message = `Qualità foto: ${confidence.label} (${Math.round(confidence.score * 100)}%)`;

    if (qualityMessage) {
      message += `\n\n${qualityMessage.message}`;
    }

    return message;
  }

  // Controlla se è necessario ripetere l'analisi
  static shouldRetakeAnalysis(quality: QualityMetrics): boolean {
    const overallQuality = (quality.lighting + quality.focus + quality.roi_coverage) / 3;
    return overallQuality < 0.5;
  }

  // Genera messaggio di retake
  static getRetakeMessage(quality: QualityMetrics): string {
    const tips = this.getQualityImprovementTips(quality);
    
    if (tips.length === 0) {
      return 'La qualità della foto è buona!';
    }

    return `Per risultati migliori:\n${tips.join('\n')}`;
  }

  // Valida qualità per tipo di analisi
  static validateQualityForAnalysis(quality: QualityMetrics, analysisType: 'skin' | 'emotion'): boolean {
    if (analysisType === 'skin') {
      // Per l'analisi della pelle serve maggiore precisione
      return quality.lighting >= 0.7 && quality.focus >= 0.8 && quality.roi_coverage >= 0.8;
    } else {
      // Per l'analisi delle emozioni possiamo essere più flessibili
      return quality.lighting >= 0.5 && quality.focus >= 0.6 && quality.roi_coverage >= 0.6;
    }
  }

  // Genera report di qualità dettagliato
  static generateQualityReport(quality: QualityMetrics): {
    overall: number;
    lighting: { score: number; status: string; tip?: string };
    focus: { score: number; status: string; tip?: string };
    coverage: { score: number; status: string; tip?: string };
    recommendations: string[];
  } {
    const overall = (quality.lighting + quality.focus + quality.roi_coverage) / 3;
    
    const lighting = {
      score: quality.lighting,
      status: quality.lighting >= 0.7 ? 'Buona' : 'Migliorabile',
      tip: quality.lighting < 0.7 ? 'Usa luce frontale naturale' : undefined
    };

    const focus = {
      score: quality.focus,
      status: quality.focus >= 0.8 ? 'Ottima' : 'Migliorabile',
      tip: quality.focus < 0.8 ? 'Mantieni il telefono fermo' : undefined
    };

    const coverage = {
      score: quality.roi_coverage,
      status: quality.roi_coverage >= 0.8 ? 'Ottima' : 'Migliorabile',
      tip: quality.roi_coverage < 0.8 ? 'Avvicinati al viso' : undefined
    };

    const recommendations = this.getQualityImprovementTips(quality);

    return {
      overall,
      lighting,
      focus,
      coverage,
      recommendations
    };
  }
}
