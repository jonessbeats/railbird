'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useStable } from '@/lib/stable'
import type { MyRaceProjection, PetProjections } from '@/app/api/my-races/route'

const POLL_MS = 30_000

interface BestPlay extends MyRaceProjection {
  petId: number
}

type ProjMap = Map<number, BestPlay>   // raceId → best play across the stable

const Ctx = createContext<ProjMap>(new Map())

const TIER = { in: 0, enter: 1, contender: 2, skip: 3 }

/** Fetches the whole stable's projections across open races; keeps the best play per race. */
export function MyPetLobbyProvider({ children }: { children: React.ReactNode }) {
  const { pets } = useStable()
  const [map, setMap] = useState<ProjMap>(new Map())

  useEffect(() => {
    if (pets.length === 0) { setMap(new Map()); return }

    let alive = true
    const load = async () => {
      try {
        const res  = await fetch(`/api/my-races?petIds=${pets.join(',')}`)
        const json = await res.json() as { pets?: PetProjections[]; races?: MyRaceProjection[]; petId?: number }
        const groups: PetProjections[] = json.pets
          ?? (json.races && json.petId ? [{ petId: json.petId, races: json.races, notFound: false }] : [])
        if (!alive) return

        const best: ProjMap = new Map()
        for (const g of groups) {
          for (const r of g.races) {
            if (r.recommend === 'skip') continue
            const existing = best.get(r.raceId)
            const better = !existing
              || TIER[r.recommend] < TIER[existing.recommend]
              || (TIER[r.recommend] === TIER[existing.recommend] && r.winProb > existing.winProb)
            if (better) best.set(r.raceId, { ...r, petId: g.petId })
          }
        }
        setMap(best)
      } catch { /* keep previous */ }
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [pets.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={map}>{children}</Ctx.Provider>
}

const REC = {
  in:        { color: '#00cfff', glow: 'rgba(0,207,255,0.25)', label: 'YOU’RE IN' },
  enter:     { color: '#00ff88', glow: 'rgba(0,255,136,0.25)', label: 'ENTER'     },
  contender: { color: '#ffd700', glow: 'rgba(255,215,0,0.22)', label: 'GOOD SHOT' },
}

/** Wraps a RaceCard; adds a glow ring + corner badge for the best stable pet here. */
export function MyPetCardWrap({ raceId, children }: { raceId: number; children: React.ReactNode }) {
  const proj = useContext(Ctx).get(raceId)
  if (!proj || proj.recommend === 'skip') return <>{children}</>

  const style  = REC[proj.recommend as keyof typeof REC] ?? REC.contender
  const winPct = (proj.winProb * 100).toFixed(0)
  const hasEv  = proj.evEth !== null && proj.evEth > 0

  return (
    <div
      className="relative rounded-sm transition-all"
      style={{ boxShadow: `0 0 0 1.5px ${style.color}, 0 0 18px ${style.glow}` }}
    >
      <div
        className="absolute -top-2.5 right-3 z-20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest pixel border flex items-center gap-1"
        style={{ background: '#0a0a0f', borderColor: style.color, color: style.color }}
      >
        <span>◉ #{proj.petId}</span>
        <span className="opacity-80">· {style.label}</span>
        {proj.provisional
          ? <span className="opacity-80">· FILLING {proj.fieldSize}/{proj.fieldCap}</span>
          : <>
              <span className="opacity-80">· {winPct}%</span>
              {hasEv && <span className="opacity-80">· +EV</span>}
            </>}
      </div>
      {children}
    </div>
  )
}
