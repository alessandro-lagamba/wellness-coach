/**
 * Cache Service
 * Gestisce cache locale con AsyncStorage e TTL (Time To Live)
 * Migliora UX offline-first e riduce chiamate al database
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private static readonly CACHE_PREFIX = '@wellness_cache:';
  
  /**
   * Ottiene un valore dalla cache se ancora valido, altrimenti null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${CacheService.CACHE_PREFIX}${key}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();
      
      // 🆕 Check se la cache è scaduta
      if (now - entry.timestamp > entry.ttl) {
        // Cache scaduta, rimuovila
        await AsyncStorage.removeItem(cacheKey);
        console.log(`[Cache] ⏰ Cache expired for key: ${key}`);
        return null;
      }

      console.log(`[Cache] ✅ Cache hit for key: ${key} (age: ${Math.round((now - entry.timestamp) / 1000)}s)`);
      return entry.data;
    } catch (error) {
      console.error(`[Cache] ❌ Error reading cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Salva un valore nella cache con TTL
   * @param key - Chiave univoca
   * @param data - Dati da cache-are
   * @param ttlMs - Time to live in milliseconds (default: 5 minuti)
   */
  async set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): Promise<void> {
    try {
      const cacheKey = `${CacheService.CACHE_PREFIX}${key}`;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      console.log(`[Cache] 💾 Cached key: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
    } catch (error) {
      console.error(`[Cache] ❌ Error saving cache for key ${key}:`, error);
    }
  }

  /**
   * Rimuove una chiave dalla cache
   */
  async invalidate(key: string): Promise<void> {
    try {
      const cacheKey = `${CacheService.CACHE_PREFIX}${key}`;
      await AsyncStorage.removeItem(cacheKey);
      console.log(`[Cache] 🗑️ Invalidated cache key: ${key}`);
    } catch (error) {
      console.error(`[Cache] ❌ Error invalidating cache for key ${key}:`, error);
    }
  }

  /**
   * Rimuove tutte le chiavi che iniziano con un prefisso
   * Utile per invalidare cache di una feature specifica
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(`${CacheService.CACHE_PREFIX}${prefix}`));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`[Cache] 🗑️ Invalidated ${cacheKeys.length} cache keys with prefix: ${prefix}`);
      }
    } catch (error) {
      console.error(`[Cache] ❌ Error invalidating cache prefix ${prefix}:`, error);
    }
  }

  /**
   * Pulisce tutta la cache (usare con cautela)
   */
  async clear(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CacheService.CACHE_PREFIX));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`[Cache] 🧹 Cleared ${cacheKeys.length} cache entries`);
      }
    } catch (error) {
      console.error('[Cache] ❌ Error clearing cache:', error);
    }
  }

  /**
   * Helper per cache con fallback: prova cache, se non c'è o scaduta, chiama fetcher
   * @param key - Chiave cache
   * @param fetcher - Funzione async che ritorna i dati da cache-are
   * @param ttlMs - TTL in millisecondi
   * @param forceRefresh - Se true, ignora cache e forza refresh
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 5 * 60 * 1000,
    forceRefresh: boolean = false
  ): Promise<T> {
    // 🆕 Se forceRefresh, skip cache
    if (forceRefresh) {
      const data = await fetcher();
      await this.set(key, data, ttlMs);
      return data;
    }

    // 🆕 Prova cache prima
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 🆕 Cache miss o scaduta, fetch e cache
    console.log(`[Cache] 💾 Cache miss for key: ${key}, fetching...`);
    const data = await fetcher();
    await this.set(key, data, ttlMs);
    return data;
  }
}

// Export singleton instance
export default new CacheService();









