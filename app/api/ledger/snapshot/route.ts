// app/api/ledger/snapshot/route.ts
import { NextResponse } from 'next/server'
import { fetchRaces, fetchLeaderboardForPets } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import { predictRace } from '@/lib/backtest/predict'
import { buildPrediction } from '@/lib/backtest/ledger'
import { getStore } from '@/lib/backtest/store'
import type { ApiLeaderboardEntry } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const all = await fetchRaces(50)
    const open = all.filter(r => r.phaseName === 'OPEN' && r.entries.length >= 2)
    if (open.length === 0) return NextResponse.json({ recorded: 0 })

    const entrantIds = [...new Set(open.flatMap(r => r.entries.map(e => e.petId)))]
    const lbEntries = await fetchLeaderboardForPets(entrantIds)
    const lbMap = new Map<number, ApiLeaderboardEntry>(lbEntries.map(e => [e.petId, e]))
    const snap = new Map<number, PetSnapshotWithStats>()
    for (const id of entrantIds) {
      const lb = lbMap.get(id)
      if (lb) snap.set(id, buildPetSnapshotWithStats(lb, undefined))
    }

    const store = getStore()
    let recorded = 0
    for (const race of open) {
      const pets = race.entries
        .map(e => snap.get(e.petId))
        .filter((p): p is PetSnapshotWithStats => Boolean(p))
      if (pets.length < 2) continue
      const handicaps = handicap(pets, race.trackLength, race.entryFee, race.payoutBps, race.pool)
      const { picks, edgePetId, eloPickPetId } = predictRace(
        handicaps, pets.map(p => ({ petId: p.petId, elo: p.elo })),
      )
      await store.recordPrediction(buildPrediction(race, picks, edgePetId, eloPickPetId))
      recorded++
    }
    return NextResponse.json({ recorded })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
