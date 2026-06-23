import Link from 'next/link'
import type { HandicapResult } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'
import { OddsBar } from './OddsBar'
import { EdgeBadge } from './EdgeBadge'
import { RevealMeter } from './RevealMeter'
import { FormString } from './FormString'
import { TrackAffinityBadge } from './TrackAffinityBadge'
import { computeTrackAffinity } from '@/lib/model/trackAffinity'
import type { TrackType } from '@/lib/model/trackAffinity'

interface PetCardProps {
  pet: PetSnapshotWithStats
  h: HandicapResult
  rank?: number
  raceTrackType?: TrackType
}

const RARITY_STYLE: Record<string, string> = {
  uncommon:  'text-[#d0d0e8]  border-[#d0d0e8]/30',
  rare:      'neon-cyan       border-neon-cyan/40',
  epic:      'text-[#b06aff]  border-[#b06aff]/40',
  legendary: 'neon-gold       border-neon-gold/40',
  relic:     'neon-pink       border-neon-pink/40',
  giga:      'neon-gold       border-neon-gold/60',
}

export function PetCard({ pet, h, rank, raceTrackType }: PetCardProps) {
  const rarityStyle = RARITY_STYLE[pet.rarity] ?? 'text-[#d0d0e8] border-game-border'
  const isEdge = h.evEnter !== undefined && h.evEnter > 0
  const affinity = computeTrackAffinity(pet)

  return (
    <div className={`p-4 transition-all ${isEdge ? 'retro-panel-edge' : 'retro-panel'}`}>

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <Link
            href={`/gigling/${pet.petId}`}
            className="font-bold text-sm tracking-wider hover:neon-green transition-colors cursor-pointer"
          >
            #{pet.petId}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 pixel border ${rarityStyle}`}>
              {pet.rarity}
            </span>
            <span className="text-[10px] text-game-muted uppercase tracking-widest">{pet.faction}</span>
            <TrackAffinityBadge affinity={affinity} currentTrack={raceTrackType} compact />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {rank !== undefined && (
            <span className="text-[10px] text-game-muted uppercase tracking-widest">#{rank} seed</span>
          )}
          <EdgeBadge ev={h.evEnter} />
        </div>
      </div>

      {/* Win prob bar */}
      <div className="mb-3">
        <OddsBar winProb={h.winProb} fairOdds={h.fairOdds} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1 text-center mb-3 border border-game-border/50 divide-x divide-game-border/50">
        <div className="py-2">
          <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">ELO</div>
          <div className="text-xs font-bold neon-cyan">{pet.elo}</div>
        </div>
        <div className="py-2">
          <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Races</div>
          <div className="text-xs font-bold">{pet.racesRun}</div>
        </div>
        <div className="py-2">
          <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Wins</div>
          <div className="text-xs font-bold neon-green">{pet.wins}</div>
        </div>
      </div>

      {pet.history.length > 0 && (
        <div className="mb-3">
          <FormString history={pet.history} />
        </div>
      )}

      <div className="mb-3">
        <TrackAffinityBadge affinity={affinity} currentTrack={raceTrackType} />
      </div>

      <RevealMeter pct={h.revealPct} />
    </div>
  )
}
