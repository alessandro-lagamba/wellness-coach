export const METRICS_COPY = {
  // Skin Metrics
  texture: {
    label: 'Smoothness',
    whyItMatters: 'Indica uniformità e levigatezza della pelle',
    howItWorks: 'Analisi delle irregolarità superficiali',
    examples: {
      'Rough': 'Pelle ruvida e irregolare',
      'Fair': 'Texture migliorabile',
      'Good': 'Texture buona',
      'Excellent': 'Texture eccellente'
    },
    interpretation: '>60 buona, >80 ottima',
    range: '0-100'
  },

  redness: {
    label: 'Redness',
    whyItMatters: 'Stima arrossamento/irritazione visibile',
    howItWorks: 'Analisi dei segnali cromatici cutanei',
    examples: {
      'Low': 'Pelle calma e sana',
      'Mild': 'Leggero arrossamento',
      'Moderate': 'Arrossamento moderato',
      'High': 'Arrossamento significativo'
    },
    interpretation: 'Bassa è desiderabile; >60 indica irritazione',
    range: '0-100'
  },

  hydration: {
    label: 'Hydration',
    whyItMatters: 'Contenuto d\'acqua superficiale',
    howItWorks: 'Stima dell\'idratazione da pattern cutanei',
    examples: {
      'Low': 'Pelle disidratata',
      'Below Optimal': 'Sotto l\'ottimale',
      'Optimal': 'Idratazione ottimale',
      'High': 'Molto idratata'
    },
    interpretation: '55-75 ottimale, <40 disidratata',
    range: '0-100'
  },

  oiliness: {
    label: 'Oiliness',
    whyItMatters: 'Equilibrio del sebo e lucidità',
    howItWorks: 'Rilevazione della brillantezza superficiale',
    examples: {
      'Dry': 'Pelle secca',
      'Balanced': 'Equilibrio ottimale',
      'Oily': 'Pelle oleosa',
      'Very Oily': 'Pelle molto oleosa'
    },
    interpretation: 'Equilibrato intorno a 50; <30 secco, >65 oleoso',
    range: '0-100'
  },

  overall: {
    label: 'Skin Health Score',
    whyItMatters: 'Indice sintetico dei parametri chiave',
    howItWorks: 'Combinazione di smoothness, redness, hydration, oiliness',
    examples: {
      'Poor': 'Salute cutanea da migliorare',
      'Fair': 'Salute cutanea discreta',
      'Good': 'Salute cutanea buona',
      'Excellent': 'Salute cutanea eccellente'
    },
    interpretation: 'Indice sintetico basato su 4 parametri, con penalità se la foto non è di buona qualità',
    range: '0-100'
  },

  // Emotion Metrics
  valence: {
    label: 'Emotional Tone',
    whyItMatters: 'Capisci se il tuo volto comunica positività o fatica',
    howItWorks: 'Basato su segnali del volto (sopracciglia, occhi, bocca)',
    examples: {
      'Negative': 'Espressione negativa',
      'Neutral': 'Espressione neutra',
      'Positive': 'Espressione positiva',
      'Very Positive': 'Espressione molto positiva'
    },
    interpretation: 'Positivo = felice, Negativo = triste',
    range: '-1 to +1'
  },

  arousal: {
    label: 'Energy Level',
    whyItMatters: 'Indica quanta energia stai esprimendo',
    howItWorks: 'Valutazione dell\'intensità dei segnali espressivi',
    examples: {
      'Low': 'Bassa energia',
      'Medium': 'Energia moderata',
      'High': 'Alta energia',
      'Very High': 'Energia molto alta'
    },
    interpretation: 'Alto = eccitato/stressato, Basso = calmo/rilassato',
    range: '0 to 1'
  }
};

export const ACTION_COPY = {
  // Skin Actions
  hydration: {
    'Low': 'Umettante intensivo + bevi 8-10 bicchieri d\'acqua oggi',
    'Below Optimal': 'Umettante leggero + bevi 6-8 bicchieri d\'acqua',
    'Optimal': 'Continua con la tua routine attuale, funziona bene!',
    'High': 'Riduci prodotti idratanti per evitare sovra-idratazione'
  },
  redness: {
    'Low': 'Continua con prodotti delicati e SPF quotidiano',
    'Mild': 'SPF + riduci sfregamenti + prodotti lenitivi',
    'Moderate': 'SPF + acqua tiepida + evita prodotti aggressivi',
    'High': 'SPF + acqua tiepida + consulta dermatologo se persiste'
  },
  texture: {
    'Rough': 'Esfoliazione delicata + idratazione intensiva',
    'Fair': 'Esfoliazione leggera + idratazione regolare',
    'Good': 'Continua con la tua routine, la texture è buona!',
    'Excellent': 'La tua texture è eccellente, mantieni la routine attuale'
  },
  oiliness: {
    'Dry': 'Idratazione intensiva + oli naturali',
    'Balanced': 'Mantieni la routine attuale, l\'equilibrio è ottimale!',
    'Oily': 'Detergente astringente + tonico + crema leggera',
    'Very Oily': 'Detergente forte + tonico astringente + crema oil-free'
  },
  overall: {
    'Poor': 'Focus su idratazione e protezione solare',
    'Fair': 'Migliora routine con prodotti specifici',
    'Good': 'Continua così, la tua pelle sta bene!',
    'Excellent': 'Perfetto! Mantieni la routine attuale'
  },

  // Emotion Actions
  valence: {
    'Negative': '2 min di respiro quadrato + attività piacevole',
    'Neutral': 'Continua con attività rilassanti e piacevoli',
    'Positive': 'Continua con le attività che ti fanno sentire bene!',
    'Very Positive': 'Il tuo umore è ottimo, mantieni questo stato!'
  },
  arousal: {
    'Low': '5 min di movimento leggero + acqua fresca',
    'Medium': 'Mantieni questo livello di energia, è ottimale!',
    'High': '2 min di respiro profondo + ambiente calmo',
    'Very High': '5 min di respiro profondo + ambiente silenzioso'
  }
};

export const QUALITY_COPY = {
  lighting: {
    'low': 'Luce laterale: avvicinati a una finestra frontale',
    'medium': 'Luce buona ma migliorabile',
    'high': 'Luce ottimale per l\'analisi'
  },
  focus: {
    'low': 'Fuoco morbido: tieni fermo 1 sec e tocca il volto',
    'medium': 'Fuoco discreto ma migliorabile',
    'high': 'Fuoco perfetto per l\'analisi'
  },
  coverage: {
    'low': 'Copertura bassa: riprendi più vicino (≥70%)',
    'medium': 'Copertura discreta ma migliorabile',
    'high': 'Copertura ottimale per l\'analisi'
  },
  general: {
    'low': 'Qualità foto migliorabile: riprova con più attenzione',
    'medium': 'Qualità discreta ma migliorabile',
    'high': 'Qualità ottimale per l\'analisi'
  }
};

export const CONFIDENCE_COPY = {
  high: {
    label: 'Alta',
    icon: '✅',
    description: 'Risultato molto affidabile',
    color: '#10b981'
  },
  medium: {
    label: 'Media',
    icon: '⚠️',
    description: 'Risultato indicativo',
    color: '#f59e0b'
  },
  low: {
    label: 'Bassa',
    icon: '❌',
    description: 'Ripeti la foto per maggiore precisione',
    color: '#ef4444'
  }
};

export const TREND_COPY = {
  up: {
    icon: '↑',
    text: 'sopra il tuo solito',
    color: '#10b981'
  },
  down: {
    icon: '↓',
    text: 'sotto il tuo solito',
    color: '#ef4444'
  },
  stable: {
    icon: '→',
    text: 'in linea con il tuo solito',
    color: '#6b7280'
  },
  first: {
    icon: '🆕',
    text: 'Prima misurazione',
    color: '#6b7280'
  }
};

export const INSIGHT_COPY = {
  correlation: {
    title: 'Correlazione Rilevata',
    icon: '🔗',
    color: '#8b5cf6'
  },
  pattern: {
    title: 'Pattern Identificato',
    icon: '📊',
    color: '#06b6d4'
  },
  anomaly: {
    title: 'Anomalia Rilevata',
    icon: '⚠️',
    color: '#f59e0b'
  },
  trend: {
    title: 'Trend Identificato',
    icon: '📈',
    color: '#10b981'
  }
};

export const DISCLAIMER_COPY = {
  skin: 'Valutazione cosmetica, non diagnostica. Per dubbi clinici rivolgiti a un professionista.',
  emotion: 'Analisi espressiva, non diagnostica. Per supporto emotivo rivolgiti a un professionista.',
  general: 'Informazioni fornite a scopo educativo. Consulta sempre un professionista per dubbi medici.'
};

export const EMPTY_STATE_COPY = {
  skin: {
    title: 'Nessuna analisi della pelle',
    subtitle: 'Scatta una foto in luce naturale per iniziare',
    action: 'Analizza la Pelle'
  },
  emotion: {
    title: 'Nessuna analisi emotiva',
    subtitle: 'Inizia una sessione per analizzare le tue emozioni',
    action: 'Analizza le Emozioni'
  }
};

export const EDUCATIONAL_COPY = {
  skin: {
    title: 'Understanding Your Skin',
    subtitle: 'Scopri cosa significano i parametri della tua pelle',
    sections: {
      texture: {
        title: 'Smoothness (Texture)',
        description: 'Indica quanto è liscia e uniforme la tua pelle',
        tips: [
          'Valori alti indicano pelle liscia e giovane',
          'Valori bassi possono indicare secchezza o invecchiamento',
          'Migliora con idratazione e protezione solare'
        ]
      },
      redness: {
        title: 'Redness',
        description: 'Misura l\'arrossamento e l\'irritazione visibile',
        tips: [
          'Valori bassi indicano pelle calma e sana',
          'Valori alti possono indicare irritazione o sensibilità',
          'Riduci con prodotti lenitivi e SPF'
        ]
      },
      hydration: {
        title: 'Hydration',
        description: 'Stima il contenuto d\'acqua della tua pelle',
        tips: [
          'Valori ottimali: 55-75',
          'Valori bassi indicano disidratazione',
          'Migliora bevendo acqua e usando umettanti'
        ]
      },
      oiliness: {
        title: 'Oiliness',
        description: 'Misura l\'equilibrio del sebo',
        tips: [
          'Valori equilibrati: 30-65',
          'Valori alti indicano pelle oleosa',
          'Valori bassi indicano pelle secca'
        ]
      }
    }
  },
  emotion: {
    title: 'Understanding Your Emotions',
    subtitle: 'Scopri cosa significano i parametri emotivi',
    sections: {
      valence: {
        title: 'Emotional Tone (Valence)',
        description: 'Misura la positività o negatività della tua espressione',
        tips: [
          'Valori positivi: felice, contento, soddisfatto',
          'Valori negativi: triste, frustrato, preoccupato',
          'Valori neutri: calmo, equilibrato'
        ]
      },
      arousal: {
        title: 'Energy Level (Arousal)',
        description: 'Misura l\'intensità e l\'attivazione emotiva',
        tips: [
          'Valori alti: eccitato, stressato, energico',
          'Valori bassi: calmo, rilassato, tranquillo',
          'Valori medi: equilibrato, moderato'
        ]
      },
      combinations: {
        title: 'Combinazioni Emotive',
        description: 'Cosa significano le combinazioni di Valence e Arousal',
        examples: [
          'Positiva + Alta → Entusiasta, motivato',
          'Negativa + Alta → Stressato, irritato',
          'Positiva + Bassa → Sereno, composto',
          'Negativa + Bassa → Triste, apatico'
        ]
      }
    }
  }
};
