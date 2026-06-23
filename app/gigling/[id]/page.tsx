// app/gigling/[id]/page.tsx
import { notFound } from 'next/navigation'
import { fetchPetStats, fetchPetLeaderboardEntry, fetchRaces } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats, buildPetSnapshot } from '@/lib/model/infer'
import { weiToEth } from '@/lib/encode'
import { StatProfile } from '@/components/StatProfile'
import { TrackAffinityBadge } from '@/components/TrackAffinityBadge'
import { SaveMyPet } from '@/components/SaveMyPet'
import { computeTrackAffinity } from '@/lib/model/trackAffinity'
import { classifyTrack } from '@/lib/model/trackAffinity'
import type { ApiLeaderboardEntry } from '@/types/racing'

export const dynamic = 'force-dynamic'

const RARITY_STYLE: Record<string, string> = {
  uncommon:  'text-[#d0d0e8]  border-[#d0d0e8]/30',
  rare:      'neon-cyan       border-neon-cyan/40',
  epic:      'text-[#b06aff]  border-[#b06aff]/40',
  legendary: 'neon-gold       border-neon-gold/40',
  relic:     'neon-pink       border-neon-pink/40',
  giga:      'neon-gold       border-neon-gold/60',
}

const TRAIT_STYLE: Record<number, string> = {
  1: 'neon-gold   border-neon-gold/40   bg-neon-gold/5',
  2: 'text-[#b06aff] border-[#b06aff]/40 bg-[#b06aff]/5',
}

export default async function GiglingProfilePage({ params }: { params: { id: string } }) {
  const petId = Number(params.id)
  if (isNaN(petId)) notFound()

  let petStats: Awaited<ReturnType<typeof fetchPetStats>>
  let lbEntry: ApiLeaderboardEntry | null = null
  let activeRaces: Awaited<ReturnType<typeof fetchRaces>> = []
  try {
    ;[petStats, lbEntry, activeRaces] = await Promise.all([
      fetchPetStats(petId),
      fetchPetLeaderboardEntry(petId).catch(() => null),
      fetchRaces(50).catch(() => []),
    ])
  } catch {
    notFound()
  }

  const myRaces = activeRaces.filter(
    r => r.phaseName === 'OPEN' && r.entries.some(e => e.petId === petId)
  )
  const snapshot = lbEntry
    ? buildPetSnapshotWithStats(lbEntry, petStats)
    : buildPetSnapshot(petStats)
  const hasLeaderboardData = !!lbEntry

  const totalRaces = petStats.totalRaces
  const wins       = petStats.wins
  const podiums    = petStats.podiums
  const winRate    = totalRaces > 0 ? wins / totalRaces : 0
  const podiumRate = totalRaces > 0 ? podiums / totalRaces : 0
  const netEth     = weiToEth(petStats.weiNet)
  const spentEth   = weiToEth(petStats.weiSpent)
  const wonEth     = weiToEth(petStats.weiWon)
  const traits     = lbEntry?.racePublic?.traits ?? []

  const rarityStyle = RARITY_STYLE[snapshot.rarity] ?? 'text-[#d0d0e8] border-game-border'
  const affinityData = hasLeaderboardData
    ? computeTrackAffinity(snapshot as Parameters<typeof computeTrackAffinity>[0])
    : null

  return (
    <div className="max-w-2xl">
      {/* ── PROFILE HEADER ── */}
      <div className="mb-6 retro-panel overflow-hidden">
        <div className="px-4 py-2 bg-game-panel border-b border-game-border flex items-center justify-between">
          <span className="text-[10px] text-game-muted uppercase tracking-widest">// gigling profile</span>
          <div className="flex items-center gap-2">
            {!hasLeaderboardData && (
              <span className="text-[10px] text-game-muted uppercase tracking-widest px-2 py-0.5 border border-game-border pixel">
                unranked
              </span>
            )}
            <SaveMyPet petId={petId} />
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="text-[10px] text-game-muted uppercase tracking-widest mb-0.5">Gigling ID</div>
          <h1 className="text-3xl font-bold tracking-widest neon-cyan mb-3">#{params.id}</h1>

          {hasLeaderboardData ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 pixel border capitalize ${rarityStyle}`}>
                {snapshot.rarity}
              </span>
              <span className="text-[10px] text-game-muted uppercase tracking-widest capitalize">{snapshot.faction}</span>
              <span className="text-[10px] text-game-muted uppercase tracking-widest capitalize">{snapshot.gender}</span>
              <span className="text-[10px] uppercase tracking-widest ml-auto">
                ELO <span className="neon-cyan font-bold">{snapshot.elo}</span>
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-game-muted uppercase tracking-widest">
              Rarity · faction · ELO unavailable (not in leaderboard)
            </span>
          )}
        </div>
      </div>

      {/* ── LIVE RACES ── */}
      {myRaces.length > 0 && (
        <div className="mb-6 retro-panel overflow-hidden">
          <div className="px-4 py-2 bg-game-panel border-b border-game-border flex items-center justify-between">
            <span className="text-[10px] text-game-muted uppercase tracking-widest">Live Races</span>
            <span className="flex items-center gap-1.5 text-[10px] neon-green font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green blink inline-block" />
              {myRaces.length} active
            </span>
          </div>
          <div className="divide-y divide-game-border/40">
            {myRaces.map(r => {
              const trackType = classifyTrack(r.trackLength)
              const entryFee  = weiToEth(r.entryFee)
              const pool      = weiToEth(r.pool)
              const TRACK_LABEL: Record<string, string> = { SPRINT: 'SPR', MID: 'MID', STAMINA: 'STA' }
              return (
                <a key={r.raceId} href={`/race/${r.raceId}`} className="block px-4 py-3 hover:bg-game-panel/60 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold font-mono">Race #{r.raceId}</span>
                        <span className="text-[10px] text-game-muted uppercase tracking-widest">{r.trackLength}m {TRACK_LABEL[trackType]}</span>
                        <span className="text-[10px] text-game-muted uppercase tracking-widest">
                          {r.petCount}/{r.fieldSize} filled
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-game-muted uppercase tracking-widest">
                        <span>
                          Entry: {entryFee > 0
                            ? <span className="neon-gold font-bold">{entryFee.toFixed(4)} ETH</span>
                            : <span className="neon-green font-bold">FREE</span>}
                        </span>
                        <span>Pool: <span className="font-bold">{pool.toFixed(4)} ETH</span></span>
                      </div>
                    </div>
                    <span className="text-[10px] neon-green uppercase tracking-widest group-hover:underline shrink-0">
                      View odds →
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TRAITS ── */}
      {traits.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {traits.map(t => {
            const ts = TRAIT_STYLE[t.tier ?? 0] ?? 'text-game-muted border-game-border bg-transparent'
            return (
              <span key={t.id} className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 pixel border ${ts}`}>
                {t.name}{t.tier !== null ? ` T${t.tier}` : ''}
              </span>
            )
          })}
        </div>
      )}

      {/* ── TRACK AFFINITY ── */}
      {affinityData && (
        <div className="mb-6 retro-panel p-4">
          <TrackAffinityBadge affinity={affinityData} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Stat profile */}
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
          <div className="retro-panel p-4 flex items-center justify-center">
            <p className="text-[10px] text-game-muted uppercase tracking-widest text-center">
              Stat ranges unavailable
            </p>
          </div>
        )}

        {/* Performance stats */}
        <div className="retro-panel overflow-hidden">
          <div className="px-4 py-2 bg-game-panel border-b border-game-border">
            <span className="text-[10px] text-game-muted uppercase tracking-widest">Performance</span>
          </div>
          <div className="divide-y divide-game-border/40">
            <div className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Wins</span>
              <span className="text-xs font-bold font-mono">
                <span className="neon-green">{wins}</span>
                <span className="text-game-muted"> / {totalRaces}</span>
              </span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Podiums</span>
              <span className="text-xs font-bold font-mono">
                <span className="neon-cyan">{podiums}</span>
                <span className="text-game-muted"> / {totalRaces}</span>
              </span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Win Rate</span>
              <span className="text-xs font-bold font-mono neon-green">{(winRate * 100).toFixed(1)}%</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Podium Rate</span>
              <span className="text-xs font-bold font-mono neon-cyan">{(podiumRate * 100).toFixed(1)}%</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center border-t border-game-border">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Spent</span>
              <span className="text-xs font-mono text-game-muted">{spentEth.toFixed(4)} ETH</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Won</span>
              <span className="text-xs font-mono text-game-muted">{wonEth.toFixed(4)} ETH</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Net P&amp;L</span>
              <span className={`text-xs font-bold font-mono ${netEth >= 0 ? 'neon-green' : 'neon-pink'}`}>
                {netEth >= 0 ? '+' : ''}{netEth.toFixed(4)} ETH
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RECENT FORM TABLE ── */}
      {(() => {
        const rows = petStats.recent.filter(r => r.phase === 3 && r.rank !== null).slice(0, 15)
        if (rows.length === 0) return (
          <div className="retro-panel p-6 text-center text-game-muted text-xs uppercase tracking-widest">
            [ No recent race history ]
          </div>
        )
        return (
          <div className="retro-panel overflow-hidden">
            <div className="px-4 py-2 bg-game-panel border-b border-game-border flex items-center justify-between">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Recent Form</span>
              <span className="text-[10px] neon-cyan font-bold">{rows.length} races</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-game-border">
                  <th className="px-4 py-2 text-left text-[10px] text-game-muted font-normal uppercase tracking-widest">Race</th>
                  <th className="px-4 py-2 text-center text-[10px] text-game-muted font-normal uppercase tracking-widest">Place</th>
                  <th className="px-4 py-2 text-right text-[10px] text-game-muted font-normal uppercase tracking-widest">Entry</th>
                  <th className="px-4 py-2 text-right text-[10px] text-game-muted font-normal uppercase tracking-widest">Payout</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const place     = (r.rank ?? 0) + 1
                  const entryEth  = weiToEth(r.weiEntry)
                  const payoutEth = weiToEth(r.weiPayout)
                  const isWin     = place === 1
                  const isPodium  = place <= 3
                  return (
                    <tr key={r.raceId} className="border-t border-game-border/40 hover:bg-game-panel/60 transition-colors">
                      <td className="px-4 py-2.5">
                        <a href={`/race/${r.raceId}`} className="text-[11px] font-mono text-game-muted hover:neon-cyan transition-colors">
                          #{r.raceId}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                          isWin ? 'neon-gold' : isPodium ? 'neon-green' : 'text-game-muted'
                        }`}>
                          {isWin ? '1ST' : place === 2 ? '2ND' : place === 3 ? '3RD' : `#${place}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[11px] font-mono text-game-muted">
                        {entryEth > 0 ? entryEth.toFixed(4) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-[11px] font-bold font-mono ${
                        payoutEth > 0 ? 'neon-green' : 'text-game-muted'
                      }`}>
                        {payoutEth > 0 ? payoutEth.toFixed(4) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}
    </div>
  )
}
