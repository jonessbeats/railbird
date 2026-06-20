// components/StatProfile.tsx
// Shows inferred 4-stat bars with uncertainty ranges from racePublic data.
// Each bar shows the min-max range as a shaded band; narrower = more revealed.

interface StatBarProps {
  label: string
  range: { min: number; max: number }
}

function StatBar({ label, range }: StatBarProps) {
  const { min, max } = range
  const mid = (min + max) / 2
  const spread = max - min
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className="font-mono">
          {min === max
            ? mid.toFixed(0)
            : `${min.toFixed(0)}–${max.toFixed(0)}`}
        </span>
      </div>
      <div className="h-3 bg-slate-800 rounded-full relative overflow-hidden">
        {/* Uncertainty band */}
        <div
          className="absolute h-full bg-emerald-500/25 rounded-full"
          style={{ left: `${min}%`, width: `${spread}%` }}
        />
        {/* Point estimate (midpoint) */}
        <div
          className="absolute h-full w-0.5 bg-emerald-400"
          style={{ left: `${mid}%` }}
        />
      </div>
    </div>
  )
}

export interface StatProfileProps {
  startRange: { min: number; max: number }
  speedRange: { min: number; max: number }
  staminaRange: { min: number; max: number }
  finishRange: { min: number; max: number }
  racesRun: number
  maxRaces: number
}

export function StatProfile({
  startRange,
  speedRange,
  staminaRange,
  finishRange,
  racesRun,
  maxRaces,
}: StatProfileProps) {
  const revealPct = maxRaces > 0 ? Math.min(100, Math.round((racesRun / maxRaces) * 100)) : 0
  return (
    <div className="rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300">Stat Ranges</h3>
        <span className="text-xs text-slate-500">{racesRun}/{maxRaces} races revealed</span>
      </div>
      <StatBar label="Start" range={startRange} />
      <StatBar label="Speed" range={speedRange} />
      <StatBar label="Stamina" range={staminaRange} />
      <StatBar label="Finish" range={finishRange} />
      <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${revealPct >= 80 ? 'bg-emerald-500' : revealPct >= 40 ? 'bg-yellow-500' : 'bg-slate-500'}`}
          style={{ width: `${revealPct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-1">{revealPct}% profile revealed</p>
    </div>
  )
}
