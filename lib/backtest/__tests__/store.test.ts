import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { FileLedgerStore } from '../store'
import { buildGradedRecord } from '../grade'
import type { PredictionRecord } from '../types'

function pred(raceId: number): PredictionRecord {
  return {
    raceId, modelVersion: 'v1', recordedAt: 0, trackLength: 1000,
    entryFee: '0', pool: '0', payoutBps: [10000], fieldSize: 2,
    picks: [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }],
    edgePetId: null, eloPickPetId: 1,
  }
}

test('file store round-trips pending → graded, dedupes by raceId+version', async () => {
  const file = path.join(os.tmpdir(), `railbird-ledger-${Date.now()}.json`)
  const store = new FileLedgerStore(file)
  try {
    await store.recordPrediction(pred(1))
    await store.recordPrediction(pred(1))          // duplicate ignored
    await store.recordPrediction(pred(2))
    assert.equal((await store.getPending()).length, 2)

    const g = buildGradedRecord(pred(1), [1, 2], 'ledger')
    await store.addGraded(g)
    await store.removePending(1, 'v1')

    assert.equal((await store.getPending()).length, 1)
    assert.equal((await store.getGraded()).length, 1)
    assert.equal((await store.getGraded())[0].winnerPetId, 1)
  } finally {
    await fs.rm(file, { force: true })
  }
})
