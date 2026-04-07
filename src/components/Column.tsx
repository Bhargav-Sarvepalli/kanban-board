import { useDroppable } from '@dnd-kit/core'
import type { Task, Status } from '../types'
import TaskCard from './TaskCard'

interface Props {
  id: Status
  label: string
  tasks: Task[]
  onDeleted: () => void
}

function Column({ id, label, tasks, onDeleted }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div style={{
      backgroundColor: '#13131f',
      border: `1px solid ${isOver ? '#6366f1' : '#2e2e3e'}`,
      borderRadius: '12px',
      padding: '16px',
      width: '280px',
      minHeight: '500px',
      flexShrink: 0,
      transition: 'border-color 0.2s',
    }}>
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 600 }}>
          {label}
        </h3>
        <span style={{
          backgroundColor: '#2e2e3e',
          color: '#6b7280',
          borderRadius: '12px',
          padding: '2px 8px',
          fontSize: '12px',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div ref={setNodeRef} style={{ minHeight: '400px' }}>
        {tasks.length === 0 ? (
          <p style={{ color: '#3e3e4e', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
            No tasks yet
          </p>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} onDeleted={onDeleted} />
          ))
        )}
      </div>
    </div>
  )
}

export default Column