import Link from 'next/link'
import { fetchRaces } from '@/lib/api/gigaverse'
import { enrichRaces } from '@/lib/enrichRaces'
import { weiToEth } from '@/lib/encode'
import { classifyTrack } from '@/lib/model/trackAffinity'

// ISR: cached HTML served instantly, background-revalidated every 15s.
export const revalidate = 15

const TYPE_STYLE = {
  edge:      { label: 'EDGE',     color: 'neon-green',  border: 'border-neon-green/40',  bg: 'bg-neon-green/5'  },
  walkover:  { label: 'WALKOVER', color: 'neon-cyan',   border: 'border-neon-cyan/40',   bg: 'bg-neon-cyan/5'   },
}

const CONF_COLOR = {
  high:   'neon-green',
  medium: 'neon-gold',
  low:    'text-game-muted',
}

const TRACK_LABEL = { SPRINT: 'SPR', MID: 'MID', STAMINA: 'STA' }

export default async function ValueFeedPage() {
  let enriched: Awaited<ReturnType<typeof enrichRaces>> = []
  try {
    const all = await fetchRaces(50)
    enriched = await enrichRaces(all)
  } catch {
    // show empty state
  }

  // Only EDGE and WALKOVER, sorted by EV descending (EDGE first, then WALKOVER)
  const valueRaces = enriched
    .filter(r => r.analysis.type === 'edge' || r.analysis.type === 'walkover')
    .sort((a, b) => {
      const evA = a.analysis.valuePlay?.evEth ?? -1
      const evB = b.analysis.valuePlay?.evEth ?? -1
      return evB - evA
    })

  const edgeCount    = valueRaces.filter(r => r.analysis.type === 'edge').length
  const walkoverCount = valueRaces.filter(r => r.analysis.type === 'walkover').length
  const totalEv      = valueRaces.reduce((s, r) => s + (r.analysis.valuePlay?.evEth ?? 0), 0)

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="mb-6 border-b border-game-border pb-4">
        <p className="text-[10px] text-game-muted uppercase tracking-widest mb-1">// value feed</p>
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-bold tracking-widest uppercase neon-green">+EV Races</h1>
          <div className="flex items-center gap-4 text-xs text-game-muted uppercase tracking-widest">
            {edgeCount > 0 && (
              <span><span className="neon-green font-bold">{edgeCount}</span> edge</span>
            )}
            {walkoverCount > 0 && (
              <span><span className="neon-cyan font-bold">{walkoverCount}</span> walkover</span>
            )}
            {totalEv > 0 && (
              <span>total EV <span className="neon-gold font-bold">+{(totalEv * 100).toFixed(1)}%</span></span>
            )}
          </div>
        </div>
      </div>

      {valueRaces.length === 0 ? (
        <div className="retro-panel p-16 text-center">
          <div className="text-game-muted text-xs uppercase tracking-widest mb-2">
            [ No value in current market ]
          </div>
          <div className="text-[10px] text-game-muted uppercase tracking-widest mt-4">
            All open races are either contested, open, or have insufficient data.
          </div>
          <Link
            href="/"
            className="inline-block mt-6 px-4 py-2 text-[10px] uppercase tracking-widest border border-game-border text-game-muted hover:border-neon-green/40 hover:neon-green transition-colors pixel"
          >
            ← Back to Lobby
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {valueRaces.map(({ race, handicaps, pets, analysis }) => {
            const sorted       = [...handicaps].sort((a, b) => b.winProb - a.winProb)
            const topH         = sorted[0]
            const topPet       = topH ? pets.find(p => p.petId === topH.petId) : null
            const vp           = analysis.valuePlay
            const entryFeeEth  = weiToEth(race.entryFee)
            const prizePoolEth = weiToEth(race.pool)
            const trackType    = classifyTrack(race.trackLength)
            const style        = TYPE_STYLE[analysis.type as keyof typeof TYPE_STYLE]
            const fillPct      = race.fieldSize > 0 ? Math.round((race.petCount / race.fieldSize) * 100) : 0

            return (
              <Link key={race.raceId} href={`/race/${race.raceId}`} className="block group">
                <div className={`retro-panel overflow-hidden transition-all group-hover:border-neon-green/30 ${style?.bg ?? ''}`}>
                  <div className="px-4 py-3 flex items-center gap-4">

                    {/* Analysis type badge */}
                    <div className="shrink-0 w-20">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 pixel border ${style?.color ?? 'text-game-muted'} ${style?.border ?? 'border-game-border'}`}>
                        {style?.label ?? analysis.type.toUpperCase()}
                      </span>
                    </div>

                    {/* Race ID + track */}
                    <div className="shrink-0 w-28">
                      <div className="text-xs font-bold font-mono tracking-wider">#{race.raceId}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-game-muted uppercase tracking-widest">
                          {race.trackLength}m
                        </span>
                        <span className="text-[9px] text-game-muted uppercase tracking-widest">
                          {TRACK_LABEL[trackType]}
                        </span>
                      </div>
                    </div>

                    {/* Top pick */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-game-muted uppercase tracking-widest mb-0.5">Top Pick</div>
                      {topPet && topH ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono">#{topPet.petId}</span>
                          <span className="text-[10px] text-game-muted uppercase tracking-widest">{topPet.rarity}</span>
                          <span className="text-[10px] text-game-muted uppercase tracking-widest">ELO {topPet.elo}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-game-muted">—</span>
                      )}
                    </div>

                    {/* Win probability */}
                    {topH && (
                      <div className="shrink-0 text-right w-16">
                        <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Win%</div>
                        <div className="text-sm font-bold neon-cyan font-mono">
                          {(topH.winProb * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}

                    {/* EV */}
                    <div className="shrink-0 text-right w-20">
                      <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">EV</div>
                      {vp ? (
                        <div className="text-sm font-bold neon-green font-mono">
                          +{(vp.evEth * 100).toFixed(1)}%
                        </div>
                      ) : (
                        <div className="text-[10px] text-game-muted">—</div>
                      )}
                    </div>

                    {/* Confidence */}
                    <div className="shrink-0 text-right w-14">
                      <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Data</div>
                      <div className={`text-[10px] font-bold uppercase tracking-widest ${CONF_COLOR[analysis.confidence]}`}>
                        {analysis.confidence}
                      </div>
                    </div>

                    {/* Entry + pool */}
                    <div className="shrink-0 text-right w-24 hidden sm:block">
                      <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">
                        {entryFeeEth > 0 ? 'Entry' : 'Free'}
                      </div>
                      <div className="text-[10px] font-bold font-mono">
                        {entryFeeEth > 0
                          ? <span className="neon-gold">{entryFeeEth.toFixed(4)} ETH</span>
                          : <span className="neon-green">FREE</span>}
                      </div>
                      <div className="text-[9px] text-game-muted font-mono mt-0.5">
                        pool {prizePoolEth.toFixed(3)} ETH
                      </div>
                    </div>

                    {/* Fill bar */}
                    <div className="shrink-0 w-16 hidden md:block">
                      <div className="text-[9px] text-game-muted uppercase tracking-widest mb-1">
                        {race.petCount}/{race.fieldSize}
                      </div>
                      <div className="h-1 bg-game-border overflow-hidden">
                        <div
                          className="h-full bg-neon-cyan"
                          style={{ width: `${fillPct}%`, boxShadow: '0 0 3px rgba(0,207,255,0.4)' }}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 text-game-muted text-[10px] tracking-widest">›</div>
                  </div>

                  {/* One-liner analysis */}
                  <div className="px-4 pb-2.5 border-t border-game-border/30">
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${style?.color ?? 'text-game-muted'}`}>
                      {analysis.oneliner}
                    </span>
                    {analysis.factors[0] && (
                      <span className="text-[10px] text-game-muted ml-3">· {analysis.factors[0]}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-[10px] text-game-muted uppercase tracking-widest hover:neon-green transition-colors"
        >
          ← All open races
        </Link>
      </div>
    </div>
  )
}
