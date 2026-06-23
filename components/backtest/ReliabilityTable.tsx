// components/backtest/ReliabilityTable.tsx
import type { CalibrationBin } from '@/lib/backtest/types'

export function ReliabilityTable({ bins }: { bins: CalibrationBin[] }) {
  const rows = bins.filter(b => b.count > 0)
  return (
    <div className="retro-panel overflow-hidden">
      <div className="px-4 py-2 text-[10px] text-game-muted uppercase tracking-widest border-b border-game-border">
        Reliability by predicted-probability bin
      </div>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-game-muted text-[10px] uppercase tracking-widest">
            <th className="px-4 py-2 text-left">Bin</th>
            <th className="px-4 py-2 text-right">Predicted</th>
            <th className="px-4 py-2 text-right">Observed</th>
            <th className="px-4 py-2 text-right">n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b, i) => (
            <tr key={i} className="border-t border-game-border/40">
              <td className="px-4 py-1.5 text-game-muted">
                {(b.lo * 100).toFixed(0)}–{(b.hi * 100).toFixed(0)}%
              </td>
              <td className="px-4 py-1.5 text-right neon-cyan">{(b.predictedMean * 100).toFixed(1)}%</td>
              <td className="px-4 py-1.5 text-right neon-green">{(b.observedRate * 100).toFixed(1)}%</td>
              <td className="px-4 py-1.5 text-right text-game-muted">{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
