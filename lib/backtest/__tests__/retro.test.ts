import { test } from 'node:test'
import assert from 'node:assert/strict'
import { replayResolvedRace } from '../retro'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import type { ApiRaceSummary, ApiLeaderboardEntry } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'

function lb(petId: number, elo: number): ApiLeaderboardEntry {
  return {
    rank: 0, petId, elo, eloRaceCount: 50, racesRun: 50, wins: 10,
    rarity: 3, faction: 1, gender: 'Male', ownerAddress: '0x',
    rarityName: 'Epic', factionName: 'Crusader',
    racePublic: { id: petId, racesRun: 50 } as ApiLeaderboardEntry['racePublic'],
    ownerSummary: {} as ApiLeaderboardEntry['ownerSummary'],
  }
}

function resolvedRace(petIds: number[], finalRanking: number[]): ApiRaceSummary {
  return {
    raceId: 99, phase: 3, phaseName: 'RESOLVED', createdAt: 0, raceStart: 100, cancelledAt: 0,
    fieldSize: petIds.length, trackLength: 1000, petCount: petIds.length, entryFee: '0', pool: '0',
    creator: '0x', createdTxHash: null, broadcastTxHash: null, joinHook: null, isPrivate: false,
    entries: petIds.map((petId, slot) => ({
      petId, ownerAddress: '0x', slot, joinedAt: 0, juiced: false, protoSurcharge: '0',
    })),
    finalRanking, finishTimes: null, payoutBps: [10000],
    creatorFeeBps: 0, protocolFeeBps: 0, protocolFeeBpsJuiced: 0, protocolFeeFloorWei: '0',
    jackpotBps: 0, jackpotWinnableBps: 0, jackpotMaxChanceBps: 0, jackpotTargetEntryFee: '0',
    creatorFeeAccruedWei: '0', raceParams: {}, raceTemp: null,
    joinHookPolicy: {} as ApiRaceSummary['joinHookPolicy'],
  }
}

test('replay produces a graded record with a top pick and winner', () => {
  const snapshotMap = new Map<number, PetSnapshotWithStats>([
    [1, buildPetSnapshotWithStats(lb(1, 1800), undefined)],
    [2, buildPetSnapshotWithStats(lb(2, 1400), undefined)],
    [3, buildPetSnapshotWithStats(lb(3, 1300), undefined)],
    [4, buildPetSnapshotWithStats(lb(4, 1200), undefined)],
  ])
  const g = replayResolvedRace(resolvedRace([1, 2, 3, 4], [1, 2, 3, 4]), snapshotMap)
  assert.ok(g)
  assert.equal(g!.winnerPetId, 1)
  assert.equal(g!.picks.length, 4)
  assert.equal(g!.source, 'retro')
  assert.equal(g!.topPickPetId, 1)        // highest ELO should be model favorite here
})

test('replay returns null when coverage below threshold', () => {
  const snapshotMap = new Map<number, PetSnapshotWithStats>([
    [1, buildPetSnapshotWithStats(lb(1, 1800), undefined)],
  ])
  // 1 of 4 entrants known → coverage 0.25 < 0.75
  const g = replayResolvedRace(resolvedRace([1, 2, 3, 4], [1, 2, 3, 4]), snapshotMap)
  assert.equal(g, null)
})
