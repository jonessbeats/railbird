// lib/api/gigaverse.ts
import type {
  ApiRaceSummary, ApiRaceDetail, ApiPetStats, ApiLeaderboardEntry, ApiLobbySyncResponse,
  ApiGlobalStats,
} from '@/types/racing'
import { apiCache, TTL } from './cache'

const BASE = 'https://gigaverse.io/api/racing'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    cache: 'no-store',
  } as RequestInit)
  if (!res.ok) throw new Error(`Gigaverse API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchRaces(limit = 50): Promise<ApiRaceSummary[]> {
  return apiCache.getOrFetch(`races:${limit}`, TTL.RACE_LIST, async () => {
    const data = await apiFetch<{ success: boolean; latestRaceId: number; races: ApiRaceSummary[] }>(
      `/races?limit=${limit}`,
    )
    return data.races ?? []
  })
}

export async function fetchRace(raceId: number | string): Promise<ApiRaceDetail> {
  return apiCache.getOrFetch(`race:${raceId}`, TTL.RACE_DETAIL, async () => {
    const data = await apiFetch<{ success: boolean } & ApiRaceDetail>(`/race/${raceId}`)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { success, ...race } = data
    return race as ApiRaceDetail
  })
}

export async function fetchLobbySync(cursor?: string): Promise<ApiLobbySyncResponse> {
  return apiFetch<ApiLobbySyncResponse>('/lobby/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cursor ? { cursor } : {}),
  })
}

export async function fetchPetStats(petId: number): Promise<ApiPetStats> {
  return apiCache.getOrFetch(`petstats:${petId}`, TTL.PET_STATS, async () => {
    const data = await apiFetch<{ success: boolean; stats: ApiPetStats }>(`/pets/${petId}/stats`)
    return data.stats
  })
}

export async function fetchPetsStatsBatch(petIds: number[]): Promise<ApiPetStats[]> {
  if (petIds.length === 0) return []
  const key = `petstats:batch:${[...petIds].sort().join(',')}`
  return apiCache.getOrFetch(key, TTL.PET_STATS, async () => {
    const data = await apiFetch<{ success: boolean; stats: ApiPetStats[] }>(
      `/pets/stats?ids=${petIds.join(',')}`
    )
    return data.stats ?? []
  })
}

async function fetchLeaderboardPage(params: {
  limit: number; offset: number
}): Promise<{ entries: ApiLeaderboardEntry[]; hasMore: boolean }> {
  const key = `lb:${params.limit}:${params.offset}`
  return apiCache.getOrFetch(key, TTL.LEADERBOARD, async () => {
    const q = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) })
    const data = await apiFetch<{
      success: boolean; entries: ApiLeaderboardEntry[]; hasMore: boolean
    }>(`/leaderboard/elo?${q}`)
    return { entries: data.entries ?? [], hasMore: data.hasMore ?? false }
  })
}

export async function fetchLeaderboard(params?: {
  limit?: number; offset?: number; factions?: string; rarities?: string; genders?: string
}): Promise<{ entries: ApiLeaderboardEntry[]; hasMore: boolean }> {
  const q = new URLSearchParams()
  if (params?.limit   !== undefined) q.set('limit',    String(params.limit))
  if (params?.offset  !== undefined) q.set('offset',   String(params.offset))
  if (params?.factions)  q.set('factions',  params.factions)
  if (params?.rarities)  q.set('rarities',  params.rarities)
  if (params?.genders)   q.set('genders',   params.genders)
  const data = await apiFetch<{
    success: boolean; entries: ApiLeaderboardEntry[]; hasMore: boolean
  }>(`/leaderboard/elo?${q}`)
  return { entries: data.entries ?? [], hasMore: data.hasMore ?? false }
}

// Fetches top N*100 entries — each page is individually cached for 45s.
export async function fetchLeaderboardParallel(pages = 10): Promise<ApiLeaderboardEntry[]> {
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      fetchLeaderboardPage({ limit: 100, offset: i * 100 }).catch(
        () => ({ entries: [] as ApiLeaderboardEntry[], hasMore: false }),
      ),
    ),
  )
  return results.flatMap(r => r.entries)
}

// Fetches until all targetPetIds found — pages are cached individually.
// maxPages caps the scan depth so a missing/very-low-ranked pet can't trigger a
// full-leaderboard crawl (default 50 pages = top 5000, covers virtually all active pets).
export async function fetchLeaderboardForPets(
  targetPetIds: number[],
  pageSize = 100,
  batchSize = 14,
  maxPages = 50,
): Promise<ApiLeaderboardEntry[]> {
  const allEntries: ApiLeaderboardEntry[] = []
  const found = new Set<number>()
  let batchStart = 0

  while (batchStart < maxPages) {
    const pages = Array.from({ length: batchSize }, (_, i) => batchStart + i)
      .filter(p => p < maxPages)
    const results = await Promise.all(
      pages.map(p =>
        fetchLeaderboardPage({ limit: pageSize, offset: p * pageSize }).catch(
          () => ({ entries: [] as ApiLeaderboardEntry[], hasMore: false }),
        ),
      ),
    )
    let exhausted = false
    for (const r of results) {
      for (const e of r.entries) { allEntries.push(e); found.add(e.petId) }
      if (!r.hasMore || r.entries.length === 0) { exhausted = true; break }
    }
    if (exhausted || targetPetIds.every(id => found.has(id))) break
    batchStart += batchSize
  }

  return allEntries
}

// Cached single-pet leaderboard lookup. Pets outside the top-1000 require a deep
// scan; this caches the result (SWR) so the scan runs at most once per TTL window
// in the background instead of blocking every request.
export async function fetchPetLeaderboardEntry(petId: number): Promise<ApiLeaderboardEntry | null> {
  return apiCache.getOrFetch(`lb:pet:${petId}`, TTL.PET_LB, async () => {
    const entries = await fetchLeaderboardForPets([petId])
    return entries.find(e => e.petId === petId) ?? null
  })
}

export async function fetchScheduled(): Promise<ApiRaceSummary[]> {
  const data = await apiFetch<{ success: boolean; races: ApiRaceSummary[] }>('/scheduled')
  return data.races ?? []
}

export async function fetchGlobalStats(): Promise<ApiGlobalStats> {
  const data = await apiFetch<{ success: boolean; data: ApiGlobalStats }>('/stats')
  return data.data
}

// ── Cache warming ──────────────────────────────────────────────
// Prefetch the top-1000 leaderboard + open race list on server startup so the
// first user navigation hits a warm cache instead of blocking ~4s on 10 pages.
// Then keep the leaderboard warm on an interval (the SWR cache also refreshes
// lazily, but this guarantees freshness even with zero traffic).
if (typeof window === 'undefined' && !(globalThis as { __railbirdWarmed?: boolean }).__railbirdWarmed) {
  ;(globalThis as { __railbirdWarmed?: boolean }).__railbirdWarmed = true
  const warm = () => {
    fetchLeaderboardParallel(10).catch(() => {})
    fetchRaces(50).catch(() => {})
  }
  warm()
  setInterval(warm, 40_000).unref?.()
}
