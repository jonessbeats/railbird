import { NextRequest } from 'next/server'
import {
  fetchRaces, fetchLeaderboardParallel, fetchPetsStatsBatch, fetchPetLeaderboardEntry,
} from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats, buildSnapshotFromStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import { classifyTrack } from '@/lib/model/trackAffinity'
import { weiToEth } from '@/lib/encode'
import type { ApiLeaderboardEntry, ApiPetStats, ApiRaceSummary } from '@/types/racing'

export const dynamic = 'force-dynamic'

export interface MyRaceProjection {
  raceId:      number
  trackLength: number
  trackType:   'SPRINT' | 'MID' | 'STAMINA'
  fieldSize:   number          // current participants
  fieldCap:    number
  entryFeeEth: number
  poolEth:     number
  inRace:      boolean         // pet already entered
  winProb:     number
  evEth:       number | null   // net EV in ETH (null for free races)
  gridPos:     number
  gridTotal:   number
  recommend:   'in' | 'enter' | 'contender' | 'skip'
  provisional: boolean         // field too sparse for a trustworthy winProb (inflated)
}

export interface PetProjections {
  petId:    number
  races:    MyRaceProjection[]
  notFound: boolean
}

// A pet is a "contender" when it has a genuinely strong shot at winning this race
// right now, even if the entry isn't strictly +EV.
const CONTENDER_WIN = 0.33

type Snapshot = ReturnType<typeof buildPetSnapshotWithStats>

function projectPet(
  petId: number,
  open: ApiRaceSummary[],
  snap: (id: number) => Snapshot | null,
  statsMap: Map<number, ApiPetStats>,
): PetProjections {
  // Our pet: leaderboard snapshot if found, else stats-only fallback
  let mySnap = snap(petId)
  if (!mySnap) {
    const myStats = statsMap.get(petId)
    if (myStats) { try { mySnap = buildSnapshotFromStats(myStats) } catch { /* give up */ } }
  }
  if (!mySnap) return { petId, races: [], notFound: true }

  const projections: MyRaceProjection[] = []
  for (const race of open) {
    const participantIds = race.entries.map(e => e.petId)
    const alreadyIn = participantIds.includes(petId)

    const fieldIds = alreadyIn ? participantIds : [...participantIds, petId]
    const field = fieldIds
      .map(id => (id === petId ? mySnap : snap(id)))
      .filter(Boolean) as Snapshot[]

    if (!field.some(p => p.petId === petId)) continue
    if (field.length < 1) continue

    const handicaps = handicap(field, race.trackLength, race.entryFee, race.payoutBps, race.pool)
    const sorted    = [...handicaps].sort((a, b) => b.winProb - a.winProb)
    const myH       = handicaps.find(h => h.petId === petId)
    if (!myH) continue

    const entryFeeEth = weiToEth(race.entryFee)
    const evEth       = myH.evEnter ?? null
    const gridPos     = sorted.findIndex(h => h.petId === petId) + 1
    // winProb is normalised over pets currently in the field, so a near-empty race
    // inflates it (e.g. 1 entrant => 100%). Flag as provisional when too sparse.
    const projectedFill = alreadyIn ? participantIds.length : participantIds.length + 1
    const provisional = field.length < 3
      || (race.fieldSize > 0 && projectedFill / race.fieldSize < 0.6)
    const isContender = !provisional && myH.winProb >= CONTENDER_WIN

    let recommend: MyRaceProjection['recommend']
    if (alreadyIn) {
      recommend = 'in'
    } else if (entryFeeEth > 0) {
      recommend = evEth !== null && evEth > 0 ? 'enter'
        : isContender ? 'contender'
        : 'skip'
    } else {
      recommend = isContender ? 'enter' : 'skip'
    }

    projections.push({
      raceId:      race.raceId,
      trackLength: race.trackLength,
      trackType:   classifyTrack(race.trackLength),
      fieldSize:   participantIds.length,
      fieldCap:    race.fieldSize,
      entryFeeEth,
      poolEth:     weiToEth(race.pool),
      inRace:      alreadyIn,
      winProb:     myH.winProb,
      evEth,
      gridPos,
      gridTotal:   sorted.length,
      recommend,
      provisional,
    })
  }

  const tier = { in: 0, enter: 1, contender: 2, skip: 3 }
  const score = (p: MyRaceProjection) => (p.evEth !== null ? p.evEth : p.winProb - 1)
  projections.sort((a, b) => tier[a.recommend] - tier[b.recommend] || score(b) - score(a))

  return { petId, races: projections, notFound: false }
}

export async function GET(req: NextRequest) {
  // Accept ?petId=X (single, back-compat) or ?petIds=a,b,c (stable)
  const single = Number(req.nextUrl.searchParams.get('petId'))
  const multi  = (req.nextUrl.searchParams.get('petIds') ?? '')
    .split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0)
  const petIds = [...new Set(multi.length ? multi : single ? [single] : [])]

  if (petIds.length === 0) return Response.json({ error: 'missing petId(s)' }, { status: 400 })

  try {
    const races = await fetchRaces(50)
    const open  = races.filter(r => r.phaseName === 'OPEN' || r.phase === 1)

    if (open.length === 0) {
      const empty = petIds.map(petId => ({ petId, races: [], notFound: false }))
      return single && !multi.length
        ? Response.json({ petId: single, races: [], updatedAt: Date.now() })
        : Response.json({ pets: empty, updatedAt: Date.now() })
    }

    // Shared fetches across all pets: participants + our pets
    const allIds = [...new Set([...open.flatMap(r => r.entries.map(e => e.petId)), ...petIds])]

    const [lbEntries, statsArr] = await Promise.all([
      fetchLeaderboardParallel(10),
      fetchPetsStatsBatch(allIds.slice(0, 80)).catch(() => []),
    ])

    let allLb = lbEntries as ApiLeaderboardEntry[]
    // Any of our pets outside the top 1000 → cached deep lookup
    const have = new Set(allLb.map(e => e.petId))
    const missing = petIds.filter(id => !have.has(id))
    if (missing.length > 0) {
      const extra = await Promise.all(missing.map(id => fetchPetLeaderboardEntry(id).catch(() => null)))
      allLb = [...allLb, ...extra.filter(Boolean) as ApiLeaderboardEntry[]]
    }

    const lbMap    = new Map<number, ApiLeaderboardEntry>(allLb.map(e => [e.petId, e]))
    const statsMap = new Map<number, ApiPetStats>((statsArr as ApiPetStats[]).map(s => [s.petId, s]))

    const snap = (id: number) => {
      const lb = lbMap.get(id)
      if (!lb) return null
      try { return buildPetSnapshotWithStats(lb, statsMap.get(id)) } catch { return null }
    }

    const pets = petIds.map(petId => projectPet(petId, open, snap, statsMap))

    // Single-pet back-compat shape
    if (single && !multi.length) {
      const only = pets[0]
      return Response.json({
        petId: only.petId, races: only.races, notFound: only.notFound, updatedAt: Date.now(),
      })
    }
    return Response.json({ pets, updatedAt: Date.now() })
  } catch (e) {
    console.error('my-races API error:', e)
    return Response.json({ error: 'computation failed' }, { status: 500 })
  }
}
