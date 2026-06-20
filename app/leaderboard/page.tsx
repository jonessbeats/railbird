// app/leaderboard/page.tsx
import type { ApiLeaderboardEntry } from '@/types/racing'
import { fetchLeaderboard } from '@/lib/api/gigaverse'
import Link from 'next/link'

export const revalidate = 120

const RARITY_COLORS: Record<string, string> = {
  giga: 'text-yellow-400',
  relic: 'text-pink-400',
  legendary: 'text-orange-400',
  epic: 'text-purple-400',
  rare: 'text-blue-400',
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const page = Number(searchParams.page ?? 1)
  const limit = 50
  const offset = (page - 1) * limit

  let entries: ApiLeaderboardEntry[] = []
  let hasMore = false
  let total = 0

  try {
    const data = await fetchLeaderboard({
      limit,
      offset,
    })
    entries = data.entries
    hasMore = data.hasMore
    // Calculate approximate total based on rank of first entry + hasMore
    if (entries.length > 0) {
      total = hasMore ? offset + entries.length + 1 : offset + entries.length
    }
  } catch (e) {
    console.error('Leaderboard fetch failed:', e)
  }

  const getRarityColor = (rarityName: string): string => {
    const key = rarityName?.toLowerCase() ?? ''
    return RARITY_COLORS[key] ?? 'text-slate-400'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">ELO Leaderboard</h1>
        <p className="text-slate-500 text-sm">
          {total > 0 ? `${total}+ Giglings ranked` : 'Giglings ranked'}
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-normal w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-normal">
                  Pet
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-normal">
                  Rarity
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-normal">
                  Faction
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-400 font-normal">
                  ELO
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-400 font-normal">
                  Races
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-400 font-normal">
                  Win Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const winRate =
                  entry.racesRun > 0
                    ? ((entry.wins / entry.racesRun) * 100).toFixed(1)
                    : '0.0'

                return (
                  <tr
                    key={entry.petId}
                    className="border-t border-slate-800/50 hover:bg-slate-900/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {offset + i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/gigling/${entry.petId}`}
                        className="hover:text-emerald-400 transition-colors font-medium"
                      >
                        #{entry.petId}
                      </Link>
                    </td>
                    <td
                      className={`px-4 py-3 text-xs font-semibold ${getRarityColor(
                        entry.rarityName
                      )}`}
                    >
                      {entry.rarityName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {entry.factionName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">
                      {entry.elo}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {entry.racesRun}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {winRate}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {(hasMore || page > 1) && (
          <div className="px-4 py-3 border-t border-slate-800 flex justify-between text-sm text-slate-400">
            {page > 1 ? (
              <Link
                href={`/leaderboard?page=${page - 1}`}
                className="hover:text-slate-200 transition-colors"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span>Page {page}</span>
            {hasMore ? (
              <Link
                href={`/leaderboard?page=${page + 1}`}
                className="hover:text-slate-200 transition-colors"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
