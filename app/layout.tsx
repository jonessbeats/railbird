// app/layout.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'RAILBIRD — Gigling Racing Edge Finder',
  description: 'Form guide & +EV picker for Gigling Racing on Gigaverse',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-slate-100 antialiased">
        <nav className="border-b border-slate-800 px-4 py-3 flex items-center gap-6">
          <Link href="/" className="font-bold text-lg tracking-tight text-emerald-400">RAILBIRD</Link>
          <Link href="/leaderboard" className="text-sm text-slate-400 hover:text-slate-200">Leaderboard</Link>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
