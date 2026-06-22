import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGradedRecord } from '../grade'
import type { PredictionRecord } from '../types'

function pred(overrides: Partial<PredictionRecord> = {}): PredictionRecord {
  return {
    raceId: 1, modelVersion: 'v1', recordedAt: 0, trackLength: 1000,
    entryFee: '1000000000000000',          // 0.001 ETH
    pool: '5000000000000000',              // 0.005 ETH
    payoutBps: [6000, 3000, 1000],
    fieldSize: 4,
    picks: [
      { petId: 10, winProb: 0.5, evEnter: 0.002 },
      { petId: 20, winProb: 0.3, evEnter: -0.001 },
      { petId: 30, winProb: 0.2, evEnter: null },
    ],
    edgePetId: 10,
    eloPickPetId: 10,
    ...overrides,
  }
}

test('top pick wins, top-3 true, edge payout for 1st', () => {
  const g = buildGradedRecord(pred(), [10, 20, 30, 40], 'retro')
  assert.equal(g.winnerPetId, 10)
  assert.equal(g.topPickPetId, 10)
  assert.equal(g.topPickWon, true)
  assert.equal(g.topPickInTop3, true)
  assert.equal(g.source, 'retro')
  // edge pick #10 finished 1st → payout = pool * 6000/10000 = 0.003 ETH
  assert.equal(g.edgeOutcome?.rank, 0)
  assert.equal(g.edgeOutcome?.payoutWei, '3000000000000000')
  // net = 0.003 - 0.001 = 0.002 ETH
  assert.equal(g.edgeOutcome?.netWei, '2000000000000000')
})

test('top pick loses and out of money', () => {
  const g = buildGradedRecord(pred(), [20, 30, 40, 10], 'ledger')
  assert.equal(g.topPickWon, false)
  assert.equal(g.topPickInTop3, false)   // #10 finished 4th (index 3)
  // edge pick #10 finished 4th → no payout (only 3 paid)
  assert.equal(g.edgeOutcome?.rank, 3)
  assert.equal(g.edgeOutcome?.payoutWei, '0')
  assert.equal(g.edgeOutcome?.netWei, '-1000000000000000')
})

test('no edge pick → edgeOutcome null', () => {
  const g = buildGradedRecord(pred({ edgePetId: null }), [10, 20, 30, 40], 'retro')
  assert.equal(g.edgeOutcome, null)
})
