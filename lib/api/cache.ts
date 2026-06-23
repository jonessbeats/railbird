// In-memory stale-while-revalidate cache — survives across requests within the same Node process.
// Works regardless of Next.js force-dynamic (which disables fetch cache but not module-level state).
//
// Strategy:
//   • First ever request for a key blocks until the fetch resolves (unavoidable cold start).
//   • Once a value exists it is ALWAYS returned instantly.
//   • When the value is older than its soft TTL, a background refresh is kicked off
//     (not awaited) so the next request gets fresh data — but the current request never blocks.
//   • A hard max-age guards against serving truly ancient data if the upstream is down for long.

interface CacheEntry<T> {
  value: T
  freshUntil: number      // soft TTL — past this, refresh in background
  hardUntil: number       // hard TTL — past this, block and refetch
  refreshing: boolean
}

const HARD_MULTIPLIER = 20   // hard max-age = soft TTL × 20

class SwrCache {
  private store = new Map<string, CacheEntry<unknown>>()
  // De-dupe concurrent fetches for the same key so N simultaneous cold callers
  // (e.g. page load + two pollers) share ONE upstream request instead of N.
  private inflight = new Map<string, Promise<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.hardUntil) { this.store.delete(key); return null }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const now = Date.now()
    this.store.set(key, {
      value,
      freshUntil: now + ttlMs,
      hardUntil:  now + ttlMs * HARD_MULTIPLIER,
      refreshing: false,
    })
  }

  private dedupedFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined
    if (existing) return existing
    const p = fn()
      .then(value => { this.set(key, value, ttlMs); return value })
      .finally(() => { this.inflight.delete(key) })
    this.inflight.set(key, p)
    return p
  }

  async getOrFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const entry = this.store.get(key) as CacheEntry<T> | undefined

    // Have a value within hard limit → serve instantly
    if (entry && now <= entry.hardUntil) {
      // Past soft TTL → kick off background refresh (fire-and-forget, deduped)
      if (now > entry.freshUntil && !entry.refreshing) {
        entry.refreshing = true
        this.dedupedFetch(key, ttlMs, fn).catch(() => { entry.refreshing = false })
      }
      return entry.value
    }

    // No usable value → block on a shared (deduped) fetch
    return this.dedupedFetch(key, ttlMs, fn)
  }
}

// Singleton — one cache per Node process (shared across all requests)
export const apiCache = new SwrCache()

export const TTL = {
  LEADERBOARD:  45_000,    // leaderboard changes slowly
  PET_STATS:    60_000,    // stats even slower
  PET_LB:       300_000,   // single-pet ELO/rank — barely moves; expensive deep scan
  RACE_DETAIL:  8_000,     // needs to be fresh for live polling
  RACE_LIST:    12_000,    // open races list
}
