'use client'

import { useStable } from '@/lib/stable'

export function SaveMyPet({ petId }: { petId: number }) {
  const { pets, add, remove, has } = useStable()
  const inStable = has(petId)

  // pets is [] until the effect runs client-side; render the add state by default
  if (inStable) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] neon-green uppercase tracking-widest font-bold px-2 py-1 border border-neon-green/40 pixel">
          ◉ In Stable
        </span>
        <button
          onClick={() => remove(petId)}
          className="text-[10px] text-game-muted uppercase tracking-widest hover:neon-pink transition-colors cursor-pointer"
        >
          remove
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => add(petId)}
      className="text-[10px] text-game-muted uppercase tracking-widest px-2 py-1 border border-game-border hover:border-neon-green/40 hover:neon-green transition-colors pixel cursor-pointer"
    >
      + Add to Stable{pets.length > 0 ? ` (${pets.length})` : ''}
    </button>
  )
}
