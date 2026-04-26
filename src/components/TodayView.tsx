import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Task } from '../types'

interface TodayViewProps {
  tasks: Task[]
  onOpen: (task: Task) => void
  onAddTask: () => void
  userId: string | null
  onTaskUpdated: () => void
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isToday(dateStr: string): boolean {
  const t = parseDate(dateStr)
  const n = new Date()
  return t.getFullYear() === n.getFullYear() &&
    t.getMonth() === n.getMonth() &&
    t.getDate() === n.getDate()
}

function isOverdue(dateStr: string): boolean {
  return parseDate(dateStr) < new Date(new Date().setHours(0, 0, 0, 0))
}

function getDaysOverdue(dateStr: string): number {
  const diff = new Date(new Date().setHours(0, 0, 0, 0)).getTime() - parseDate(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

const priorityColor: Record<string, string> = {
  high:   '#f87171',
  normal: '#fb923c',
  low:    '#34d399',
}

const statusLabel: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  in_review:   'In Review',
  done:        'Done',
}

const statusColor: Record<string, string> = {
  todo:        'rgba(255,255,255,0.45)',
  in_progress: '#a78bfa',
  in_review:   '#fb923c',
  done:        '#34d399',
}

const statusBg: Record<string, string> = {
  todo:        'rgba(255,255,255,0.05)',
  in_progress: 'rgba(167,139,250,0.1)',
  in_review:   'rgba(251,146,60,0.1)',
  done:        'rgba(52,211,153,0.1)',
}

interface TaskRowProps {
  task: Task
  onOpen: (task: Task) => void
  showBadge?: 'overdue' | 'today' | 'progress'
  userId: string | null
  onTaskUpdated: () => void
}

function TaskRow({ task, onOpen, showBadge, userId, onTaskUpdated }: TaskRowProps) {
  const [marking, setMarking] = useState(false)
  const [done, setDone] = useState(task.status === 'done')
  const daysOver = task.due_date && showBadge === 'overdue' ? getDaysOverdue(task.due_date) : 0

  const markDone = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (marking || done) return
    setMarking(true)
    setDone(true)
    const { error } = await supabase.from('tasks').update({
      status: 'done',
      last_edited_by: userId,
      last_edited_at: new Date().toISOString(),
    }).eq('id', task.id)
    if (error) {
      setDone(false)
      console.error('Mark done error:', error)
    } else {
      setTimeout(() => onTaskUpdated(), 600)
    }
    setMarking(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: done ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -14, transition: { duration: 0.22 } }}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px 9px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: done
          ? '3px solid rgba(52,211,153,0.35)'
          : showBadge === 'overdue'
          ? '3px solid rgba(248,113,113,0.75)'
          : showBadge === 'today'
          ? '3px solid rgba(167,139,250,0.75)'
          : '3px solid rgba(52,211,153,0.6)',
        borderRadius: '10px',
        cursor: 'pointer',
        marginBottom: '6px',
        userSelect: 'none',
      }}
      onClick={() => onOpen(task)}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      whileTap={{ scale: 0.998 }}
    >
      {/* Mark done circle button */}
      <button
        onClick={markDone}
        title={done ? 'Done' : 'Mark as done'}
        style={{
          width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
          border: done
            ? '2px solid #34d399'
            : showBadge === 'overdue'
            ? '2px solid rgba(248,113,113,0.45)'
            : '2px solid rgba(255,255,255,0.18)',
          background: done ? 'rgba(52,211,153,0.18)' : 'transparent',
          cursor: done ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
          padding: 0, outline: 'none',
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Title only — no description for compact rows */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: '13px', fontWeight: done ? 400 : 500,
          color: done ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.88)',
          textDecoration: done ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: 'Space Grotesk',
        }}>
          {task.title}
        </p>
      </div>

      {/* Badges — hidden when done */}
      {!done && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {task.priority && task.priority !== 'normal' && (
            <span style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
              color: priorityColor[task.priority] ?? '#fff',
              fontFamily: 'Space Mono',
            }}>
              {task.priority.toUpperCase()}
            </span>
          )}
          <span style={{
            fontSize: '10px', padding: '2px 7px', borderRadius: '5px',
            background: statusBg[task.status] ?? 'rgba(255,255,255,0.05)',
            color: statusColor[task.status] ?? 'rgba(255,255,255,0.38)',
            fontFamily: 'Space Mono',
          }}>
            {statusLabel[task.status] ?? task.status}
          </span>
          {showBadge === 'overdue' && daysOver > 0 && (
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '5px',
              background: 'rgba(248,113,113,0.1)',
              color: '#f87171', fontFamily: 'Space Mono',
            }}>
              {daysOver}d late
            </span>
          )}
          {showBadge === 'today' && (
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '5px',
              background: 'rgba(167,139,250,0.1)',
              color: '#a78bfa', fontFamily: 'Space Mono',
            }}>
              today
            </span>
          )}
        </div>
      )}

      {!done && <span style={{ color: 'rgba(255,255,255,0.14)', fontSize: '12px' }}>›</span>}
    </motion.div>
  )
}

interface SectionProps {
  title: string
  count: number
  color: string
  emoji: string
  children: React.ReactNode
}

function Section({ title, count, color, emoji, children }: SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ marginBottom: '22px' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
      }}>
        <span style={{ fontSize: '13px' }}>{emoji}</span>
        <h3 style={{
          margin: 0, fontSize: '11px', fontWeight: 600,
          color, fontFamily: 'Space Grotesk',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {title}
        </h3>
        <span style={{
          fontSize: '10px', fontWeight: 700, color,
          background: `${color}15`, border: `1px solid ${color}28`,
          borderRadius: '5px', padding: '1px 6px', fontFamily: 'Space Mono',
        }}>
          {count}
        </span>
        <div style={{ flex: 1, height: '1px', background: `${color}12` }} />
      </div>
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </motion.div>
  )
}

export default function TodayView({ tasks, onOpen, onAddTask, userId, onTaskUpdated }: TodayViewProps) {
  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const overdueTasks = tasks
    .filter(t => t.due_date && isOverdue(t.due_date) && t.status !== 'done')
    .sort((a, b) => getDaysOverdue(b.due_date!) - getDaysOverdue(a.due_date!))

  const dueTodayTasks = tasks.filter(t =>
    t.due_date && isToday(t.due_date) && t.status !== 'done'
  )

  const inProgressTasks = tasks.filter(t =>
    t.status === 'in_progress' && !(t.due_date && (isOverdue(t.due_date) || isToday(t.due_date)))
  )

  const completedCount = tasks.filter(t => t.status === 'done').length
  const totalActionable = overdueTasks.length + dueTodayTasks.length + inProgressTasks.length
  const allClear = totalActionable === 0

  // Fix: proper greeting for all hours including late night
  const hour = today.getHours()
  const greeting =
    hour < 5  ? 'Working late.' :
    hour < 12 ? 'Good morning.' :
    hour < 17 ? 'Good afternoon.' :
    hour < 21 ? 'Good evening.' :
                'Still at it.'

  const headline =
    overdueTasks.length > 0
      ? `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} need${overdueTasks.length === 1 ? 's' : ''} attention.`
      : dueTodayTasks.length > 0
      ? `${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''} due today.`
      : inProgressTasks.length > 0
      ? `${inProgressTasks.length} task${inProgressTasks.length > 1 ? 's' : ''} in progress.`
      : "You're all caught up."

  // Only show pills with count > 0, always show Done
  const pills = [
    overdueTasks.length > 0    && { label: 'Overdue',     count: overdueTasks.length,    color: '#f87171', bg: 'rgba(248,113,113,0.09)', border: 'rgba(248,113,113,0.22)' },
    dueTodayTasks.length > 0   && { label: 'Due today',   count: dueTodayTasks.length,   color: '#a78bfa', bg: 'rgba(167,139,250,0.09)', border: 'rgba(167,139,250,0.22)' },
    inProgressTasks.length > 0 && { label: 'In progress', count: inProgressTasks.length, color: '#34d399', bg: 'rgba(52,211,153,0.09)',  border: 'rgba(52,211,153,0.22)'  },
    { label: 'Done', count: completedCount, color: 'rgba(255,255,255,0.28)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
  ].filter(Boolean) as { label: string; count: number; color: string; bg: string; border: string }[]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{ maxWidth: '640px' }}
    >
      {/* Header */}
      <div style={{ marginBottom: '22px' }}>
        <p style={{
          margin: '0 0 4px', fontSize: '11px', fontFamily: 'Space Mono',
          color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em',
        }}>
          {dayName.toUpperCase()} · {dateStr.toUpperCase()}
        </p>
        <h2 style={{
          margin: '0 0 4px', fontSize: '26px', fontWeight: 700,
          color: '#fff', fontFamily: 'Space Grotesk',
          letterSpacing: '-0.02em', lineHeight: 1.2,
        }}>
          {greeting}
        </h2>
        <p style={{
          margin: 0, fontSize: '14px', fontFamily: 'Space Grotesk',
          color: overdueTasks.length > 0 ? '#f87171' : 'rgba(255,255,255,0.42)',
        }}>
          {headline}
        </p>
      </div>

      {/* Summary pills — only non-zero + done */}
      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '26px' }}>
        {pills.map(p => (
          <div key={p.label} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: p.bg, border: `1px solid ${p.border}`,
            borderRadius: '8px', padding: '5px 11px',
          }}>
            <span style={{
              fontSize: '13px', fontWeight: 700,
              color: p.color, fontFamily: 'Space Mono',
            }}>
              {String(p.count).padStart(2, '0')}
            </span>
            <span style={{ fontSize: '11px', color: p.color, fontFamily: 'Space Grotesk' }}>
              {p.label}
            </span>
          </div>
        ))}
      </div>

      {/* All clear */}
      {allClear && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            textAlign: 'center', padding: '44px 24px',
            background: 'rgba(52,211,153,0.04)',
            border: '1px solid rgba(52,211,153,0.14)',
            borderRadius: '14px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>✓</div>
          <h3 style={{
            margin: '0 0 6px', fontSize: '18px', fontWeight: 600,
            color: '#34d399', fontFamily: 'Space Grotesk',
          }}>
            Board is clear.
          </h3>
          <p style={{
            margin: '0 0 16px', fontSize: '13px',
            color: 'rgba(255,255,255,0.38)', fontFamily: 'Space Grotesk',
          }}>
            No overdue tasks, nothing due today. What are we building next?
          </p>
          <button
            onClick={onAddTask}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none', borderRadius: '8px', padding: '8px 18px',
              color: 'white', fontSize: '13px', fontWeight: 600,
              fontFamily: 'Space Grotesk', cursor: 'pointer',
            }}
          >
            + Add a task
          </button>
        </motion.div>
      )}

      {/* Overdue */}
      {overdueTasks.length > 0 && (
        <Section title="Overdue" count={overdueTasks.length} color="#f87171" emoji="🔴">
          {overdueTasks.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <TaskRow task={task} onOpen={onOpen} showBadge="overdue" userId={userId} onTaskUpdated={onTaskUpdated} />
            </motion.div>
          ))}
        </Section>
      )}

      {/* Due today */}
      {dueTodayTasks.length > 0 && (
        <Section title="Due today" count={dueTodayTasks.length} color="#a78bfa" emoji="📅">
          {dueTodayTasks.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <TaskRow task={task} onOpen={onOpen} showBadge="today" userId={userId} onTaskUpdated={onTaskUpdated} />
            </motion.div>
          ))}
        </Section>
      )}

      {/* In progress */}
      {inProgressTasks.length > 0 && (
        <Section title="In progress" count={inProgressTasks.length} color="#34d399" emoji="⚡">
          {inProgressTasks.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <TaskRow task={task} onOpen={onOpen} showBadge="progress" userId={userId} onTaskUpdated={onTaskUpdated} />
            </motion.div>
          ))}
        </Section>
      )}

      {/* Add task nudge */}
      {!allClear && (
        <div
          onClick={onAddTask}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 14px', marginTop: '4px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: '10px', cursor: 'pointer',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '15px', lineHeight: 1 }}>+</span>
          <span style={{
            fontSize: '12px', color: 'rgba(255,255,255,0.22)',
            fontFamily: 'Space Grotesk',
          }}>
            Add a task for today
          </span>
        </div>
      )}
    </motion.div>
  )
}