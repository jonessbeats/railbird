import { fetchLeaderboardParallel, fetchPetsStatsBatch } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import { analyzeRace } from '@/lib/model/analyze'
import type { ApiRaceSummary } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'
import type { RaceAnalysis } from '@/lib/model/analyze'
import type { HandicapResult } from '@/types/racing'

export interface EnrichedRace {
  race: ApiRaceSummary
  handicaps: HandicapResult[]
  pets: PetSnapshotWithStats[]
  analysis: RaceAnalysis
}

export async function enrichRaces(
  races: ApiRaceSummary[],
  maxRaces = 12,
): Promise<EnrichedRace[]> {
  const openFull = races
    .filter(r => r.phaseName === 'OPEN')
    .slice(0, maxRaces)

  if (openFull.length === 0) return []

  const allPetIds = [
    ...new Set(openFull.flatMap(r => r.entries.map(e => e.petId))),
  ]

  const [lbEntries, batchStats] = await Promise.all([
    fetchLeaderboardParallel(10).catch(() => []),
    allPetIds.length > 0
      ? fetchPetsStatsBatch(allPetIds.slice(0, 50)).catch(() => [])
      : Promise.resolve([]),
  ])

  const snapshotMap = new Map<number, PetSnapshotWithStats>()
  for (const lb of lbEntries) {
    if (!allPetIds.includes(lb.petId)) continue
    const stats = batchStats.find(s => s.petId === lb.petId)
    snapshotMap.set(lb.petId, buildPetSnapshotWithStats(lb, stats))
  }

  return openFull.map(race => {
    try {
      const petIds = race.entries.map(e => e.petId)
      const pets = petIds.map(id => snapshotMap.get(id)).filter(Boolean) as PetSnapshotWithStats[]
      const handicaps = pets.length >= 2
        ? handicap(pets, race.trackLength, race.entryFee, race.payoutBps, race.pool)
        : []
      const analysis = analyzeRace(handicaps, pets, race.trackLength, race.entries.length)
      return { race, handicaps, pets, analysis }
    } catch {
      const analysis = analyzeRace([], [], race.trackLength, race.entries.length)
      return { race, handicaps: [], pets: [], analysis }
    }
  })
}
