/**
 * Intelligent Response Cache Service
 * Caches common responses for instant replies
 */

interface CachedResponse {
  text: string;
  audio?: string;
  timestamp: number;
  usageCount: number;
}

export class ResponseCacheService {
  private cache = new Map<string, CachedResponse>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Get cached response for common greetings and questions
   */
  getCachedResponse(message: string): CachedResponse | null {
    const normalizedMessage = this.normalizeMessage(message);
    
    // Check for exact matches first
    if (this.cache.has(normalizedMessage)) {
      const cached = this.cache.get(normalizedMessage)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        cached.usageCount++;
        return cached;
      } else {
        this.cache.delete(normalizedMessage);
      }
    }

    // Check for similar patterns
    for (const [key, value] of this.cache.entries()) {
      if (this.isSimilarMessage(normalizedMessage, key) && 
          Date.now() - value.timestamp < this.CACHE_TTL) {
        value.usageCount++;
        return value;
      }
    }

    return null;
  }

  /**
   * Cache a response for future use
   */
  cacheResponse(message: string, text: string, audio?: string): void {
    const normalizedMessage = this.normalizeMessage(message);
    
    // Clean up old entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanupCache();
    }

    this.cache.set(normalizedMessage, {
      text,
      audio,
      timestamp: Date.now(),
      usageCount: 1
    });

    console.log('[ResponseCache] 💾 Cached response for:', normalizedMessage.substring(0, 30));
  }

  /**
   * Normalize message for consistent caching
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Check if two messages are similar enough to share a response
   */
  private isSimilarMessage(msg1: string, msg2: string): boolean {
    const words1 = msg1.split(' ');
    const words2 = msg2.split(' ');
    
    // If one is subset of another, consider similar
    const intersection = words1.filter(word => words2.includes(word));
    const similarity = intersection.length / Math.max(words1.length, words2.length);
    
    return similarity > 0.7; // 70% similarity threshold
  }

  /**
   * Clean up old and unused cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Sort by usage count and age
    entries.sort((a, b) => {
      const ageA = now - a[1].timestamp;
      const ageB = now - b[1].timestamp;
      return (b[1].usageCount - a[1].usageCount) || (ageA - ageB);
    });

    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const activeEntries = Array.from(this.cache.values())
      .filter(entry => now - entry.timestamp < this.CACHE_TTL);
    
    return {
      totalEntries: this.cache.size,
      activeEntries: activeEntries.length,
      totalUsage: activeEntries.reduce((sum, entry) => sum + entry.usageCount, 0)
    };
  }
}

