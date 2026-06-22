import { test } from 'node:test'
import assert from 'node:assert/strict'
import { predictRace } from '../predict'
import type { HandicapResult } from '@/types/racing'

function h(petId: number, winProb: number, evEnter: number | undefined): HandicapResult {
  return { petId, winProb, fairOdds: 1 / winProb, rankDist: [], evEnter, valueRating: 0, revealPct: 50 }
}

test('picks mirror handicaps; edgePetId is max positive EV; eloPick is max ELO', () => {
  const handicaps = [h(1, 0.5, -0.01), h(2, 0.3, 0.04), h(3, 0.2, 0.02)]
  const pets = [{ petId: 1, elo: 1500 }, { petId: 2, elo: 1400 }, { petId: 3, elo: 1700 }]
  const { picks, edgePetId, eloPickPetId } = predictRace(handicaps, pets)

  assert.equal(picks.length, 3)
  assert.deepEqual(picks[0], { petId: 1, winProb: 0.5, evEnter: -0.01 })
  assert.equal(edgePetId, 2)        // 0.04 is the largest positive EV
  assert.equal(eloPickPetId, 3)     // ELO 1700
})

test('edgePetId null when no positive EV', () => {
  const handicaps = [h(1, 0.6, -0.01), h(2, 0.4, undefined)]
  const pets = [{ petId: 1, elo: 1500 }, { petId: 2, elo: 1400 }]
  const { edgePetId } = predictRace(handicaps, pets)
  assert.equal(edgePetId, null)
})
