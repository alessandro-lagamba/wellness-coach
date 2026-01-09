/**
 * Logger Utility
 * 
 * Provides controlled logging that can be disabled in production
 * or when performance optimization is needed.
 * 
 * Usage:
 *   import { logger } from './logger';
 *   logger.log('message');  // Only logs in dev mode
 *   logger.debug('debug');  // Only logs when DEBUG_ENABLED is true
 *   logger.error('error');  // Always logs errors
 */

// Set to false to disable all non-error logging (for performance testing)
const LOGGING_ENABLED = __DEV__;
const DEBUG_ENABLED = false; // Set to true for verbose debugging

export const logger = {
    log: (...args: any[]) => {
        if (LOGGING_ENABLED) {
            console.log(...args);
        }
    },

    debug: (...args: any[]) => {
        if (LOGGING_ENABLED && DEBUG_ENABLED) {
            console.log('[DEBUG]', ...args);
        }
    },

    info: (...args: any[]) => {
        if (LOGGING_ENABLED) {
            console.info(...args);
        }
    },

    warn: (...args: any[]) => {
        if (LOGGING_ENABLED) {
            console.warn(...args);
        }
    },

    error: (...args: any[]) => {
        // Always log errors
        console.error(...args);
    },

    // Performance-sensitive areas - disabled by default
    perf: (...args: any[]) => {
        if (DEBUG_ENABLED) {
            console.log('[PERF]', ...args);
        }
    },

    // Disable all logging temporarily (for performance testing)
    disable: () => {
        // @ts-ignore
        global.__LOGGING_DISABLED__ = true;
    },

    // Re-enable logging
    enable: () => {
        // @ts-ignore
        global.__LOGGING_DISABLED__ = false;
    },
};

export default logger;
