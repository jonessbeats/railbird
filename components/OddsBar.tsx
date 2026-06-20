// components/OddsBar.tsx
interface OddsBarProps {
  winProb: number
  fairOdds: number
  petName?: string
}

export function OddsBar({ winProb, fairOdds, petName }: OddsBarProps) {
  const pct = (winProb * 100).toFixed(1)
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{petName ?? 'Pet'}</span>
        <span>{pct}% · {fairOdds.toFixed(2)}x</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
