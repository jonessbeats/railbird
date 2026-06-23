interface SegmentBarProps {
  range: { min: number; max: number }
  accent?: string
  glow?: string
}

function SegmentBar({ range, accent = '#00ff88', glow = 'rgba(0,255,136,0.6)' }: SegmentBarProps) {
  const total = 20
  const { min, max } = range
  const isRevealed = min === max

  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: total }, (_, i) => {
        const lo = (i / total) * 100
        const hi = ((i + 1) / total) * 100
        const inRange = lo < max && hi > min
        const solid   = inRange && (lo >= min || isRevealed)
        return (
          <div
            key={i}
            className="h-2.5 flex-1"
            style={{
              background: solid ? accent : inRange ? `${accent}35` : '#1e1e3a',
              boxShadow: solid ? `0 0 4px ${glow}` : 'none',
            }}
          />
        )
      })}
    </div>
  )
}

export interface StatProfileProps {
  startRange:   { min: number; max: number }
  speedRange:   { min: number; max: number }
  staminaRange: { min: number; max: number }
  finishRange:  { min: number; max: number }
  racesRun: number
  maxRaces: number
}

const STAT_CONFIG = [
  { key: 'start',   label: 'START',   accent: '#00cfff', glow: 'rgba(0,207,255,0.6)' },
  { key: 'speed',   label: 'SPEED',   accent: '#00ff88', glow: 'rgba(0,255,136,0.6)' },
  { key: 'stamina', label: 'STAMINA', accent: '#b06aff', glow: 'rgba(176,106,255,0.6)' },
  { key: 'finish',  label: 'FINISH',  accent: '#ff2d6b', glow: 'rgba(255,45,107,0.6)' },
] as const

export function StatProfile({ startRange, speedRange, staminaRange, finishRange, racesRun, maxRaces }: StatProfileProps) {
  const ranges = { start: startRange, speed: speedRange, stamina: staminaRange, finish: finishRange }
  const revealPct = maxRaces > 0 ? Math.min(100, Math.round((racesRun / maxRaces) * 100)) : 0

  return (
    <div className="retro-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] text-game-muted uppercase tracking-widest">Stat Profile</span>
        <span className="text-[10px] text-game-muted uppercase tracking-widest">
          <span className="neon-cyan font-bold">{racesRun}</span>/{maxRaces} revealed
        </span>
      </div>

      <div className="space-y-3">
        {STAT_CONFIG.map(({ key, label, accent, glow }) => {
          const r = ranges[key]
          const isRevealed = r.min === r.max
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>
                  {label}
                </span>
                <span className="text-[10px] font-bold" style={{ color: accent }}>
                  {isRevealed ? r.min.toFixed(0) : `${r.min.toFixed(0)}–${r.max.toFixed(0)}`}
                  {(r.max - r.min) > 30 && !isRevealed && (
                    <span className="text-game-muted ml-1">volatile</span>
                  )}
                </span>
              </div>
              <SegmentBar range={r} accent={accent} glow={glow} />
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-game-border/50 pt-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-game-muted uppercase tracking-widest">Profile completeness</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${
            revealPct >= 80 ? 'neon-green' : revealPct >= 40 ? 'neon-gold' : 'text-game-muted'
          }`}>{revealPct}%</span>
        </div>
        <div className="h-1 bg-game-border flex gap-[2px]">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="flex-1 h-full"
              style={{
                background: (i / 20) * 100 < revealPct
                  ? revealPct >= 80 ? '#00ff88' : revealPct >= 40 ? '#ffd700' : '#3a3a5c'
                  : '#1e1e3a',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
