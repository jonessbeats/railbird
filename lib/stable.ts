'use client'

import { useEffect, useState } from 'react'

// localStorage keys
const STABLE_KEY = 'railbird:stable'        // JSON number[]
const ACTIVE_KEY = 'railbird:active-pet'    // number
const LEGACY_KEY = 'railbird:my-pet-id'     // pre-stable single pet

const EVENT = 'railbird:stable-changed'

function read(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STABLE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter((n): n is number => Number.isFinite(n))
    }
    // Migrate from the old single-pet key
    const legacy = Number(localStorage.getItem(LEGACY_KEY))
    if (legacy) {
      write([legacy])
      return [legacy]
    }
  } catch { /* ignore */ }
  return []
}

function write(pets: number[]): void {
  if (typeof window === 'undefined') return
  const unique = [...new Set(pets.filter(n => Number.isFinite(n) && n > 0))]
  localStorage.setItem(STABLE_KEY, JSON.stringify(unique))
  // Keep legacy key in sync so any not-yet-migrated reader still works
  if (unique.length > 0) localStorage.setItem(LEGACY_KEY, String(getActive() ?? unique[0]))
  else localStorage.removeItem(LEGACY_KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function getStable(): number[] {
  return read()
}

export function getActive(): number | null {
  if (typeof window === 'undefined') return null
  const pets = read()
  if (pets.length === 0) return null
  const stored = Number(localStorage.getItem(ACTIVE_KEY))
  return stored && pets.includes(stored) ? stored : pets[0]
}

export function setActive(petId: number): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_KEY, String(petId))
  if (getActive() === petId) localStorage.setItem(LEGACY_KEY, String(petId))
  window.dispatchEvent(new Event(EVENT))
}

export function addPet(petId: number): void {
  if (!petId) return
  const pets = read()
  if (!pets.includes(petId)) write([...pets, petId])
  setActive(petId)
}

export function removePet(petId: number): void {
  const pets = read().filter(p => p !== petId)
  if (typeof window !== 'undefined' && getActive() === petId) {
    localStorage.removeItem(ACTIVE_KEY)
  }
  write(pets)
}

export function isInStable(petId: number): boolean {
  return read().includes(petId)
}

/** React hook: reactive view of the stable, synced within and across tabs. */
export function useStable() {
  const [pets,   setPets]   = useState<number[]>([])
  const [active, setActiveS] = useState<number | null>(null)

  useEffect(() => {
    const sync = () => { setPets(read()); setActiveS(getActive()) }
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return {
    pets,
    active,
    has:       (id: number) => pets.includes(id),
    add:       addPet,
    remove:    removePet,
    setActive,
  }
}
