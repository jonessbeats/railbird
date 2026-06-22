// lib/backtest/predict.ts
import type { HandicapResult } from '@/types/racing'
import type { PredictionPick } from './types'

export function predictRace(
  handicaps: HandicapResult[],
  pets: { petId: number; elo: number }[],
): { picks: PredictionPick[]; edgePetId: number | null; eloPickPetId: number | null } {
  const picks: PredictionPick[] = handicaps.map(hc => ({
    petId: hc.petId,
    winProb: hc.winProb,
    evEnter: hc.evEnter ?? null,
  }))

  const edge = [...handicaps]
    .filter(hc => (hc.evEnter ?? -Infinity) > 0)
    .sort((a, b) => (b.evEnter ?? 0) - (a.evEnter ?? 0))[0]
  const edgePetId = edge ? edge.petId : null

  const eloPick = [...pets].sort((a, b) => b.elo - a.elo)[0]
  const eloPickPetId = eloPick ? eloPick.petId : null

  return { picks, edgePetId, eloPickPetId }
}
