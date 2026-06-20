import { RaceCard } from '@/components/RaceCard'
import { fetchLobbySync } from '@/lib/api/gigaverse'
import type { ApiRaceSummary } from '@/types/racing'

export const revalidate = 30

export default async function LobbyPage() {
  let races: ApiRaceSummary[] = []
  try {
    const data = await fetchLobbySync()
    races = (data.races ?? []).filter(r => r.phaseName === 'OPEN').slice(0, 20)
  } catch (e) {
    console.error('Lobby fetch failed:', e)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Open Races</h1>
        <p className="text-slate-500 text-sm mt-1">
          {races.length} races open · Live odds from race history
        </p>
      </div>

      {races.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          No open races at the moment. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {races.map(race => (
            <RaceCard key={race.raceId} race={race} />
          ))}
        </div>
      )}
    </div>
  )
}
