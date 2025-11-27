/**
 * Sentry Service - Crash Reporting and Error Tracking
 * 
 * Integrates Sentry for production error tracking.
 * 
 * Setup Instructions:
 * 1. Create account at https://sentry.io
 * 2. Create a React Native project
 * 3. Get your DSN from project settings
 * 4. Add DSN to .env: EXPO_PUBLIC_SENTRY_DSN=your_dsn_here
 * 5. Run: pnpm add @sentry/react-native
 * 6. Run: pnpm add -D @sentry/wizard
 * 7. Run: npx @sentry/wizard -i reactNative -p ios android
 * 
 * Note: This service is optional and can be disabled by not setting SENTRY_DSN
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Get Sentry DSN from environment
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const ENABLE_SENTRY = !__DEV__ && SENTRY_DSN; // Only enable in production

/**
 * Initialize Sentry
 */
export function initializeSentry(): void {
  if (!ENABLE_SENTRY || !SENTRY_DSN) {
    if (__DEV__) {
      console.log('[Sentry] ⚠️ Sentry disabled (development mode or DSN not set)');
    }
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      debug: false, // Set to true in development to see Sentry logs
      environment: __DEV__ ? 'development' : 'production',
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000, // 30 seconds
      
      // Privacy: Anonymize user data
      beforeSend(event, hint) {
        // Remove any potential PII
        if (event.user) {
          // Don't send real user ID, use hash instead
          if (event.user.id) {
            // Hash user ID (you can implement proper hashing here)
            event.user.id = `user_${event.user.id.substring(0, 8)}`;
          }
          // Remove email and other PII
          delete event.user.email;
          delete event.user.username;
        }

        // Remove sensitive data from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            if (breadcrumb.data) {
              // Remove potential PII from breadcrumb data
              const sanitized = { ...breadcrumb.data };
              delete sanitized.email;
              delete sanitized.password;
              delete sanitized.token;
              delete sanitized.apiKey;
              return { ...breadcrumb, data: sanitized };
            }
            return breadcrumb;
          });
        }

        // Remove sensitive data from extra context
        if (event.extra) {
          const sanitized = { ...event.extra };
          delete sanitized.email;
          delete sanitized.password;
          delete sanitized.token;
          delete sanitized.apiKey;
          event.extra = sanitized;
        }

        return event;
      },

      // Integrations
      integrations: [
        new Sentry.ReactNativeTracing({
          // Performance monitoring
          enableNativeFramesTracking: true,
          enableStallTracking: true,
        }),
      ],

      // Traces sample rate (0.0 to 1.0)
      tracesSampleRate: 0.1, // 10% of transactions

      // Release tracking
      release: Constants.expoConfig?.version || '0.0.0',
      dist: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || undefined,
    });

    console.log('[Sentry] ✅ Initialized');
  } catch (error) {
    console.warn('[Sentry] ⚠️ Failed to initialize:', error);
  }
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (!ENABLE_SENTRY) {
    if (__DEV__) {
      console.error('[Sentry] Exception (not sent):', error, context);
    }
    return;
  }

  try {
    Sentry.captureException(error, {
      extra: context,
      tags: {
        source: 'manual',
      },
    });
  } catch (err) {
    console.warn('[Sentry] Failed to capture exception:', err);
  }
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!ENABLE_SENTRY) {
    if (__DEV__) {
      console.log(`[Sentry] Message (not sent): [${level}] ${message}`);
    }
    return;
  }

  try {
    Sentry.captureMessage(message, level);
  } catch (error) {
    console.warn('[Sentry] Failed to capture message:', error);
  }
}

/**
 * Set user context (anonymized)
 */
export function setUserContext(userIdHash: string, metadata?: Record<string, any>): void {
  if (!ENABLE_SENTRY) return;

  try {
    Sentry.setUser({
      id: userIdHash, // Use hash, not real user ID
      // Don't set email, username, or other PII
      ...metadata,
    });
  } catch (error) {
    console.warn('[Sentry] Failed to set user context:', error);
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  if (!ENABLE_SENTRY) return;

  try {
    Sentry.setUser(null);
  } catch (error) {
    console.warn('[Sentry] Failed to clear user context:', error);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category?: string, level?: Sentry.SeverityLevel, data?: Record<string, any>): void {
  if (!ENABLE_SENTRY) return;

  try {
    Sentry.addBreadcrumb({
      message,
      category: category || 'default',
      level: level || 'info',
      data: data || {},
    });
  } catch (error) {
    console.warn('[Sentry] Failed to add breadcrumb:', error);
  }
}

/**
 * Start transaction (performance monitoring)
 */
export function startTransaction(name: string, op: string): Sentry.Transaction | null {
  if (!ENABLE_SENTRY) return null;

  try {
    return Sentry.startTransaction({
      name,
      op,
    });
  } catch (error) {
    console.warn('[Sentry] Failed to start transaction:', error);
    return null;
  }
}


