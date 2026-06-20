// components/WeatherIcon.tsx
const ICONS: Record<string, string> = {
  hot: '☀️', cold: '❄️', rainy: '🌧️', snowing: '❄️🌨️',
  none: '—', dung: '💩', butterflies: '🦋', all: '🎲',
}

export function WeatherIcon({ weather }: { weather: string | null }) {
  if (!weather) return null
  return <span title={weather}>{ICONS[weather] ?? weather}</span>
}
