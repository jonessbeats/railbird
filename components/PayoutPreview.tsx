import type { PayoutPreview as PayoutPreviewType } from '@/types/racing'
import { weiToEth } from '@/lib/encode'

const RANK_STYLE: Record<number, { label: string; color: string }> = {
  1: { label: '1ST', color: 'neon-gold' },
  2: { label: '2ND', color: 'text-[#c0c0c0]' },
  3: { label: '3RD', color: 'text-[#cd7f32]' },
}

export function PayoutPreview({ payout }: { payout: PayoutPreviewType }) {
  const totalEth = payout.payouts.reduce((s, p) => s + weiToEth(p.amount), 0)

  return (
    <div className="retro-panel overflow-hidden">
      <div className="px-4 py-2 bg-game-panel border-b border-game-border">
        <span className="text-[10px] text-game-muted uppercase tracking-widest">Payout Structure</span>
      </div>
      <div className="divide-y divide-game-border/40">
        {payout.payouts.map(p => {
          const eth     = weiToEth(p.amount)
          const style   = RANK_STYLE[p.rank]
          const sharePct = totalEth > 0 ? (eth / totalEth) * 100 : 0
          return (
            <div key={p.rank} className="px-4 py-2.5 flex items-center gap-3">
              <span className={`text-[10px] font-bold w-8 uppercase tracking-widest ${style?.color ?? 'text-game-muted'}`}>
                {style?.label ?? `#${p.rank}`}
              </span>
              <div className="flex-1 h-1 bg-game-border overflow-hidden">
                <div
                  className="h-full bg-neon-green"
                  style={{ width: `${sharePct}%`, boxShadow: '0 0 4px rgba(0,255,136,0.4)' }}
                />
              </div>
              <span className="text-xs font-bold neon-green font-mono">
                {eth.toFixed(4)} ETH
              </span>
            </div>
          )
        })}
      </div>
      {payout.jackpotEligible && payout.jackpotPool && (
        <div className="px-4 py-2.5 border-t border-game-border bg-neon-gold/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-game-muted uppercase tracking-widest">Jackpot eligible</span>
            <span className="text-xs font-bold neon-gold">{weiToEth(payout.jackpotPool).toFixed(3)} ETH</span>
          </div>
        </div>
      )}
    </div>
  )
}
