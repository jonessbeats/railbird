// lib/backtest/grade.ts
import type { PredictionRecord, GradedRecord, EdgeOutcome } from './types'

function payoutForRank(rank: number, pool: string, payoutBps: number[]): bigint {
  if (rank < 0 || rank >= payoutBps.length) return 0n
  return (BigInt(pool) * BigInt(payoutBps[rank])) / 10000n
}

export function buildGradedRecord(
  pred: PredictionRecord,
  finalRanking: number[],
  source: 'retro' | 'ledger',
): GradedRecord {
  const winnerPetId = finalRanking[0]

  const sortedPicks = [...pred.picks].sort((a, b) => b.winProb - a.winProb)
  const topPickPetId = sortedPicks.length > 0 ? sortedPicks[0].petId : -1
  const topPickRank = finalRanking.indexOf(topPickPetId)
  const topPickWon = topPickRank === 0
  const topPickInTop3 = topPickRank >= 0 && topPickRank < 3

  let edgeOutcome: EdgeOutcome | null = null
  if (pred.edgePetId != null) {
    const rank = finalRanking.indexOf(pred.edgePetId)
    const payoutWei = payoutForRank(rank, pred.pool, pred.payoutBps)
    const netWei = payoutWei - BigInt(pred.entryFee)
    edgeOutcome = { rank, payoutWei: payoutWei.toString(), netWei: netWei.toString() }
  }

  return {
    ...pred,
    finalRanking,
    winnerPetId,
    topPickPetId,
    topPickWon,
    topPickInTop3,
    edgeOutcome,
    source,
  }
}
