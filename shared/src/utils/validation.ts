/**
 * Validation Utilities
 * Centralized validation functions for wellness coach data
 */

import { VALIDATION_RULES } from './constants';

// ========================================
// TYPE GUARDS
// ========================================

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidApiKey = (key: string): boolean => {
  return typeof key === 'string' && key.length > 10 && key.trim() !== '';
};

// ========================================
// USER INPUT VALIDATION
// ========================================

export const validateMessage = (message: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message is required' };
  }
  
  const trimmed = message.trim();
  
  if (trimmed.length < VALIDATION_RULES.USER_INPUT.MIN_MESSAGE_LENGTH) {
    return { isValid: false, error: 'Message is too short' };
  }
  
  if (trimmed.length > VALIDATION_RULES.USER_INPUT.MAX_MESSAGE_LENGTH) {
    return { isValid: false, error: 'Message is too long' };
  }
  
  return { isValid: true };
};

export const validateUserAge = (age: number): {
  isValid: boolean;
  error?: string;
} => {
  if (!Number.isInteger(age) || age < 13 || age > 120) {
    return { isValid: false, error: 'Age must be between 13 and 120' };
  }
  
  return { isValid: true };
};

// ========================================
// IMAGE VALIDATION
// ========================================

export const validateImageFile = (file: {
  size: number;
  type: string;
  name?: string;
}): {
  isValid: boolean;
  error?: string;
} => {
  const maxSize = VALIDATION_RULES.IMAGE_UPLOAD.MAX_FILE_SIZE_MB * 1024 * 1024;
  const supportedFormats = VALIDATION_RULES.IMAGE_UPLOAD.SUPPORTED_FORMATS;
  
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      error: `File too large. Max size: ${VALIDATION_RULES.IMAGE_UPLOAD.MAX_FILE_SIZE_MB}MB` 
    };
  }
  
  if (!supportedFormats.includes(file.type as any)) {
    return { 
      isValid: false, 
      error: `Unsupported format. Supported: ${supportedFormats.join(', ')}` 
    };
  }
  
  return { isValid: true };
};

export const validateImageDimensions = (
  width: number, 
  height: number
): {
  isValid: boolean;
  error?: string;
} => {
  const { MIN_RESOLUTION, MAX_RESOLUTION } = VALIDATION_RULES.IMAGE_UPLOAD;
  
  if (width < MIN_RESOLUTION || height < MIN_RESOLUTION) {
    return { 
      isValid: false, 
      error: `Image too small. Minimum: ${MIN_RESOLUTION}x${MIN_RESOLUTION}px` 
    };
  }
  
  if (width > MAX_RESOLUTION || height > MAX_RESOLUTION) {
    return { 
      isValid: false, 
      error: `Image too large. Maximum: ${MAX_RESOLUTION}x${MAX_RESOLUTION}px` 
    };
  }
  
  return { isValid: true };
};

// ========================================
// BIOMETRIC DATA VALIDATION
// ========================================

export const validateHeartRate = (heartRate: number): {
  isValid: boolean;
  error?: string;
} => {
  const { HEART_RATE_MIN, HEART_RATE_MAX } = VALIDATION_RULES.BIOMETRIC_DATA;
  
  if (!Number.isFinite(heartRate) || heartRate < HEART_RATE_MIN || heartRate > HEART_RATE_MAX) {
    return { 
      isValid: false, 
      error: `Heart rate must be between ${HEART_RATE_MIN} and ${HEART_RATE_MAX} BPM` 
    };
  }
  
  return { isValid: true };
};

export const validateHRV = (hrv: number): {
  isValid: boolean;
  error?: string;
} => {
  const { HRV_MIN, HRV_MAX } = VALIDATION_RULES.BIOMETRIC_DATA;
  
  if (!Number.isFinite(hrv) || hrv < HRV_MIN || hrv > HRV_MAX) {
    return { 
      isValid: false, 
      error: `HRV must be between ${HRV_MIN} and ${HRV_MAX} ms` 
    };
  }
  
  return { isValid: true };
};

export const validateSleepHours = (hours: number): {
  isValid: boolean;
  error?: string;
} => {
  const { SLEEP_HOURS_MIN, SLEEP_HOURS_MAX } = VALIDATION_RULES.BIOMETRIC_DATA;
  
  if (!Number.isFinite(hours) || hours < SLEEP_HOURS_MIN || hours > SLEEP_HOURS_MAX) {
    return { 
      isValid: false, 
      error: `Sleep hours must be between ${SLEEP_HOURS_MIN} and ${SLEEP_HOURS_MAX}` 
    };
  }
  
  return { isValid: true };
};

// ========================================
// EMOTION DATA VALIDATION
// ========================================

export const validateEmotionScore = (score: number): {
  isValid: boolean;
  error?: string;
} => {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    return { 
      isValid: false, 
      error: 'Emotion score must be between 0 and 1' 
    };
  }
  
  return { isValid: true };
};

export const validateEmotionData = (emotions: Record<string, number>): {
  isValid: boolean;
  error?: string;
} => {
  const requiredEmotions = ['neutral', 'happiness', 'sadness', 'anger', 'fear', 'surprise', 'disgust'];
  
  for (const emotion of requiredEmotions) {
    if (!(emotion in emotions)) {
      return { 
        isValid: false, 
        error: `Missing emotion: ${emotion}` 
      };
    }
    
    const scoreValidation = validateEmotionScore(emotions[emotion]);
    if (!scoreValidation.isValid) {
      return { 
        isValid: false, 
        error: `Invalid ${emotion} score: ${scoreValidation.error}` 
      };
    }
  }
  
  // Check if scores sum to approximately 1 (with some tolerance for floating point)
  const sum = Object.values(emotions).reduce((acc, score) => acc + score, 0);
  if (Math.abs(sum - 1) > 0.1) {
    return { 
      isValid: false, 
      error: 'Emotion scores should sum to approximately 1' 
    };
  }
  
  return { isValid: true };
};

// ========================================
// SKIN ANALYSIS VALIDATION
// ========================================

export const validateSkinMetric = (value: number, metricName: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { 
      isValid: false, 
      error: `${metricName} must be between 0 and 100` 
    };
  }
  
  return { isValid: true };
};

export const validateSkinTone = (tone: string): {
  isValid: boolean;
  error?: string;
} => {
  const validTones = ['warm', 'cool', 'neutral'];
  
  if (!validTones.includes(tone)) {
    return { 
      isValid: false, 
      error: `Skin tone must be one of: ${validTones.join(', ')}` 
    };
  }
  
  return { isValid: true };
};

// ========================================
// AVATAR CONFIGURATION VALIDATION
// ========================================

export const validateAvatarConfig = (config: any): {
  isValid: boolean;
  error?: string;
} => {
  if (!config || typeof config !== 'object') {
    return { isValid: false, error: 'Avatar config is required' };
  }
  
  const validTypes = ['simli', 'three', 'placeholder'];
  if (!validTypes.includes(config.type)) {
    return { 
      isValid: false, 
      error: `Avatar type must be one of: ${validTypes.join(', ')}` 
    };
  }
  
  if (!config.settings || typeof config.settings !== 'object') {
    return { isValid: false, error: 'Avatar settings are required' };
  }
  
  return { isValid: true };
};

// ========================================
// PRIVACY CONSENT VALIDATION
// ========================================

export const validateConsentData = (consent: any): {
  isValid: boolean;
  error?: string;
} => {
  if (!consent || typeof consent !== 'object') {
    return { isValid: false, error: 'Consent data is required' };
  }
  
  const requiredSections = ['dataSharing', 'analytics', 'marketing'];
  
  for (const section of requiredSections) {
    if (!(section in consent) || typeof consent[section] !== 'object') {
      return { 
        isValid: false, 
        error: `Missing consent section: ${section}` 
      };
    }
  }
  
  if (!consent.grantedAt || !consent.updatedAt) {
    return { 
      isValid: false, 
      error: 'Consent timestamps are required' 
    };
  }
  
  return { isValid: true };
};

// ========================================
// BATCH VALIDATION
// ========================================

export const validateBatch = <T>(
  items: T[],
  validator: (item: T) => { isValid: boolean; error?: string }
): {
  isValid: boolean;
  errors: string[];
  validItems: T[];
} => {
  const errors: string[] = [];
  const validItems: T[] = [];
  
  items.forEach((item, index) => {
    const validation = validator(item);
    if (validation.isValid) {
      validItems.push(item);
    } else {
      errors.push(`Item ${index}: ${validation.error}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    validItems
  };
};

// ========================================
// SANITIZATION FUNCTIONS
// ========================================

export const sanitizeMessage = (message: string): string => {
  return message
    .trim()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .substring(0, VALIDATION_RULES.USER_INPUT.MAX_MESSAGE_LENGTH);
};

export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Collapse multiple underscores
    .substring(0, 255); // Limit length
};

export const sanitizeApiKey = (key: string): string => {
  return key.trim().replace(/\s/g, '');
};

// ========================================
// RATE LIMITING VALIDATION
// ========================================

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = VALIDATION_RULES.USER_INPUT.MAX_MESSAGES_PER_MINUTE,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return true;
  }
  
  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}

// ========================================
// EXPORTS
// ========================================

export const validators = {
  message: validateMessage,
  userAge: validateUserAge,
  imageFile: validateImageFile,
  imageDimensions: validateImageDimensions,
  heartRate: validateHeartRate,
  hrv: validateHRV,
  sleepHours: validateSleepHours,
  emotionScore: validateEmotionScore,
  emotionData: validateEmotionData,
  skinMetric: validateSkinMetric,
  skinTone: validateSkinTone,
  avatarConfig: validateAvatarConfig,
  consentData: validateConsentData,
};

export const sanitizers = {
  message: sanitizeMessage,
  fileName: sanitizeFileName,
  apiKey: sanitizeApiKey,
};

export const typeGuards = {
  isValidEmail,
  isValidUrl,
  isValidApiKey,
};
