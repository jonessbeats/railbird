// lib/backtest/ledger.ts
import type { LedgerStore } from './store'
import { buildGradedRecord } from './grade'
import { MODEL_VERSION } from './version'
import type { ApiRaceSummary } from '@/types/racing'
import type { PredictionRecord, PredictionPick } from './types'

export function buildPrediction(
  race: ApiRaceSummary,
  picks: PredictionPick[],
  edgePetId: number | null,
  eloPickPetId: number | null,
  now = Math.floor(Date.now() / 1000),
): PredictionRecord {
  return {
    raceId: race.raceId,
    modelVersion: MODEL_VERSION,
    recordedAt: now,
    trackLength: race.trackLength,
    entryFee: race.entryFee,
    pool: race.pool,
    payoutBps: race.payoutBps,
    fieldSize: race.fieldSize,
    picks,
    edgePetId,
    eloPickPetId,
  }
}

export async function gradePending(
  store: LedgerStore,
  fetchRaceById: (id: number) => Promise<ApiRaceSummary>,
): Promise<number> {
  const pending = await store.getPending()
  let graded = 0
  for (const rec of pending) {
    let race: ApiRaceSummary
    try {
      race = await fetchRaceById(rec.raceId)
    } catch {
      continue                                   // transient fetch failure → retry next run
    }
    // NB: the /race/{id} detail endpoint returns numeric `phase` but NOT the string
    // `phaseName` (that only exists on the /races list), so we must not rely on
    // phaseName here. Cancelled = phase 4; resolved is signalled by finalRanking
    // being populated (the definitive "result is in" marker).
    const cancelled = race.phase === 4 || race.phaseName === 'CANCELLED'
    if (cancelled) {
      await store.removePending(rec.raceId, rec.modelVersion)
      continue
    }
    if (race.finalRanking && race.finalRanking.length > 0) {
      await store.addGraded(buildGradedRecord(rec, race.finalRanking, 'ledger'))
      await store.removePending(rec.raceId, rec.modelVersion)
      graded++
    }
  }
  return graded
}
