// components/backtest/EdgeTrackRecord.tsx
import type { GradedRecord } from '@/lib/backtest/types'
import { weiToEth } from '@/lib/encode'

export function EdgeTrackRecord({ records }: { records: GradedRecord[] }) {
  const edges = records.filter(r => r.edgeOutcome != null)
  if (edges.length === 0) {
    return (
      <div className="retro-panel p-4 text-[10px] text-game-muted uppercase tracking-widest">
        No EDGE flags in this sample yet.
      </div>
    )
  }
  let running = 0
  return (
    <div className="retro-panel overflow-hidden">
      <div className="px-4 py-2 text-[10px] text-game-muted uppercase tracking-widest border-b border-game-border">
        EDGE track record
      </div>
      <table className="w-full text-xs font-mono">
        <tbody>
          {edges.map(r => {
            const won = r.edgeOutcome!.rank === 0
            const net = weiToEth(r.edgeOutcome!.netWei)
            running += net
            return (
              <tr key={`${r.raceId}:${r.modelVersion}`} className="border-t border-game-border/40">
                <td className="px-4 py-1.5 text-game-muted">#{r.raceId}</td>
                <td className="px-4 py-1.5">#{r.edgePetId}</td>
                <td className={`px-4 py-1.5 ${won ? 'neon-green' : 'text-game-muted'}`}>
                  {won ? '✓ WON' : `${r.edgeOutcome!.rank >= 0 ? `P${r.edgeOutcome!.rank + 1}` : '—'}`}
                </td>
                <td className={`px-4 py-1.5 text-right ${net >= 0 ? 'neon-green' : 'text-red-400'}`}>
                  {net >= 0 ? '+' : ''}{net.toFixed(4)}
                </td>
                <td className={`px-4 py-1.5 text-right ${running >= 0 ? 'neon-gold' : 'text-red-400'}`}>
                  {running >= 0 ? '+' : ''}{running.toFixed(4)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
