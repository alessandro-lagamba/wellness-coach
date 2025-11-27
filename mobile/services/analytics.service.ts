/**
 * Analytics Service - Privacy-First Event Tracking
 * 
 * Tracks app events in an anonymized way using Supabase.
 * All data is anonymized and GDPR-compliant.
 * 
 * Features:
 * - Anonymized user tracking (hashed user ID)
 * - Event tracking (analysis started/completed, feature usage)
 * - Error tracking (integrated with EnhancedLoggingService)
 * - Remote logging toggle (can be disabled in production)
 */

import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

// Environment variable to enable/disable remote logging
const ENABLE_REMOTE_LOGGING = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true';

/**
 * Event types that can be tracked
 */
export type AnalyticsEventType =
  // Analysis events
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_error'
  | 'analysis_cancelled'
  
  // Feature usage
  | 'recipe_generated'
  | 'recipe_saved'
  | 'recipe_viewed'
  | 'meal_planned'
  | 'meal_plan_entry_created'
  | 'journal_entry_created'
  | 'chat_message_sent'
  | 'widget_added'
  | 'widget_removed'
  
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  
  // Navigation
  | 'screen_viewed'
  
  // Errors
  | 'api_error'
  | 'database_error'
  | 'network_error'
  
  // Performance
  | 'slow_operation'
  | 'timeout_error';

/**
 * Event properties (anonymized, no PII)
 */
export interface AnalyticsEventProperties {
  // Analysis type (if applicable)
  analysis_type?: 'emotion' | 'skin' | 'food';
  
  // Feature context
  feature?: string;
  source?: string; // e.g., 'camera', 'gallery', 'fridge'
  
  // Error context (if applicable)
  error_type?: string;
  error_message?: string; // Anonymized, no PII
  
  // Performance metrics
  duration_ms?: number;
  response_time_ms?: number;
  
  // Generic metadata (no PII)
  metadata?: Record<string, any>;
}

/**
 * Analytics Event (stored in Supabase)
 */
interface AnalyticsEvent {
  id: string;
  user_id_hash: string; // Hashed user ID (not real user_id)
  event_type: AnalyticsEventType;
  properties: AnalyticsEventProperties;
  device_type: 'ios' | 'android' | 'web';
  app_version: string;
  os_version?: string;
  created_at: string;
}

/**
 * Hash user ID for anonymization
 */
async function hashUserId(userId: string): Promise<string> {
  try {
    // Use SHA-256 to hash user ID (one-way, cannot be reversed)
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      userId
    );
    return hash.substring(0, 16); // Use first 16 chars as hash
  } catch (error) {
    console.warn('[Analytics] Failed to hash user ID:', error);
    return 'anonymous';
  }
}

/**
 * Analytics Service
 */
export class AnalyticsService {
  private static isInitialized = false;
  private static currentUserIdHash: string | null = null;

  /**
   * Initialize analytics service
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get current user and hash ID
      const user = await AuthService.getCurrentUser();
      if (user?.id) {
        this.currentUserIdHash = await hashUserId(user.id);
      }

      this.isInitialized = true;
      
      if (__DEV__) {
        console.log('[Analytics] ✅ Initialized', {
          remoteLogging: ENABLE_REMOTE_LOGGING,
          userIdHash: this.currentUserIdHash ? 'set' : 'anonymous',
        });
      }
    } catch (error) {
      console.warn('[Analytics] Failed to initialize:', error);
      this.isInitialized = true; // Mark as initialized to avoid retry loops
    }
  }

  /**
   * Track an event
   */
  static async trackEvent(
    eventType: AnalyticsEventType,
    properties?: AnalyticsEventProperties
  ): Promise<void> {
    // Always log to console in dev
    if (__DEV__) {
      console.log(`[Analytics] 📊 ${eventType}`, properties || {});
    }

    // Skip remote logging if disabled
    if (!ENABLE_REMOTE_LOGGING) {
      return;
    }

    try {
      // Ensure initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Get user ID hash
      let userIdHash = this.currentUserIdHash;
      if (!userIdHash) {
        const user = await AuthService.getCurrentUser();
        if (user?.id) {
          userIdHash = await hashUserId(user.id);
          this.currentUserIdHash = userIdHash;
        } else {
          userIdHash = 'anonymous';
        }
      }

      // Get device info
      const deviceType = Constants.platform?.ios ? 'ios' : Constants.platform?.android ? 'android' : 'web';
      const appVersion = Constants.expoConfig?.version || '0.0.0';
      const osVersion = Constants.platform?.ios?.systemVersion || Constants.platform?.android?.systemVersion || undefined;

      // Sanitize properties (remove any PII)
      const sanitizedProperties = this.sanitizeProperties(properties || {});

      // Create event
      const event: Omit<AnalyticsEvent, 'id' | 'created_at'> = {
        user_id_hash: userIdHash,
        event_type: eventType,
        properties: sanitizedProperties,
        device_type: deviceType,
        app_version: appVersion,
        os_version: osVersion,
      };

      // Insert into Supabase (fire-and-forget, don't block)
      supabase
        .from('analytics_events')
        .insert(event)
        .then(() => {
          if (__DEV__) {
            console.log(`[Analytics] ✅ Event tracked: ${eventType}`);
          }
        })
        .catch((error) => {
          // Don't log errors in production to avoid noise
          if (__DEV__) {
            console.warn(`[Analytics] ⚠️ Failed to track event ${eventType}:`, error);
          }
        });
    } catch (error) {
      // Don't block the app if analytics fails
      if (__DEV__) {
        console.warn('[Analytics] Error tracking event:', error);
      }
    }
  }

  /**
   * Sanitize properties to remove PII
   */
  private static sanitizeProperties(properties: AnalyticsEventProperties): AnalyticsEventProperties {
    const sanitized = { ...properties };

    // Remove any potential PII from error messages
    if (sanitized.error_message) {
      // Remove email addresses
      sanitized.error_message = sanitized.error_message.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[email_redacted]'
      );
      
      // Remove URLs that might contain user data
      sanitized.error_message = sanitized.error_message.replace(
        /https?:\/\/[^\s]+/g,
        '[url_redacted]'
      );
    }

    // Sanitize metadata
    if (sanitized.metadata) {
      const sanitizedMetadata: Record<string, any> = {};
      for (const [key, value] of Object.entries(sanitized.metadata)) {
        // Skip any keys that might contain PII
        if (['email', 'name', 'phone', 'address', 'password', 'token'].some(pii => key.toLowerCase().includes(pii))) {
          continue;
        }
        
        // Sanitize string values
        if (typeof value === 'string') {
          sanitizedMetadata[key] = value.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            '[email_redacted]'
          );
        } else {
          sanitizedMetadata[key] = value;
        }
      }
      sanitized.metadata = sanitizedMetadata;
    }

    return sanitized;
  }

  /**
   * Track analysis started
   */
  static async trackAnalysisStarted(
    analysisType: 'emotion' | 'skin' | 'food',
    source?: string
  ): Promise<void> {
    await this.trackEvent('analysis_started', {
      analysis_type: analysisType,
      source,
    });
  }

  /**
   * Track analysis completed
   */
  static async trackAnalysisCompleted(
    analysisType: 'emotion' | 'skin' | 'food',
    durationMs?: number,
    source?: string
  ): Promise<void> {
    await this.trackEvent('analysis_completed', {
      analysis_type: analysisType,
      duration_ms: durationMs,
      source,
    });
  }

  /**
   * Track analysis error
   */
  static async trackAnalysisError(
    analysisType: 'emotion' | 'skin' | 'food',
    errorType: string,
    errorMessage?: string
  ): Promise<void> {
    await this.trackEvent('analysis_error', {
      analysis_type: analysisType,
      error_type: errorType,
      error_message: errorMessage,
    });
  }

  /**
   * Track feature usage
   */
  static async trackFeatureUsage(
    feature: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.trackEvent('screen_viewed', {
      feature,
      metadata,
    });
  }

  /**
   * Track error
   */
  static async trackError(
    errorType: 'api_error' | 'database_error' | 'network_error',
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.trackEvent(errorType, {
      error_type: errorType,
      error_message: errorMessage,
      metadata,
    });
  }

  /**
   * Track performance issue
   */
  static async trackPerformanceIssue(
    operation: string,
    durationMs: number,
    thresholdMs: number = 3000
  ): Promise<void> {
    if (durationMs > thresholdMs) {
      await this.trackEvent('slow_operation', {
        feature: operation,
        duration_ms: durationMs,
        metadata: { threshold_ms: thresholdMs },
      });
    }
  }

  /**
   * Update user ID hash when user logs in/out
   */
  static async updateUserContext(): Promise<void> {
    try {
      const user = await AuthService.getCurrentUser();
      if (user?.id) {
        this.currentUserIdHash = await hashUserId(user.id);
      } else {
        this.currentUserIdHash = null;
      }
    } catch (error) {
      console.warn('[Analytics] Failed to update user context:', error);
    }
  }
}


