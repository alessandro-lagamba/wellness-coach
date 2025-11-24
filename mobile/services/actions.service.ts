export interface ActionInfo {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category:
    | 'skincare'
    | 'lifestyle'
    | 'medical'
    | 'emotional'
    | 'nutrition'
    | 'skin'
    | 'movement'
    | 'mindfulness'
    | 'recovery';
  actionable: boolean;
  estimatedTime?: string;
  resources?: string[];
}

export interface UserContext {
  userId: string;
  age?: number;
  skinType?: string;
  lifestyle?: string[];
  medicalConditions?: string[];
  preferences?: string[];
}

export class ActionsService {
  // Regole deterministiche per Next Best Actions
  static getNextBestAction(metric: string, value: number, bucket: string, userContext?: UserContext): ActionInfo {
    const actions = this.getActionRules(metric);
    const action = actions[bucket] || actions['default'];
    
    if (userContext) {
      return this.personalizeAction(action, userContext);
    }
    
    return action;
  }

  // Regole per Skin Metrics
  private static getActionRules(metric: string): Record<string, ActionInfo> {
    switch (metric) {
      case 'hydration':
        return {
          'Low': {
            id: 'hydration_low',
            title: 'Idratazione Intensiva',
            description: 'Umettante intensivo + bevi 8-10 bicchieri d\'acqua oggi',
            priority: 'high',
            category: 'skincare',
            actionable: true,
            estimatedTime: '5 min',
            resources: ['Umettante con acido ialuronico', 'Acqua minerale']
          },
          'Below Optimal': {
            id: 'hydration_below_optimal',
            title: 'Migliora Idratazione',
            description: 'Umettante leggero + bevi 6-8 bicchieri d\'acqua',
            priority: 'medium',
            category: 'skincare',
            actionable: true,
            estimatedTime: '3 min',
            resources: ['Umettante leggero', 'Acqua']
          },
          'Optimal': {
            id: 'hydration_optimal',
            title: 'Mantieni Routine',
            description: 'Continua con la tua routine attuale, funziona bene!',
            priority: 'low',
            category: 'skincare',
            actionable: false,
            estimatedTime: '0 min'
          },
          'High': {
            id: 'hydration_high',
            title: 'Bilancia Idratazione',
            description: 'Riduci prodotti idratanti per evitare sovra-idratazione',
            priority: 'medium',
            category: 'skincare',
            actionable: true,
            estimatedTime: '2 min',
            resources: ['Detergente delicato', 'Tonico astringente']
          }
        };

      case 'redness':
        return {
          'Low': {
            id: 'redness_low',
            title: 'Mantieni Routine Delicata',
            description: 'Continua con prodotti delicati e SPF quotidiano',
            priority: 'low',
            category: 'skincare',
            actionable: false,
            estimatedTime: '0 min'
          },
          'Mild': {
            id: 'redness_mild',
            title: 'Calma la Pelle',
            description: 'SPF + riduci sfregamenti + prodotti lenitivi',
            priority: 'medium',
            category: 'skincare',
            actionable: true,
            estimatedTime: '5 min',
            resources: ['SPF 50+', 'Crema lenitiva', 'Detergente delicato']
          },
          'Moderate': {
            id: 'redness_moderate',
            title: 'Attenzione al Rossore',
            description: 'SPF + acqua tiepida + evita prodotti aggressivi',
            priority: 'high',
            category: 'skincare',
            actionable: true,
            estimatedTime: '10 min',
            resources: ['SPF 50+', 'Acqua termale', 'Crema lenitiva']
          },
          'High': {
            id: 'redness_high',
            title: 'Consulta Specialista',
            description: 'SPF + acqua tiepida + consulta dermatologo se persiste',
            priority: 'urgent',
            category: 'medical',
            actionable: true,
            estimatedTime: '15 min',
            resources: ['SPF 50+', 'Acqua termale', 'Contatto dermatologo']
          }
        };

      case 'texture':
        return {
          'Rough': {
            id: 'texture_rough',
            title: 'Migliora Texture',
            description: 'Esfoliazione delicata + idratazione intensiva',
            priority: 'high',
            category: 'skincare',
            actionable: true,
            estimatedTime: '10 min',
            resources: ['Esfoliante delicato', 'Umettante intensivo']
          },
          'Fair': {
            id: 'texture_fair',
            title: 'Raffina Texture',
            description: 'Esfoliazione leggera + idratazione regolare',
            priority: 'medium',
            category: 'skincare',
            actionable: true,
            estimatedTime: '7 min',
            resources: ['Esfoliante leggero', 'Umettante']
          },
          'Good': {
            id: 'texture_good',
            title: 'Mantieni Routine',
            description: 'Continua con la tua routine, la texture è buona!',
            priority: 'low',
            category: 'skincare',
            actionable: false,
            estimatedTime: '0 min'
          },
          'Excellent': {
            id: 'texture_excellent',
            title: 'Perfetto!',
            description: 'La tua texture è eccellente, mantieni la routine attuale',
            priority: 'low',
            category: 'skincare',
            actionable: false,
            estimatedTime: '0 min'
          }
        };

      case 'oiliness':
        return {
          'Dry': {
            id: 'oiliness_dry',
            title: 'Bilancia Sebo',
            description: 'Idratazione intensiva + oli naturali',
            priority: 'high',
            category: 'skincare',
            actionable: true,
            estimatedTime: '8 min',
            resources: ['Umettante intensivo', 'Olio di jojoba']
          },
          'Balanced': {
            id: 'oiliness_balanced',
            title: 'Equilibrio Perfetto',
            description: 'Mantieni la routine attuale, l\'equilibrio è ottimale!',
            priority: 'low',
            category: 'skincare',
            actionable: false,
            estimatedTime: '0 min'
          },
          'Oily': {
            id: 'oiliness_oily',
            title: 'Controlla Sebo',
            description: 'Detergente astringente + tonico + crema leggera',
            priority: 'medium',
            category: 'skincare',
            actionable: true,
            estimatedTime: '6 min',
            resources: ['Detergente astringente', 'Tonico', 'Crema leggera']
          },
          'Very Oily': {
            id: 'oiliness_very_oily',
            title: 'Riduci Sebo',
            description: 'Detergente forte + tonico astringente + crema oil-free',
            priority: 'high',
            category: 'skincare',
            actionable: true,
            estimatedTime: '10 min',
            resources: ['Detergente forte', 'Tonico astringente', 'Crema oil-free']
          }
        };

      case 'valence':
        return {
          'Negative': {
            id: 'valence_negative',
            title: 'Migliora Umore',
            description: '2 min di respiro quadrato + attività piacevole',
            priority: 'high',
            category: 'emotional',
            actionable: true,
            estimatedTime: '2 min',
            resources: ['Tecnica respiro quadrato', 'Attività piacevole']
          },
          'Neutral': {
            id: 'valence_neutral',
            title: 'Mantieni Equilibrio',
            description: 'Continua con attività rilassanti e piacevoli',
            priority: 'low',
            category: 'emotional',
            actionable: false,
            estimatedTime: '0 min'
          },
          'Positive': {
            id: 'valence_positive',
            title: 'Mantieni Positività',
            description: 'Continua con le attività che ti fanno sentire bene!',
            priority: 'low',
            category: 'emotional',
            actionable: false,
            estimatedTime: '0 min'
          },
          'Very Positive': {
            id: 'valence_very_positive',
            title: 'Fantastico!',
            description: 'Il tuo umore è ottimo, mantieni questo stato!',
            priority: 'low',
            category: 'emotional',
            actionable: false,
            estimatedTime: '0 min'
          }
        };

      case 'arousal':
        return {
          'Low': {
            id: 'arousal_low',
            title: 'Aumenta Energia',
            description: '5 min di movimento leggero + acqua fresca',
            priority: 'medium',
            category: 'lifestyle',
            actionable: true,
            estimatedTime: '5 min',
            resources: ['Movimento leggero', 'Acqua fresca']
          },
          'Medium': {
            id: 'arousal_medium',
            title: 'Energia Bilanciata',
            description: 'Mantieni questo livello di energia, è ottimale!',
            priority: 'low',
            category: 'lifestyle',
            actionable: false,
            estimatedTime: '0 min'
          },
          'High': {
            id: 'arousal_high',
            title: 'Riduci Attivazione',
            description: '2 min di respiro profondo + ambiente calmo',
            priority: 'medium',
            category: 'emotional',
            actionable: true,
            estimatedTime: '2 min',
            resources: ['Tecnica respiro profondo', 'Ambiente calmo']
          },
          'Very High': {
            id: 'arousal_very_high',
            title: 'Calma Urgente',
            description: '5 min di respiro profondo + ambiente silenzioso',
            priority: 'urgent',
            category: 'emotional',
            actionable: true,
            estimatedTime: '5 min',
            resources: ['Tecnica respiro profondo', 'Ambiente silenzioso']
          }
        };

      default:
        return {
          'default': {
            id: 'default_action',
            title: 'Continua a Monitorare',
            description: 'Continua a monitorare questa metrica',
            priority: 'low',
            category: 'lifestyle',
            actionable: false,
            estimatedTime: '0 min'
          }
        };
    }
  }

  // Personalizza azione basata su contesto utente
  private static personalizeAction(action: ActionInfo, userContext: UserContext): ActionInfo {
    let personalizedAction = { ...action };

    // Personalizza basato su età
    if (userContext.age) {
      if (userContext.age < 25) {
        personalizedAction.description += ' (giovane pelle)';
      } else if (userContext.age > 50) {
        personalizedAction.description += ' (pelle matura)';
      }
    }

    // Personalizza basato su tipo di pelle
    if (userContext.skinType) {
      switch (userContext.skinType) {
        case 'sensitive':
          personalizedAction.description += ' - usa prodotti delicati';
          break;
        case 'oily':
          personalizedAction.description += ' - evita prodotti troppo grassi';
          break;
        case 'dry':
          personalizedAction.description += ' - usa prodotti idratanti';
          break;
      }
    }

    // Personalizza basato su condizioni mediche
    if (userContext.medicalConditions?.includes('rosacea')) {
      if (personalizedAction.category === 'skincare') {
        personalizedAction.description += ' - attenzione alla rosacea';
        personalizedAction.priority = 'urgent';
      }
    }

    return personalizedAction;
  }

  // Genera azioni multiple per combinazioni di metriche
  static getMultipleActions(metrics: Array<{ metric: string; value: number; bucket: string }>, userContext?: UserContext): ActionInfo[] {
    const actions = metrics.map(({ metric, value, bucket }) => 
      this.getNextBestAction(metric, value, bucket, userContext)
    );

    // Rimuovi duplicati e ordina per priorità
    const uniqueActions = actions.filter((action, index, self) => 
      index === self.findIndex(a => a.id === action.id)
    );

    return uniqueActions.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Valida se un'azione è appropriata per l'utente
  static isActionAppropriate(action: ActionInfo, userContext: UserContext): boolean {
    // Controlla controindicazioni mediche
    if (userContext.medicalConditions?.includes('allergy') && action.resources?.some(r => r.includes('allergen'))) {
      return false;
    }

    // Controlla preferenze utente
    if (userContext.preferences?.includes('vegan') && action.resources?.some(r => r.includes('animal'))) {
      return false;
    }

    return true;
  }

  // Genera messaggio di follow-up per azione
  static getFollowUpMessage(action: ActionInfo, daysSinceAction: number): string {
    if (daysSinceAction === 0) {
      return `Hai completato: ${action.title}. Come ti senti?`;
    } else if (daysSinceAction === 1) {
      return `Ieri hai fatto: ${action.title}. Noti miglioramenti?`;
    } else if (daysSinceAction === 3) {
      return `3 giorni fa: ${action.title}. Continua così!`;
    } else if (daysSinceAction === 7) {
      return `Una settimana fa: ${action.title}. È il momento di una nuova analisi!`;
    }
    
    return `Ricorda: ${action.title}`;
  }
}
