// components/backtest/SampleBadge.tsx
export function SampleBadge({
  nRaces, meanCoverage, mode,
}: {
  nRaces: number
  meanCoverage: number
  mode: 'retro' | 'live'
}) {
  return (
    <div className="flex items-center gap-3 text-[10px] text-game-muted uppercase tracking-widest">
      <span><span className="neon-green font-bold">{nRaces}</span> races</span>
      <span><span className="neon-cyan font-bold">{(meanCoverage * 100).toFixed(0)}%</span> coverage</span>
      {mode === 'retro'
        ? <span className="text-neon-gold">in-sample · ELO look-ahead</span>
        : <span className="neon-green">live · zero-leakage</span>}
    </div>
  )
}
