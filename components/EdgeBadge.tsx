export function EdgeBadge({ ev }: { ev: number | undefined }) {
  if (ev === undefined || ev <= 0) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold bg-neon-green/10 neon-green border border-neon-green/50 uppercase tracking-widest pixel">
      ⚡{(ev * 100).toFixed(1)}%
    </span>
  )
}
