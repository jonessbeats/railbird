import type { ApiLeaderboardEntry } from '@/types/racing'
import { fetchLeaderboard } from '@/lib/api/gigaverse'
import Link from 'next/link'

export const revalidate = 120

const RARITY_CLASS: Record<string, string> = {
  giga:      'neon-gold',
  relic:     'neon-pink',
  legendary: 'neon-gold',
  epic:      'text-[#b06aff]',
  rare:      'neon-cyan',
}

const RANK_CLASS: Record<number, string> = {
  1: 'neon-gold',
  2: 'text-[#c0c0c0]',
  3: 'text-[#cd7f32]',
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
    const data = await fetchLeaderboard({ limit, offset })
    entries = data.entries
    hasMore = data.hasMore
    if (entries.length > 0) {
      total = hasMore ? offset + entries.length + 1 : offset + entries.length
    }
  } catch (e) {
    console.error('Leaderboard fetch failed:', e)
  }

  const getRarityClass = (rarityName: string) =>
    RARITY_CLASS[rarityName?.toLowerCase() ?? ''] ?? 'text-[#d0d0e8]'

  return (
    <div>
      {/* Header */}
      <div className="mb-8 border-b border-game-border pb-4">
        <p className="text-[10px] text-game-muted uppercase tracking-widest mb-1">// rankings</p>
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-bold tracking-widest uppercase">ELO Leaderboard</h1>
          <span className="text-xs text-game-muted uppercase tracking-widest">
            <span className="neon-cyan font-bold">{total > 0 ? `${total}+` : '—'}</span> giglings
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="retro-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-game-border bg-game-panel">
                {['#', 'Pet', 'Rarity', 'Faction', 'ELO', 'Races', 'Win%'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[10px] text-game-muted font-normal uppercase tracking-widest ${i >= 4 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const rank = offset + i + 1
                const rankClass = RANK_CLASS[rank] ?? 'text-game-muted'
                const winRate = entry.racesRun > 0
                  ? ((entry.wins / entry.racesRun) * 100).toFixed(1)
                  : '0.0'

                return (
                  <tr
                    key={entry.petId}
                    className="border-t border-game-border/40 hover:bg-game-panel transition-colors"
                  >
                    <td className={`px-4 py-3 font-bold ${rankClass}`}>{rank}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/gigling/${entry.petId}`}
                        className="hover:neon-green transition-colors font-bold tracking-wider cursor-pointer"
                      >
                        #{entry.petId}
                      </Link>
                    </td>
                    <td className={`px-4 py-3 font-bold uppercase tracking-widest ${getRarityClass(entry.rarityName)}`}>
                      {entry.rarityName}
                    </td>
                    <td className="px-4 py-3 text-game-muted uppercase tracking-widest">
                      {entry.factionName}
                    </td>
                    <td className="px-4 py-3 text-right font-bold neon-cyan">{entry.elo}</td>
                    <td className="px-4 py-3 text-right text-game-muted">{entry.racesRun}</td>
                    <td className="px-4 py-3 text-right font-bold neon-green">{winRate}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(hasMore || page > 1) && (
          <div className="px-4 py-3 border-t border-game-border flex justify-between text-xs text-game-muted uppercase tracking-widest">
            {page > 1 ? (
              <Link href={`/leaderboard?page=${page - 1}`} className="hover:text-[#d0d0e8] transition-colors cursor-pointer">
                ← Prev
              </Link>
            ) : <span />}
            <span>Page <span className="neon-cyan font-bold">{page}</span></span>
            {hasMore ? (
              <Link href={`/leaderboard?page=${page + 1}`} className="hover:text-[#d0d0e8] transition-colors cursor-pointer">
                Next →
              </Link>
            ) : <span />}
          </div>
        )}
      </div>
    </div>
  )
}
