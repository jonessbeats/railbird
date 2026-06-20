import Link from 'next/link'
import type { ApiRaceSummary, HandicapResult, PetSnapshot } from '@/types/racing'
import { weiToEth } from '@/lib/encode'
import { EdgeBadge } from './EdgeBadge'
import { WeatherIcon } from './WeatherIcon'

interface RaceCardProps {
  race: ApiRaceSummary
  handicaps?: HandicapResult[]
  pets?: PetSnapshot[]
}

export function RaceCard({ race, handicaps, pets }: RaceCardProps) {
  const weather = race.raceTemp
  const sorted = handicaps ? [...handicaps].sort((a, b) => b.winProb - a.winProb) : []
  const top = sorted[0]
  const second = sorted[1]
  const hasEdge = sorted.some(h => (h.evEnter ?? -1) > 0)
  const fee = weiToEth(race.entryFee)

  return (
    <Link href={`/race/${race.raceId}`}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-600 hover:bg-slate-900/60 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-xs text-slate-500 font-mono">#{race.raceId}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-medium">{race.trackLength}m</span>
              {weather && <WeatherIcon weather={weather} />}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {hasEdge && <EdgeBadge ev={top?.evEnter} />}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              race.phaseName === 'OPEN'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-700 text-slate-400'
            }`}>{race.phaseName}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-slate-400">
            {race.petCount}/{race.fieldSize} filled
          </span>
          <span className="text-slate-300 font-mono">
            {fee > 0 ? `${fee.toFixed(4)} ETH` : 'Free'}
          </span>
        </div>

        {top && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Favorites</span>
            </div>
            {[top, second].filter(Boolean).map(h => {
              const pet = pets?.find(p => p.petId === h.petId)
              return (
                <div key={h.petId} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    {pet ? `#${pet.petId} (${pet.rarity})` : `Pet #${h.petId}`}
                  </span>
                  <span className="text-emerald-400 font-mono">{(h.winProb * 100).toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Link>
  )
}
