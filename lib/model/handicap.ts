// lib/model/handicap.ts
import type { HandicapResult } from '@/types/racing'
import { rarityOrdinal, weiToEth, statScoreForDistance } from '@/lib/encode'
import { type PetSnapshotWithStats, smoothedWinRate } from './infer'

// Softmax temperature applied to z-scored strength. (Was effectively divided by 1000
// against z-scores, which flattened every field to ~uniform — the model picked the
// right favorite but reported near-equal probabilities. Tuned via backtest calibration.)
// Read at call time so it can be tuned via env without rebuilds.
function getBeta(): number {
  // 1.2 tuned on the retro backtest: favorite's stated prob (~56%) ≈ its real win
  // rate (~55%), best log-loss, hit-rate preserved.
  return Number(process.env.HANDICAP_BETA ?? '1.2') || 1.2
}

// Compute base strength score S_i for one pet given race conditions
function baseStrength(pet: PetSnapshotWithStats, trackLength: number): number {
  // 1. ELO component (dominant signal)
  let s = pet.elo

  // 2. Rarity prior — higher rarity → higher stat ceiling
  s += rarityOrdinal(pet.rarity) * 25  // max 125 pts for Giga

  // 3. Stat range score for this distance (from leaderboard racePublic data)
  const statScore = statScoreForDistance(
    pet.startRange, pet.speedRange, pet.staminaRange, pet.finishRange,
    trackLength,
  )
  s += statScore * 0.5  // scale: stat ranges are 0-200, this adds up to 100 pts

  // 4. Smoothed win-rate bonus (Bayesian shrinkage toward prior)
  const priorWinRate = 0.125  // 1/8 for equal-field assumption
  const smoothed = smoothedWinRate(
    Math.round(pet.winRate * pet.racesRun), // wins
    pet.racesRun,
    priorWinRate,
  )
  s += (smoothed - priorWinRate) * 500  // ±62.5 pts for extreme win rates

  return s
}

// Softmax over field scores
function softmax(scores: number[], beta: number): number[] {
  const max = Math.max(...scores)
  const exps = scores.map(s => Math.exp(beta * (s - max)))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / sum)
}

// Plackett-Luce rank distribution approximation
// P(rank=k) for pet i in a field of N
function rankDistribution(winProb: number, fieldSize: number): number[] {
  const dist = new Array(fieldSize).fill(0)
  dist[0] = winProb
  // For ranks 2..N: approximate by distributing remaining probability
  // proportionally — simplified but computationally cheap
  const remaining = 1 - winProb
  for (let k = 1; k < fieldSize; k++) {
    dist[k] = remaining / (fieldSize - 1)
  }
  return dist
}

// Main handicap function — takes full field with stat ranges
export function handicap(
  field: PetSnapshotWithStats[],
  trackLength: number,
  entryFeeWei: string,
  payoutBps: number[],    // basis-points per rank, e.g. [5500, 3000, 1500]
  prizePoolWei: string,
): HandicapResult[] {
  if (field.length === 0) return []

  const scores = field.map(pet => baseStrength(pet, trackLength))

  // Z-score normalisation across field (prevents ELO scale dominating beta)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.map(s => (s - mean) ** 2).reduce((a, b) => a + b, 0) / scores.length
  const std = Math.sqrt(variance) || 1
  const zScores = scores.map(s => (s - mean) / std)

  const winProbs = softmax(zScores, getBeta())

  const entryFeeEth = weiToEth(entryFeeWei)
  const prizePoolEth = weiToEth(prizePoolWei)

  return field.map((pet, i) => {
    const winProb = winProbs[i]
    const fairOdds = winProb > 0 ? 1 / winProb : 99
    const rankDist = rankDistribution(winProb, field.length)

    // EV calculation using payoutBps applied to prize pool
    let evEnter: number | undefined
    if (entryFeeEth > 0 && payoutBps.length > 0) {
      const ev = rankDist.reduce((sum, prob, rank) => {
        const bps = payoutBps[rank] ?? 0
        const payout = (bps / 10000) * prizePoolEth
        return sum + prob * payout
      }, 0) - entryFeeEth
      evEnter = ev
    }

    // Value rating: win probability vs equal-split implied odds
    // Positive = model thinks this pet is undervalued relative to equal split
    const impliedWinProb = 1 / field.length
    const valueRating = winProb / impliedWinProb - 1  // e.g. +0.3 = 30% better than random

    return {
      petId: pet.petId,
      winProb,
      fairOdds,
      rankDist,
      evEnter,
      valueRating,
      revealPct: pet.revealPct,
    }
  })
}

// Helper: pick top-N most likely winners from handicap results
export function topPicks(results: HandicapResult[], n = 2): HandicapResult[] {
  return [...results].sort((a, b) => b.winProb - a.winProb).slice(0, n)
}

// Helper: does this field have any +EV entry?
export function hasEdge(results: HandicapResult[]): boolean {
  return results.some(r => (r.evEnter ?? -1) > 0)
}
