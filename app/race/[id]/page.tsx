// app/race/[id]/page.tsx
import { notFound } from 'next/navigation'
import { fetchRace, fetchPetsStatsBatch, fetchLeaderboard } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import { weiToEth } from '@/lib/encode'
import { PetCard } from '@/components/PetCard'
import { PayoutPreview } from '@/components/PayoutPreview'
import { WeatherIcon } from '@/components/WeatherIcon'
import type { PayoutPreview as PayoutPreviewType } from '@/types/racing'
import type { ApiLeaderboardEntry } from '@/types/racing'

export const revalidate = 15

export default async function RaceDetailPage({ params }: { params: { id: string } }) {
  let race
  try {
    race = await fetchRace(params.id)
  } catch {
    notFound()
  }

  // racePets is the authoritative list of petIds in this race
  const petIds: number[] = race.racePets ?? []

  // Build payout preview from payoutBps + pool (no chain call needed)
  const prizePoolEth = weiToEth(race.pool ?? '0')
  const payoutPreview: PayoutPreviewType = {
    entryFee: race.entryFee ?? '0',
    fieldSize: race.fieldSize,
    prizePool: race.pool ?? '0',
    payouts: (race.payoutBps ?? []).map((bps, i) => ({
      rank: i + 1,
      amount: String(BigInt(Math.round((bps / 10000) * prizePoolEth * 1e18))),
    })),
    jackpotEligible: (race.jackpot?.balance ?? '0') !== '0',
    jackpotPool: race.jackpot?.balance,
  }

  // Enrich pets: leaderboard gives ELO/rarity/faction, stats give win/podium counts
  const snapshots: ReturnType<typeof buildPetSnapshotWithStats>[] = []

  if (petIds.length > 0) {
    try {
      // Fetch leaderboard (top 200) and pet stats in parallel
      const [lbResult, petStatsArr] = await Promise.all([
        fetchLeaderboard({ limit: 200 }),
        fetchPetsStatsBatch(petIds),
      ])

      // Index leaderboard entries by petId for fast lookup
      const lbByPetId = new Map<number, ApiLeaderboardEntry>(
        lbResult.entries.map(e => [e.petId, e])
      )
      // Index stats by petId
      const statsByPetId = new Map(petStatsArr.map(s => [s.petId, s]))

      for (const petId of petIds) {
        const lb = lbByPetId.get(petId)
        if (!lb) {
          // Pet not in top-200 leaderboard — skip gracefully
          continue
        }
        try {
          const stats = statsByPetId.get(petId)
          snapshots.push(buildPetSnapshotWithStats(lb, stats))
        } catch (e) {
          console.error(`Failed to build snapshot for pet ${petId}:`, e)
        }
      }
    } catch (e) {
      console.error('Enrichment fetch failed:', e)
    }
  }

  // Run handicap model
  const handicaps = snapshots.length > 0
    ? handicap(snapshots, race.trackLength, race.entryFee ?? '0', race.payoutBps ?? [], race.pool ?? '0')
    : []

  const sortedByWinProb = [...handicaps].sort((a, b) => b.winProb - a.winProb)

  const entryFeeEth = weiToEth(race.entryFee ?? '0')
  const weather = race.raceTemp ?? null
  const phase = race.phaseName ?? 'UNKNOWN'

  return (
    <div>
      {/* Race header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">Race #{params.id}</h1>
          <span className={`text-sm px-3 py-1 rounded-full ${
            phase === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400'
            : phase === 'RESOLVING' ? 'bg-yellow-500/20 text-yellow-400'
            : phase === 'RESOLVED' ? 'bg-slate-700 text-slate-300'
            : 'bg-slate-700 text-slate-400'
          }`}>{phase}</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          <span>{race.trackLength}m track</span>
          <span>{race.petCount ?? petIds.length}/{race.fieldSize} entrants</span>
          <span>
            {entryFeeEth > 0 ? `${entryFeeEth.toFixed(4)} ETH entry` : 'Free entry'}
          </span>
          <span>Pool: {prizePoolEth.toFixed(4)} ETH</span>
          {weather && (
            <span className="flex items-center gap-1">
              <WeatherIcon weather={weather} /> {weather}
            </span>
          )}
        </div>
      </div>

      {/* Final ranking (if resolved) */}
      {race.finalRanking && race.finalRanking.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-700 p-4 bg-slate-900/30">
          <h2 className="text-sm font-medium text-slate-300 mb-3">Final Results</h2>
          <div className="space-y-1">
            {race.finalRanking.map((petId, i) => (
              <div key={petId} className="flex items-center gap-3 text-sm">
                <span className={`w-6 text-center font-bold ${
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-500'
                }`}>#{i + 1}</span>
                <span className="text-slate-200">Pet {petId}</span>
                {race.finishTimes?.[i] !== undefined && (
                  <span className="text-slate-500 text-xs">{(race.finishTimes[i] / 1000).toFixed(2)}s</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Field cards */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-3">
            Field {snapshots.length > 0 ? `(${snapshots.length} with data)` : ''}
          </h2>
          {snapshots.length === 0 ? (
            <p className="text-slate-500 text-sm">
              {petIds.length === 0
                ? 'No entrants yet.'
                : 'No leaderboard data available for this field — pets may be outside top 200.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {snapshots.map(pet => {
                const h = handicaps.find(hh => hh.petId === pet.petId)
                if (!h) return null
                const seedRank = sortedByWinProb.findIndex(hh => hh.petId === pet.petId) + 1
                return <PetCard key={pet.petId} pet={pet} h={h} rank={seedRank} />
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Payout structure */}
          {payoutPreview.payouts.length > 0 && (
            <PayoutPreview payout={payoutPreview} />
          )}

          {/* Model rankings */}
          {sortedByWinProb.length > 0 && (
            <div className="rounded-lg border border-slate-800 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Model Rankings</h3>
              <div className="space-y-0">
                {sortedByWinProb.map((h, i) => (
                  <div key={h.petId} className="flex justify-between text-sm py-1.5 border-b border-slate-800/50 last:border-0">
                    <span className="text-slate-400">
                      <span className="w-5 inline-block">#{i + 1}</span>
                      {' '}Pet {h.petId}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-mono">{(h.winProb * 100).toFixed(1)}%</span>
                      {h.evEnter !== undefined && h.evEnter > 0 && (
                        <span className="text-xs text-emerald-500">+EV</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Race metadata */}
          <div className="rounded-lg border border-slate-800 p-4 text-xs text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Race ID</span><span className="text-slate-400">{params.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Field size</span><span className="text-slate-400">{race.fieldSize}</span>
            </div>
            <div className="flex justify-between">
              <span>Track</span><span className="text-slate-400">{race.trackLength}m</span>
            </div>
            {race.creatorFeeBps > 0 && (
              <div className="flex justify-between">
                <span>Creator fee</span><span className="text-slate-400">{(race.creatorFeeBps / 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
