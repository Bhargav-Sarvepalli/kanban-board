import { useState } from 'react'
import { useFlowData } from '../../hooks/useFlowData'
import type { FlowBranch, FlowTask } from '../../hooks/useFlowData'

interface Props {
  projectId: string
  onClose: () => void
  onBranchClick: (branch: FlowBranch) => void
}

function isOverdue(t: FlowTask) {
  return !!t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date()
}

export default function StandupMode({ projectId, onClose, onBranchClick }: Props) {
  const { branches, loading } = useFlowData(null, projectId)
  const [idx, setIdx] = useState(0)

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: '#04020e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '36px', height: '36px', border: '2px solid rgba(239,68,68,0.2)', borderTop: '2px solid #ef4444', borderRadius: '50%', animation: 'smSpin 0.8s linear infinite' }} />
      <style>{`@keyframes smSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!branches.length) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: '#04020e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono', fontSize: '12px', letterSpacing: '0.2em' }}>NO BRANCHES ON FLOW YET</p>
      <button onClick={onClose} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Mono' }}>Close</button>
    </div>
  )

  const branch = branches[idx]
  const total  = branches.length
  const active  = branch.tasks.filter(t => t.status === 'in_progress')
  const review  = branch.tasks.filter(t => t.status === 'in_review')
  const todo    = branch.tasks.filter(t => t.status === 'todo')
  const done    = branch.tasks.filter(t => t.status === 'done')
  const overdue = branch.tasks.filter(t => isOverdue(t))

  const prev = () => setIdx(i => Math.max(0, i - 1))
  const next = () => {
    if (idx < total - 1) setIdx(i => i + 1)
    else onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      background: '#04020e',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Space Grotesk, sans-serif',
    }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Live dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '4px 10px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', animation: 'smPulse 1.5s ease-in-out infinite' }} />
            <span style={{ color: '#f87171', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 600, letterSpacing: '0.1em' }}>STANDUP</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {/* Progress pips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {branches.map((b, i) => (
              <div key={b.id}
                onClick={() => setIdx(i)}
                style={{
                  width: i === idx ? '20px' : '7px', height: '7px', borderRadius: '4px',
                  background: i === idx ? b.color : i < idx ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }} />
            ))}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'Space Mono' }}>
            {idx + 1} / {total}
          </span>
        </div>

        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 14px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Mono' }}>
          ESC
        </button>
      </div>

      {/* Main card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 48px', overflow: 'hidden' }}>
        <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Person / feature header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: `3px solid ${branch.color}`, overflow: 'hidden', flexShrink: 0, background: `linear-gradient(135deg, ${branch.color}, ${branch.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {branch.avatar_url
                ? <img src={branch.avatar_url} alt={branch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: 'white', fontSize: '20px', fontWeight: 800 }}>
                    {branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
              }
            </div>
            <div>
              <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{branch.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <div style={{ width: '120px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                  <div style={{ width: `${branch.progress}%`, height: '100%', background: branch.color, borderRadius: '2px' }} />
                </div>
                <span style={{ color: branch.color, fontSize: '13px', fontFamily: 'Space Mono', fontWeight: 700 }}>{branch.progress}% complete</span>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
              {[
                { label: 'Active',  value: active.length,  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
                { label: 'Review',  value: review.length,  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
                { label: 'Overdue', value: overdue.length, color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
                { label: 'Done',    value: done.length,    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '10px 16px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: '10px', minWidth: '64px' }}>
                  <p style={{ color: s.color, fontSize: '22px', fontFamily: 'Space Mono', fontWeight: 700, margin: 0 }}>{s.value}</p>
                  <p style={{ color: s.color, fontSize: '10px', fontFamily: 'Space Mono', margin: '2px 0 0', opacity: 0.8 }}>{s.label.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Three columns: Doing now / Blockers / Up next */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>

            {/* Doing now */}
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px', padding: '16px 18px' }}>
              <p style={{ color: '#60a5fa', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', fontWeight: 700, margin: '0 0 12px' }}>DOING NOW</p>
              {active.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', margin: 0 }}>Nothing active</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {active.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: '5px' }} />
                      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: 1.4 }}>{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Show in_review tasks too, lighter */}
              {review.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ color: '#fbbf24', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.1em', margin: '0 0 8px' }}>IN REVIEW</p>
                  {review.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: '5px' }} />
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: 1.4 }}>{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blockers */}
            <div style={{ background: overdue.length > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${overdue.length > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', padding: '16px 18px' }}>
              <p style={{ color: overdue.length > 0 ? '#f87171' : 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', fontWeight: 700, margin: '0 0 12px' }}>BLOCKERS</p>
              {overdue.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>No blockers</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {overdue.map(t => (
                    <div key={t.id} style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
                      <p style={{ color: '#fca5a5', fontSize: '13px', margin: '0 0 3px', lineHeight: 1.4 }}>{t.title}</p>
                      <p style={{ color: '#ef4444', fontSize: '10px', fontFamily: 'Space Mono', margin: 0 }}>
                        ⚠ Overdue{t.due_date ? ` · Due ${t.due_date.slice(5)}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Up next */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px 18px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', fontWeight: 700, margin: '0 0 12px' }}>UP NEXT</p>
              {todo.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', margin: 0 }}>Nothing planned</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {todo.slice(0, 4).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0, marginTop: '5px' }} />
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: 1.4 }}>{t.title}</span>
                    </div>
                  ))}
                  {todo.length > 4 && (
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', fontFamily: 'Space Mono' }}>+{todo.length - 4} more</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Open board link */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => onBranchClick(branch)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 20px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Mono', letterSpacing: '0.05em' }}>
              Open {branch.name} board →
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={prev} disabled={idx === 0}
          style={{ padding: '10px 28px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: idx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600, transition: 'all 0.15s' }}>
          ← Previous
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          {branches.map((b, i) => (
            <div key={b.id} onClick={() => setIdx(i)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: i === idx ? `${b.color}20` : 'transparent', border: `1px solid ${i === idx ? b.color + '60' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: i <= idx ? b.color : 'rgba(255,255,255,0.2)' }} />
              <span style={{ color: i === idx ? b.color : 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: i === idx ? 700 : 400 }}>
                {b.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>

        <button onClick={next}
          style={{ padding: '10px 28px', background: idx === total - 1 ? 'rgba(34,197,94,0.15)' : 'rgba(139,92,246,0.2)', border: `1px solid ${idx === total - 1 ? 'rgba(34,197,94,0.4)' : 'rgba(139,92,246,0.4)'}`, borderRadius: '10px', color: idx === total - 1 ? '#4ade80' : '#a78bfa', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, transition: 'all 0.15s' }}>
          {idx === total - 1 ? '✓ End standup' : `Next: ${branches[idx + 1]?.name.split(' ')[0]} →`}
        </button>
      </div>

      <style>{`
        @keyframes smPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  )
}