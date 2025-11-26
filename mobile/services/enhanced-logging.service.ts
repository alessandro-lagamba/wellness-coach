/**
 * Enhanced Logging Service
 * Fornisce logging strutturato e dettagliato per il beta testing
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  error?: Error;
  userId?: string;
  operation?: string;
}

export class EnhancedLoggingService {
  private static logs: LogEntry[] = [];
  private static maxLogs = 1000; // Mantieni solo gli ultimi 1000 log
  private static isEnabled = __DEV__ || true; // Sempre abilitato per beta testing

  /**
   * Log un'operazione di database
   */
  static logDatabaseOperation(
    operation: 'save' | 'read' | 'update' | 'delete' | 'verify',
    entity: string,
    success: boolean,
    error?: Error,
    data?: any
  ): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level: success ? 'info' : 'error',
      category: 'database',
      message: `${operation.toUpperCase()} ${entity}: ${success ? 'SUCCESS' : 'FAILED'}`,
      data: {
        operation,
        entity,
        success,
        ...(data && { data }),
      },
      error,
      operation: `${operation}_${entity}`,
    };

    this.addLog(entry);
    this.consoleLog(entry);
  }

  /**
   * Log un'operazione di salvataggio
   */
  static logSaveOperation(
    entity: string,
    userId: string,
    success: boolean,
    error?: Error,
    savedId?: string
  ): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level: success ? 'info' : 'error',
      category: 'save',
      message: `SAVE ${entity}: ${success ? 'SUCCESS' : 'FAILED'}`,
      data: {
        entity,
        userId,
        success,
        savedId,
      },
      error,
      operation: `save_${entity}`,
      userId,
    };

    this.addLog(entry);
    this.consoleLog(entry);
  }

  /**
   * Log una verifica post-salvataggio
   */
  static logVerification(
    entity: string,
    userId: string,
    verified: boolean,
    error?: Error
  ): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level: verified ? 'info' : 'warn',
      category: 'verification',
      message: `VERIFY ${entity}: ${verified ? 'VERIFIED' : 'NOT FOUND'}`,
      data: {
        entity,
        userId,
        verified,
      },
      error,
      operation: `verify_${entity}`,
      userId,
    };

    this.addLog(entry);
    this.consoleLog(entry);
  }

  /**
   * Log un retry
   */
  static logRetry(
    operation: string,
    attempt: number,
    maxAttempts: number,
    success: boolean,
    error?: Error
  ): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level: success ? 'info' : attempt >= maxAttempts ? 'error' : 'warn',
      category: 'retry',
      message: `RETRY ${operation}: Attempt ${attempt}/${maxAttempts} - ${success ? 'SUCCESS' : 'FAILED'}`,
      data: {
        operation,
        attempt,
        maxAttempts,
        success,
      },
      error,
      operation: `retry_${operation}`,
    };

    this.addLog(entry);
    this.consoleLog(entry);
  }

  /**
   * Log una race condition
   */
  static logRaceCondition(
    operation: string,
    entity: string,
    action: 'locked' | 'skipped' | 'completed'
  ): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level: action === 'skipped' ? 'warn' : 'info',
      category: 'race_condition',
      message: `RACE CONDITION ${operation} (${entity}): ${action.toUpperCase()}`,
      data: {
        operation,
        entity,
        action,
      },
      operation: `race_${operation}`,
    };

    this.addLog(entry);
    this.consoleLog(entry);
  }

  /**
   * Log una validazione
   */
  static logValidation(
    entity: string,
    valid: boolean,
    errors?: string[]
  ): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level: valid ? 'info' : 'warn',
      category: 'validation',
      message: `VALIDATE ${entity}: ${valid ? 'VALID' : 'INVALID'}`,
      data: {
        entity,
        valid,
        errors,
      },
      operation: `validate_${entity}`,
    };

    this.addLog(entry);
    this.consoleLog(entry);
  }

  /**
   * Ottiene tutti i log
   */
  static getLogs(level?: LogLevel, category?: string): LogEntry[] {
    let filtered = this.logs;

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (category) {
      filtered = filtered.filter(log => log.category === category);
    }

    return filtered;
  }

  /**
   * Ottiene gli ultimi N log
   */
  static getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Pulisce i log
   */
  static clearLogs(): void {
    this.logs = [];
  }

  /**
   * Esporta i log come JSON
   */
  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Aggiunge un log alla lista
   */
  private static addLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Mantieni solo gli ultimi maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Log sulla console con formato strutturato
   */
  private static consoleLog(entry: LogEntry): void {
    const emoji = this.getEmoji(entry.level);
    const prefix = `${emoji} [${entry.category.toUpperCase()}]`;

    const logMessage = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'error':
      case 'critical':
        console.error(logMessage, entry.data || '', entry.error || '');
        // Send to Sentry for crash reporting
        this.sendToSentry(entry);
        // Send to Analytics for error tracking
        this.sendToAnalytics(entry);
        break;
      case 'warn':
        console.warn(logMessage, entry.data || '');
        break;
      case 'info':
        console.log(logMessage, entry.data || '');
        break;
      case 'debug':
        if (__DEV__) {
          console.log(logMessage, entry.data || '');
        }
        break;
    }
  }

  /**
   * Send error to Sentry
   */
  private static sendToSentry(entry: LogEntry): void {
    try {
      // Dynamic import to avoid errors if Sentry is not installed
      const { captureException, captureMessage } = require('./sentry.service');
      
      if (entry.error) {
        captureException(entry.error, {
          category: entry.category,
          operation: entry.operation,
          data: entry.data,
        });
      } else {
        captureMessage(entry.message, 'error');
      }
    } catch (error) {
      // Sentry not available or not configured, ignore
    }
  }

  /**
   * Send error to Analytics
   */
  private static sendToAnalytics(entry: LogEntry): void {
    try {
      // Dynamic import to avoid errors if Analytics is not initialized
      const { AnalyticsService } = require('./analytics.service');
      
      // Determine error type from category
      let errorType: 'api_error' | 'database_error' | 'network_error' = 'api_error';
      if (entry.category === 'database') {
        errorType = 'database_error';
      } else if (entry.category === 'network' || entry.message.includes('network') || entry.message.includes('fetch')) {
        errorType = 'network_error';
      }

      AnalyticsService.trackError(
        errorType,
        entry.error?.message || entry.message,
        {
          category: entry.category,
          operation: entry.operation,
        }
      );
    } catch (error) {
      // Analytics not available, ignore
    }
  }

  /**
   * Ottiene l'emoji per il livello di log
   */
  private static getEmoji(level: LogLevel): string {
    switch (level) {
      case 'success':
      case 'info':
        return '✅';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      case 'critical':
        return '🔴';
      case 'debug':
        return '🔍';
      default:
        return 'ℹ️';
    }
  }
}

