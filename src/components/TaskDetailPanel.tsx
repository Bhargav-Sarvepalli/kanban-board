import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Task, Comment, Status, Profile } from '../types'
import { breakIntoSubtasks } from '../lib/ai'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import { useWorkspaceRole, canEditTask } from '../hooks/useWorkspaceRole'
import ShowOnFlowToggle from './Project/ShowOnFlowToggle'

interface ProjectFeature { id: string; name: string }

interface Props {
  task: Task
  onClose: () => void
  onUpdated: () => void
  userId: string
  profiles?: Record<string, Profile>
}

function TaskDetailPanel({ task, onClose, onUpdated, userId, profiles = {} }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [status, setStatus] = useState<Status>(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [showOnFlow, setShowOnFlow] = useState(task.show_on_flow ?? false)
  const [featureId, setFeatureId] = useState<string | null>(task.feature_id ?? null)
  const [features, setFeatures] = useState<ProjectFeature[]>([])
  const [saving, setSaving] = useState(false)
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [generatingSubtasks, setGeneratingSubtasks] = useState(false)

  const role = useWorkspaceRole(task.workspace_id, userId)
  const isPersonal = !task.workspace_id
  const canEdit = isPersonal
    ? task.user_id === userId
    : canEditTask(role, task.user_id, task.assignee_id, userId)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setEditingTitle(false)
      setTitle(task.title)
      setDescription(task.description ?? '')
      setStatus(task.status)
      setPriority(task.priority)
      setDueDate(task.due_date ?? '')
      setShowOnFlow(task.show_on_flow ?? false)
      setFeatureId(task.feature_id ?? null)
      setNewComment('')
      setSubtasks([])
    })
    return () => { active = false }
  }, [task.id, task.title, task.description, task.status, task.priority, task.due_date, task.show_on_flow, task.feature_id])

  // Fetch features for this project
  useEffect(() => {
    if (!task.project_id) return
    let cancelled = false
    supabase
      .from('project_features')
      .select('id, name')
      .eq('project_id', task.project_id)
      .order('name', { ascending: true })
      .then(({ data }) => { if (!cancelled) setFeatures(data ?? []) })
    return () => { cancelled = true }
  }, [task.project_id])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const { data } = await supabase.from('comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true })
      if (!cancelled) setComments(data ?? [])
    }
    void run()
    return () => { cancelled = true }
  }, [task.id])

  const refetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  const handleSave = async () => {
    if (!canEdit) return
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      toast.error('Task title is required')
      return
    }
    setSaving(true)
    const wasNotDone = task.status !== 'done'
    const isNowDone  = status === 'done'
    const { error } = await supabase.from('tasks').update({
      title: cleanTitle,
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate || null,
      show_on_flow: showOnFlow,
      feature_id: featureId,
      last_edited_by: userId,
      last_edited_at: new Date().toISOString(),
    }).eq('id', task.id)

    if (!error && wasNotDone && isNowDone && task.recurring && task.due_date) {
      const [y, m, d] = task.due_date.split('-').map(Number)
      const nextDue = new Date(y, m - 1, d)
      if (task.recurring === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
      else if (task.recurring === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1)
      const pad = (n: number) => String(n).padStart(2, '0')
      await supabase.from('tasks').insert({
        title: task.title, description: task.description, priority: task.priority,
        status: 'todo', due_date: `${nextDue.getFullYear()}-${pad(nextDue.getMonth() + 1)}-${pad(nextDue.getDate())}`,
        recurring: task.recurring,
        user_id: task.user_id,
        workspace_id: task.workspace_id ?? null,
        project_id: task.project_id ?? null,
        feature_id: task.feature_id ?? null,
        assignee_id: task.assignee_id ?? null,
        show_on_flow: task.show_on_flow ?? false,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      })
      toast.success(`↻ Next ${task.recurring} task created!`)
    }

    setSaving(false); setEditingTitle(false)
    if (error) toast.error('Failed to save changes')
    else { toast.success('Changes saved!'); onUpdated() }
  }

  const handleToggleFlow = async (v: boolean) => {
    if (!canEdit) return
    const previous = showOnFlow
    setShowOnFlow(v)
    const { error } = await supabase.from('tasks').update({ show_on_flow: v }).eq('id', task.id)
    if (error) {
      setShowOnFlow(previous)
      toast.error('Could not update Flow visibility')
    }
  }

  const handleFeatureChange = async (newFeatureId: string | null) => {
    if (!canEdit) return
    const previous = featureId
    setFeatureId(newFeatureId)
    const { error } = await supabase.from('tasks').update({ feature_id: newFeatureId }).eq('id', task.id)
    if (error) {
      setFeatureId(previous)
      toast.error('Could not move task to that branch')
    }
  }

  const submitComment = async () => {
    const content = newComment.trim()
    if (!content || submitting) return
    setSubmitting(true)
    const { error } = await supabase.from('comments').insert({ task_id: task.id, user_id: userId, content })
    if (error) {
      toast.error('Could not add comment')
    } else {
      setNewComment('')
      await refetchComments()
    }
    setSubmitting(false)
  }

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) {
      toast.error('Could not delete comment')
      return
    }
    await refetchComments()
  }

  const labelStyle = { display: 'block' as const, color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono, monospace', letterSpacing: '0.2em', marginBottom: '8px' }
  const formatTime = (ts: string) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const getDueDateStatus = () => {
    if (!dueDate) return null
    const [y, m, d] = dueDate.split('-').map(Number)
    const due = new Date(y, m - 1, d)
    const today = new Date(new Date().setHours(0, 0, 0, 0))
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    if (due < today) return { label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    if (due.getTime() === today.getTime()) return { label: 'Due Today', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    if (due.getTime() === tomorrow.getTime()) return { label: 'Due Tomorrow', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' }
    return { label: new Date(y, m-1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)' }
  }
  const dueDateStatus = getDueDateStatus()

  const statusOptions = [
    { value: 'todo',        label: 'To Do',      color: '#94a3b8' },
    { value: 'in_progress', label: 'In Progress', color: '#8b5cf6' },
    { value: 'in_review',   label: 'In Review',   color: '#f59e0b' },
    { value: 'done',        label: 'Done',        color: '#10b981' },
  ]
  const priorityOptions = [
    { value: 'low',    label: 'Low',    color: '#64748b' },
    { value: 'normal', label: 'Normal', color: '#8b5cf6' },
    { value: 'high',   label: 'High',   color: '#ef4444' },
  ]

  const selectedFeature = features.find(f => f.id === featureId)

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 50 }}>
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: '520px', background: '#050505', borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>TASK DETAILS</span>
              {!canEdit && <span style={{ fontSize: '9px', fontFamily: 'Space Mono', padding: '2px 7px', borderRadius: '4px', color: '#fb923c', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)' }}>VIEW ONLY</span>}
              {task.recurring && <span style={{ fontSize: '9px', fontFamily: 'Space Mono', padding: '2px 6px', borderRadius: '4px', color: task.recurring === 'weekly' ? '#06b6d4' : '#8b5cf6', background: task.recurring === 'weekly' ? 'rgba(6,182,212,0.1)' : 'rgba(139,92,246,0.1)' }}>↻ {task.recurring.toUpperCase()}</span>}
              {dueDateStatus && <span style={{ fontSize: '9px', fontFamily: 'Space Mono', padding: '2px 6px', borderRadius: '4px', color: dueDateStatus.color, background: dueDateStatus.bg }}>{dueDateStatus.label}</span>}
              {task.project_id && showOnFlow && <span style={{ fontSize: '9px', fontFamily: 'Space Mono', padding: '2px 6px', borderRadius: '4px', color: '#a78bfa', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>⚡ ON FLOW</span>}
              {selectedFeature && <span style={{ fontSize: '9px', fontFamily: 'Space Mono', padding: '2px 6px', borderRadius: '4px', color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>🌿 {selectedFeature.name}</span>}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

            {/* Title */}
            <div style={{ marginBottom: '24px' }}>
              {editingTitle && canEdit
                ? <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onBlur={() => setEditingTitle(false)}
                    style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #8b5cf6', padding: '4px 0', color: 'white', fontSize: '20px', fontFamily: 'Space Grotesk', fontWeight: 700, outline: 'none', letterSpacing: '-0.02em' }} />
                : <h2 onClick={() => canEdit && setEditingTitle(true)} style={{ color: 'white', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', cursor: canEdit ? 'pointer' : 'default', margin: 0, lineHeight: 1.3 }}>{title}</h2>
              }
              {canEdit && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '4px', fontFamily: 'Space Mono' }}>Click title to edit</p>}
            </div>

            {/* Status */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>STATUS</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {statusOptions.map(opt => (
                  <button key={opt.value} onClick={() => canEdit && setStatus(opt.value as Status)} disabled={!canEdit}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: `1px solid ${status === opt.value ? opt.color + '60' : opt.color + '20'}`, background: status === opt.value ? `${opt.color}15` : `${opt.color}05`, color: status === opt.value ? opt.color : opt.color + '60', cursor: canEdit ? 'pointer' : 'default', fontSize: '10px', fontFamily: 'Space Grotesk', fontWeight: 600, opacity: canEdit ? 1 : 0.6 }}>{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>PRIORITY</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {priorityOptions.map(opt => (
                  <button key={opt.value} onClick={() => canEdit && setPriority(opt.value as 'low' | 'normal' | 'high')} disabled={!canEdit}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: `1px solid ${priority === opt.value ? opt.color + '60' : opt.color + '30'}`, background: priority === opt.value ? `${opt.color}15` : `${opt.color}08`, color: priority === opt.value ? opt.color : opt.color + '70', cursor: canEdit ? 'pointer' : 'default', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600, opacity: canEdit ? 1 : 0.6 }}>{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Feature selector — only for project tasks */}
            {task.project_id && (
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>FEATURE BRANCH</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    onClick={() => canEdit && handleFeatureChange(null)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', border: `1px solid ${featureId === null ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                      background: featureId === null ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: featureId === null ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
                      cursor: canEdit ? 'pointer' : 'default', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600,
                    }}>
                    — None
                  </button>
                  {features.map(f => (
                    <button key={f.id}
                      onClick={() => canEdit && handleFeatureChange(f.id)}
                      style={{
                        padding: '6px 12px', borderRadius: '20px',
                        border: `1px solid ${featureId === f.id ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        background: featureId === f.id ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.03)',
                        color: featureId === f.id ? '#34d399' : 'rgba(255,255,255,0.45)',
                        cursor: canEdit ? 'pointer' : 'default', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: featureId === f.id ? 700 : 400,
                        display: 'flex', alignItems: 'center', gap: '5px',
                      }}>
                      <span style={{ fontSize: '10px' }}>🌿</span>{f.name}
                    </button>
                  ))}
                  {features.length === 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'Space Grotesk', padding: '6px 0' }}>
                      No features created yet — add them in Project Dashboard
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Due Date */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>DUE DATE</label>
              <input type="date" value={dueDate} onChange={e => canEdit && setDueDate(e.target.value)} disabled={!canEdit}
                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 14px', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none', colorScheme: 'dark', cursor: canEdit ? 'pointer' : 'default', opacity: canEdit ? 1 : 0.6 }} />
            </div>

            {/* Show on Flow toggle */}
            {task.project_id && (
              <div style={{ marginBottom: '20px' }}>
                <ShowOnFlowToggle value={showOnFlow} onChange={handleToggleFlow} projectId={task.project_id} disabled={!canEdit} />
              </div>
            )}

            {/* Assignee */}
            {task.workspace_id && task.assignee_id && profiles?.[task.assignee_id] && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '10px', marginBottom: '12px' }}>
                <Avatar name={profiles[task.assignee_id].full_name ?? profiles[task.assignee_id].email} avatarUrl={profiles[task.assignee_id].avatar_url} size={24} />
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0 }}>Assigned to <span style={{ color: '#c084fc', fontWeight: 600 }}>{profiles[task.assignee_id].full_name ?? profiles[task.assignee_id].email}</span></p>
              </div>
            )}

            {/* Last edited */}
            {task.last_edited_by && profiles?.[task.last_edited_by] && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '20px' }}>
                <Avatar name={profiles[task.last_edited_by].full_name ?? profiles[task.last_edited_by].email} avatarUrl={profiles[task.last_edited_by].avatar_url} size={24} />
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0 }}>Last edited by <span style={{ color: 'white', fontWeight: 600 }}>{profiles[task.last_edited_by].full_name ?? profiles[task.last_edited_by].email}</span></p>
                  {task.last_edited_at && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono', margin: '2px 0 0' }}>{new Date(task.last_edited_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>DESCRIPTION</label>
              <textarea value={description} onChange={e => canEdit && setDescription(e.target.value)} readOnly={!canEdit} rows={4} placeholder={canEdit ? 'Add a description...' : ''}
                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none', resize: 'none', lineHeight: 1.6, opacity: canEdit ? 1 : 0.7 }} />
            </div>

            {/* Save */}
            {canEdit && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
                style={{ width: '100%', background: saving ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '10px', padding: '12px', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: '24px', boxShadow: saving ? 'none' : '0 0 20px rgba(139,92,246,0.3)' }}>
                {saving ? '⟳ Saving...' : 'Save Changes →'}
              </motion.button>
            )}

            {/* AI Subtasks */}
            {canEdit && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>AI SUBTASKS</label>
                  <button onClick={async () => { setGeneratingSubtasks(true); try { setSubtasks(await breakIntoSubtasks(title, description)); toast.success('Subtasks generated!') } catch { toast.error('Failed') } setGeneratingSubtasks(false) }} disabled={generatingSubtasks}
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px', color: '#8b5cf6', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk', padding: '4px 10px' }}>
                    {generatingSubtasks ? '⟳ Breaking down...' : '✨ Generate'}
                  </button>
                </div>
                {subtasks.length > 0 && subtasks.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
                    <span style={{ color: '#8b5cf6', fontSize: '10px', fontFamily: 'Space Mono', marginTop: '2px', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{s}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Comments */}
            <div>
              <label style={labelStyle}>COMMENTS ({comments.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {comments.length === 0
                  ? <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', textAlign: 'center', padding: '20px 0', fontFamily: 'Space Mono' }}>NO COMMENTS YET</p>
                  : comments.map(c => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: 0, lineHeight: 1.5, flex: 1 }}>{c.content}</p>
                        {c.user_id === userId && <button type="button" aria-label="Delete comment" onClick={() => deleteComment(c.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '10px' }}>✕</button>}
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', margin: '6px 0 0', fontFamily: 'Space Mono' }}>{formatTime(c.created_at)}</p>
                    </motion.div>
                  ))
                }
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={newComment} onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void submitComment() }}
                  placeholder="Add a comment..."
                  style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none' }} />
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => void submitComment()}
                  disabled={submitting || !newComment.trim()}
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 700, opacity: !newComment.trim() ? 0.4 : 1 }}>
                  {submitting ? '...' : 'Send'}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default TaskDetailPanel
