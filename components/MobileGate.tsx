export function MobileGate() {
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-6 bg-game-bg px-8 text-center md:hidden">
      <div className="text-5xl">🖥️</div>
      <div className="font-bold text-2xl tracking-widest neon-green uppercase">
        ▸ RAILBIRD
      </div>
      <h1 className="text-lg tracking-widest uppercase text-[#d0d0e8]">
        Desktop only
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-game-muted">
        For the best experience, open RAILBIRD on a desktop or laptop. This site
        isn&apos;t available on mobile devices.
      </p>
      <div className="flex items-center gap-2 text-xs text-game-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-neon-green blink inline-block" />
        <span className="tracking-widest uppercase">See you on the big screen</span>
      </div>
    </div>
  )
}
