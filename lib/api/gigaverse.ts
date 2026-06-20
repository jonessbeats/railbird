// lib/api/gigaverse.ts
import type {
  ApiRaceSummary, ApiRaceDetail, ApiPetStats, ApiLeaderboardEntry, ApiLobbySyncResponse,
  ApiGlobalStats,
} from '@/types/racing'

const BASE = 'https://gigaverse.io/api/racing'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    next: { revalidate: 60 },
  } as RequestInit & { next?: { revalidate?: number } })
  if (!res.ok) throw new Error(`Gigaverse API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchRaces(limit = 50): Promise<ApiRaceSummary[]> {
  const data = await apiFetch<{ success: boolean; latestRaceId: number; races: ApiRaceSummary[] }>(
    `/races?limit=${limit}`
  )
  return data.races ?? []
}

export async function fetchRace(raceId: number | string): Promise<ApiRaceDetail> {
  const data = await apiFetch<{ success: boolean } & ApiRaceDetail>(`/race/${raceId}`)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { success, ...race } = data
  return race as ApiRaceDetail
}

export async function fetchLobbySync(cursor?: string): Promise<ApiLobbySyncResponse> {
  return apiFetch<ApiLobbySyncResponse>('/lobby/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cursor ? { cursor } : {}),
    next: { revalidate: 30 },
  } as RequestInit & { next?: { revalidate?: number } })
}

export async function fetchPetStats(petId: number): Promise<ApiPetStats> {
  const data = await apiFetch<{ success: boolean; stats: ApiPetStats }>(`/pets/${petId}/stats`)
  return data.stats
}

export async function fetchPetsStatsBatch(petIds: number[]): Promise<ApiPetStats[]> {
  if (petIds.length === 0) return []
  const data = await apiFetch<{ success: boolean; stats: ApiPetStats[] }>(
    `/pets/stats?ids=${petIds.join(',')}`
  )
  return data.stats ?? []
}

export async function fetchLeaderboard(params?: {
  limit?: number
  offset?: number
  factions?: string
  rarities?: string
  genders?: string
}): Promise<{ entries: ApiLeaderboardEntry[]; hasMore: boolean }> {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  if (params?.factions) q.set('factions', params.factions)
  if (params?.rarities) q.set('rarities', params.rarities)
  if (params?.genders) q.set('genders', params.genders)
  const data = await apiFetch<{
    success: boolean
    message: string
    entries: ApiLeaderboardEntry[]
    hasMore: boolean
  }>(`/leaderboard/elo?${q}`)
  return { entries: data.entries ?? [], hasMore: data.hasMore ?? false }
}

export async function fetchScheduled(): Promise<ApiRaceSummary[]> {
  const data = await apiFetch<{ success: boolean; races: ApiRaceSummary[] }>('/scheduled')
  return data.races ?? []
}

export async function fetchGlobalStats(): Promise<ApiGlobalStats> {
  const data = await apiFetch<{ success: boolean; data: ApiGlobalStats }>('/stats')
  return data.data
}
