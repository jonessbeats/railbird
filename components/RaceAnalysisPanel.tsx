import type { RaceAnalysis } from '@/lib/model/analyze'

const TYPE_STYLE: Record<string, { bar: string; text: string; bg: string }> = {
  edge:         { bar: 'bg-neon-green', text: 'neon-green',  bg: 'bg-neon-green/5 border-neon-green/30' },
  walkover:     { bar: 'bg-neon-cyan',  text: 'neon-cyan',   bg: 'bg-neon-cyan/5 border-neon-cyan/30'   },
  contested:    { bar: 'bg-neon-gold',  text: 'neon-gold',   bg: 'bg-neon-gold/5 border-neon-gold/30'   },
  open:         { bar: 'bg-game-muted', text: 'text-[#d0d0e8]', bg: 'retro-panel'                       },
  insufficient: { bar: 'bg-game-muted', text: 'text-game-muted', bg: 'retro-panel'                      },
}

const CONF_LABEL: Record<string, string> = {
  high: 'HIGH CONF',
  medium: 'MED CONF',
  low: 'LOW DATA',
}
const CONF_COLOR: Record<string, string> = {
  high: 'neon-green',
  medium: 'neon-gold',
  low: 'text-game-muted',
}

export function RaceAnalysisPanel({ analysis }: { analysis: RaceAnalysis }) {
  const s = TYPE_STYLE[analysis.type] ?? TYPE_STYLE.open

  return (
    <div className={`border p-4 ${s.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-1 h-5 ${s.bar}`} />
          <span className="text-[10px] text-game-muted uppercase tracking-widest">Analysis</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${CONF_COLOR[analysis.confidence]}`}>
          {CONF_LABEL[analysis.confidence]}
        </span>
      </div>

      {/* Headline */}
      <div className={`text-lg font-bold tracking-widest uppercase mb-2 ${s.text}`}>
        {analysis.headline}
      </div>

      {/* Summary */}
      <p className="text-xs text-[#d0d0e8] leading-relaxed mb-4">
        {analysis.summary}
      </p>

      {/* Factors */}
      {analysis.factors.length > 0 && (
        <div className="border-t border-game-border/50 pt-3 space-y-1.5">
          <div className="text-[10px] text-game-muted uppercase tracking-widest mb-2">Key Factors</div>
          {analysis.factors.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-game-muted">
              <span className={`mt-0.5 shrink-0 ${s.text}`}>›</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
