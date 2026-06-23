// components/backtest/StatTile.tsx
export function StatTile({
  label, value, sub, accent = 'neon-green',
}: {
  label: string
  value: string
  sub?: string
  accent?: 'neon-green' | 'neon-cyan' | 'neon-gold'
}) {
  return (
    <div className="retro-panel p-4 flex flex-col gap-1">
      <span className="text-[10px] text-game-muted uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-bold font-mono ${accent}`}>{value}</span>
      {sub && <span className="text-[10px] text-game-muted tracking-widest">{sub}</span>}
    </div>
  )
}
