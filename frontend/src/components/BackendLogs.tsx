/**
 * Live backend log panel.
 * Polls /api/logs every 2 s, showing the last N lines with level colour-coding.
 * Pass `active` to start/stop polling.
 */
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Terminal, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

interface LogLine { ts: number; level: string; logger: string; message: string }

const LEVEL_COLOR: Record<string, string> = {
  DEBUG:    '#64748b',
  INFO:     '#94a3b8',
  WARNING:  '#eab308',
  ERROR:    '#ef4444',
  CRITICAL: '#f97316',
}

export default function BackendLogs({ active = true }: { active?: boolean }) {
  const [lines, setLines]     = useState<LogLine[]>([])
  const [open, setOpen]       = useState(false)
  const [paused, setPaused]   = useState(false)
  const sinceRef              = useRef(0)
  const bottomRef             = useRef<HTMLDivElement>(null)
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active || paused) return
    const poll = async () => {
      try {
        const { data } = await axios.get<LogLine[]>('/api/logs', {
          params: { since: sinceRef.current },
        })
        if (data.length > 0) {
          sinceRef.current = data[data.length - 1].ts
          setLines(prev => {
            const next = [...prev, ...data].slice(-300)
            return next
          })
        }
      } catch { /* backend might be restarting */ }
    }
    poll()
    timerRef.current = setInterval(poll, 2000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [active, paused])

  // Auto-scroll when open
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, open])

  const levelCounts = lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1; return acc
  }, {})

  return (
    <div style={{ background: '#0b0f1a', border: '1px solid #1e2736', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <Terminal style={{ width: 14, height: 14, color: '#38bdf8' }} />
        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, flex: 1, textAlign: 'left' }}>
          Backend Logs
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {Object.entries(levelCounts).filter(([l]) => l !== 'INFO' && l !== 'DEBUG').map(([l, n]) => (
            <span key={l} style={{ fontSize: 10, color: LEVEL_COLOR[l] ?? '#94a3b8',
              background: '#1e2736', padding: '1px 6px', borderRadius: 10 }}>
              {l} {n}
            </span>
          ))}
          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{lines.length} lines</span>
          {active && !paused && <span style={{ width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e', animation: 'pulse 2s infinite' }} />}
        </div>
        <span style={{ color: '#475569', marginLeft: 4 }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div>
          {/* Toolbar */}
          <div style={{ padding: '4px 14px 4px', display: 'flex', alignItems: 'center', gap: 8,
            borderTop: '1px solid #1e2736', borderBottom: '1px solid #1e2736',
            background: '#0f1117' }}>
            <button onClick={() => setPaused(v => !v)}
              style={{ fontSize: 11, background: paused ? '#0284c7' : 'transparent',
                border: '1px solid #1e2736', borderRadius: 4, padding: '2px 8px',
                color: paused ? 'white' : '#64748b', cursor: 'pointer' }}>
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button onClick={() => { setLines([]); sinceRef.current = 0 }}
              style={{ fontSize: 11, background: 'transparent', border: '1px solid #1e2736',
                borderRadius: 4, padding: '2px 6px', color: '#64748b', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4 }}>
              <Trash2 size={11} /> Clear
            </button>
            <span style={{ fontSize: 11, color: '#475569', marginLeft: 'auto' }}>
              Polls every 2s · last 300 lines
            </span>
          </div>

          {/* Log lines */}
          <div style={{ height: 280, overflowY: 'auto', padding: '8px 0', background: '#0b0f1a' }}>
            {lines.length === 0 ? (
              <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', paddingTop: 40 }}>
                No log lines yet…
              </p>
            ) : lines.map((l, i) => {
              const t = new Date(l.ts * 1000)
              const timeStr = t.toTimeString().slice(0, 8)
              const isErr = l.level === 'ERROR' || l.level === 'CRITICAL' || l.level === 'WARNING'
              return (
                <div key={`${l.ts}-${i}`} style={{
                  display: 'flex', gap: 8, padding: '1px 14px', fontSize: 11,
                  fontFamily: 'monospace', lineHeight: 1.6,
                  background: isErr ? `${LEVEL_COLOR[l.level]}10` : 'transparent',
                }}>
                  <span style={{ color: '#334155', flexShrink: 0, width: 56 }}>{timeStr}</span>
                  <span style={{ color: LEVEL_COLOR[l.level] ?? '#94a3b8',
                    flexShrink: 0, width: 52, fontWeight: 600 }}>{l.level}</span>
                  <span style={{ color: '#475569', flexShrink: 0, maxWidth: 120,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.logger}</span>
                  <span style={{ color: isErr ? LEVEL_COLOR[l.level] : '#94a3b8', wordBreak: 'break-all' }}>
                    {l.message}
                  </span>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  )
}
