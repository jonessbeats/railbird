import { NextRequest } from 'next/server'
import { fetchRace, fetchLeaderboardParallel, fetchPetsStatsBatch, fetchPetLeaderboardEntry } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import type { ApiLeaderboardEntry, ApiPetStats } from '@/types/racing'

export const dynamic = 'force-dynamic'

async function buildSnapshots(petIds: number[], allLbEntries: ApiLeaderboardEntry[], petStatsArr: ApiPetStats[]) {
  const lbMap    = new Map<number, ApiLeaderboardEntry>(allLbEntries.map(e => [e.petId, e]))
  const statsMap = new Map<number, ApiPetStats>(petStatsArr.map(s => [s.petId, s]))
  return petIds
    .map(id => {
      const lb    = lbMap.get(id)
      const stats = statsMap.get(id)
      if (!lb) return null
      try { return buildPetSnapshotWithStats(lb, stats) } catch { return null }
    })
    .filter(Boolean) as ReturnType<typeof buildPetSnapshotWithStats>[]
}

export async function GET(req: NextRequest) {
  const raceId = req.nextUrl.searchParams.get('raceId')
  const petId  = Number(req.nextUrl.searchParams.get('petId'))

  if (!raceId || !petId) {
    return Response.json({ error: 'missing params' }, { status: 400 })
  }

  try {
    const race = await fetchRace(raceId)
    const petIds: number[] = race.entries?.length
      ? race.entries.map((e: { petId: number }) => e.petId)
      : []

    const isOpen     = race.phaseName === 'OPEN' || race.phase === 1
    const alreadyIn  = petIds.includes(petId)
    // Project whenever race is open and pet hasn't entered (even empty field → 100% sole entrant)
    const canProject = !alreadyIn && isOpen
    const fetchIds   = canProject ? [...petIds, petId] : petIds

    if (!alreadyIn && !canProject) {
      return Response.json({
        inRace:    false,
        projected: false,
        phase:     race.phaseName ?? 'UNKNOWN',
        fieldSize: petIds.length,
        fieldCap:  race.fieldSize,
        updatedAt: Date.now(),
      })
    }

    const needed = fetchIds.length > 0 ? fetchIds : [petId]

    // Top-1000 leaderboard (warm/SWR cached) + pet stats — run together
    const [lbEntries, petStatsArr] = await Promise.all([
      fetchLeaderboardParallel(10),
      fetchPetsStatsBatch(needed).catch(() => []),
    ])

    let allLb = lbEntries as ApiLeaderboardEntry[]

    // Only scan deeper for pets outside the top 1000 — cached per-pet lookups
    const haveIds = new Set(allLb.map(e => e.petId))
    const missing = needed.filter(id => !haveIds.has(id))
    if (missing.length > 0) {
      const extra = await Promise.all(missing.map(id => fetchPetLeaderboardEntry(id).catch(() => null)))
      allLb = [...allLb, ...extra.filter(Boolean) as ApiLeaderboardEntry[]]
    }

    const snapshots = await buildSnapshots(needed, allLb, petStatsArr as ApiPetStats[])

    // Model works with 1+ pets (softmax of 1 = 100%)
    const handicaps = snapshots.length >= 1
      ? handicap(snapshots, race.trackLength, race.entryFee ?? '0', race.payoutBps ?? [], race.pool ?? '0')
      : []

    const sorted  = [...handicaps].sort((a, b) => b.winProb - a.winProb)
    const myH     = handicaps.find(h => h.petId === petId)
    const gridPos = sorted.findIndex(h => h.petId === petId) + 1

    return Response.json({
      inRace:     alreadyIn,
      projected:  canProject,
      petId,
      phase:      race.phaseName ?? 'UNKNOWN',
      winProb:    myH?.winProb  ?? null,
      evEnter:    myH?.evEnter  ?? null,
      gridPos:    gridPos || null,
      gridTotal:  sorted.length,
      fieldSize:  petIds.length,
      fieldCap:   race.fieldSize,
      updatedAt:  Date.now(),
    })
  } catch (e) {
    console.error('race-odds API error:', e)
    return Response.json({ error: 'computation failed' }, { status: 500 })
  }
}
