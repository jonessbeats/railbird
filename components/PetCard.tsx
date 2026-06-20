// components/PetCard.tsx
import Link from 'next/link'
import type { PetSnapshot, HandicapResult } from '@/types/racing'
import { OddsBar } from './OddsBar'
import { EdgeBadge } from './EdgeBadge'
import { RevealMeter } from './RevealMeter'

interface PetCardProps {
  pet: PetSnapshot
  h: HandicapResult
  rank?: number
}

const RARITY_COLORS: Record<string, string> = {
  uncommon: 'text-slate-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
  relic: 'text-pink-400',
  giga: 'text-yellow-400',
}

export function PetCard({ pet, h, rank }: PetCardProps) {
  const rarityColor = RARITY_COLORS[pet.rarity] ?? 'text-slate-400'
  const winCount = pet.history.filter(r => r.rank === 1).length

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      h.evEnter !== undefined && h.evEnter > 0
        ? 'border-emerald-600/50 bg-emerald-950/20'
        : 'border-slate-800 bg-slate-900/40'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <Link href={`/gigling/${pet.petId}`} className="hover:text-emerald-400 transition-colors">
            <span className="font-semibold">#{pet.petId}</span>
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-medium capitalize ${rarityColor}`}>{pet.rarity}</span>
            <span className="text-xs text-slate-500 capitalize">{pet.faction}</span>
            <span className="text-xs text-slate-500">{pet.gender}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {rank !== undefined && (
            <span className="text-xs text-slate-500">#{rank} seed</span>
          )}
          <EdgeBadge ev={h.evEnter} />
        </div>
      </div>

      <div className="mb-3">
        <OddsBar winProb={h.winProb} fairOdds={h.fairOdds} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
        <div>
          <div className="text-slate-500">ELO</div>
          <div className="font-mono text-slate-200">{pet.elo}</div>
        </div>
        <div>
          <div className="text-slate-500">Races</div>
          <div className="font-mono text-slate-200">{pet.racesRun}</div>
        </div>
        <div>
          <div className="text-slate-500">Wins</div>
          <div className="font-mono text-slate-200">{winCount}</div>
        </div>
      </div>

      <RevealMeter pct={h.revealPct} />
    </div>
  )
}
