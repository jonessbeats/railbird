'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useStable } from '@/lib/stable'
import type { MyRaceProjection, PetProjections } from '@/app/api/my-races/route'

const POLL_MS = 20_000

const TRACK_LABEL = { SPRINT: 'SPR', MID: 'MID', STAMINA: 'STA' }

const REC_STYLE = {
  in:        { label: 'RACING',    color: 'neon-cyan',       border: 'border-neon-cyan/40',  bg: 'bg-neon-cyan/5'  },
  enter:     { label: 'ENTER',     color: 'neon-green',      border: 'border-neon-green/40', bg: 'bg-neon-green/5' },
  contender: { label: 'GOOD SHOT', color: 'neon-gold',       border: 'border-neon-gold/40',  bg: 'bg-neon-gold/5'  },
  skip:      { label: 'SKIP',      color: 'text-game-muted', border: 'border-game-border',   bg: '' },
}

// ── Single race row ───────────────────────────────────────────
function RaceRow({ r }: { r: MyRaceProjection }) {
  const style   = REC_STYLE[r.recommend]
  const fillPct = r.fieldCap > 0 ? Math.round((r.fieldSize / r.fieldCap) * 100) : 0
  const dim     = r.recommend === 'skip'
  const barColor =
    r.recommend === 'enter' || r.recommend === 'in' ? '#00ff88'
    : r.recommend === 'contender' ? '#ffd700'
    : '#3a3a5c'
  const pctColor =
    r.recommend === 'contender' ? 'neon-gold'
    : dim ? 'text-game-muted'
    : 'neon-green'

  return (
    <Link href={`/race/${r.raceId}`} className="block group">
      <div className={`retro-panel overflow-hidden transition-all group-hover:border-neon-green/30 ${style.bg} ${dim ? 'opacity-60 hover:opacity-100' : ''}`}>
        <div className="px-4 py-3 flex items-center gap-4">
          <div className="shrink-0 w-20">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 pixel border ${style.color} ${style.border}`}>
              {style.label}
            </span>
          </div>
          <div className="shrink-0 w-24">
            <div className="text-xs font-bold font-mono tracking-wider">#{r.raceId}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-game-muted uppercase tracking-widest">{r.trackLength}m</span>
              <span className="text-[9px] text-game-muted uppercase tracking-widest">{TRACK_LABEL[r.trackType]}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-game-muted uppercase tracking-widest mb-1">
              {r.inRace ? 'Win Chance' : 'Projected Win'}
            </div>
            <div className="flex items-center gap-2 max-w-[200px]">
              <div className="flex-1 h-1.5 bg-game-border pixel overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${(r.winProb * 100).toFixed(0)}%`,
                    background: barColor,
                    boxShadow: barColor !== '#3a3a5c' ? `0 0 4px ${barColor}80` : 'none',
                  }}
                />
              </div>
              <span className={`text-xs font-bold font-mono w-12 text-right ${pctColor}`}>
                {(r.winProb * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right w-16">
            <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Seed</div>
            <div className={`text-sm font-bold font-mono ${r.gridPos <= 3 ? 'neon-gold' : ''}`}>
              #{r.gridPos}<span className="text-game-muted text-[10px]">/{r.gridTotal}</span>
            </div>
          </div>
          <div className="shrink-0 text-right w-20">
            <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">EV</div>
            {r.evEth !== null ? (
              <div className={`text-sm font-bold font-mono ${r.evEth > 0 ? 'neon-green' : 'neon-pink'}`}>
                {r.evEth > 0 ? '+' : ''}{r.evEth.toFixed(4)}
              </div>
            ) : (
              <div className="text-[10px] text-game-muted">FREE</div>
            )}
          </div>
          <div className="shrink-0 w-16 hidden md:block">
            <div className="text-[9px] text-game-muted uppercase tracking-widest mb-1">{r.fieldSize}/{r.fieldCap}</div>
            <div className="h-1 bg-game-border overflow-hidden">
              <div className="h-full bg-neon-cyan" style={{ width: `${fillPct}%` }} />
            </div>
          </div>
          <div className="shrink-0 text-game-muted text-[10px] tracking-widest">›</div>
        </div>
      </div>
    </Link>
  )
}

// ── Per-pet group (used in "All" view) ────────────────────────
function PetGroup({ p }: { p: PetProjections }) {
  const plays = p.races.filter(r => r.recommend !== 'skip')
  const best  = plays[0]
  return (
    <div className="retro-panel overflow-hidden">
      <div className="px-4 py-2 bg-game-panel border-b border-game-border flex items-center justify-between">
        <Link href={`/gigling/${p.petId}`} className="text-xs font-bold font-mono tracking-wider hover:neon-green transition-colors">
          ◉ #{p.petId}
        </Link>
        <div className="flex items-center gap-3 text-[10px] text-game-muted uppercase tracking-widest">
          {plays.length > 0
            ? <span><span className="neon-green font-bold">{plays.length}</span> {plays.length === 1 ? 'play' : 'plays'}</span>
            : <span>no plays right now</span>}
          {best && (
            <span>best <span className="neon-gold font-bold">{(best.winProb * 100).toFixed(0)}%</span></span>
          )}
        </div>
      </div>
      {plays.length > 0 ? (
        <div className="p-2 space-y-2">
          {plays.slice(0, 5).map(r => <RaceRow key={r.raceId} r={r} />)}
        </div>
      ) : (
        <div className="px-4 py-3 text-[10px] text-game-muted uppercase tracking-widest">
          No good entries for this pet in the current market
        </div>
      )}
    </div>
  )
}

export default function MyRacesPage() {
  const { pets, active, add, remove, setActive } = useStable()
  const [data,    setData]    = useState<PetProjections[] | null>(null)
  const [selected, setSelected] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [nextIn,  setNextIn]  = useState(POLL_MS / 1000)
  const [addVal,  setAddVal]  = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async (ids: number[]) => {
    if (ids.length === 0) { setData([]); return }
    setLoading(true)
    setNextIn(POLL_MS / 1000)
    try {
      const res  = await fetch(`/api/my-races?petIds=${ids.join(',')}`)
      const json = await res.json() as { pets?: PetProjections[]; races?: MyRaceProjection[]; petId?: number }
      // Normalise single vs multi response shape
      if (json.pets) setData(json.pets)
      else if (json.races && json.petId) setData([{ petId: json.petId, races: json.races, notFound: false }])
      else setData([])
    } catch { /* keep previous */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (pets.length === 0) { setData([]); return }
    load(pets)
    timer.current = setInterval(() => load(pets), POLL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [pets.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNextIn(n => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const handleAdd = () => {
    const id = Number(addVal.replace('#', '').trim())
    if (id > 0) { add(id); setAddVal('') }
  }

  // ── Empty stable ──────────────────────────────────────────────
  if (pets.length === 0) return (
    <div className="retro-panel p-16 text-center">
      <div className="text-game-muted text-xs uppercase tracking-widest mb-4">[ Your stable is empty ]</div>
      <p className="text-[11px] text-game-muted tracking-wide mb-6 max-w-md mx-auto leading-relaxed">
        Add your pets to instantly see which open races give each of them the best win chance and EV.
      </p>
      <div className="flex items-center justify-center gap-2">
        <input
          value={addVal}
          onChange={e => setAddVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Pet ID…"
          className="bg-game-bg border border-game-border px-3 py-2 text-xs font-mono w-32 focus:border-neon-green/50 focus:outline-none pixel"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-[10px] uppercase tracking-widest border border-neon-green/40 neon-green hover:bg-neon-green/10 transition-colors pixel cursor-pointer"
        >
          + Add pet
        </button>
      </div>
    </div>
  )

  const totalPlays = data?.reduce((s, p) => s + p.races.filter(r => r.recommend !== 'skip').length, 0) ?? 0
  const selectedPet = selected !== 'all' ? data?.find(p => p.petId === selected) : null

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="mb-4 border-b border-game-border pb-4">
        <p className="text-[10px] text-game-muted uppercase tracking-widest mb-1">// my stable</p>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold tracking-widest uppercase neon-green">
            Stable <span className="text-[#d0d0e8]">· {pets.length}</span>
          </h1>
          <div className="flex items-center gap-4 text-xs text-game-muted uppercase tracking-widest">
            <span><span className="neon-green font-bold">{totalPlays}</span> total plays</span>
            <span className="normal-case">
              {loading ? 'updating…' : nextIn <= 1 ? 'refreshing…' : `refresh ${nextIn}s`}
            </span>
          </div>
        </div>
      </div>

      {/* ── PET SELECTOR / MANAGER ── */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <button
          onClick={() => setSelected('all')}
          className={`px-3 py-1.5 text-[10px] uppercase tracking-widest pixel border transition-colors cursor-pointer ${
            selected === 'all'
              ? 'neon-green border-neon-green/50 bg-neon-green/10'
              : 'text-game-muted border-game-border hover:border-game-muted'
          }`}
        >
          All pets
        </button>
        {pets.map(id => (
          <div
            key={id}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest pixel border transition-colors ${
              selected === id
                ? 'neon-cyan border-neon-cyan/50 bg-neon-cyan/10'
                : 'text-game-muted border-game-border hover:border-game-muted'
            }`}
          >
            <button onClick={() => { setSelected(id); setActive(id) }} className="cursor-pointer font-mono">
              {active === id ? '◉' : '○'} #{id}
            </button>
            <button
              onClick={() => remove(id)}
              className="text-game-muted hover:neon-pink transition-colors cursor-pointer"
              title="Remove from stable"
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <input
            value={addVal}
            onChange={e => setAddVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="+ pet ID"
            className="bg-game-bg border border-game-border px-2 py-1.5 text-[10px] font-mono w-20 focus:border-neon-green/50 focus:outline-none pixel"
          />
        </div>
      </div>

      {/* ── CONTENT ── */}
      {data === null ? (
        <div className="retro-panel p-16 text-center">
          <span className="text-[10px] text-game-muted uppercase tracking-widest">
            Analysing open races for {pets.length} {pets.length === 1 ? 'pet' : 'pets'}…
          </span>
        </div>
      ) : selected === 'all' ? (
        <div className="space-y-4">
          {data.map(p => <PetGroup key={p.petId} p={p} />)}
        </div>
      ) : selectedPet ? (
        selectedPet.races.length > 0 ? (
          <div className="space-y-2">
            {selectedPet.races.map(r => <RaceRow key={r.raceId} r={r} />)}
          </div>
        ) : (
          <div className="retro-panel p-16 text-center text-[10px] text-game-muted uppercase tracking-widest">
            [ No open races for #{selected} right now ]
          </div>
        )
      ) : null}

      <div className="mt-6 text-center">
        <Link href="/" className="text-[10px] text-game-muted uppercase tracking-widest hover:neon-green transition-colors">
          ← All open races
        </Link>
      </div>
    </div>
  )
}
