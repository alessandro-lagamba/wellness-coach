import { EnhancedLoggingService } from './enhanced-logging.service';

interface LockInfo {
  operation: string;
  entity: string;
  timestamp: Date;
  timeout: number;
}

/**
 * Service per gestire lock delle operazioni e prevenire race conditions
 */
export class OperationLockService {
  private static locks: Map<string, LockInfo> = new Map();
  private static defaultTimeout = 30000; // 30 secondi

  /**
   * Acquisisce un lock per un'operazione
   */
  static acquireLock(
    operation: string,
    entity: string,
    timeout: number = this.defaultTimeout
  ): boolean {
    const lockKey = `${operation}_${entity}`;
    const existingLock = this.locks.get(lockKey);

    // Verifica se c'è un lock esistente e se è ancora valido
    if (existingLock) {
      const age = Date.now() - existingLock.timestamp.getTime();
      if (age < existingLock.timeout) {
        // Lock ancora valido
        EnhancedLoggingService.logRaceCondition(operation, entity, 'skipped');
        return false;
      } else {
        // Lock scaduto, rimuovilo
        this.locks.delete(lockKey);
      }
    }

    // Crea nuovo lock
    const lockInfo: LockInfo = {
      operation,
      entity,
      timestamp: new Date(),
      timeout,
    };

    this.locks.set(lockKey, lockInfo);
    EnhancedLoggingService.logRaceCondition(operation, entity, 'locked');

    return true;
  }

  /**
   * Rilascia un lock
   */
  static releaseLock(operation: string, entity: string): void {
    const lockKey = `${operation}_${entity}`;
    const existingLock = this.locks.get(lockKey);

    if (existingLock) {
      this.locks.delete(lockKey);
      EnhancedLoggingService.logRaceCondition(operation, entity, 'completed');
    }
  }

  /**
   * Verifica se un lock esiste ed è valido
   */
  static isLocked(operation: string, entity: string): boolean {
    const lockKey = `${operation}_${entity}`;
    const existingLock = this.locks.get(lockKey);

    if (!existingLock) {
      return false;
    }

    const age = Date.now() - existingLock.timestamp.getTime();
    if (age >= existingLock.timeout) {
      // Lock scaduto, rimuovilo
      this.locks.delete(lockKey);
      return false;
    }

    return true;
  }

  /**
   * Esegue un'operazione con lock automatico
   */
  static async withLock<T>(
    operation: string,
    entity: string,
    fn: () => Promise<T>,
    timeout: number = this.defaultTimeout
  ): Promise<T> {
    // Prova ad acquisire il lock
    if (!this.acquireLock(operation, entity, timeout)) {
      throw new Error(`Operation ${operation} on ${entity} is already in progress`);
    }

    try {
      const result = await fn();
      return result;
    } finally {
      // Rilascia sempre il lock
      this.releaseLock(operation, entity);
    }
  }

  /**
   * Pulisce tutti i lock scaduti
   */
  static cleanupExpiredLocks(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.locks.forEach((lock, key) => {
      const age = now - lock.timestamp.getTime();
      if (age >= lock.timeout) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.locks.delete(key));
  }

  /**
   * Pulisce tutti i lock
   */
  static clearAllLocks(): void {
    this.locks.clear();
  }
}

