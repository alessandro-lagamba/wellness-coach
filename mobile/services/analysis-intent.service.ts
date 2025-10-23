/**
 * Servizio per rilevare intent di analisi dai messaggi dell'utente
 */

export interface AnalysisIntent {
  needsEmotionAnalysis: boolean;
  needsSkinAnalysis: boolean;
  confidence: number;
  detectedKeywords: string[];
  suggestedActions: string[];
}

export class AnalysisIntentService {
  // Parole chiave per analisi emotive
  private static emotionKeywords = [
    // Emozioni negative
    'stressato', 'stress', 'triste', 'tristezza', 'depresso', 'depressione',
    'arrabbiato', 'rabbia', 'furioso', 'ansioso', 'ansia', 'preoccupato',
    'nervoso', 'tensione', 'paura', 'spaventato', 'confuso', 'perso',
    'solo', 'solitudine', 'isolato', 'stanco', 'esausto', 'svuotato',
    
    // Emozioni positive
    'felice', 'gioia', 'contento', 'soddisfatto', 'eccitato', 'entusiasta',
    'energico', 'motivato', 'fiducioso', 'ottimista', 'calmo', 'rilassato',
    
    // Stati d'animo generali
    'umore', 'sentimenti', 'emozioni', 'stato d\'animo', 'come mi sento',
    'mi sento', 'mi sento come', 'non mi sento', 'mi sento male',
    'mi sento bene', 'mi sento strano', 'mi sento diverso'
  ];

  // Parole chiave per analisi della pelle
  private static skinKeywords = [
    // Problemi pelle
    'pelle', 'cute', 'viso', 'faccia', 'acne', 'brufoli', 'punti neri',
    'secca', 'disidratata', 'grassa', 'oleosa', 'untuosa', 'lucida',
    'rughe', 'rughette', 'linee', 'macchie', 'macchie scure', 'iperpigmentazione',
    'rossore', 'irritata', 'sensibile', 'prurito', 'bruciore', 'tirante',
    'opaca', 'spenta', 'senza vita', 'vecchia', 'stanca',
    
    // Cura della pelle
    'skincare', 'cura della pelle', 'routine', 'crema', 'idratante',
    'detergente', 'toner', 'siero', 'protezione solare', 'spf',
    'trattamento', 'maschera', 'esfoliante', 'peeling'
  ];

  // Parole chiave per analisi generale
  private static generalKeywords = [
    'non mi sento bene', 'mi sento male', 'qualcosa non va',
    'aiutami', 'aiuto', 'cosa posso fare', 'consigli',
    'come migliorare', 'come stare meglio', 'benessere',
    'salute', 'come sono', 'come sto', 'valutazione'
  ];

  /**
   * Rileva intent di analisi da un messaggio dell'utente
   */
  static detectAnalysisIntent(message: string): AnalysisIntent {
    const lowerMessage = message.toLowerCase();
    const detectedKeywords: string[] = [];
    let emotionScore = 0;
    let skinScore = 0;
    let generalScore = 0;

    // Conta occorrenze per emozioni
    this.emotionKeywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        detectedKeywords.push(keyword);
        emotionScore += 1;
      }
    });

    // Conta occorrenze per pelle
    this.skinKeywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        detectedKeywords.push(keyword);
        skinScore += 1;
      }
    });

    // Conta occorrenze per generale
    this.generalKeywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        detectedKeywords.push(keyword);
        generalScore += 1;
      }
    });

    // Determina se servono analisi
    const needsEmotionAnalysis = emotionScore > 0 || generalScore > 0;
    const needsSkinAnalysis = skinScore > 0 || generalScore > 0;

    // Calcola confidence
    const totalScore = emotionScore + skinScore + generalScore;
    const confidence = Math.min(totalScore / 3, 1); // Normalizza tra 0 e 1

    // Genera azioni suggerite
    const suggestedActions: string[] = [];
    if (needsEmotionAnalysis) {
      suggestedActions.push('emotion_analysis');
    }
    if (needsSkinAnalysis) {
      suggestedActions.push('skin_analysis');
    }

    return {
      needsEmotionAnalysis,
      needsSkinAnalysis,
      confidence,
      detectedKeywords,
      suggestedActions
    };
  }

  /**
   * Genera messaggio di suggerimento per l'IA
   */
  static generateAnalysisSuggestion(intent: AnalysisIntent): string {
    if (intent.confidence < 0.3) {
      return ''; // Non suggerire se confidence troppo bassa
    }

    let suggestion = '';

    if (intent.needsEmotionAnalysis && intent.needsSkinAnalysis) {
      suggestion = 'Per aiutarti al meglio, ti suggerisco di fare entrambe le analisi per avere un quadro completo del tuo benessere.';
    } else if (intent.needsEmotionAnalysis) {
      suggestion = 'Per capire meglio come ti senti e darti consigli mirati, ti suggerisco di fare un\'analisi delle tue emozioni.';
    } else if (intent.needsSkinAnalysis) {
      suggestion = 'Per valutare la situazione della tua pelle e suggerirti i migliori trattamenti, ti consiglio di fare un\'analisi della pelle.';
    }

    return suggestion;
  }

  /**
   * Genera testo per i bottoni di azione
   */
  static generateActionButtons(intent: AnalysisIntent): Array<{
    text: string;
    action: string;
    icon: string;
    route: string;
  }> {
    const buttons = [];

    if (intent.needsEmotionAnalysis) {
      buttons.push({
        text: '🔍 Analizza Emozioni',
        action: 'emotion_analysis',
        icon: 'heart',
        route: '/emotion-detection'
      });
    }

    if (intent.needsSkinAnalysis) {
      buttons.push({
        text: '📸 Analizza Pelle',
        action: 'skin_analysis',
        icon: 'camera',
        route: '/skin-analysis'
      });
    }

    return buttons;
  }

  /**
   * Testa il servizio con esempi
   */
  static testService(): void {
    const testMessages = [
      'Mi sento stressato',
      'La mia pelle è secca',
      'Non mi sento bene oggi',
      'Ho dei brufoli sul viso',
      'Sono triste e la mia pelle è opaca',
      'Come posso migliorare il mio benessere?',
      'Ciao, come stai?', // Dovrebbe avere confidence bassa
    ];

    console.log('🧠 Testing Analysis Intent Detection...\n');

    testMessages.forEach((message, index) => {
      const intent = this.detectAnalysisIntent(message);
      console.log(`${index + 1}. "${message}"`);
      console.log(`   Intent: Emotion=${intent.needsEmotionAnalysis}, Skin=${intent.needsSkinAnalysis}`);
      console.log(`   Confidence: ${intent.confidence.toFixed(2)}`);
      console.log(`   Keywords: [${intent.detectedKeywords.join(', ')}]`);
      console.log(`   Suggestion: "${this.generateAnalysisSuggestion(intent)}"`);
      console.log('');
    });
  }
}
