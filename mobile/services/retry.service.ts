import { EnhancedLoggingService } from './enhanced-logging.service';

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Service per gestire retry logic con backoff
 */
export class RetryService {
  /**
   * Esegue un'operazione con retry automatico
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delay = 1000,
      backoff = 'exponential',
      onRetry,
      shouldRetry = () => true,
    } = options;

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        const result = await operation();
        
        if (attempt > 1) {
          EnhancedLoggingService.logRetry(operationName, attempt, maxAttempts, true);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Verifica se dovremmo ritentare
        if (!shouldRetry(lastError)) {
          EnhancedLoggingService.logRetry(operationName, attempt, maxAttempts, false, lastError);
          throw lastError;
        }

        // Se è l'ultimo tentativo, lancia l'errore
        if (attempt >= maxAttempts) {
          EnhancedLoggingService.logRetry(operationName, attempt, maxAttempts, false, lastError);
          throw lastError;
        }

        // Calcola il delay per il prossimo tentativo
        const currentDelay = this.calculateDelay(attempt, delay, backoff);

        EnhancedLoggingService.logRetry(operationName, attempt, maxAttempts, false, lastError);

        // Callback onRetry
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // Attendi prima del prossimo tentativo
        await this.sleep(currentDelay);
      }
    }

    // Non dovrebbe mai arrivare qui, ma per sicurezza
    throw lastError || new Error('Retry failed');
  }

  /**
   * Calcola il delay per il prossimo tentativo
   */
  private static calculateDelay(
    attempt: number,
    baseDelay: number,
    backoff: 'linear' | 'exponential'
  ): number {
    if (backoff === 'exponential') {
      return baseDelay * Math.pow(2, attempt - 1);
    } else {
      return baseDelay * attempt;
    }
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verifica se un errore è retryable
   */
  static isRetryableError(error: Error): boolean {
    // Errori di rete sono generalmente retryable
    if (error.message.includes('network') || error.message.includes('timeout')) {
      return true;
    }

    // Errori di database temporanei
    if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
      return true;
    }

    // Errori 5xx del server
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return true;
    }

    // Errori di rate limiting
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return true;
    }

    return false;
  }
}

