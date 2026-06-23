'use client'

import { useEffect, useRef, useState } from 'react'
import { useStable } from '@/lib/stable'
import type { MyRaceProjection, PetProjections } from '@/app/api/my-races/route'

const POLL_MS     = 10_000

interface OddsSnapshot {
  inRace:    boolean
  projected: boolean          // true = pet not entered, but projected against current field
  winProb:   number | null
  evEnter:   number | null
  gridPos:   number | null
  gridTotal: number
  fieldSize: number
  fieldCap:  number
  phase:     string
  updatedAt: number
}

type Delta = 'up' | 'down' | 'same' | null

function getDelta(prev: number | null, next: number | null): Delta {
  if (prev === null || next === null) return null
  const diff = next - prev
  if (Math.abs(diff) < 0.005) return 'same'
  return diff > 0 ? 'up' : 'down'
}

export function MyPetLiveOdds({ raceId }: { raceId: string }) {
  const { pets, active, setActive } = useStable()
  const [viewId,  setViewId]  = useState<number | null>(null)
  const [current, setCurrent] = useState<OddsSnapshot | null>(null)
  const [prev,    setPrev]    = useState<OddsSnapshot | null>(null)
  const [nextIn,  setNextIn]  = useState(POLL_MS / 1000)
  const [loading, setLoading] = useState(false)
  const [statuses, setStatuses] = useState<Map<number, MyRaceProjection>>(new Map())
  const prevRef = useRef<OddsSnapshot | null>(null)  // stable ref avoids stale closure in updater
  const timer   = useRef<ReturnType<typeof setInterval> | null>(null)

  const petId = viewId

  // Default the focused pet to the active stable pet
  useEffect(() => {
    setViewId(v => (v && pets.includes(v)) ? v : active)
  }, [active, pets.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Per-pet status for THIS race (drives the chip bar) when multiple pets saved
  useEffect(() => {
    if (pets.length < 2) { setStatuses(new Map()); return }
    let alive = true
    fetch(`/api/my-races?petIds=${pets.join(',')}`)
      .then(r => r.json())
      .then((json: { pets?: PetProjections[] }) => {
        if (!alive) return
        const m = new Map<number, MyRaceProjection>()
        for (const g of json.pets ?? []) {
          const r = g.races.find(x => String(x.raceId) === String(raceId))
          if (r) m.set(g.petId, r)
        }
        setStatuses(m)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [pets.join(','), raceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOdds = async (id: number) => {
    setLoading(true)
    setNextIn(POLL_MS / 1000)
    try {
      const res  = await fetch(`/api/race-odds?raceId=${raceId}&petId=${id}`)
      const data = await res.json() as OddsSnapshot
      setPrev(prevRef.current)
      prevRef.current = data
      setCurrent(data)
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  // Start polling when petId is known
  useEffect(() => {
    if (!petId) return
    fetchOdds(petId)
    timer.current = setInterval(() => fetchOdds(petId), POLL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [petId, raceId])

  // Countdown to next refresh
  useEffect(() => {
    const t = setInterval(() => setNextIn(n => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Empty stable ──────────────────────────────────────────────
  if (pets.length === 0) return (
    <div className="mb-6 pixel border border-game-border/60 px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-game-border inline-block" />
        <span className="text-[10px] text-game-muted uppercase tracking-widest">
          Add a pet to your stable to see live odds in every race
        </span>
      </div>
      <a
        href="/gigling/0"
        className="text-[10px] neon-cyan uppercase tracking-widest hover:underline"
        onClick={e => {
          e.preventDefault()
          const id = prompt('Enter your pet ID:')
          if (id && /^\d+$/.test(id.trim())) window.location.href = `/gigling/${id.trim()}`
        }}
      >
        Find my pet →
      </a>
    </div>
  )

  // Pet picker chips (only when the stable has more than one pet)
  const chips = pets.length > 1 ? (
    <div className="flex items-center gap-1.5 flex-wrap mb-2">
      <span className="text-[9px] text-game-muted uppercase tracking-widest mr-1">Stable:</span>
      {pets.map(id => {
        const st = statuses.get(id)
        const col = st?.recommend === 'enter' || st?.recommend === 'in' ? '#00ff88'
          : st?.recommend === 'contender' ? '#ffd700'
          : '#3a3a5c'
        const isSel = id === petId
        return (
          <button
            key={id}
            onClick={() => { setViewId(id); setActive(id) }}
            className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest pixel border transition-colors cursor-pointer"
            style={{
              borderColor: isSel ? col : '#26263a',
              color: isSel ? col : '#8a8aa0',
              background: isSel ? `${col}14` : 'transparent',
            }}
          >
            #{id}{st ? ` · ${(st.winProb * 100).toFixed(0)}%` : ''}
          </button>
        )
      })}
    </div>
  ) : null

  // Still resolving which pet to show
  if (!petId) return null

  // ── Loading (first fetch in progress) ─────────────────────────
  if (!current) return (
    <div className="mb-6">
      {chips}
      <div className="pixel border border-game-border/60 px-5 py-4 flex items-center gap-3">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ background: '#ffd700', boxShadow: '0 0 6px rgba(255,215,0,0.9)' }}
        />
        <span className="text-[10px] text-game-muted uppercase tracking-widest">
          Analysing field for pet #{petId}…
        </span>
      </div>
    </div>
  )

  // ── Pet not in race, no projection possible (race not open) ──
  if (!current.inRace && !current.projected) return (
    <div className="mb-6">
      {chips}
      <div className="pixel border border-game-border/40 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-game-border inline-block" />
          <span className="text-[10px] text-game-muted uppercase tracking-widest">
            Pet <span className="text-[#d0d0e8] font-bold">#{petId}</span> did not enter this race
          </span>
        </div>
        <a href={`/gigling/${petId}`} className="text-[10px] neon-cyan uppercase tracking-widest hover:underline">
          View profile →
        </a>
      </div>
    </div>
  )

  const isProjected = !current.inRace && current.projected

  const winPct   = current.winProb !== null ? (current.winProb * 100).toFixed(1) : null
  const prevPct  = prev?.winProb   ?? null
  const delta    = getDelta(prevPct, current.winProb)
  const deltaPct = current.winProb !== null && prevPct !== null
    ? ((current.winProb - prevPct) * 100).toFixed(1)
    : null
  const hasEdge  = current.evEnter !== null && current.evEnter > 0
  const evPct    = current.evEnter !== null ? (current.evEnter * 100).toFixed(1) : null
  const fillPct  = current.fieldCap > 0 ? (current.fieldSize / current.fieldCap) * 100 : 0

  const borderColor = isProjected ? '#ffd700'
    : hasEdge       ? '#00ff88'
    : '#00cfff'
  const glowColor   = isProjected ? 'rgba(255,215,0,0.15)'
    : hasEdge       ? 'rgba(0,255,136,0.2)'
    : 'rgba(0,207,255,0.15)'

  return (
    <div className="mb-6">
      {chips}
      <div
        className="overflow-hidden pixel border"
        style={{ borderColor, boxShadow: `0 0 24px ${glowColor}` }}
      >
      {/* ── STATUS BAR ── */}
      <div
        className="px-4 py-2 flex items-center justify-between border-b"
        style={{ borderColor: `${borderColor}33`, background: `${borderColor}0a` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{
              background: loading ? '#ffd700' : borderColor,
              boxShadow:  loading ? '0 0 6px rgba(255,215,0,0.9)' : `0 0 6px ${borderColor}cc`,
              animation:  loading ? 'none' : undefined,
            }}
          />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: borderColor }}>
            {loading
              ? 'Updating…'
              : isProjected
                ? 'Projected Odds — If You Enter Now'
                : 'Live Analysis — Your Pet'}
          </span>
          <span className="text-[10px] text-game-muted uppercase tracking-widest">#{petId}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-game-muted uppercase tracking-widest">
          <span>
            Field{' '}
            <span className="font-bold" style={{ color: borderColor }}>
              {current.fieldSize}/{current.fieldCap}
            </span>
          </span>
          <span>{loading ? 'updating…' : nextIn <= 1 ? 'refreshing…' : `refresh in ${nextIn}s`}</span>
        </div>
      </div>

      {/* ── MAIN NUMBERS ── */}
      <div className="px-6 py-5 grid grid-cols-3 gap-0 divide-x divide-game-border/50">

        {/* Win Chance */}
        <div className="pr-6">
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: isProjected ? '#ffd700aa' : undefined }} >
            {isProjected ? 'Projected Win Chance' : 'Win Chance'}
          </div>
          {winPct ? (
            <>
              <div className="flex items-end gap-2">
                <span
                  className="text-5xl font-bold leading-none"
                  style={{ color: borderColor, textShadow: `0 0 20px ${glowColor.replace('0.2', '0.7')}` }}
                >
                  {winPct}%
                </span>
                {delta && delta !== 'same' && deltaPct && (
                  <span
                    className="text-sm font-bold mb-1"
                    style={{ color: delta === 'up' ? '#00ff88' : '#ff2d6b' }}
                  >
                    {delta === 'up' ? '↑' : '↓'} {Math.abs(Number(deltaPct)).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="mt-3 h-2 bg-game-border overflow-hidden pixel">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${winPct}%`,
                    background: borderColor,
                    boxShadow:  `0 0 8px ${borderColor}aa`,
                  }}
                />
              </div>
              {delta === 'up' && (
                <div className="mt-1 text-[9px] neon-green uppercase tracking-widest">
                  ↑ Improved — weaker competitors joined
                </div>
              )}
              {delta === 'down' && (
                <div className="mt-1 text-[9px] neon-pink uppercase tracking-widest">
                  ↓ Tougher — stronger competitors joined
                </div>
              )}
            </>
          ) : (
            <div className="text-game-muted text-sm">No data</div>
          )}
        </div>

        {/* Grid Position */}
        <div className="px-6">
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: isProjected ? '#ffd700aa' : undefined }}>
            {isProjected ? 'Projected Seed' : 'Grid Seed'}
          </div>
          {current.gridPos ? (
            <>
              <div className="flex items-end gap-1">
                <span
                  className="text-5xl font-bold leading-none"
                  style={{ color: current.gridPos <= 3 ? '#ffd700' : '#d0d0e8' }}
                >
                  #{current.gridPos}
                </span>
                <span className="text-game-muted text-sm mb-1">/ {current.gridTotal}</span>
              </div>
              <div className="mt-2 text-[10px] text-game-muted uppercase tracking-widest">
                {current.gridPos === 1 ? '★ model favourite'
                  : current.gridPos <= 3 ? 'top contender'
                  : current.gridPos <= Math.ceil(current.gridTotal / 2) ? 'mid-field'
                  : 'outsider'}
              </div>
            </>
          ) : (
            <div className="text-game-muted text-sm">—</div>
          )}
        </div>

        {/* EV / Verdict */}
        <div className="pl-6">
          <div className="text-[10px] text-game-muted uppercase tracking-widest mb-2">
            {hasEdge ? 'Expected Value' : 'Verdict'}
          </div>
          {hasEdge && evPct ? (
            <>
              <div
                className="text-5xl font-bold leading-none neon-green"
                style={{ textShadow: '0 0 20px rgba(0,255,136,0.6)' }}
              >
                +{evPct}%
              </div>
              <div className="mt-2 text-[10px] neon-green uppercase tracking-widest font-bold">
                ⚡ Positive EV entry
              </div>
            </>
          ) : current.winProb !== null ? (
            <>
              <div
                className="text-3xl font-bold leading-none mt-1"
                style={{ color: current.winProb >= 0.3 ? '#00cfff' : current.winProb >= 0.15 ? '#d0d0e8' : '#3a3a5c' }}
              >
                {current.winProb >= 0.35 ? 'STRONG'
                  : current.winProb >= 0.2 ? 'FAIR'
                  : current.winProb >= 0.12 ? 'SLIM'
                  : 'LONG SHOT'}
              </div>
              <div className="mt-2 text-[10px] text-game-muted uppercase tracking-widest">
                {current.winProb >= 0.35 ? 'Among the top picks'
                  : current.winProb >= 0.2 ? 'Competitive odds'
                  : current.winProb >= 0.12 ? 'Below-average expectation'
                  : 'Unlikely given current field'}
              </div>
            </>
          ) : (
            <div className="text-game-muted text-sm">—</div>
          )}
        </div>
      </div>

      {/* ── PROJECTED DISCLAIMER ── */}
      {isProjected && (
        <div
          className="mx-6 mb-4 px-4 py-2 border pixel flex items-center justify-between"
          style={{ borderColor: '#ffd70040', background: '#ffd7000a' }}
        >
          <span className="text-[10px] text-game-muted uppercase tracking-widest">
            ⚠ Not entered · odds projected against current {current.fieldSize}-pet field
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ffd700' }}>
            {current.fieldCap - current.fieldSize} slot{current.fieldCap - current.fieldSize !== 1 ? 's' : ''} left
          </span>
        </div>
      )}

      {/* ── FIELD FILL BAR ── */}
      <div className="px-6 pb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-game-muted uppercase tracking-widest">Race fill</span>
          <span className="text-[9px] text-game-muted uppercase tracking-widest">
            {current.fieldCap - current.fieldSize} slot{current.fieldCap - current.fieldSize !== 1 ? 's' : ''} remaining
          </span>
        </div>
        <div className="h-1 bg-game-border overflow-hidden pixel">
          <div
            className="h-full transition-all duration-700"
            style={{
              width:      `${fillPct}%`,
              background: '#00cfff',
              boxShadow:  '0 0 4px rgba(0,207,255,0.5)',
            }}
          />
        </div>
      </div>
      </div>
    </div>
  )
}
