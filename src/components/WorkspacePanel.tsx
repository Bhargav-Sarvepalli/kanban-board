/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Workspace, WorkspaceMember } from '../types'
import toast from 'react-hot-toast'

interface Props {
  userId: string
  currentWorkspace: Workspace | null
  onWorkspaceChange: (workspace: Workspace | null) => void
  onClose: () => void
}

type InviteRole = 'admin' | 'member' | 'viewer'

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; desc: string }> = {
  admin:  { label: 'Admin',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', desc: 'Full access — create, edit, delete, manage members' },
  member: { label: 'Member', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  desc: 'Create tasks, edit own work, comment on anything' },
  viewer: { label: 'Viewer', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  desc: 'Read-only + comments. Good for clients or stakeholders' },
}

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? ROLE_META.member
  return (
    <span style={{
      fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
      padding: '2px 8px', borderRadius: '5px',
      color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
      fontFamily: 'Space Mono',
    }}>
      {meta.label.toUpperCase()}
    </span>
  )
}

export default function WorkspacePanel({ userId, currentWorkspace, onWorkspaceChange, onClose }: Props) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<InviteRole>('member')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [tab, setTab] = useState<'workspaces' | 'members'>('workspaces')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)

  // Current user's role in the active workspace
  const [myRole, setMyRole] = useState<string>('member')

  const fetchWorkspaces = useCallback(async () => {
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true })
    setWorkspaces(data ?? [])
  }, [])

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace) return
    const { data } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
    setMembers(data ?? [])
  }, [currentWorkspace])

  const fetchMyRole = useCallback(async () => {
    if (!currentWorkspace) return
    if (currentWorkspace.owner_id === userId) { setMyRole('admin'); return }
    const { data } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', userId)
      .single()
    setMyRole(data?.role ?? 'member')
  }, [currentWorkspace, userId])

  useEffect(() => { fetchWorkspaces() }, [fetchWorkspaces])
  useEffect(() => { if (currentWorkspace) { fetchMembers(); fetchMyRole() } }, [currentWorkspace, fetchMembers, fetchMyRole])

  const isAdmin = myRole === 'admin' || currentWorkspace?.owner_id === userId

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return
    setCreating(true)
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: newWorkspaceName.trim(), owner_id: userId })
      .select().single()
    if (error) toast.error('Failed to create workspace')
    else {
      toast.success('Workspace created!')
      setNewWorkspaceName('')
      fetchWorkspaces()
      onWorkspaceChange(data)
    }
    setCreating(false)
  }

  const startEditing = (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmDeleteId(null)
    setEditingId(ws.id)
    setEditingName(ws.name)
  }

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingId(null)
    setEditingName('')
  }

  const saveEdit = async (wsId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!editingName.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('workspaces')
      .update({ name: editingName.trim() })
      .eq('id', wsId)
      .select().single()
    if (error) toast.error('Failed to rename workspace')
    else {
      toast.success('Workspace renamed!')
      setEditingId(null)
      setEditingName('')
      fetchWorkspaces()
      if (currentWorkspace?.id === wsId) onWorkspaceChange(data)
    }
    setSaving(false)
  }

  const deleteWorkspace = async (wsId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDeleting(true)
    await supabase.from('workspace_members').delete().eq('workspace_id', wsId)
    await supabase.from('tasks').delete().eq('workspace_id', wsId)
    const { error } = await supabase.from('workspaces').delete().eq('id', wsId)
    if (error) toast.error('Failed to delete workspace')
    else {
      toast.success('Workspace deleted')
      setConfirmDeleteId(null)
      if (currentWorkspace?.id === wsId) onWorkspaceChange(null)
      fetchWorkspaces()
    }
    setDeleting(false)
  }

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !currentWorkspace) return
    setInviting(true)

    const existing = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('email', inviteEmail.trim())

    if (existing.data && existing.data.length > 0) {
      toast.error('User already invited!')
      setInviting(false)
      return
    }

    const { data: foundUserId } = await supabase.rpc('get_user_id_by_email', {
      email_input: inviteEmail.trim()
    })

    const memberId = foundUserId ?? userId

    const { error: insertError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: currentWorkspace.id,
        user_id: memberId,
        email: inviteEmail.trim(),
        role: inviteRole,
      })

    if (insertError) toast.error('Failed to invite member')
    else {
      toast.success(`${inviteRole === 'viewer' ? 'Viewer' : inviteRole === 'admin' ? 'Admin' : 'Member'} invited!`)
      setInviteEmail('')
      setInviteRole('member')
      fetchMembers()
    }
    setInviting(false)
  }

  const removeMember = async (memberId: string) => {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
    if (error) toast.error('Failed to remove member')
    else { toast.success('Member removed'); fetchMembers() }
  }

  const changeRole = async (memberId: string, newRole: string) => {
    setChangingRoleId(memberId)
    const { error } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId)
    if (error) toast.error('Failed to change role')
    else { toast.success(`Role updated to ${newRole}`); fetchMembers() }
    setChangingRoleId(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#080808',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          width: '100%', maxWidth: '520px',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

        <div style={{ padding: '28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, fontFamily: 'Space Grotesk', margin: 0 }}>
                Workspaces
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: '4px 0 0' }}>
                Collaborate with your team
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer', width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px',
              }}
            >✕</button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: '4px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px', padding: '4px',
            marginBottom: '24px',
          }}>
            {(['workspaces', 'members'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '8px',
                  borderRadius: '7px', border: 'none',
                  background: tab === t ? 'rgba(139,92,246,0.2)' : 'transparent',
                  color: tab === t ? '#8b5cf6' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', fontSize: '12px',
                  fontFamily: 'Space Grotesk', fontWeight: tab === t ? 600 : 400,
                  transition: 'all 0.15s', textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'workspaces' ? (
              <motion.div key="workspaces" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>

                {/* Create workspace */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
                    CREATE NEW WORKSPACE
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={newWorkspaceName}
                      onChange={e => setNewWorkspaceName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && createWorkspace()}
                      placeholder="Workspace name..."
                      style={{
                        flex: 1, padding: '10px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px', color: 'white',
                        fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none',
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={createWorkspace} disabled={creating}
                      style={{
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        border: 'none', borderRadius: '10px',
                        padding: '10px 16px', color: 'white',
                        cursor: 'pointer', fontSize: '13px',
                        fontFamily: 'Space Grotesk', fontWeight: 700, whiteSpace: 'nowrap',
                      }}
                    >
                      {creating ? '...' : 'Create'}
                    </motion.button>
                  </div>
                </div>

                {/* Personal board */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  onClick={() => { onWorkspaceChange(null); onClose() }}
                  style={{
                    padding: '12px 16px', borderRadius: '12px',
                    border: `1px solid ${currentWorkspace === null ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    background: currentWorkspace === null ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', marginBottom: '8px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(139,92,246,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                  }}>👤</div>
                  <div>
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>Personal Board</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>Private tasks only you can see</p>
                  </div>
                  {currentWorkspace === null && <div style={{ marginLeft: 'auto', color: '#8b5cf6', fontSize: '12px' }}>✓ Active</div>}
                </motion.div>

                {/* Workspace list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {workspaces.map(ws => (
                    <div key={ws.id}>
                      <motion.div
                        whileHover={{ scale: editingId === ws.id ? 1 : 1.01 }}
                        onClick={() => {
                          if (editingId === ws.id || confirmDeleteId === ws.id) return
                          onWorkspaceChange(ws); onClose()
                        }}
                        style={{
                          padding: '12px 16px',
                          borderRadius: confirmDeleteId === ws.id ? '12px 12px 0 0' : '12px',
                          border: `1px solid ${confirmDeleteId === ws.id ? 'rgba(239,68,68,0.3)' : currentWorkspace?.id === ws.id ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
                          borderBottom: confirmDeleteId === ws.id ? 'none' : undefined,
                          background: confirmDeleteId === ws.id ? 'rgba(239,68,68,0.05)' : currentWorkspace?.id === ws.id ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
                          cursor: editingId === ws.id || confirmDeleteId === ws.id ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '12px',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: confirmDeleteId === ws.id ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: confirmDeleteId === ws.id ? '#ef4444' : 'white',
                          fontSize: confirmDeleteId === ws.id ? '16px' : '13px',
                          fontWeight: 700, fontFamily: 'Space Grotesk', flexShrink: 0, transition: 'all 0.15s',
                        }}>
                          {confirmDeleteId === ws.id ? '⚠' : ws.name.charAt(0).toUpperCase()}
                        </div>

                        {editingId === ws.id ? (
                          <input
                            autoFocus value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(ws.id); if (e.key === 'Escape') cancelEditing() }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              flex: 1, padding: '4px 10px',
                              background: 'rgba(255,255,255,0.07)',
                              border: '1px solid rgba(139,92,246,0.5)',
                              borderRadius: '7px', color: 'white',
                              fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600, outline: 'none',
                            }}
                          />
                        ) : (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              color: confirmDeleteId === ws.id ? '#ef4444' : 'white',
                              fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s',
                            }}>
                              {ws.name}
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
                              {ws.owner_id === userId ? 'Owner' : 'Member'}
                            </p>
                          </div>
                        )}

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {editingId === ws.id ? (
                            <>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => saveEdit(ws.id, e)} disabled={saving}
                                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '4px 10px', color: '#10b981', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
                                {saving ? '...' : 'Save'}
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={cancelEditing}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                                Cancel
                              </motion.button>
                            </>
                          ) : confirmDeleteId === ws.id ? (
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                              Cancel
                            </motion.button>
                          ) : (
                            <>
                              {currentWorkspace?.id === ws.id && <div style={{ color: '#8b5cf6', fontSize: '12px' }}>✓ Active</div>}
                              {ws.owner_id === userId && (
                                <>
                                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => startEditing(ws, e)}
                                    style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px', padding: '4px 8px', color: '#8b5cf6', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                                    ✎ Edit
                                  </motion.button>
                                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); setEditingId(null); setConfirmDeleteId(ws.id) }}
                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 8px', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                                    🗑
                                  </motion.button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>

                      <AnimatePresence>
                        {confirmDeleteId === ws.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            style={{
                              overflow: 'hidden', background: 'rgba(239,68,68,0.08)',
                              border: '1px solid rgba(239,68,68,0.3)', borderTop: 'none',
                              borderRadius: '0 0 12px 12px', padding: '10px 16px',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                            }}
                          >
                            <p style={{ color: '#fca5a5', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0 }}>
                              This will delete all tasks in this workspace.
                            </p>
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={e => deleteWorkspace(ws.id, e)} disabled={deleting}
                              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '5px 12px', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {deleting ? '...' : 'Yes, Delete'}
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                  {workspaces.length === 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'Space Mono', textAlign: 'center', padding: '20px 0' }}>NO WORKSPACES YET</p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="members" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                {!currentWorkspace ? (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontFamily: 'Space Grotesk', textAlign: 'center', padding: '20px 0' }}>
                    Select a workspace first to manage members
                  </p>
                ) : (
                  <>
                    {/* Role legend */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {Object.entries(ROLE_META).map(([key, meta]) => (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px', borderRadius: '6px',
                          background: meta.bg, border: `1px solid ${meta.border}`,
                        }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: meta.color, fontFamily: 'Space Mono', letterSpacing: '0.08em' }}>{meta.label.toUpperCase()}</span>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Space Grotesk' }}>— {meta.desc}</span>
                        </div>
                      ))}
                    </div>

                    {/* Invite — admin only */}
                    {isAdmin && (
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
                          INVITE MEMBER
                        </label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && inviteMember()}
                            placeholder="colleague@email.com"
                            type="email"
                            style={{
                              flex: 1, padding: '10px 14px',
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '10px', color: 'white',
                              fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none',
                            }}
                          />
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={inviteMember} disabled={inviting}
                            style={{
                              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                              border: 'none', borderRadius: '10px', padding: '10px 16px',
                              color: 'white', cursor: 'pointer', fontSize: '13px',
                              fontFamily: 'Space Grotesk', fontWeight: 700,
                            }}>
                            {inviting ? '...' : 'Invite'}
                          </motion.button>
                        </div>

                        {/* Role selector for invite */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(['admin', 'member', 'viewer'] as InviteRole[]).map(r => {
                            const meta = ROLE_META[r]
                            return (
                              <button
                                key={r}
                                onClick={() => setInviteRole(r)}
                                style={{
                                  flex: 1, padding: '7px 4px',
                                  borderRadius: '8px', border: `1px solid ${inviteRole === r ? meta.border : 'rgba(255,255,255,0.08)'}`,
                                  background: inviteRole === r ? meta.bg : 'rgba(255,255,255,0.02)',
                                  color: inviteRole === r ? meta.color : 'rgba(255,255,255,0.35)',
                                  cursor: 'pointer', fontSize: '11px',
                                  fontFamily: 'Space Grotesk', fontWeight: inviteRole === r ? 600 : 400,
                                  transition: 'all 0.15s',
                                }}
                              >
                                {meta.label}
                              </button>
                            )
                          })}
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '6px 0 0' }}>
                          {ROLE_META[inviteRole].desc}
                        </p>
                      </div>
                    )}

                    {/* Member list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>

                      {/* Owner row */}
                      <div style={{
                        padding: '12px 16px', borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.02)',
                        display: 'flex', alignItems: 'center', gap: '12px',
                      }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '12px', fontWeight: 700,
                        }}>
                          {currentWorkspace.owner_id === userId ? 'Y' : '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>
                            {currentWorkspace.owner_id === userId ? 'You' : 'Owner'}
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>Workspace creator</p>
                        </div>
                        <RoleBadge role="admin" />
                      </div>

                      {/* Member rows */}
                      {members.map(member => (
                        <div key={member.id} style={{
                          padding: '12px 16px', borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.02)',
                          display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '12px', fontWeight: 700,
                          }}>
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {member.email}
                            </p>
                          </div>

                          {/* Role badge + change (admin only) */}
                          {isAdmin ? (
                            <select
                              value={member.role ?? 'member'}
                              disabled={changingRoleId === member.id}
                              onChange={e => changeRole(member.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '6px', padding: '3px 8px',
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: '11px', fontFamily: 'Space Grotesk',
                                cursor: 'pointer', outline: 'none',
                              }}
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <RoleBadge role={member.role ?? 'member'} />
                          )}

                          {isAdmin && (
                            <motion.button
                              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                              onClick={() => removeMember(member.id)}
                              style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: '6px', padding: '4px 8px',
                                color: '#ef4444', cursor: 'pointer',
                                fontSize: '11px', fontFamily: 'Space Grotesk',
                              }}
                            >
                              Remove
                            </motion.button>
                          )}
                        </div>
                      ))}

                      {members.length === 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'Space Mono', textAlign: 'center', padding: '20px 0' }}>
                          NO MEMBERS YET — INVITE SOMEONE
                        </p>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}