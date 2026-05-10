import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Profile, Workspace, WorkspaceMember } from '../types'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import LogoUpload from './LogoUpload'
import WorkspaceAvatar from './WorkspaceAvatar'

interface Props {
  userId: string
  currentWorkspace: Workspace | null
  onWorkspaceChange: (workspace: Workspace | null) => void
  onClose: () => void
}

type InviteRole = 'admin' | 'member' | 'viewer'

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; desc: string }> = {
  admin:  { label: 'Admin',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', desc: 'Create, edit, delete, manage members' },
  member: { label: 'Member', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  desc: 'Create tasks, edit own work, comment' },
  viewer: { label: 'Viewer', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  desc: 'Read-only + comments. Good for clients' },
}

const PRESET_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const normalizeEmail = (email: string) => email.trim().toLowerCase()
const PRESET_ICONS  = ['🚀', '💼', '🎯', '⚡', '🔥', '💡', '🛠', '📊', '🌟', '🤖', '🎮', '📱']

function WorkspaceEditModal({
  workspace, onSave, onClose,
}: {
  workspace: Workspace
  onSave: (updated: Workspace) => void
  onClose: () => void
}) {
  const [name, setName]           = useState(workspace.name)
  const [color, setColor]         = useState(workspace.color ?? '#8b5cf6')
  const [icon, setIcon]           = useState<string | null>(workspace.icon ?? null)
  const [logoUrl, setLogoUrl]     = useState<string | null>(workspace.logo_url ?? null)
  const [description, setDesc]    = useState(workspace.description ?? '')
  const [saving, setSaving]       = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const { data, error } = await supabase
      .from('workspaces')
      .update({ name: name.trim(), color, icon: icon ?? null, logo_url: logoUrl, description: description.trim() || null })
      .eq('id', workspace.id)
      .select().single()
    if (error) { toast.error('Failed to save'); setSaving(false); return }
    toast.success('Workspace updated!')
    onSave(data)
    setSaving(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.9)' }}
      >
        <div style={{ height: '2px', background: `linear-gradient(90deg, ${color}, #ec4899)` }} />
        <div style={{ padding: '28px' }}>
          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <LogoUpload
              currentUrl={logoUrl}
              fallbackText={name || workspace.name}
              fallbackIcon={icon}
              accentColor={color}
              bucket="workspace-logos"
              entityId={workspace.id}
              table="workspaces"
              size={52}
              onUploaded={setLogoUrl}
              editable
            />
            <div>
              <p style={{ color: 'white', fontSize: '16px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>{name || 'Workspace name'}</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>{description || 'Upload a logo or keep an icon fallback'}</p>
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>NAME</label>
            <input
              value={name} onChange={e => setName(e.target.value)} autoFocus
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = `${color}80`}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>DESCRIPTION <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span></label>
            <input
              value={description} onChange={e => setDesc(e.target.value)}
              placeholder="What is this workspace for?"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Color */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>COLOR</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: c, border: `3px solid ${color === c ? 'white' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                    outline: 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>ICON <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span></label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {/* None option */}
              <button
                onClick={() => setIcon(null)}
                style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: icon === null ? `${color}20` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${icon === null ? color + '60' : 'rgba(255,255,255,0.1)'}`,
                  cursor: 'pointer', fontSize: '11px', color: 'rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                A
              </button>
              {PRESET_ICONS.map(em => (
                <button
                  key={em}
                  onClick={() => setIcon(em)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: icon === em ? `${color}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${icon === em ? color + '60' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', fontSize: '18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk' }}>
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleSave} disabled={saving}
              style={{ flex: 2, padding: '11px', borderRadius: '10px', background: saving ? 'rgba(139,92,246,0.3)' : `linear-gradient(135deg, ${color}, #ec4899)`, border: 'none', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700 }}
            >
              {saving ? '⟳ Saving...' : 'Save Changes →'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function WorkspacePanel({ userId, currentWorkspace, onWorkspaceChange, onClose }: Props) {
  const [workspaces, setWorkspaces]       = useState<Workspace[]>([])
  const [members, setMembers]             = useState<WorkspaceMember[]>([])
  const [memberProfiles, setMemberProfiles] = useState<Record<string, Profile>>({})
  const [inviteEmail, setInviteEmail]     = useState('')
  const [inviteRole, setInviteRole]       = useState<InviteRole>('member')
  const [newWsName, setNewWsName]         = useState('')
  const [creating, setCreating]           = useState(false)
  const [inviting, setInviting]           = useState(false)
  const [tab, setTab]                     = useState<'workspaces' | 'members'>('workspaces')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)
  const [myRole, setMyRole]               = useState<string>('member')
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string; role: string; created_at?: string }[]>([])

  const fetchWorkspaces = useCallback(async () => {
    const { data } = await supabase.from('workspaces').select('*').order('created_at', { ascending: true })
    setWorkspaces(data ?? [])
  }, [])

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace) {
      setMembers([])
      setMemberProfiles({})
      return
    }
    const { data } = await supabase.from('workspace_members').select('*').eq('workspace_id', currentWorkspace.id)
    setMembers(data ?? [])

    const ids = [...new Set([
      currentWorkspace.owner_id,
      ...((data ?? []) as WorkspaceMember[]).map(member => member.user_id),
    ].filter(Boolean))]

    if (ids.length === 0) {
      setMemberProfiles({})
      return
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id,email,full_name,avatar_url,onboarding_completed')
      .in('id', ids)

    const nextProfiles: Record<string, Profile> = {}
    for (const profile of (profiles ?? []) as Profile[]) nextProfiles[profile.id] = profile
    setMemberProfiles(nextProfiles)
  }, [currentWorkspace])

  const fetchMyRole = useCallback(async () => {
    if (!currentWorkspace) return
    if (currentWorkspace.owner_id === userId) { setMyRole('admin'); return }
    const { data } = await supabase.from('workspace_members').select('role').eq('workspace_id', currentWorkspace.id).eq('user_id', userId).single()
    setMyRole(data?.role ?? 'member')
  }, [currentWorkspace, userId])

  const fetchPendingInvites = useCallback(async () => {
    if (!currentWorkspace) return
    const { data } = await supabase.from('workspace_invites').select('id, email, role, created_at').eq('workspace_id', currentWorkspace.id).eq('status', 'pending').order('created_at', { ascending: false })
    setPendingInvites(data ?? [])
  }, [currentWorkspace])

  useEffect(() => { void fetchWorkspaces() }, [fetchWorkspaces])
  useEffect(() => {
    if (currentWorkspace) {
      void fetchMembers()
      void fetchMyRole()
      void fetchPendingInvites()
    } else {
      setMembers([])
      setMemberProfiles({})
      setPendingInvites([])
      setMyRole('member')
    }
  }, [currentWorkspace, fetchMembers, fetchMyRole, fetchPendingInvites])

  const isAdmin = myRole === 'admin' || currentWorkspace?.owner_id === userId
  const visibleMembers = currentWorkspace ? members.filter(member => member.user_id !== currentWorkspace.owner_id) : []
  const ownerProfile = currentWorkspace ? memberProfiles[currentWorkspace.owner_id] : undefined
  const ownerName = ownerProfile?.full_name || ownerProfile?.email || (currentWorkspace?.owner_id === userId ? 'You' : 'Owner')

  const createWorkspace = async () => {
    if (creating || !newWsName.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from('workspaces').insert({ name: newWsName.trim(), owner_id: userId, color: '#8b5cf6' }).select().single()
    if (error) toast.error('Failed to create workspace')
    else {
      const { data: auth } = await supabase.auth.getUser()
      const email = normalizeEmail(auth.user?.email ?? '')
      if (email) {
        await supabase.from('workspace_members').insert({
          workspace_id: data.id,
          user_id: userId,
          email,
          role: 'admin',
        })
      }
      toast.success('Workspace created!')
      setNewWsName('')
      void fetchWorkspaces()
      onWorkspaceChange(data)
      setTab('members')
    }
    setCreating(false)
  }

  const deleteWorkspace = async (wsId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDeleting(true)

    const runStep = async (label: string, step: () => PromiseLike<{ error: unknown }>) => {
      const { error } = await step()
      if (error) {
        console.error(`[WorkspacePanel] failed to delete ${label}`, error)
        throw error
      }
    }

    try {
      const { data: projectRows, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('workspace_id', wsId)
      if (projectError) throw projectError

      const projectIds = (projectRows ?? []).map(project => project.id)
      if (projectIds.length > 0) {
        await runStep('workspace project flow history', () => supabase.from('flow_events').delete().in('project_id', projectIds))
        await runStep('workspace project tasks', () => supabase.from('tasks').delete().in('project_id', projectIds))
        await runStep('workspace project features', () => supabase.from('project_features').delete().in('project_id', projectIds))
        await runStep('workspace project milestones', () => supabase.from('project_milestones').delete().in('project_id', projectIds))
        await runStep('workspace project members', () => supabase.from('project_members').delete().in('project_id', projectIds))
        await runStep('workspace projects', () => supabase.from('projects').delete().in('id', projectIds))
      }

      await runStep('workspace tasks', () => supabase.from('tasks').delete().eq('workspace_id', wsId))
      await runStep('workspace invites', () => supabase.from('workspace_invites').delete().eq('workspace_id', wsId))
      await runStep('workspace members', () => supabase.from('workspace_members').delete().eq('workspace_id', wsId))

      const { error } = await supabase.from('workspaces').delete().eq('id', wsId)
      if (error) throw error

      toast.success('Workspace deleted')
      setConfirmDeleteId(null)
      if (currentWorkspace?.id === wsId) onWorkspaceChange(null)
      void fetchWorkspaces()
    } catch {
      toast.error('Failed to delete workspace data')
    }
    setDeleting(false)
  }

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !currentWorkspace) return
    const email = normalizeEmail(inviteEmail)
    if (!EMAIL_RE.test(email)) {
      toast.error('Enter a valid email')
      return
    }
    setInviting(true)

    // Check not already a member
    const { data: existing } = await supabase.from('workspace_members').select('id').eq('workspace_id', currentWorkspace.id).ilike('email', email)
    if (existing && existing.length > 0) { toast.error('Already a member'); setInviting(false); return }

    // Check no pending invite
    const { data: existingInvite } = await supabase.from('workspace_invites').select('id').eq('workspace_id', currentWorkspace.id).ilike('email', email).eq('status', 'pending')
    if (existingInvite && existingInvite.length > 0) { toast.error('Invite already pending'); setInviting(false); return }

    const { error } = await supabase.from('workspace_invites').insert({
      workspace_id: currentWorkspace.id,
      invited_by: userId,
      email,
      role: inviteRole,
    })

    if (error) {
      console.error('[WorkspacePanel] invite failed', error)
      toast.error(error.message || 'Failed to send invite')
    }
    else {
      toast.success(`Invite saved. They'll see it in the bell when they sign in as ${email}.`)
      setInviteEmail('')
      setInviteRole('member')
      void fetchPendingInvites()
      setTab('members')
    }
    setInviting(false)
  }

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('workspace_members').delete().eq('id', memberId)
    if (error) toast.error('Failed to remove member')
    else { toast.success('Member removed'); void fetchMembers() }
  }

  const cancelInvite = async (inviteId: string) => {
    const { error } = await supabase.from('workspace_invites').delete().eq('id', inviteId)
    if (error) toast.error('Failed to cancel invite')
    else {
      toast.success('Invite cancelled')
      void fetchPendingInvites()
    }
  }

  const changeRole = async (memberId: string, newRole: string) => {
    setChangingRoleId(memberId)
    const { error } = await supabase.from('workspace_members').update({ role: newRole }).eq('id', memberId)
    if (error) toast.error('Failed to update role')
    else {
      toast.success(`Role updated to ${newRole}`)
      void fetchMembers()
    }
    setChangingRoleId(null)
  }

  const handleWorkspaceSaved = (updated: Workspace) => {
    setWorkspaces(prev => prev.map(w => w.id === updated.id ? updated : w))
    if (currentWorkspace?.id === updated.id) onWorkspaceChange(updated)
    setEditingWorkspace(null)
  }

  const inputStyle = {
    flex: 1, padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', color: 'white' as const,
    fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none',
  }

  const labelStyle = {
    color: 'rgba(255,255,255,0.3)', fontSize: '10px',
    fontFamily: 'Space Mono', letterSpacing: '0.15em',
    display: 'block', marginBottom: '8px',
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
          style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', width: '100%', maxWidth: '520px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

          <div style={{ padding: '28px 28px 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, fontFamily: 'Space Grotesk', margin: 0 }}>Workspaces</h2>
                <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: '4px 0 0' }}>Create, switch, and manage access</p>
              </div>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
              {([
                { id: 'workspaces', label: 'Workspaces', count: workspaces.length + 1, pending: 0 },
                { id: 'members', label: 'Members', count: currentWorkspace ? visibleMembers.length + 1 : 0, pending: pendingInvites.length },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', background: tab === t.id ? 'rgba(139,92,246,0.24)' : 'transparent', color: tab === t.id ? '#d8b4fe' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: tab === t.id ? 700 : 500, transition: 'all 0.15s' }}>
                  {t.label}
                  {t.count > 0 && <span style={{ marginLeft: '6px', fontSize: '10px', color: tab === t.id ? '#ffffff' : 'rgba(255,255,255,0.38)' }}>{t.count}</span>}
                  {t.pending > 0 && <span style={{ marginLeft: '7px', fontSize: '9px', color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.26)', borderRadius: '999px', padding: '1px 6px' }}>{t.pending} pending</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
            <AnimatePresence mode="wait">
              {/* ── WORKSPACES TAB ── */}
              {tab === 'workspaces' && (
                <motion.div key="workspaces" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  {/* Create */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>CREATE NEW WORKSPACE</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input value={newWsName} onChange={e => setNewWsName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createWorkspace()} placeholder="Workspace name..." style={inputStyle} />
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={createWorkspace} disabled={creating} style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {creating ? '...' : 'Create'}
                      </motion.button>
                    </div>
                  </div>

                  {/* Personal board */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    onClick={() => { onWorkspaceChange(null); setTab('workspaces') }}
                    style={{ padding: '12px 16px', borderRadius: '12px', border: `1px solid ${currentWorkspace === null ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)'}`, background: currentWorkspace === null ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <WorkspaceAvatar name="Personal" icon="P" color="#8b5cf6" size={32} radius={8} />
                    <div>
                      <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>Personal Board</p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>Private tasks only you can see</p>
                    </div>
                    {currentWorkspace === null && <div style={{ marginLeft: 'auto', color: '#8b5cf6', fontSize: '12px' }}>✓ Active</div>}
                  </motion.div>

                  {/* Workspace list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {workspaces.map(ws => {
                      const wsColor = ws.color ?? '#8b5cf6'
                      const isActive = currentWorkspace?.id === ws.id
                      const isOwner = ws.owner_id === userId
                      const isDeleting = confirmDeleteId === ws.id

                      return (
                        <div key={ws.id}>
                          <motion.div
                            whileHover={{ scale: isDeleting ? 1 : 1.01 }}
                            onClick={() => { if (isDeleting) return; onWorkspaceChange(ws); setTab('members') }}
                            style={{
                              padding: '12px 16px',
                              borderRadius: isDeleting ? '12px 12px 0 0' : '12px',
                              border: `1px solid ${isDeleting ? 'rgba(239,68,68,0.3)' : isActive ? wsColor + '60' : 'rgba(255,255,255,0.06)'}`,
                              borderBottom: isDeleting ? 'none' : undefined,
                              background: isDeleting ? 'rgba(239,68,68,0.05)' : isActive ? wsColor + '12' : 'rgba(255,255,255,0.02)',
                              cursor: isDeleting ? 'default' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s',
                            }}
                          >
                            <WorkspaceAvatar
                              name={ws.name}
                              logoUrl={ws.logo_url ?? null}
                              icon={ws.icon}
                              color={wsColor}
                              danger={isDeleting}
                              size={32}
                              radius={8}
                            />

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: isDeleting ? '#ef4444' : 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ws.name}
                              </p>
                              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
                                {ws.description ?? (isOwner ? 'Owner' : 'Member')}
                              </p>
                            </div>

                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {isActive && !isDeleting && <div style={{ color: wsColor, fontSize: '12px' }}>✓ Active</div>}
                              {isDeleting ? (
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                                  Cancel
                                </motion.button>
                              ) : isOwner ? (
                                <>
                                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); setEditingWorkspace(ws) }}
                                    style={{ background: `${wsColor}18`, border: `1px solid ${wsColor}35`, borderRadius: '6px', padding: '4px 8px', color: wsColor, cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                                    ✎ Edit
                                  </motion.button>
                                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); setConfirmDeleteId(ws.id) }}
                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 8px', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                                    🗑
                                  </motion.button>
                                </>
                              ) : null}
                            </div>
                          </motion.div>

                          {/* Delete confirm */}
                          <AnimatePresence>
                            {isDeleting && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                style={{ overflow: 'hidden', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <p style={{ color: '#fca5a5', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0 }}>Deletes this workspace, its projects, tasks, members, and invites.</p>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={e => deleteWorkspace(ws.id, e)} disabled={deleting}
                                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '5px 12px', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {deleting ? '...' : 'Yes, Delete'}
                                </motion.button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}

                    {workspaces.length === 0 && (
                      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'Space Mono', textAlign: 'center', padding: '20px 0' }}>NO WORKSPACES YET</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── MEMBERS TAB ── */}
              {tab === 'members' && (
                <motion.div key="members" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  {!currentWorkspace ? (
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontFamily: 'Space Grotesk', textAlign: 'center', padding: '20px 0' }}>Select a workspace first</p>
                  ) : (
                    <>
                      {/* Role legend */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                        {Object.entries(ROLE_META).map(([key, meta]) => (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '7px', background: meta.bg, border: `1px solid ${meta.border}` }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: meta.color, fontFamily: 'Space Mono', letterSpacing: '0.08em', minWidth: '44px' }}>{meta.label.toUpperCase()}</span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Space Grotesk' }}>— {meta.desc}</span>
                          </div>
                        ))}
                      </div>

                      {/* Invite form — admin only */}
                      {isAdmin && (
                        <div style={{ marginBottom: '20px' }}>
                          <label style={labelStyle}>INVITE BY EMAIL</label>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && inviteMember()} placeholder="colleague@email.com" type="email" style={inputStyle} />
                            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={inviteMember} disabled={inviting}
                              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
                              {inviting ? '...' : 'Invite'}
                            </motion.button>
                          </div>
                          {/* Role picker */}
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                            {(['admin', 'member', 'viewer'] as InviteRole[]).map(r => {
                              const meta = ROLE_META[r]
                              return (
                                <button key={r} onClick={() => setInviteRole(r)} style={{ flex: 1, padding: '7px 4px', borderRadius: '8px', border: `1px solid ${inviteRole === r ? meta.border : 'rgba(255,255,255,0.08)'}`, background: inviteRole === r ? meta.bg : 'rgba(255,255,255,0.02)', color: inviteRole === r ? meta.color : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: inviteRole === r ? 600 : 400, transition: 'all 0.15s' }}>
                                  {meta.label}
                                </button>
                              )
                            })}
                          </div>
                          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0 }}>{ROLE_META[inviteRole].desc}</p>
                          <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '6px 0 0' }}>
                            In-app invite only. They will see it in the bell after signing in with this email.
                          </p>
                        </div>
                      )}

                      {/* Pending invites */}
                      {pendingInvites.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ ...labelStyle, color: 'rgba(251,146,60,0.6)' }}>PENDING INVITES ({pendingInvites.length})</label>
                          {pendingInvites.map(inv => (
                            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.18)', marginBottom: '6px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: 700 }}>
                                {inv.email.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</p>
                              </div>
                              <span style={{ fontSize: '9px', fontWeight: 700, color: ROLE_META[inv.role]?.color ?? '#fff', background: ROLE_META[inv.role]?.bg ?? 'transparent', border: `1px solid ${ROLE_META[inv.role]?.border ?? 'transparent'}`, padding: '2px 7px', borderRadius: '5px', fontFamily: 'Space Mono' }}>
                                {inv.role.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '5px', background: 'rgba(251,146,60,0.1)', color: '#fb923c', fontFamily: 'Space Mono', fontWeight: 600 }}>PENDING</span>
                              {isAdmin && (
                                <button onClick={() => cancelInvite(inv.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }} title="Cancel invite">✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Member list */}
                      <label style={labelStyle}>MEMBERS ({visibleMembers.length + 1})</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Owner */}
                        <div style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Avatar name={ownerName} avatarUrl={ownerProfile?.avatar_url ?? null} size={32} />
                          <div style={{ flex: 1 }}>
                            <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>{currentWorkspace.owner_id === userId ? 'You' : ownerName}</p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>Workspace creator</p>
                          </div>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '5px', padding: '2px 8px', fontFamily: 'Space Mono' }}>ADMIN</span>
                        </div>

                        {visibleMembers.map(member => {
                          const profile = memberProfiles[member.user_id]
                          const name = profile?.full_name || profile?.email || member.email
                          return (
                          <div key={member.id} style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Avatar name={name} avatarUrl={profile?.avatar_url ?? null} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                              {name !== member.email && <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>{member.email}</p>}
                            </div>
                            {isAdmin ? (
                              <select value={member.role ?? 'member'} disabled={changingRoleId === member.id} onChange={e => changeRole(member.id, e.target.value)} onClick={e => e.stopPropagation()}
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '3px 8px', color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: 'Space Grotesk', cursor: 'pointer', outline: 'none' }}>
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: '9px', fontWeight: 700, color: ROLE_META[member.role ?? 'member']?.color ?? '#fff', background: ROLE_META[member.role ?? 'member']?.bg, border: `1px solid ${ROLE_META[member.role ?? 'member']?.border}`, borderRadius: '5px', padding: '2px 8px', fontFamily: 'Space Mono' }}>
                                {(member.role ?? 'MEMBER').toUpperCase()}
                              </span>
                            )}
                            {isAdmin && (
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeMember(member.id)}
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 8px', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                                Remove
                              </motion.button>
                            )}
                          </div>
                          )
                        })}

                        {visibleMembers.length === 0 && (
                          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'Space Mono', textAlign: 'center', padding: '16px 0' }}>NO TEAMMATES YET - INVITE SOMEONE</p>
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

      {/* Workspace edit modal */}
      <AnimatePresence>
        {editingWorkspace && (
          <WorkspaceEditModal workspace={editingWorkspace} onSave={handleWorkspaceSaved} onClose={() => setEditingWorkspace(null)} />
        )}
      </AnimatePresence>
    </>
  )
}
