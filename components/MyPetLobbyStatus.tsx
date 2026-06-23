'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const KEY = 'railbird:my-pet-id'

export interface PetHandicap {
  petId: number
  winProb: number
  gridPos: number
}

export interface LobbyRaceSummary {
  raceId: number
  petIds: number[]
  trackLength: number
  gridTotal: number
  handicaps: PetHandicap[]   // all pets' data so client can look up saved pet
}

export function MyPetLobbyStatus({ races }: { races: LobbyRaceSummary[] }) {
  const [petId, setPetId] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    setPetId(stored ? Number(stored) : null)
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setPetId(e.newValue ? Number(e.newValue) : null)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  if (!petId) return null

  const myRaces = races
    .filter(r => r.petIds.includes(petId))
    .map(r => {
      const h = r.handicaps.find(h => h.petId === petId)
      return { ...r, myWinProb: h?.winProb ?? null, myGridPos: h?.gridPos ?? null }
    })

  return (
    <div
      className="mb-6 overflow-hidden pixel border border-neon-green/40"
      style={{ boxShadow: '0 0 16px rgba(0,255,136,0.12)' }}
    >
      {/* Header */}
      <div className="px-4 py-2 bg-neon-green/8 border-b border-neon-green/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-neon-green blink"
            style={{ boxShadow: '0 0 6px rgba(0,255,136,0.9)' }}
          />
          <span className="text-[10px] neon-green font-bold uppercase tracking-widest">
            My Pet #{petId}
          </span>
        </div>
        <Link
          href={`/gigling/${petId}`}
          className="text-[10px] text-game-muted uppercase tracking-widest hover:neon-green transition-colors"
        >
          View Profile →
        </Link>
      </div>

      {myRaces.length === 0 ? (
        <div className="px-4 py-3 text-[10px] text-game-muted uppercase tracking-widest">
          Not entered in any open races right now
        </div>
      ) : (
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-[10px] text-game-muted uppercase tracking-widest shrink-0">
            Racing in:
          </span>
          {myRaces.map(r => (
            <Link
              key={r.raceId}
              href={`/race/${r.raceId}`}
              className="flex items-center gap-2 px-3 py-1.5 border border-neon-green/30 hover:border-neon-green/70 hover:bg-neon-green/5 transition-all pixel group"
            >
              <span className="text-[10px] font-bold font-mono text-[#d0d0e8] group-hover:neon-green transition-colors">
                Race #{r.raceId}
              </span>
              <span className="text-[10px] text-game-muted">{r.trackLength}m</span>
              {r.myWinProb !== null && (
                <span
                  className="text-[10px] font-bold neon-green"
                  style={{ textShadow: '0 0 6px rgba(0,255,136,0.5)' }}
                >
                  {(r.myWinProb * 100).toFixed(1)}% WIN
                </span>
              )}
              {r.myGridPos !== null && (
                <span className="text-[10px] text-game-muted">
                  seed #{r.myGridPos}/{r.gridTotal}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
