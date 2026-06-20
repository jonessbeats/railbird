// app/page.tsx — enriched lobby: win% favorites + EDGE badges + live indicator
import { RaceCard } from '@/components/RaceCard'
import { LiveLobby } from '@/components/LiveLobby'
import { fetchLobbySync, fetchLeaderboard, fetchPetsStatsBatch } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import type { ApiRaceSummary } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'

export const revalidate = 30

interface EnrichedRace {
  race: ApiRaceSummary
  handicaps: ReturnType<typeof handicap>
  pets: PetSnapshotWithStats[]
}

async function enrichRaces(races: ApiRaceSummary[]): Promise<EnrichedRace[]> {
  // Only enrich OPEN races that have at least one entrant; cap at 12 cards
  const openFull = races
    .filter(r => r.phaseName === 'OPEN' && r.petCount > 0)
    .slice(0, 12)

  if (openFull.length === 0) return []

  // Collect all unique petIds across the lobby for a single batch stat fetch
  const allPetIds = [
    ...new Set(openFull.flatMap(r => r.entries.map(e => e.petId))),
  ]

  // Fetch leaderboard (limit 200) once — gives us ELO, rarity, faction, stat ranges
  // Also batch-fetch recent race stats for win/podium counts
  const [lbResult, batchStats] = await Promise.all([
    fetchLeaderboard({ limit: 200 }).catch(() => ({ entries: [], hasMore: false })),
    allPetIds.length > 0
      ? fetchPetsStatsBatch(allPetIds.slice(0, 50)).catch(() => [])
      : Promise.resolve([]),
  ])

  const lbEntries = lbResult.entries

  // Build a lookup map: petId → PetSnapshotWithStats
  const snapshotMap = new Map<number, PetSnapshotWithStats>()
  for (const lb of lbEntries) {
    if (!allPetIds.includes(lb.petId)) continue
    const stats = batchStats.find(s => s.petId === lb.petId)
    snapshotMap.set(lb.petId, buildPetSnapshotWithStats(lb, stats))
  }

  return openFull.map(race => {
    try {
      const petIds = race.entries.map(e => e.petId)
      const pets = petIds.map(id => snapshotMap.get(id)).filter(Boolean) as PetSnapshotWithStats[]

      if (pets.length < 2) return { race, handicaps: [], pets }

      // raceTemp is the weather condition; map to RaceConditions for handicap
      const handicaps = handicap(
        pets,
        race.trackLength,
        race.entryFee,
        race.payoutBps,
        race.pool,
      )

      return { race, handicaps, pets }
    } catch {
      return { race, handicaps: [], pets: [] }
    }
  })
}

export default async function LobbyPage() {
  let races: ApiRaceSummary[] = []
  try {
    const data = await fetchLobbySync()
    races = data.races ?? []
  } catch (e) {
    console.error('Lobby fetch failed:', e)
  }

  const open = races.filter(r => r.phaseName === 'OPEN')
  const enriched = await enrichRaces(open)
  const edgeCount = enriched.filter(r => r.handicaps.some(h => (h.evEnter ?? -1) > 0)).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Open Races</h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-slate-500 text-sm">{open.length} races open</p>
          {edgeCount > 0 && (
            <span className="text-xs text-emerald-400 font-medium">
              {edgeCount} with EDGE
            </span>
          )}
          <LiveLobby initialCount={open.length} />
        </div>
      </div>

      {open.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          No open races right now. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {enriched.map(({ race, handicaps, pets }) => (
            <RaceCard key={race.raceId} race={race} handicaps={handicaps} pets={pets} />
          ))}
        </div>
      )}
    </div>
  )
}
