export default function RaceDetailLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-48 bg-slate-800 rounded mb-2" />
        <div className="flex gap-4">
          <div className="h-4 w-20 bg-slate-800 rounded" />
          <div className="h-4 w-24 bg-slate-800 rounded" />
          <div className="h-4 w-28 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 h-40" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 h-32" />
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 h-48" />
        </div>
      </div>
    </div>
  )
}
