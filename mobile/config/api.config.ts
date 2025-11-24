// API Configuration
export const API_CONFIG = {
  // OpenAI Configuration
  OPENAI: {
    API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
    BASE_URL: 'https://api.openai.com/v1',
    MODEL: 'gpt-4o-mini', // Primary model for vision tasks
    MAX_TOKENS: 1000,
    TEMPERATURE: 0.1, // Low temperature for consistent results
  },
  
  // Analysis Configuration
  ANALYSIS: {
    MAX_HISTORY_ITEMS: 100,
    DEFAULT_TREND_DAYS: 30,
    IMAGE_QUALITY_THRESHOLD: 0.7, // Minimum confidence threshold
  },
  
  // Storage Configuration
  STORAGE: {
    ANALYSIS_HISTORY_KEY: 'wellness_analysis_history',
    USER_PREFERENCES_KEY: 'wellness_user_preferences',
    SESSION_DATA_KEY: 'wellness_session_data',
  },
};

// Environment validation
export const validateEnvironment = (): {
  isValid: boolean;
  missingKeys: string[];
  warnings: string[];
} => {
  const missingKeys: string[] = [];
  const warnings: string[] = [];

  // Check required API keys
  if (!API_CONFIG.OPENAI.API_KEY) {
    missingKeys.push('EXPO_PUBLIC_OPENAI_API_KEY');
  }

  // Check if we're in development mode
  if (__DEV__) {
    warnings.push('Running in development mode - some features may be limited');
  }

  return {
    isValid: missingKeys.length === 0,
    missingKeys,
    warnings,
  };
};

// Helper function to get API key status
export const getApiKeyStatus = (): {
  openai: boolean;
  configured: boolean;
} => {
  return {
    openai: !!API_CONFIG.OPENAI.API_KEY,
    configured: !!API_CONFIG.OPENAI.API_KEY,
  };
};
