import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const demoTasks = [
  { id: '1', title: 'Design system tokens', priority: 'high', status: 'todo', tag: 'DESIGN', due: 'Due today' },
  { id: '2', title: 'Build auth flow', priority: 'normal', status: 'todo', tag: 'DEV', due: 'Due in 2d' },
  { id: '3', title: 'API integration', priority: 'high', status: 'in_progress', tag: 'DEV', due: 'Overdue 1d' },
  { id: '4', title: 'User research', priority: 'low', status: 'in_progress', tag: 'UX', due: 'Apr 15' },
  { id: '5', title: 'Component library', priority: 'normal', status: 'in_review', tag: 'DEV', due: 'Apr 12' },
  { id: '6', title: 'Landing page', priority: 'high', status: 'done', tag: 'DESIGN', due: 'Done' },
  { id: '7', title: 'Deploy to Vercel', priority: 'normal', status: 'done', tag: 'OPS', due: 'Done' },
]

const columns = [
  { id: 'todo', label: 'TO DO', color: '#94a3b8', dot: '#94a3b8' },
  { id: 'in_progress', label: 'IN PROGRESS', color: '#8b5cf6', dot: '#8b5cf6' },
  { id: 'in_review', label: 'IN REVIEW', color: '#f59e0b', dot: '#f59e0b' },
  { id: 'done', label: 'DONE', color: '#10b981', dot: '#10b981' },
]

const priorityColors = {
  low: '#64748b',
  normal: '#8b5cf6',
  high: '#ef4444',
}

const tagColors: Record<string, string> = {
  DESIGN: '#ec4899',
  DEV: '#8b5cf6',
  UX: '#06b6d4',
  OPS: '#10b981',
}

function DemoTaskCard({ task, index }: { task: typeof demoTasks[0]; index: number }) {
  const priorityColor = priorityColors[task.priority as keyof typeof priorityColors]
  const tagColor = tagColors[task.tag] || '#8b5cf6'
  const isOverdue = task.due.includes('Overdue')
  const isToday = task.due.includes('today')
  const isDone = task.status === 'done'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid rgba(255,255,255,0.06)`,
        borderLeft: `2px solid ${priorityColor}`,
        borderRadius: '8px',
        padding: '10px',
        marginBottom: '6px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: '60px',
        background: `linear-gradient(to right, ${priorityColor}08, transparent)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{
          fontSize: '8px', fontFamily: 'Space Mono',
          fontWeight: 700, letterSpacing: '0.1em',
          color: tagColor,
          background: `${tagColor}15`,
          border: `1px solid ${tagColor}30`,
          padding: '1px 5px', borderRadius: '3px',
        }}>{task.tag}</span>
        <span style={{
          fontSize: '8px', fontFamily: 'Space Mono',
          color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>{task.priority}</span>
      </div>

      <p style={{
        color: isDone ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)',
        fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 500,
        margin: '0 0 6px', lineHeight: 1.3,
        textDecoration: isDone ? 'line-through' : 'none',
      }}>
        {task.title}
      </p>

      <span style={{
        fontSize: '8px', fontFamily: 'Space Mono',
        color: isOverdue ? '#ef4444' : isToday ? '#f59e0b' : isDone ? '#10b981' : 'rgba(255,255,255,0.2)',
        background: isOverdue ? 'rgba(239,68,68,0.1)' : isToday ? 'rgba(245,158,11,0.1)' : isDone ? 'rgba(16,185,129,0.1)' : 'transparent',
        padding: isOverdue || isToday || isDone ? '1px 5px' : '0',
        borderRadius: '3px',
        letterSpacing: '0.05em',
      }}>
        {task.due}
      </span>
    </motion.div>
  )
}

export default function DemoBoard() {
  const [visible, setVisible] = useState(false)
  const [aiTyping, setAiTyping] = useState(false)
  const [aiText, setAiText] = useState('')
  const fullAiText = 'Break this task into subtasks: Design system tokens, Color palette, Typography scale, Component variants...'

  useEffect(() => {
    setTimeout(() => setVisible(true), 500)
    setTimeout(() => {
      setAiTyping(true)
      let i = 0
      const interval = setInterval(() => {
        setAiText(fullAiText.slice(0, i))
        i++
        if (i > fullAiText.length) {
          clearInterval(interval)
          setTimeout(() => {
            setAiText('')
            setAiTyping(false)
            setTimeout(() => {
              setAiTyping(true)
              i = 0
              const interval2 = setInterval(() => {
                setAiText(fullAiText.slice(0, i))
                i++
                if (i > fullAiText.length) clearInterval(interval2)
              }, 35)
            }, 2000)
          }, 3000)
        }
      }, 35)
    }, 2000)
  }, [])

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#000',
      fontFamily: 'Space Grotesk, sans-serif',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Background glows */}
      <div style={{
        position: 'absolute', top: '-100px', left: '-100px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', right: '-100px',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* App header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px', height: '20px', borderRadius: '5px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 800, color: 'white',
          }}>N</div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '12px', letterSpacing: '-0.02em' }}>
            NEX<span style={{ color: '#8b5cf6' }}>TASK</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {[
            { label: '07', color: '#8b5cf6' },
            { label: '02', color: '#10b981' },
            { label: '01', color: '#ef4444' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: s.color, fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700 }}>{s.label}</span>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '8px', fontFamily: 'Space Mono' }}>
                {['TOTAL', 'DONE', 'LATE'][i]}
              </span>
            </div>
          ))}
          <div style={{
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            borderRadius: '5px', padding: '4px 10px',
            color: 'white', fontSize: '10px', fontWeight: 700,
          }}>+ New</div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: '4px', width: 'fit-content' }}>
          {['⊞ Board', '⊟ Calendar'].map((v, i) => (
            <div key={i} style={{
              padding: '4px 10px', borderRadius: '5px', fontSize: '9px',
              fontFamily: 'Space Grotesk', fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? '#8b5cf6' : 'rgba(255,255,255,0.25)',
              background: i === 0 ? 'rgba(139,92,246,0.12)' : 'transparent',
            }}>{v}</div>
          ))}
        </div>
      </div>

      {/* Board columns */}
      <div style={{
        display: 'flex', gap: '10px', padding: '12px 16px',
        overflowX: 'hidden', height: 'calc(100% - 100px)',
      }}>
        {visible && columns.map((col, ci) => {
          const colTasks = demoTasks.filter(t => t.status === col.id)
          return (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                flex: 1, minWidth: 0,
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '8px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '3px', height: '12px', borderRadius: '2px',
                    background: col.color,
                    boxShadow: `0 0 6px ${col.color}`,
                  }} />
                  <span style={{
                    color: col.color, fontSize: '8px',
                    fontFamily: 'Space Mono', fontWeight: 700,
                    letterSpacing: '0.12em',
                  }}>{col.label}</span>
                </div>
                <span style={{
                  background: `${col.color}15`,
                  color: col.color,
                  fontSize: '9px', fontFamily: 'Space Mono',
                  padding: '1px 5px', borderRadius: '3px',
                }}>{colTasks.length}</span>
              </div>

              {/* Tasks */}
              <div style={{ padding: '8px' }}>
                {colTasks.map((task, ti) => (
                  <DemoTaskCard key={task.id} task={task} index={ci * 2 + ti} />
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* AI overlay — appears periodically */}
      <AnimatePresence>
        {aiTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: 'absolute', bottom: '20px', right: '20px',
              background: '#080808',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '12px', padding: '12px 14px',
              maxWidth: '240px',
              boxShadow: '0 0 30px rgba(139,92,246,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6' }}
              />
              <span style={{ color: '#8b5cf6', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>
                AI THINKING
              </span>
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.6)', fontSize: '10px',
              fontFamily: 'Space Grotesk', lineHeight: 1.5, margin: 0,
            }}>
              {aiText}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                style={{ color: '#8b5cf6' }}
              >|</motion.span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}