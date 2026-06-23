interface OddsBarProps {
  winProb: number
  fairOdds: number
  petName?: string
}

export function OddsBar({ winProb, fairOdds, petName }: OddsBarProps) {
  const pct = (winProb * 100).toFixed(1)
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-game-muted mb-1.5 uppercase tracking-widest">
        <span>{petName ?? 'Win prob'}</span>
        <span className="neon-cyan">{pct}% <span className="text-game-muted">·</span> {fairOdds.toFixed(2)}x</span>
      </div>
      <div className="h-1.5 bg-game-border pixel overflow-hidden">
        <div
          className="h-full bg-neon-green transition-all"
          style={{ width: `${pct}%`, boxShadow: '0 0 6px rgba(0,255,136,0.6)' }}
        />
      </div>
    </div>
  )
}
