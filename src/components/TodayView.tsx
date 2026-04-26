import { motion } from 'framer-motion'
import type { Task } from '../types'

interface TodayViewProps {
  tasks: Task[]
  onOpen: (task: Task) => void
  onAddTask: () => void
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

interface TaskRowProps {
  task: Task
  onOpen: (task: Task) => void
  showBadge?: 'overdue' | 'today' | 'progress'
}

function TaskRow({ task, onOpen, showBadge }: TaskRowProps) {
  const daysOver = task.due_date && showBadge === 'overdue' ? getDaysOverdue(task.due_date) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: showBadge === 'overdue'
          ? '3px solid rgba(248,113,113,0.7)'
          : showBadge === 'today'
          ? '3px solid rgba(167,139,250,0.7)'
          : '3px solid rgba(52,211,153,0.6)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        marginBottom: '8px',
        userSelect: 'none',
      }}
      whileHover={{ background: 'rgba(255,255,255,0.055)', scale: 1.005 }}
      whileTap={{ scale: 0.998 }}
    >
      {/* Status dot */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background:
          task.status === 'done'        ? '#34d399' :
          task.status === 'in_progress' ? '#a78bfa' :
          task.status === 'in_review'   ? '#fb923c' :
          'rgba(255,255,255,0.25)',
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: '14px', fontWeight: 500,
          color: task.status === 'done' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: 'Space Grotesk',
        }}>
          {task.title}
        </p>
        {task.description && (
          <p style={{
            margin: '2px 0 0', fontSize: '12px',
            color: 'rgba(255,255,255,0.35)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'Space Grotesk',
          }}>
            {task.description}
          </p>
        )}
      </div>

      {/* Right side — badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
        {/* Priority */}
        {task.priority && task.priority !== 'normal' && (
          <span style={{
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
            color: priorityColor[task.priority] ?? '#fff',
            fontFamily: 'Space Mono',
          }}>
            {task.priority.toUpperCase()}
          </span>
        )}

        {/* Status chip */}
        <span style={{
          fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.45)',
          fontFamily: 'Space Mono', letterSpacing: '0.04em',
        }}>
          {statusLabel[task.status] ?? task.status}
        </span>

        {/* Overdue days */}
        {showBadge === 'overdue' && daysOver > 0 && (
          <span style={{
            fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
            background: 'rgba(248,113,113,0.12)',
            color: '#f87171',
            fontFamily: 'Space Mono',
          }}>
            {daysOver}d late
          </span>
        )}

        {/* Due today chip */}
        {showBadge === 'today' && task.due_date && (
          <span style={{
            fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
            background: 'rgba(167,139,250,0.12)',
            color: '#a78bfa',
            fontFamily: 'Space Mono',
          }}>
            today
          </span>
        )}
      </div>

      {/* Chevron */}
      <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '12px' }}>›</span>
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ marginBottom: '28px' }}
    >
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '16px' }}>{emoji}</span>
        <h3 style={{
          margin: 0, fontSize: '13px', fontWeight: 600,
          color, fontFamily: 'Space Grotesk', letterSpacing: '0.02em',
        }}>
          {title}
        </h3>
        <span style={{
          fontSize: '11px', fontWeight: 700,
          color,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          borderRadius: '6px', padding: '1px 7px',
          fontFamily: 'Space Mono',
        }}>
          {count}
        </span>
        <div style={{ flex: 1, height: '1px', background: `${color}18` }} />
      </div>

      {children}
    </motion.div>
  )
}

export default function TodayView({ tasks, onOpen, onAddTask }: TodayViewProps) {
  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const overdueTasks = tasks
    .filter(t => t.due_date && isOverdue(t.due_date) && t.status !== 'done')
    .sort((a, b) => getDaysOverdue(b.due_date!) - getDaysOverdue(a.due_date!))

  const dueTodayTasks = tasks.filter(t => t.due_date && isToday(t.due_date) && t.status !== 'done')

  const inProgressTasks = tasks.filter(t =>
    t.status === 'in_progress' && !(t.due_date && (isOverdue(t.due_date) || isToday(t.due_date)))
  )

  const completedToday = tasks.filter(t => t.status === 'done')

  const totalActionable = overdueTasks.length + dueTodayTasks.length + inProgressTasks.length
  const allClear = totalActionable === 0

  // Morning greeting
  const hour = today.getHours()
  const greeting =
    hour < 12 ? 'Good morning.' :
    hour < 17 ? 'Good afternoon.' :
    'Good evening.'

  // Smart headline based on state
  const headline =
    overdueTasks.length > 0
      ? `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} need${overdueTasks.length === 1 ? 's' : ''} attention.`
      : dueTodayTasks.length > 0
      ? `${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''} due today.`
      : inProgressTasks.length > 0
      ? `${inProgressTasks.length} task${inProgressTasks.length > 1 ? 's' : ''} in progress.`
      : 'You\'re all caught up.'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: '680px' }}
    >
      {/* ── HEADER ── */}
      <div style={{ marginBottom: '32px' }}>
        <p style={{
          margin: '0 0 4px',
          fontSize: '12px', fontFamily: 'Space Mono',
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em',
        }}>
          {dayName.toUpperCase()} · {dateStr.toUpperCase()}
        </p>
        <h2 style={{
          margin: '0 0 4px', fontSize: '28px', fontWeight: 700,
          color: '#fff', fontFamily: 'Space Grotesk', letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          {greeting}
        </h2>
        <p style={{
          margin: 0, fontSize: '15px',
          color: overdueTasks.length > 0 ? '#f87171' : 'rgba(255,255,255,0.5)',
          fontFamily: 'Space Grotesk',
        }}>
          {headline}
        </p>
      </div>

      {/* ── SUMMARY PILLS ── */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '32px',
      }}>
        {[
          { label: 'Overdue', count: overdueTasks.length, color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
          { label: 'Due today', count: dueTodayTasks.length, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
          { label: 'In progress', count: inProgressTasks.length, color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
          { label: 'Done', count: completedToday.length, color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
        ].map(p => (
          <div key={p.label} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: p.bg, border: `1px solid ${p.border}`,
            borderRadius: '10px', padding: '7px 14px',
          }}>
            <span style={{
              fontSize: '16px', fontWeight: 700,
              color: p.color, fontFamily: 'Space Mono',
            }}>
              {String(p.count).padStart(2, '0')}
            </span>
            <span style={{
              fontSize: '12px', color: p.color,
              fontFamily: 'Space Grotesk',
            }}>
              {p.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── ALL CLEAR STATE ── */}
      {allClear && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            textAlign: 'center', padding: '48px 24px',
            background: 'rgba(52,211,153,0.04)',
            border: '1px solid rgba(52,211,153,0.15)',
            borderRadius: '16px',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
          <h3 style={{
            margin: '0 0 8px', fontSize: '20px', fontWeight: 600,
            color: '#34d399', fontFamily: 'Space Grotesk',
          }}>
            Board is clear.
          </h3>
          <p style={{
            margin: '0 0 20px', fontSize: '14px',
            color: 'rgba(255,255,255,0.45)', fontFamily: 'Space Grotesk',
          }}>
            No overdue tasks, nothing due today. What are we building next?
          </p>
          <button
            onClick={onAddTask}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none', borderRadius: '8px',
              padding: '9px 20px', color: 'white',
              fontSize: '13px', fontWeight: 600,
              fontFamily: 'Space Grotesk', cursor: 'pointer',
              boxShadow: '0 0 20px rgba(139,92,246,0.35)',
            }}
          >
            + Add a task
          </button>
        </motion.div>
      )}

      {/* ── OVERDUE ── */}
      {overdueTasks.length > 0 && (
        <Section title="Overdue" count={overdueTasks.length} color="#f87171" emoji="🔴">
          {overdueTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <TaskRow task={task} onOpen={onOpen} showBadge="overdue" />
            </motion.div>
          ))}
        </Section>
      )}

      {/* ── DUE TODAY ── */}
      {dueTodayTasks.length > 0 && (
        <Section title="Due today" count={dueTodayTasks.length} color="#a78bfa" emoji="📅">
          {dueTodayTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <TaskRow task={task} onOpen={onOpen} showBadge="today" />
            </motion.div>
          ))}
        </Section>
      )}

      {/* ── IN PROGRESS ── */}
      {inProgressTasks.length > 0 && (
        <Section title="In progress" count={inProgressTasks.length} color="#34d399" emoji="⚡">
          {inProgressTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <TaskRow task={task} onOpen={onOpen} showBadge="progress" />
            </motion.div>
          ))}
        </Section>
      )}

      {/* ── ADD TASK NUDGE — when tasks exist but nothing new ── */}
      {!allClear && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '10px', cursor: 'pointer',
          marginTop: '4px',
        }}
          onClick={onAddTask}
        >
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '18px', lineHeight: 1 }}>+</span>
          <span style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.3)',
            fontFamily: 'Space Grotesk',
          }}>
            Add a task for today
          </span>
        </div>
      )}
    </motion.div>
  )
}