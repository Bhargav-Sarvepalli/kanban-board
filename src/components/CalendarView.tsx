import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { motion } from 'framer-motion'
import type { Task } from '../types'

interface Props {
  tasks: Task[]
  onOpenTask: (task: Task) => void
}

const priorityColors = {
  low:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.35)' },
  normal: { color: '#a78bfa', bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)'  },
  high:   { color: '#f87171', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)'   },
}

const getPriority = (p: string | null) => priorityColors[p as keyof typeof priorityColors] ?? priorityColors.normal

const parseDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function CalendarView({ tasks, onOpenTask }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  const getTasksForDay   = (day: Date) => tasks.filter(t => t.due_date && isSameDay(parseDate(t.due_date), day))
  const getTasksForMonth = ()           => tasks.filter(t => t.due_date && isSameMonth(parseDate(t.due_date), currentMonth))

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : []
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

  const today = new Date(new Date().setHours(0, 0, 0, 0))

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

      {/* Calendar grid */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            }}
          >←</motion.button>

          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, fontFamily: 'Space Grotesk', letterSpacing: '-0.02em', margin: 0 }}>
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.2em', marginTop: '2px' }}>
              {getTasksForMonth().length} TASKS THIS MONTH
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            }}
          >→</motion.button>
        </div>

        {/* Week day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {weekDays.map(day => (
            <div key={day} style={{
              textAlign: 'center', padding: '8px 0',
              color: 'rgba(255,255,255,0.45)', fontSize: '10px',
              fontFamily: 'Space Mono', letterSpacing: '0.15em',
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {days.map(day => {
            const dayTasks       = getTasksForDay(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isSelected     = selectedDay ? isSameDay(day, selectedDay) : false
            const isTodayDate    = isToday(day)

            return (
              <motion.div
                key={day.toISOString()}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedDay(selectedDay && isSameDay(day, selectedDay) ? null : day)}
                style={{
                  minHeight: '90px', padding: '8px',
                  borderRadius: '10px', cursor: 'pointer',
                  border: `1px solid ${
                    isSelected   ? 'rgba(139,92,246,0.6)'  :
                    isTodayDate  ? 'rgba(139,92,246,0.35)' :
                    'rgba(255,255,255,0.08)'
                  }`,
                  background: isSelected
                    ? 'rgba(139,92,246,0.1)'
                    : isTodayDate
                    ? 'rgba(139,92,246,0.05)'
                    : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.15s',
                  opacity: isCurrentMonth ? 1 : 0.35,
                  overflow: 'hidden',  // ← prevents cell itself from stretching
                }}
              >
                {/* Day number + task count */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '12px', fontFamily: 'Space Mono',
                    fontWeight: isTodayDate ? 700 : 400,
                    color: isTodayDate ? '#a78bfa' : isCurrentMonth ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)',
                    width: '22px', height: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    background: isTodayDate ? 'rgba(139,92,246,0.25)' : 'transparent',
                    flexShrink: 0,
                  }}>
                    {format(day, 'd')}
                  </span>
                  {dayTasks.length > 0 && (
                    <span style={{ fontSize: '9px', fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.4)' }}>
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* Task pills — truncated, with done strikethrough */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayTasks.slice(0, 3).map(task => {
                    const p    = getPriority(task.priority)
                    const done = task.status === 'done'
                    return (
                      <div
                        key={task.id}
                        onClick={e => { e.stopPropagation(); onOpenTask(task) }}
                        title={task.title}  // ← full title on hover
                        style={{
                          background:     done ? 'rgba(255,255,255,0.04)' : p.bg,
                          border:         `1px solid ${done ? 'rgba(255,255,255,0.1)' : p.border}`,
                          borderRadius:   '4px',
                          padding:        '2px 5px',
                          fontSize:       '9px',
                          fontFamily:     'Space Grotesk',
                          color:          done ? 'rgba(255,255,255,0.3)' : p.color,
                          // ── text truncation ──
                          whiteSpace:     'nowrap',
                          overflow:       'hidden',
                          textOverflow:   'ellipsis',
                          maxWidth:       '100%',
                          display:        'block',
                          // ── done state ──
                          textDecoration: done ? 'line-through' : 'none',
                          cursor:         'pointer',
                        }}
                      >
                        {done && '✓ '}{task.title}
                      </div>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <div style={{ fontSize: '9px', fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.4)', paddingLeft: '4px' }}>
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Side panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{ width: '280px', flexShrink: 0, position: 'sticky', top: '24px' }}
      >
        {/* Selected day tasks */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px', padding: '20px', marginBottom: '12px',
        }}>
          {selectedDay ? (
            <>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: 0, fontFamily: 'Space Grotesk' }}>
                  {format(selectedDay, 'MMMM d')}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginTop: '2px' }}>
                  {format(selectedDay, 'EEEE').toUpperCase()}
                </p>
              </div>

              {selectedDayTasks.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontFamily: 'Space Mono', textAlign: 'center', padding: '20px 0' }}>
                  NO TASKS
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDayTasks.map(task => {
                    const p    = getPriority(task.priority)
                    const done = task.status === 'done'
                    const isOverdue = task.due_date && parseDate(task.due_date) < today && !done
                    return (
                      <motion.div
                        key={task.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => onOpenTask(task)}
                        style={{
                          background:  done ? 'rgba(255,255,255,0.03)' : p.bg,
                          border:      `1px solid ${done ? 'rgba(255,255,255,0.08)' : p.border}`,
                          borderRadius: '10px', padding: '10px 12px',
                          cursor: 'pointer',
                          borderLeft: `2px solid ${done ? 'rgba(255,255,255,0.15)' : isOverdue ? '#ef4444' : p.color}`,
                          opacity: done ? 0.7 : 1,
                        }}
                      >
                        <p style={{
                          color: done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.9)',
                          fontSize: '12px', fontWeight: 600,
                          margin: '0 0 4px', fontFamily: 'Space Grotesk',
                          textDecoration: done ? 'line-through' : 'none',
                        }}>
                          {done ? '✓ ' : ''}{task.title}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: done ? 'rgba(255,255,255,0.3)' : p.color, fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>
                            {(task.priority ?? 'normal').toUpperCase()}
                          </span>
                          <span style={{ color: done ? '#10b981' : isOverdue ? '#ef4444' : 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: 'Space Mono' }}>
                            {done ? 'DONE' : isOverdue ? 'OVERDUE' : task.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>SELECT A DAY</p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'Space Mono', marginTop: '4px' }}>TO SEE TASKS</p>
            </div>
          )}
        </div>

        {/* Month summary */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px', padding: '20px',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.2em', marginBottom: '16px' }}>
            MONTH SUMMARY
          </p>
          {[
            { label: 'Total',     value: getTasksForMonth().length,                                                                                            color: '#8b5cf6' },
            { label: 'Completed', value: getTasksForMonth().filter(t => t.status === 'done').length,                                                           color: '#10b981' },
            { label: 'Overdue',   value: getTasksForMonth().filter(t => t.due_date && parseDate(t.due_date) < today && t.status !== 'done').length,            color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '10px', paddingBottom: '10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'Space Grotesk' }}>{stat.label}</span>
              <span style={{ color: stat.color, fontSize: '16px', fontWeight: 700, fontFamily: 'Space Mono' }}>
                {String(stat.value).padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default CalendarView