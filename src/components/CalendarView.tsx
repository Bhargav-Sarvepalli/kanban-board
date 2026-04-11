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
  low: { color: '#64748b', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)' },
  normal: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)' },
  high: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' },
}

// Parse date without timezone shift
const parseDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function CalendarView({ tasks, onOpenTask }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const getTasksForDay = (day: Date) =>
    tasks.filter(t => t.due_date && isSameDay(parseDate(t.due_date), day))

  const getTasksForMonth = () =>
    tasks.filter(t => t.due_date && isSameMonth(parseDate(t.due_date), currentMonth))

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : []
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

      {/* Calendar grid */}
      <div style={{ flex: 1 }}>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}
          >←</motion.button>

          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              color: 'white', fontSize: '20px', fontWeight: 700,
              fontFamily: 'Space Grotesk', letterSpacing: '-0.02em', margin: 0,
            }}>
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.2em', marginTop: '2px' }}>
              {getTasksForMonth().length} TASKS THIS MONTH
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}
          >→</motion.button>
        </div>

        {/* Week day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {weekDays.map(day => (
            <div key={day} style={{
              textAlign: 'center', padding: '8px 0',
              color: 'rgba(255,255,255,0.2)', fontSize: '10px',
              fontFamily: 'Space Mono', letterSpacing: '0.15em',
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {days.map(day => {
            const dayTasks = getTasksForDay(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const isTodayDate = isToday(day)

            return (
              <motion.div
                key={day.toISOString()}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                style={{
                  minHeight: '90px', padding: '8px',
                  borderRadius: '10px', cursor: 'pointer',
                  border: `1px solid ${isSelected ? 'rgba(139,92,246,0.5)' : isTodayDate ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)'}`,
                  background: isSelected ? 'rgba(139,92,246,0.08)' : isTodayDate ? 'rgba(139,92,246,0.04)' : 'rgba(255,255,255,0.01)',
                  transition: 'all 0.15s',
                  opacity: isCurrentMonth ? 1 : 0.3,
                }}
              >
                {/* Day number */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '12px', fontFamily: 'Space Mono',
                    fontWeight: isTodayDate ? 700 : 400,
                    color: isTodayDate ? '#8b5cf6' : isCurrentMonth ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
                    width: '22px', height: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    background: isTodayDate ? 'rgba(139,92,246,0.2)' : 'transparent',
                  }}>
                    {format(day, 'd')}
                  </span>
                  {dayTasks.length > 0 && (
                    <span style={{ fontSize: '9px', fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.3)' }}>
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* Task pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayTasks.slice(0, 3).map(task => {
                    const p = priorityColors[task.priority]
                    return (
                      <div
                        key={task.id}
                        onClick={e => { e.stopPropagation(); onOpenTask(task) }}
                        style={{
                          background: p.bg, border: `1px solid ${p.border}`,
                          borderRadius: '4px', padding: '2px 5px',
                          fontSize: '9px', fontFamily: 'Space Grotesk',
                          color: p.color, whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          cursor: 'pointer',
                        }}
                      >
                        {task.title}
                      </div>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <div style={{ fontSize: '9px', fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.3)', paddingLeft: '4px' }}>
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
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '20px', marginBottom: '12px',
        }}>
          {selectedDay ? (
            <>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: 0, fontFamily: 'Space Grotesk' }}>
                  {format(selectedDay, 'MMMM d')}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginTop: '2px' }}>
                  {format(selectedDay, 'EEEE').toUpperCase()}
                </p>
              </div>

              {selectedDayTasks.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'Space Mono', textAlign: 'center', padding: '20px 0' }}>
                  NO TASKS
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDayTasks.map(task => {
                    const p = priorityColors[task.priority]
                    return (
                      <motion.div
                        key={task.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => onOpenTask(task)}
                        style={{
                          background: p.bg, border: `1px solid ${p.border}`,
                          borderRadius: '10px', padding: '10px 12px',
                          cursor: 'pointer', borderLeft: `2px solid ${p.color}`,
                        }}
                      >
                        <p style={{ color: 'white', fontSize: '12px', fontWeight: 600, margin: '0 0 4px', fontFamily: 'Space Grotesk' }}>
                          {task.title}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: p.color, fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>
                            {task.priority.toUpperCase()}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Space Mono' }}>
                            {task.status.replace('_', ' ').toUpperCase()}
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
              <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>
                SELECT A DAY
              </p>
              <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '11px', fontFamily: 'Space Mono', marginTop: '4px' }}>
                TO SEE TASKS
              </p>
            </div>
          )}
        </div>

        {/* Month summary */}
        <div style={{
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '20px',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.2em', marginBottom: '12px' }}>
            MONTH SUMMARY
          </p>
          {[
            { label: 'Total', value: getTasksForMonth().length, color: '#8b5cf6' },
            {
              label: 'Completed',
              value: getTasksForMonth().filter(t => t.status === 'done').length,
              color: '#10b981',
            },
            {
              label: 'Overdue',
              value: getTasksForMonth().filter(t => {
                if (!t.due_date) return false
                const due = parseDate(t.due_date)
                return due < new Date(new Date().setHours(0, 0, 0, 0)) && t.status !== 'done'
              }).length,
              color: '#ef4444',
            },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'Space Grotesk' }}>
                {stat.label}
              </span>
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