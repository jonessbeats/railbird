import { RaceCard } from '@/components/RaceCard'
import { LiveLobby } from '@/components/LiveLobby'
import { MyPetLobbyStatus } from '@/components/MyPetLobbyStatus'
import { MyPetLobbyProvider, MyPetCardWrap } from '@/components/MyPetLobbyHighlight'
import { fetchRaces } from '@/lib/api/gigaverse'
import { enrichRaces } from '@/lib/enrichRaces'
import type { ApiRaceSummary } from '@/types/racing'
import type { LobbyRaceSummary } from '@/components/MyPetLobbyStatus'

// ISR: serve cached HTML (survives cold starts), regenerate in the background every 15s.
export const revalidate = 15

export default async function LobbyPage() {
  let open: ApiRaceSummary[] = []
  try {
    const all = await fetchRaces(50)
    open = all.filter(r => r.phaseName === 'OPEN')
  } catch (e) {
    console.error('Lobby fetch failed:', e)
  }
  const enriched = await enrichRaces(open)
  const edgeCount = enriched.filter(r => r.analysis.type === 'edge').length

  // Serializable summaries for MyPetLobbyStatus (client component)
  const lobbySummaries: LobbyRaceSummary[] = enriched.map(({ race, handicaps }) => {
    const sorted = [...handicaps].sort((a, b) => b.winProb - a.winProb)
    return {
      raceId:      race.raceId,
      petIds:      race.entries.map(e => e.petId),
      trackLength: race.trackLength,
      gridTotal:   sorted.length,
      handicaps:   sorted.map((h, i) => ({ petId: h.petId, winProb: h.winProb, gridPos: i + 1 })),
    }
  })

  return (
    <div>
      <div className="mb-8 border-b border-game-border pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-game-muted uppercase tracking-widest mb-1">// gigling racing</p>
            <h1 className="text-2xl font-bold tracking-widest uppercase">Open Races</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-game-muted uppercase tracking-widest">
            <span><span className="neon-green font-bold">{enriched.length}</span> races</span>
            {edgeCount > 0 && (
              <span><span className="neon-green font-bold">{edgeCount}</span> edge</span>
            )}
            <LiveLobby initialCount={open.length} />
          </div>
        </div>
      </div>

      <MyPetLobbyStatus races={lobbySummaries} />

      {open.length === 0 ? (
        <div className="text-center py-20 text-game-muted uppercase tracking-widest text-sm">
          [ NO OPEN RACES — CHECK BACK SOON ]
        </div>
      ) : (
        <MyPetLobbyProvider>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enriched.map(({ race, handicaps, pets, analysis }) => (
              <MyPetCardWrap key={race.raceId} raceId={race.raceId}>
                <RaceCard race={race} handicaps={handicaps} pets={pets} analysis={analysis} />
              </MyPetCardWrap>
            ))}
          </div>
        </MyPetLobbyProvider>
      )}
    </div>
  )
}
