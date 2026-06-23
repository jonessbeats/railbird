import type { Metadata } from 'next'
import Link from 'next/link'
import { MyPetNav } from '@/components/MyPetNav'
import { PetSearch } from '@/components/PetSearch'
import './globals.css'

export const metadata: Metadata = {
  title: 'RAILBIRD — Gigling Racing Edge Finder',
  description: 'Form guide & +EV picker for Gigling Racing on Gigaverse',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-game-bg text-[#d0d0e8] antialiased font-mono">
        <nav className="border-b border-game-border bg-game-surface/80 backdrop-blur-sm sticky top-0 z-50 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-8">
            <Link href="/" className="font-bold text-xl tracking-widest neon-green uppercase">
              ▸ RAILBIRD
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1 text-xs tracking-widest uppercase text-game-muted hover:text-[#d0d0e8] hover:bg-game-panel transition-colors border border-transparent hover:border-game-border cursor-pointer"
              >
                Lobby
              </Link>
              <Link
                href="/value"
                className="px-3 py-1 text-xs tracking-widest uppercase text-neon-green hover:bg-neon-green/10 transition-colors border border-neon-green/30 hover:border-neon-green/60 cursor-pointer pixel"
              >
                +EV
              </Link>
              <Link
                href="/my-races"
                className="px-3 py-1 text-xs tracking-widest uppercase text-neon-cyan hover:bg-neon-cyan/10 transition-colors border border-neon-cyan/30 hover:border-neon-cyan/60 cursor-pointer pixel"
              >
                My Races
              </Link>
              <Link
                href="/leaderboard"
                className="px-3 py-1 text-xs tracking-widest uppercase text-game-muted hover:text-[#d0d0e8] hover:bg-game-panel transition-colors border border-transparent hover:border-game-border cursor-pointer"
              >
                Leaderboard
              </Link>
              <Link
                href="/backtest"
                className="px-3 py-1 text-xs tracking-widest uppercase text-game-muted hover:text-[#d0d0e8] hover:bg-game-panel transition-colors border border-transparent hover:border-game-border cursor-pointer"
              >
                Backtest
              </Link>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <PetSearch />
              <MyPetNav />
              <div className="flex items-center gap-2 text-xs text-game-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green blink inline-block" />
                <span className="tracking-widest uppercase">LIVE</span>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
