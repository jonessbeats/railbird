import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { buildPrediction, gradePending } from '../ledger'
import { FileLedgerStore } from '../store'
import type { ApiRaceSummary } from '@/types/racing'

function race(o: Partial<ApiRaceSummary>): ApiRaceSummary {
  return {
    raceId: 1, phase: 3, phaseName: 'OPEN', createdAt: 0, raceStart: 0, cancelledAt: 0,
    fieldSize: 2, trackLength: 1000, petCount: 2, entryFee: '0', pool: '0',
    creator: '0x', createdTxHash: null, broadcastTxHash: null, joinHook: null, isPrivate: false,
    entries: [{ petId: 1, ownerAddress: '0x', slot: 0, joinedAt: 0, juiced: false, protoSurcharge: '0' },
              { petId: 2, ownerAddress: '0x', slot: 1, joinedAt: 0, juiced: false, protoSurcharge: '0' }],
    finalRanking: null, finishTimes: null, payoutBps: [10000],
    creatorFeeBps: 0, protocolFeeBps: 0, protocolFeeBpsJuiced: 0, protocolFeeFloorWei: '0',
    jackpotBps: 0, jackpotWinnableBps: 0, jackpotMaxChanceBps: 0, jackpotTargetEntryFee: '0',
    creatorFeeAccruedWei: '0', raceParams: {}, raceTemp: null,
    joinHookPolicy: {} as ApiRaceSummary['joinHookPolicy'],
    ...o,
  }
}

test('buildPrediction stamps model version and copies race fields', () => {
  const p = buildPrediction(
    race({ raceId: 7 }),
    [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }],
    null, 1, 1234,
  )
  assert.equal(p.raceId, 7)
  assert.equal(p.modelVersion, 'v1')
  assert.equal(p.recordedAt, 1234)
  assert.equal(p.picks.length, 2)
  assert.equal(p.eloPickPetId, 1)
})

test('gradePending settles resolved, drops cancelled, leaves open', async () => {
  const file = path.join(os.tmpdir(), `railbird-ledger-${Date.now()}.json`)
  const store = new FileLedgerStore(file)
  try {
    await store.recordPrediction(buildPrediction(
      race({ raceId: 1 }), [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }], null, 1))
    await store.recordPrediction(buildPrediction(
      race({ raceId: 2 }), [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }], null, 1))
    await store.recordPrediction(buildPrediction(
      race({ raceId: 3 }), [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }], null, 1))

    const fetchRaceById = async (id: number): Promise<ApiRaceSummary> => {
      if (id === 1) return race({ raceId: 1, phaseName: 'RESOLVED', finalRanking: [1, 2] })
      if (id === 2) return race({ raceId: 2, phaseName: 'CANCELLED' })
      return race({ raceId: 3, phaseName: 'OPEN' })
    }

    const graded = await gradePending(store, fetchRaceById)
    assert.equal(graded, 1)                              // only race 1 resolved
    assert.equal((await store.getGraded()).length, 1)
    assert.equal((await store.getPending()).length, 1)   // race 3 still open (2 cancelled & dropped)
    assert.equal((await store.getPending())[0].raceId, 3)
  } finally {
    await fs.rm(file, { force: true })
  }
})

// Regression: the /race/{id} detail endpoint returns numeric `phase` but NO string
// `phaseName`. Grading must key off `phase`/`finalRanking`, not `phaseName`.
test('gradePending grades detail-shaped races without phaseName (numeric phase)', async () => {
  const file = path.join(os.tmpdir(), `railbird-ledger-${Date.now()}-d.json`)
  const store = new FileLedgerStore(file)
  try {
    await store.recordPrediction(buildPrediction(
      race({ raceId: 1 }), [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }], null, 1))
    await store.recordPrediction(buildPrediction(
      race({ raceId: 2 }), [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }], null, 1))

    const fetchRaceById = async (id: number): Promise<ApiRaceSummary> => {
      // Simulate the detail endpoint: phaseName stripped out entirely.
      if (id === 1) {
        const r = race({ raceId: 1, phase: 3, finalRanking: [1, 2] })
        delete (r as Partial<ApiRaceSummary>).phaseName
        return r
      }
      const r = race({ raceId: 2, phase: 4 })   // cancelled, numeric
      delete (r as Partial<ApiRaceSummary>).phaseName
      return r
    }

    const graded = await gradePending(store, fetchRaceById)
    assert.equal(graded, 1)                              // race 1 graded via finalRanking
    assert.equal((await store.getGraded()).length, 1)
    assert.equal((await store.getPending()).length, 0)   // race 2 (phase 4) dropped
  } finally {
    await fs.rm(file, { force: true })
  }
})
