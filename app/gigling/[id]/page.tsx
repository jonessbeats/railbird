// app/gigling/[id]/page.tsx
// Individual Gigling profile page — ELO, stat ranges, form history
import { notFound } from 'next/navigation'
import { fetchPetStats, fetchLeaderboard } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats, buildPetSnapshot } from '@/lib/model/infer'
import { weiToEth } from '@/lib/encode'
import { StatProfile } from '@/components/StatProfile'
import { RevealMeter } from '@/components/RevealMeter'
import type { ApiLeaderboardEntry } from '@/types/racing'

export const revalidate = 60

const RARITY_COLORS: Record<string, string> = {
  uncommon: 'text-slate-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
  relic: 'text-pink-400',
  giga: 'text-yellow-400',
}

export default async function GiglingProfilePage({ params }: { params: { id: string } }) {
  const petId = Number(params.id)

  if (isNaN(petId)) notFound()

  // Fetch pet stats and leaderboard in parallel
  let petStats, lbResult
  try {
    ;[petStats, lbResult] = await Promise.all([
      fetchPetStats(petId),
      fetchLeaderboard({ limit: 1000 }),
    ])
  } catch {
    notFound()
  }

  // Find this pet in the leaderboard (only way to get ELO, rarity, faction, stat ranges)
  const lbEntry: ApiLeaderboardEntry | undefined = lbResult.entries.find(e => e.petId === petId)

  // Build snapshot — either full (with leaderboard) or minimal (stats-only)
  const snapshot = lbEntry
    ? buildPetSnapshotWithStats(lbEntry, petStats)
    : buildPetSnapshot(petStats)

  const hasLeaderboardData = !!lbEntry

  const rarityColor = RARITY_COLORS[snapshot.rarity] ?? 'text-slate-400'

  // Derived stats from ApiPetStats (more accurate than history filter)
  const totalRaces = petStats.totalRaces
  const wins = petStats.wins
  const podiums = petStats.podiums
  const winRate = totalRaces > 0 ? wins / totalRaces : 0
  const podiumRate = totalRaces > 0 ? podiums / totalRaces : 0

  // Recent form from history (resolved races with rank)
  const recentForm = snapshot.history // already filtered to resolved + rank != null in buildPetSnapshot

  // Net ETH P&L
  const netEth = weiToEth(petStats.weiNet)
  const spentEth = weiToEth(petStats.weiSpent)
  const wonEth = weiToEth(petStats.weiWon)

  // Traits from leaderboard entry
  const traits = lbEntry?.racePublic?.traits ?? []

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">Gigling #{params.id}</h1>
          {!hasLeaderboardData && (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
              Not in top 1000
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {hasLeaderboardData ? (
            <>
              <span className={`font-medium capitalize ${rarityColor}`}>{snapshot.rarity}</span>
              <span className="text-slate-400 capitalize">{snapshot.faction}</span>
              <span className="text-slate-400 capitalize">{snapshot.gender}</span>
              <span className="text-slate-400">ELO {snapshot.elo}</span>
            </>
          ) : (
            <span className="text-slate-500 text-xs">Rarity/faction/ELO unavailable (not in leaderboard)</span>
          )}
          <span className="text-slate-500">{totalRaces} races total</span>
        </div>
      </div>

      {/* Reveal meter (leaderboard data only) */}
      {hasLeaderboardData && lbEntry && (
        <div className="mb-4">
          <RevealMeter pct={'revealPct' in snapshot ? (snapshot as { revealPct: number }).revealPct : 0} />
        </div>
      )}

      {/* Traits */}
      {traits.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {traits.map(t => (
            <span
              key={t.id}
              className={`text-xs px-2 py-0.5 rounded-full border ${
                t.tier === 1 ? 'border-yellow-600/50 text-yellow-400 bg-yellow-950/20'
                : t.tier === 2 ? 'border-purple-600/50 text-purple-400 bg-purple-950/20'
                : 'border-slate-700 text-slate-400 bg-slate-900/40'
              }`}
            >
              {t.name}{t.tier !== null ? ` T${t.tier}` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Stat ranges (leaderboard only) */}
        {hasLeaderboardData && lbEntry?.racePublic ? (
          <StatProfile
            startRange={lbEntry.racePublic.startRange}
            speedRange={lbEntry.racePublic.speedRange}
            staminaRange={lbEntry.racePublic.staminaRange}
            finishRange={lbEntry.racePublic.finishRange}
            racesRun={lbEntry.racePublic.racesRun}
            maxRaces={lbEntry.racePublic.maxRaces}
          />
        ) : (
          <div className="rounded-lg border border-slate-800 p-4 flex items-center justify-center">
            <p className="text-slate-500 text-sm text-center">
              Stat ranges unavailable — pet not in top-1000 leaderboard
            </p>
          </div>
        )}

        {/* Quick stats */}
        <div className="rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Quick Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Wins</span>
              <span className="font-mono">{wins} / {totalRaces}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Podiums</span>
              <span className="font-mono">{podiums} / {totalRaces}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Win Rate</span>
              <span className="font-mono text-emerald-400">{(winRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Podium Rate</span>
              <span className="font-mono text-blue-400">{(podiumRate * 100).toFixed(1)}%</span>
            </div>
            <div className="border-t border-slate-800 pt-2 mt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Spent</span>
                <span className="font-mono text-slate-400">{spentEth.toFixed(4)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Won</span>
                <span className="font-mono text-slate-400">{wonEth.toFixed(4)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Net P&L</span>
                <span className={`font-mono ${netEth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {netEth >= 0 ? '+' : ''}{netEth.toFixed(4)} ETH
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent form table */}
      {recentForm.length > 0 ? (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <div className="px-4 py-2 bg-slate-900/50 text-sm font-medium text-slate-300">
            Recent Form ({recentForm.length} races)
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-2 text-left text-xs text-slate-500 font-normal">Race</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-normal">Place</th>
                <th className="px-4 py-2 text-right text-xs text-slate-500 font-normal">Entry (ETH)</th>
                <th className="px-4 py-2 text-right text-xs text-slate-500 font-normal">Payout (ETH)</th>
              </tr>
            </thead>
            <tbody>
              {/* Use petStats.recent for full weiPayout data; rank is 0-indexed there */}
              {petStats.recent
                .filter(r => r.phase === 3 && r.rank !== null)
                .slice(0, 15)
                .map(r => {
                  const place = (r.rank ?? 0) + 1 // convert 0-indexed to 1-based
                  const entryEth = weiToEth(r.weiEntry)
                  const payoutEth = weiToEth(r.weiPayout)
                  const isWin = place === 1
                  const isPodium = place <= 3
                  return (
                    <tr key={r.raceId} className="border-t border-slate-800/50 hover:bg-slate-900/30">
                      <td className="px-4 py-2 font-mono text-slate-500 text-xs">
                        <a href={`/race/${r.raceId}`} className="hover:text-slate-300 transition-colors">
                          #{r.raceId}
                        </a>
                      </td>
                      <td className={`px-4 py-2 text-center font-bold ${
                        isWin ? 'text-yellow-400' : isPodium ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        #{place}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500 text-xs">
                        {entryEth > 0 ? entryEth.toFixed(4) : '—'}
                      </td>
                      <td className={`px-4 py-2 text-right font-mono text-xs ${
                        payoutEth > 0 ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {payoutEth > 0 ? payoutEth.toFixed(4) : '—'}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 p-6 text-center text-slate-500 text-sm">
          No recent race history available.
        </div>
      )}
    </div>
  )
}
