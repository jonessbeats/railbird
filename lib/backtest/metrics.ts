// lib/backtest/metrics.ts
import type { GradedRecord, CalibrationBin, BacktestMetrics } from './types'
import { weiToEth } from '@/lib/encode'

const N_BINS = 10

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function probSum(r: GradedRecord): number {
  return r.picks.reduce((s, p) => s + p.winProb, 0)
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

function buildCalibration(records: GradedRecord[]): CalibrationBin[] {
  const bins = Array.from({ length: N_BINS }, (_, i) => ({
    lo: i / N_BINS, hi: (i + 1) / N_BINS, preds: [] as number[], wins: 0,
  }))
  for (const r of records) {
    const total = Math.max(probSum(r), 1e-9)
    for (const p of r.picks) {
      const norm = p.winProb / total
      let idx = Math.floor(norm * N_BINS)
      if (idx >= N_BINS) idx = N_BINS - 1
      if (idx < 0) idx = 0
      bins[idx].preds.push(norm)
      if (p.petId === r.winnerPetId) bins[idx].wins += 1
    }
  }
  return bins.map(b => ({
    lo: b.lo, hi: b.hi,
    predictedMean: b.preds.length ? mean(b.preds) : 0,
    observedRate: b.preds.length ? b.wins / b.preds.length : 0,
    count: b.preds.length,
  }))
}

export function computeMetrics(records: GradedRecord[]): BacktestMetrics {
  const n = records.length
  // Races where the actual winner had model data (winner ∈ picks) — needed for Brier/log-loss.
  const scored = records.filter(r => r.picks.some(p => p.petId === r.winnerPetId))

  const favoriteHitRate = mean(records.map(r => (r.topPickWon ? 1 : 0)))
  const top3HitRate = mean(records.map(r => (r.topPickInTop3 ? 1 : 0)))
  const randomBaseline = mean(records.map(r => (r.fieldSize > 0 ? 1 / r.fieldSize : 0)))
  const eloBaseline = mean(records.map(
    r => (r.eloPickPetId != null && r.eloPickPetId === r.winnerPetId ? 1 : 0),
  ))

  const brier = mean(scored.map(r => {
    const total = Math.max(probSum(r), 1e-9)
    return r.picks.reduce((s, p) => {
      const norm = p.winProb / total
      const o = p.petId === r.winnerPetId ? 1 : 0
      return s + (norm - o) ** 2
    }, 0)
  }))

  const logLoss = mean(scored.map(r => {
    const total = Math.max(probSum(r), 1e-9)
    const winnerPick = r.picks.find(p => p.petId === r.winnerPetId)!
    const p = clamp(winnerPick.winProb / total, 1e-6, 1 - 1e-6)
    return -Math.log(p)
  }))

  const calibration = buildCalibration(scored)

  const edgeRecords = records.filter(
    r => r.edgeOutcome != null && BigInt(r.entryFee) > 0n,
  )
  const edgeNetWei = edgeRecords.reduce((s, r) => s + BigInt(r.edgeOutcome!.netWei), 0n)
  const edgeEntryWei = edgeRecords.reduce((s, r) => s + BigInt(r.entryFee), 0n)
  const edgeNetEth = weiToEth(edgeNetWei.toString())
  const edgeRoi = edgeEntryWei > 0n ? Number(edgeNetWei) / Number(edgeEntryWei) : null

  const nPets = records.reduce((s, r) => s + r.picks.length, 0)
  const meanCoverage = mean(records.map(
    r => (r.fieldSize > 0 ? r.picks.length / r.fieldSize : 0),
  ))

  return {
    nRaces: n, nPets, favoriteHitRate, randomBaseline, eloBaseline,
    top3HitRate, brier, logLoss, calibration,
    edgeNetEth, edgeRoi, edgePicks: edgeRecords.length, meanCoverage,
  }
}
