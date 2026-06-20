// components/PayoutPreview.tsx
import type { PayoutPreview as PayoutPreviewType } from '@/types/racing'
import { weiToEth } from '@/lib/encode'

export function PayoutPreview({ payout }: { payout: PayoutPreviewType }) {
  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <div className="px-3 py-2 bg-slate-900/50 text-xs text-slate-400 font-medium">
        Payout Structure
      </div>
      <table className="w-full text-sm">
        <tbody>
          {payout.payouts.map(p => (
            <tr key={p.rank} className="border-t border-slate-800/50">
              <td className="px-3 py-2 text-slate-400">#{p.rank}</td>
              <td className="px-3 py-2 text-right text-emerald-400 font-mono">
                {weiToEth(p.amount).toFixed(4)} ETH
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {payout.jackpotEligible && payout.jackpotPool && (
        <div className="px-3 py-2 border-t border-slate-800 text-xs text-yellow-400">
          🎰 Jackpot: {weiToEth(payout.jackpotPool).toFixed(3)} ETH eligible
        </div>
      )}
    </div>
  )
}
