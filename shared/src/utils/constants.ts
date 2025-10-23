/**
 * Shared Constants and Configuration
 * Centralized configuration for API keys, endpoints, and app settings
 */

// ========================================
// API ENDPOINTS (Public)
// ========================================

export const API_ENDPOINTS = {
  // Backend base URL (safe to expose)
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  
  // Public endpoints (no secrets)
  CHAT: '/chat/respond',
  EMOTION: '/emotion/analyze',
  HEALTH: '/health',
  
  // Wellness endpoints (proxied through backend)
  WELLNESS: {
    COACH: '/wellness/coach',
    SKIN_ANALYSIS: '/wellness/skin/analyze',
    BIOMETRIC: '/wellness/biometric',
    ENVIRONMENTAL: '/wellness/environmental',
    PROFILE: '/wellness/profile',
    GOALS: '/wellness/goals',
    PROGRESS: '/wellness/progress',
  },
  
  // Secure avatar endpoints (token-based)
  AVATAR: {
    SIMLI_TOKEN: '/avatar/simli/token',
    SIMLI_SPEAK: '/avatar/simli/speak',
    A2E_TOKEN: '/avatar/a2e/token',
    RPM_GENERATE: '/avatar/rpm/generate',
  },
  
  // Secure TTS endpoints (proxied)
  TTS: {
    SYNTHESIZE: '/tts/synthesize',
    VOICES: '/tts/voices',
  }
} as const;

// ========================================
// AVATAR CONFIGURATION (Client-Safe)
// ========================================

export const AVATAR_CONFIG = {
  PLACEHOLDER: {
    DEFAULT_COLOR: '#6366f1',
    DEFAULT_SIZE: 200,
    DEFAULT_STYLE: 'animated' as const,
    ANIMATION_SPEED: 1,
  },
  
  THREE: {
    DEFAULT_MODEL_URL: '/models/wellness-coach.glb',
    DEFAULT_ANIMATIONS: ['idle', 'speaking', 'greeting', 'thinking'],
    DEFAULT_SCALE: 1.2,
    DEFAULT_LIGHTING: 'natural' as const,
  },
  
  // Client-safe settings (no API keys)
  CLIENT_SETTINGS: {
    DEFAULT_LANGUAGE: 'it',
    DEFAULT_QUALITY: 'medium' as const,
    RECONNECT_ATTEMPTS: 3,
    RECONNECT_DELAY: 2000,
  }
} as const;

// ========================================
// WELLNESS CONFIGURATION
// ========================================

export const WELLNESS_CONFIG = {
  EMOTION_DETECTION: {
    INTERVAL_MS: parseInt(process.env.EXPO_PUBLIC_EMOTION_DETECTION_INTERVAL || '500'),
    CONFIDENCE_THRESHOLD: 0.5,
    DEBOUNCE_MS: 250,
    SUPPORTED_EMOTIONS: ['neutral', 'happiness', 'sadness', 'anger', 'fear', 'surprise', 'disgust'] as const,
  },
  
  SKIN_ANALYSIS: {
    QUALITY: process.env.EXPO_PUBLIC_SKIN_ANALYSIS_QUALITY || 'medium',
    MIN_CONFIDENCE: 0.6,
    SUPPORTED_METRICS: ['brightness', 'uniformity', 'redness', 'skinTone'] as const,
  },
  
  COACHING: {
    MAX_SUGGESTIONS: 3,
    CONTEXT_HISTORY_LENGTH: 10,
    DEFAULT_LANGUAGE: 'it',
    RESPONSE_TIMEOUT_MS: 15000,
  },
  
  PRIVACY: {
    DATA_RETENTION_DAYS: parseInt(process.env.EXPO_PUBLIC_DATA_RETENTION_DAYS || '30'),
    ENABLE_ANALYTICS: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true',
    ENABLE_CRASH_REPORTING: process.env.EXPO_PUBLIC_ENABLE_CRASH_REPORTING !== 'false',
    AUTO_DELETE_IMAGES: true,
    ENCRYPTION_ENABLED: true,
  }
} as const;

// ========================================
// FEATURE FLAGS
// ========================================

export const FEATURE_FLAGS = {
  EMOTION_DETECTION: process.env.EXPO_PUBLIC_ENABLE_EMOTION_DETECTION !== 'false',
  SKIN_ANALYSIS: process.env.EXPO_PUBLIC_ENABLE_SKIN_ANALYSIS !== 'false',
  BIOMETRIC_INTEGRATION: process.env.EXPO_PUBLIC_ENABLE_BIOMETRIC_INTEGRATION === 'true',
  THREE_D_AVATAR: process.env.EXPO_PUBLIC_ENABLE_3D_AVATAR === 'true',
  VOICE_CHAT: true,
  ENVIRONMENTAL_DATA: process.env.EXPO_PUBLIC_ENABLE_ENVIRONMENTAL_DATA === 'true',
  SOCIAL_FEATURES: false,
  GAMIFICATION: false,
  PRODUCT_RECOMMENDATIONS: false,
} as const;

// ========================================
// PERFORMANCE SETTINGS
// ========================================

export const PERFORMANCE_CONFIG = {
  // ML Model settings
  ML_MODELS: {
    FACE_DETECTION_INPUT_SIZE: 416,
    FACE_DETECTION_SCORE_THRESHOLD: 0.5,
    EMOTION_MODEL_CACHE_SIZE: 50,
    SKIN_ANALYSIS_IMAGE_MAX_SIZE: 1024,
  },
  
  // Network settings
  NETWORK: {
    REQUEST_TIMEOUT_MS: 10000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  },
  
  // Avatar performance
  AVATAR: {
    MAX_FPS: 30,
    RENDER_QUALITY: 'medium' as const,
    ENABLE_SHADOWS: true,
    ENABLE_ANTI_ALIASING: true,
  },
  
  // Memory management
  MEMORY: {
    MAX_EMOTION_HISTORY: 100,
    MAX_CHAT_MESSAGES: 50,
    MAX_ANALYSIS_CACHE: 20,
    CLEANUP_INTERVAL_MS: 60000, // 1 minute
  }
} as const;

// ========================================
// VALIDATION SCHEMAS
// ========================================

export const VALIDATION_RULES = {
  USER_INPUT: {
    MIN_MESSAGE_LENGTH: 1,
    MAX_MESSAGE_LENGTH: 1000,
    MAX_MESSAGES_PER_MINUTE: 10,
  },
  
  IMAGE_UPLOAD: {
    MAX_FILE_SIZE_MB: 10,
    SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'] as const,
    MIN_RESOLUTION: 240,
    MAX_RESOLUTION: 4096,
  },
  
  BIOMETRIC_DATA: {
    HEART_RATE_MIN: 40,
    HEART_RATE_MAX: 220,
    HRV_MIN: 10,
    HRV_MAX: 200,
    SLEEP_HOURS_MIN: 0,
    SLEEP_HOURS_MAX: 24,
  }
} as const;

// ========================================
// ERROR MESSAGES
// ========================================

export const ERROR_MESSAGES = {
  NETWORK: {
    CONNECTION_FAILED: 'Connessione fallita. Verifica la tua connessione internet.',
    TIMEOUT: 'Richiesta scaduta. Riprova più tardi.',
    SERVER_ERROR: 'Errore del server. Riprova più tardi.',
  },
  
  AVATAR: {
    LOAD_FAILED: 'Impossibile caricare l\'avatar. Riprova.',
    CONNECTION_LOST: 'Connessione avatar persa. Riconnessione in corso...',
    SPEECH_FAILED: 'Errore durante la sintesi vocale.',
  },
  
  CAMERA: {
    PERMISSION_DENIED: 'Permesso camera negato. Abilita l\'accesso alla camera nelle impostazioni.',
    NOT_AVAILABLE: 'Camera non disponibile su questo dispositivo.',
    INITIALIZATION_FAILED: 'Impossibile inizializzare la camera.',
  },
  
  ML: {
    MODEL_LOAD_FAILED: 'Impossibile caricare il modello di analisi.',
    INFERENCE_FAILED: 'Errore durante l\'analisi. Riprova.',
    INSUFFICIENT_DATA: 'Dati insufficienti per l\'analisi.',
  }
} as const;

// ========================================
// THEME CONFIGURATION
// ========================================

export const THEME_CONFIG = {
  COLORS: {
    PRIMARY: '#6366f1',
    SECONDARY: '#8b5cf6',
    ACCENT: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    SUCCESS: '#10b981',
    
    // Emotion-based colors
    EMOTIONS: {
      happiness: '#10b981',
      sadness: '#3b82f6',
      anger: '#ef4444',
      fear: '#8b5cf6',
      surprise: '#f59e0b',
      disgust: '#6b7280',
      neutral: '#6366f1',
    },
    
    // Background gradients
    GRADIENTS: {
      PRIMARY: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      WELLNESS: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      CALM: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    }
  },
  
  TYPOGRAPHY: {
    FONT_FAMILY_PRIMARY: 'Inter',
    FONT_FAMILY_SECONDARY: 'Roboto',
    FONT_SIZE_BASE: 16,
  },
  
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
    XXL: 48,
  },
  
  BORDER_RADIUS: {
    SM: 4,
    MD: 8,
    LG: 12,
    XL: 16,
    FULL: 9999,
  }
} as const;

// ========================================
// UTILITY FUNCTIONS
// ========================================

export const getApiUrl = (endpoint: string): string => {
  const baseUrl = API_ENDPOINTS.BASE_URL.replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}/api${cleanEndpoint}`;
};

export const isFeatureEnabled = (feature: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[feature];
};

export const getEmotionColor = (emotion: string): string => {
  return THEME_CONFIG.COLORS.EMOTIONS[emotion as keyof typeof THEME_CONFIG.COLORS.EMOTIONS] || THEME_CONFIG.COLORS.PRIMARY;
};

export const validateImageFile = (file: { size: number; type: string }): boolean => {
  const maxSize = VALIDATION_RULES.IMAGE_UPLOAD.MAX_FILE_SIZE_MB * 1024 * 1024;
  const supportedFormats = VALIDATION_RULES.IMAGE_UPLOAD.SUPPORTED_FORMATS;
  
  return file.size <= maxSize && supportedFormats.includes(file.type as any);
};

// ========================================
// ENVIRONMENT INFO (Pure - No DOM)
// ========================================

export const ENV_INFO = {
  VERSION: '0.1.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const;

// Platform detection functions (pure functions - no DOM references)
export const createPlatformDetector = () => ({
  detectBrowser: (hasWindow?: boolean) => hasWindow === true,
  detectMobile: (userAgent?: string) => 
    userAgent ? /iPhone|iPad|iPod|Android/i.test(userAgent) : false,
  detectIOS: (userAgent?: string) => 
    userAgent ? /iPad|iPhone|iPod/.test(userAgent) : false,
  detectAndroid: (userAgent?: string) => 
    userAgent ? /Android/.test(userAgent) : false,
});
