// components/EdgeBadge.tsx
export function EdgeBadge({ ev }: { ev: number | undefined }) {
  if (ev === undefined || ev <= 0) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase tracking-wider">
      EDGE +{(ev * 100).toFixed(1)}%
    </span>
  )
}
