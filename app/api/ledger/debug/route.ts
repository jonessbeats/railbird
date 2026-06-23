// TEMP diagnostic — inspect ledger store contents and the live phase of pending races.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/backtest/store'
import { fetchRace } from '@/lib/api/gigaverse'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const store = getStore()
    const storeKind = store.constructor.name
    const pending = await store.getPending()
    const graded = await store.getGraded()

    const sample = []
    for (const rec of pending.slice(0, 12)) {
      try {
        const race = await fetchRace(rec.raceId)
        sample.push({
          raceId: rec.raceId,
          modelVersion: rec.modelVersion,
          phaseName: race.phaseName,
          hasFinalRanking: Array.isArray(race.finalRanking) && race.finalRanking.length > 0,
        })
      } catch (e) {
        sample.push({ raceId: rec.raceId, modelVersion: rec.modelVersion, fetchError: String(e) })
      }
    }

    return NextResponse.json({
      storeKind,
      pendingCount: pending.length,
      gradedCount: graded.length,
      pendingRaceIds: pending.map(r => r.raceId),
      sample,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
