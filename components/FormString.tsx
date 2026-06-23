interface FormEntry { rank: number }

function blockStyle(rank: number): { bg: string; color: string; glow?: string } {
  if (rank === 1) return { bg: '#ffd700', color: '#0a0a14', glow: 'rgba(255,215,0,0.7)' }
  if (rank <= 3)  return { bg: '#00ff88', color: '#0a0a14', glow: 'rgba(0,255,136,0.5)' }
  if (rank <= 5)  return { bg: '#00cfff22', color: '#00cfff' }
  return               { bg: '#1e1e3a',   color: '#3a3a5c' }
}

interface FormStringProps {
  history: FormEntry[]
  max?: number
  showLabel?: boolean
}

export function FormString({ history, max = 8, showLabel = true }: FormStringProps) {
  const form = history.slice(0, max)
  if (form.length === 0) return null

  return (
    <div>
      {showLabel && (
        <div className="text-[9px] text-game-muted uppercase tracking-widest mb-1">Form</div>
      )}
      <div className="flex items-center gap-[3px]">
        {form.map((r, i) => {
          const s = blockStyle(r.rank)
          return (
            <div
              key={i}
              className="w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold pixel"
              style={{
                background: s.bg,
                color: s.color,
                boxShadow: s.glow ? `0 0 4px ${s.glow}` : undefined,
              }}
            >
              {r.rank > 9 ? '9+' : r.rank}
            </div>
          )
        })}
      </div>
    </div>
  )
}
