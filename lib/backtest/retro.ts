// lib/backtest/retro.ts
import { fetchResolvedRaces, fetchLeaderboardForPets } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import { predictRace } from './predict'
import { buildGradedRecord } from './grade'
import { buildPrediction } from './ledger'
import type { ApiRaceSummary, ApiLeaderboardEntry } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'
import type { GradedRecord } from './types'

const MIN_COVERAGE = 0.75

export function replayResolvedRace(
  race: ApiRaceSummary,
  snapshotMap: Map<number, PetSnapshotWithStats>,
): GradedRecord | null {
  if (!race.finalRanking || race.finalRanking.length === 0) return null

  const entrantIds = race.entries.map(e => e.petId)
  const pets = entrantIds
    .map(id => snapshotMap.get(id))
    .filter((p): p is PetSnapshotWithStats => Boolean(p))

  const coverage = race.fieldSize > 0 ? pets.length / race.fieldSize : 0
  if (pets.length < 2 || coverage < MIN_COVERAGE) return null

  const handicaps = handicap(pets, race.trackLength, race.entryFee, race.payoutBps, race.pool)
  const { picks, edgePetId, eloPickPetId } = predictRace(
    handicaps,
    pets.map(p => ({ petId: p.petId, elo: p.elo })),
  )
  const pred = buildPrediction(
    race, picks, edgePetId, eloPickPetId, race.raceStart || Math.floor(Date.now() / 1000),
  )
  return buildGradedRecord(pred, race.finalRanking, 'retro')
}

export async function runRetroBacktest(target = 300): Promise<GradedRecord[]> {
  const races = await fetchResolvedRaces(target)
  const entrantIds = [...new Set(races.flatMap(r => r.entries.map(e => e.petId)))]
  if (entrantIds.length === 0) return []

  const lbEntries = await fetchLeaderboardForPets(entrantIds)
  const lbMap = new Map<number, ApiLeaderboardEntry>(lbEntries.map(e => [e.petId, e]))

  const snapshotMap = new Map<number, PetSnapshotWithStats>()
  for (const id of entrantIds) {
    const lb = lbMap.get(id)
    if (lb) snapshotMap.set(id, buildPetSnapshotWithStats(lb, undefined))
  }

  return races
    .map(r => replayResolvedRace(r, snapshotMap))
    .filter((g): g is GradedRecord => g !== null)
}
