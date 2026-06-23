import Link from 'next/link'
import type { ApiRaceSummary, HandicapResult } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'
import type { RaceAnalysis } from '@/lib/model/analyze'
import { weiToEth } from '@/lib/encode'
import { EdgeBadge } from './EdgeBadge'
import { WeatherIcon } from './WeatherIcon'
import { FormString } from './FormString'
import { MyPetInRace } from './MyPetInRace'

interface RaceCardProps {
  race: ApiRaceSummary
  handicaps?: HandicapResult[]
  pets?: PetSnapshotWithStats[]
  analysis?: RaceAnalysis
}

const ANALYSIS_COLOR: Record<string, string> = {
  edge:         'neon-green',
  walkover:     'neon-cyan',
  contested:    'neon-gold',
  open:         'text-game-muted',
  insufficient: 'text-game-muted',
}

export function RaceCard({ race, handicaps, pets, analysis }: RaceCardProps) {
  const weather  = race.raceTemp
  const sorted   = handicaps ? [...handicaps].sort((a, b) => b.winProb - a.winProb) : []
  const top      = sorted[0]
  const second   = sorted[1]
  const hasEdge  = analysis?.type === 'edge'
  const fee      = weiToEth(race.entryFee)

  return (
    <Link href={`/race/${race.raceId}`} className="block cursor-pointer group">
      <div className={`p-4 transition-all duration-200 ${
        hasEdge ? 'retro-panel-edge hover:bg-neon-green/5' : 'retro-panel hover:border-game-muted'
      }`}>

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-[10px] text-game-muted uppercase tracking-widest">Race</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold tracking-wider">#{race.raceId}</span>
              <MyPetInRace petIds={race.entries.map(e => e.petId)} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-game-muted">{race.trackLength}m</span>
              {weather && <WeatherIcon weather={weather} />}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold pixel ${
              race.phaseName === 'OPEN'
                ? 'bg-neon-green/10 text-neon-green border border-neon-green/40'
                : 'bg-game-panel text-game-muted border border-game-border'
            }`}>{race.phaseName}</span>
            {hasEdge && <EdgeBadge ev={top?.evEnter} />}
          </div>
        </div>

        {/* Fill / fee */}
        <div className="flex items-center justify-between text-xs mb-3 border-t border-game-border/50 pt-3">
          <span className="text-game-muted uppercase tracking-widest">
            {race.petCount}/{race.fieldSize} filled
          </span>
          <span className="font-bold tracking-wider">
            {fee > 0 ? `${fee.toFixed(4)} ETH` : 'FREE'}
          </span>
        </div>

        {/* Analysis one-liner */}
        {analysis && analysis.type !== 'insufficient' && (
          <div className={`text-[10px] uppercase tracking-widest font-bold mb-3 ${ANALYSIS_COLOR[analysis.type]}`}>
            {analysis.oneliner}
          </div>
        )}

        {/* Favorites */}
        {top && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-game-muted uppercase tracking-widest mb-1">Favorites</div>
            {[top, second].filter(Boolean).map(h => {
              const pet = pets?.find(p => p.petId === h.petId)
              const pct = (h.winProb * 100).toFixed(1)
              return (
                <div key={h.petId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-[#d0d0e8]">
                      {pet ? `#${pet.petId} ${pet.rarity}` : `#${h.petId}`}
                    </span>
                    <div className="flex items-center gap-2 flex-1 max-w-[120px]">
                      <div className="flex-1 h-1 bg-game-border pixel overflow-hidden">
                        <div
                          className="h-full bg-neon-green"
                          style={{ width: `${pct}%`, boxShadow: '0 0 4px rgba(0,255,136,0.5)' }}
                        />
                      </div>
                      <span className="neon-green text-[11px] font-bold w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                  {pet && pet.history.length > 0 && (
                    <FormString history={pet.history} max={6} showLabel={false} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Link>
  )
}
