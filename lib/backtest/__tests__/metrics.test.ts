import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics } from '../metrics'
import { buildGradedRecord } from '../grade'
import type { PredictionRecord } from '../types'

function pred(o: Partial<PredictionRecord>): PredictionRecord {
  return {
    raceId: 1, modelVersion: 'v1', recordedAt: 0, trackLength: 1000,
    entryFee: '1000000000000000', pool: '5000000000000000',
    payoutBps: [6000, 3000, 1000], fieldSize: 4,
    picks: [], edgePetId: null, eloPickPetId: null, ...o,
  }
}

// race A: top pick (#10, 0.5) wins. race B: top pick (#10, 0.5) loses to #20.
const recA = buildGradedRecord(pred({
  raceId: 1,
  picks: [{ petId: 10, winProb: 0.5, evEnter: 0.002 }, { petId: 20, winProb: 0.5, evEnter: null }],
  edgePetId: 10, eloPickPetId: 10,
}), [10, 20, 30, 40], 'retro')

const recB = buildGradedRecord(pred({
  raceId: 2,
  picks: [{ petId: 10, winProb: 0.5, evEnter: 0.002 }, { petId: 20, winProb: 0.5, evEnter: null }],
  edgePetId: 10, eloPickPetId: 10,
}), [20, 10, 30, 40], 'ledger')

test('hit-rate and baselines', () => {
  const m = computeMetrics([recA, recB])
  assert.equal(m.nRaces, 2)
  assert.equal(m.favoriteHitRate, 0.5)        // 1 of 2
  assert.equal(m.top3HitRate, 1)              // #10 finished 1st then 2nd
  assert.equal(m.randomBaseline, 0.25)        // 1/4
  assert.equal(m.eloBaseline, 0.5)            // ELO pick #10 won once
})

test('edge ROI from paid edge picks', () => {
  const m = computeMetrics([recA, recB])
  // A: edge #10 1st → +0.002; B: edge #10 2nd → payout 0.005*0.3=0.0015, net +0.0005
  // net total = 0.0025 ETH; entry total = 0.002 ETH → ROI = 1.25
  assert.equal(m.edgePicks, 2)
  assert.ok(Math.abs(m.edgeNetEth - 0.0025) < 1e-9)
  assert.ok(m.edgeRoi !== null && Math.abs(m.edgeRoi - 1.25) < 1e-9)
})

test('calibration bins sum to all picks', () => {
  const m = computeMetrics([recA, recB])
  const totalCount = m.calibration.reduce((s, b) => s + b.count, 0)
  assert.equal(totalCount, 4)                 // 2 picks * 2 races
  assert.equal(m.calibration.length, 10)
})

test('empty input is safe', () => {
  const m = computeMetrics([])
  assert.equal(m.nRaces, 0)
  assert.equal(m.favoriteHitRate, 0)
  assert.equal(m.edgeRoi, null)
})
