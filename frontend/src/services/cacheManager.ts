interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const CACHE_PREFIX = 'cineslot_cache_';

export const CacheKeys = {
  MOVIES: 'movies',
  SLOTS: 'slots',
  AB_ASSIGNMENT: 'ab_assignment',
  MOVIE_DETAIL_PREFIX: 'movie_detail_',
} as const;

export const cacheManager = {
  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttlMs,
      };
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch (err) {
      console.warn(`[CacheManager] Erreur écriture cache pour "${key}":`, err);
    }
  },

  get<T>(key: string): { data: T; isStale: boolean } | null {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      const isStale = Date.now() - entry.timestamp > entry.ttlMs;

      return {
        data: entry.data,
        isStale,
      };
    } catch (err) {
      console.warn(`[CacheManager] Erreur lecture cache pour "${key}":`, err);
      return null;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (err) {
      console.warn(`[CacheManager] Erreur suppression clé "${key}":`, err);
    }
  },

  clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (err) {
      console.warn('[CacheManager] Erreur purge cache:', err);
    }
  },
};
