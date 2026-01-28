import React, { useEffect, useState } from 'react'
import { errorReporter } from '../services/errorReporter'
import type { ErrorReport } from '../services/errorReporter'
import { Clipboard, Activity, ShieldAlert } from 'lucide-react'

export const ErrorLog: React.FC = () => {
  const [reports, setReports] = useState<ErrorReport[]>(errorReporter.getReports())

  useEffect(() => {
    const unsubscribe = errorReporter.subscribe(setReports)
    return unsubscribe
  }, [])

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-slate-400">
        <ShieldAlert size={36} className="text-amber-500 mb-3" />
        <p className="text-xs uppercase font-bold tracking-[0.3em] text-amber-400">No errors recorded.</p>
      </div>
    )
  }

  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString()

  return (
    <div className="p-6 space-y-6 pb-20">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-50 uppercase flex items-center gap-2">
            <Activity size={24} className="text-rose-400" /> Error_Log
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase">
            {reports.length} recent incident{reports.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => {
            const payload = reports.map(r => `${formatTimestamp(r.timestamp)} | ${r.message}`).join('\n')
            navigator.clipboard.writeText(payload)
          }}
          className="px-3 py-1 rounded-xl border border-rose-500/30 text-rose-300 text-[10px] uppercase tracking-[0.2em]"
        >
          <Clipboard size={14} /> Copy
        </button>
      </header>
      <div className="grid gap-4">
        {reports.map(report => (
          <article key={report.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500 uppercase">{report.id}</span>
              <span className="text-[9px] text-slate-500 uppercase">{formatTimestamp(report.timestamp)}</span>
            </div>
            <p className="text-sm text-slate-200 font-semibold line-clamp-2">{report.message}</p>
            {report.context && (
              <pre className="text-[9px] font-mono text-slate-400 bg-slate-900/40 rounded-lg p-2 whitespace-pre-wrap">{report.context}</pre>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
