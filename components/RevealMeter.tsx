export function RevealMeter({ pct }: { pct: number }) {
  const color = pct >= 80
    ? 'bg-neon-green'
    : pct >= 40
    ? 'bg-neon-gold'
    : 'bg-game-muted'
  const glow = pct >= 80
    ? '0 0 6px rgba(0,255,136,0.5)'
    : pct >= 40
    ? '0 0 6px rgba(255,215,0,0.5)'
    : 'none'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-game-border pixel overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%`, boxShadow: glow }}
        />
      </div>
      <span className="text-[10px] text-game-muted uppercase tracking-widest w-20 text-right">
        {pct}% data
      </span>
    </div>
  )
}
