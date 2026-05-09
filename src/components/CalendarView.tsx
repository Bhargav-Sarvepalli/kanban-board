import { useEffect, useState } from 'react'
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
  contextKey: string
}

interface CalendarEntry {
  id: string
  title: string
  date: string
  time: string
  type: 'meeting' | 'focus' | 'personal'
  notes: string
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

function CalendarView({ tasks, onOpenTask, contextKey }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [entryTitle, setEntryTitle] = useState('')
  const [entryTime, setEntryTime] = useState('09:00')
  const [entryType, setEntryType] = useState<CalendarEntry['type']>('meeting')
  const [entryNotes, setEntryNotes] = useState('')
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  const storageKey = `nex-calendar:${contextKey}`

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      queueMicrotask(() => setEntries(stored ? JSON.parse(stored) as CalendarEntry[] : []))
    } catch {
      queueMicrotask(() => setEntries([]))
    }
  }, [storageKey])

  const saveEntries = (next: CalendarEntry[]) => {
    setEntries(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  const getTasksForDay   = (day: Date) => tasks.filter(t => t.due_date && isSameDay(parseDate(t.due_date), day))
  const getEntriesForDay = (day: Date) => entries.filter(e => isSameDay(parseDate(e.date), day)).sort((a, b) => a.time.localeCompare(b.time))
  const getTasksForMonth = ()           => tasks.filter(t => t.due_date && isSameMonth(parseDate(t.due_date), currentMonth))

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : []
  const selectedDayEntries = selectedDay ? getEntriesForDay(selectedDay) : []
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

  const today = new Date(new Date().setHours(0, 0, 0, 0))

  const addEntry = () => {
    if (!selectedDay || !entryTitle.trim()) return
    const next: CalendarEntry = {
      id: crypto.randomUUID(),
      title: entryTitle.trim(),
      date: format(selectedDay, 'yyyy-MM-dd'),
      time: entryTime,
      type: entryType,
      notes: entryNotes.trim(),
    }
    saveEntries([...entries, next])
    setEntryTitle('')
    setEntryNotes('')
  }

  const removeEntry = (id: string) => {
    if (pendingRemoveId !== id) {
      setPendingRemoveId(id)
      return
    }
    saveEntries(entries.filter(e => e.id !== id))
    setPendingRemoveId(null)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>

      {/* Calendar grid */}
      <div style={{ flex: '1 1 620px', minWidth: 'min(620px, 100%)' }}>

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
            const dayEntries     = getEntriesForDay(day)
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
                  {(dayTasks.length + dayEntries.length) > 0 && (
                    <span style={{ fontSize: '9px', fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.4)' }}>
                      {dayTasks.length + dayEntries.length}
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
                  {dayEntries.slice(0, Math.max(0, 3 - dayTasks.length)).map(entry => (
                    <div key={entry.id} title={`${entry.time} ${entry.title}`} style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.28)', borderRadius: '4px', padding: '2px 5px', fontSize: '9px', fontFamily: 'Space Grotesk', color: '#7dd3fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.time} {entry.title}
                    </div>
                  ))}
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
        style={{ width: 'min(280px, 100%)', flex: '0 1 280px', position: 'sticky', top: '24px' }}
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

              {selectedDayTasks.length === 0 && selectedDayEntries.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontFamily: 'Space Mono', textAlign: 'center', padding: '20px 0' }}>
                  NO TASKS
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDayEntries.map(entry => (
                    <motion.div key={entry.id} whileHover={{ scale: 1.02 }} style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.24)', borderRadius: '10px', padding: '10px 12px', borderLeft: '2px solid #2dd4bf' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontWeight: 650, margin: 0, fontFamily: 'Space Grotesk' }}>{entry.title}</p>
                        <button type="button" onClick={() => removeEntry(entry.id)} title={pendingRemoveId === entry.id ? 'Confirm remove' : 'Remove entry'} style={{ background: pendingRemoveId === entry.id ? 'rgba(248,113,113,0.12)' : 'transparent', border: pendingRemoveId === entry.id ? '1px solid rgba(248,113,113,0.28)' : '1px solid transparent', borderRadius: '6px', color: pendingRemoveId === entry.id ? '#f87171' : 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '11px', padding: '2px 6px' }}>{pendingRemoveId === entry.id ? 'Remove' : 'x'}</button>
                      </div>
                      <p style={{ color: '#2dd4bf', fontSize: '9px', fontFamily: 'Space Mono', margin: '5px 0 0' }}>{entry.time} · {entry.type.toUpperCase()}</p>
                      {entry.notes && <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', margin: '6px 0 0', fontFamily: 'Space Grotesk' }}>{entry.notes}</p>}
                    </motion.div>
                  ))}
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
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.14em', margin: '0 0 10px' }}>ADD ENTRY</p>
                <input value={entryTitle} onChange={e => setEntryTitle(e.target.value)} placeholder="Meeting, reminder, focus block" style={{ width: '100%', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', padding: '9px 10px', outline: 'none', fontSize: '12px', fontFamily: 'Space Grotesk' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <input type="time" value={entryTime} onChange={e => setEntryTime(e.target.value)} style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', padding: '8px', outline: 'none', fontSize: '12px', fontFamily: 'Space Mono' }} />
                  <select value={entryType} onChange={e => setEntryType(e.target.value as CalendarEntry['type'])} style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111118', color: 'white', padding: '8px', outline: 'none', fontSize: '12px', fontFamily: 'Space Grotesk' }}>
                    <option value="meeting">Meeting</option>
                    <option value="focus">Focus</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Optional notes" style={{ width: '100%', boxSizing: 'border-box', minHeight: '58px', marginTop: '8px', resize: 'none', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', padding: '9px 10px', outline: 'none', fontSize: '12px', fontFamily: 'Space Grotesk' }} />
                <button onClick={addEntry} disabled={!entryTitle.trim()} style={{ width: '100%', height: '34px', marginTop: '8px', borderRadius: '8px', border: 'none', background: entryTitle.trim() ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: entryTitle.trim() ? 'white' : 'rgba(255,255,255,0.32)', cursor: entryTitle.trim() ? 'pointer' : 'not-allowed', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 800 }}>
                  ADD TO CALENDAR
                </button>
              </div>
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
