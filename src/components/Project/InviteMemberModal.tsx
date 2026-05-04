import { useState } from 'react'
import { supabase } from '../../supabase'

interface Props {
  projectId: string
  onInvited: () => void
  onClose: () => void
}

type Role = 'manager' | 'member'
type InviteMode = 'direct' | 'workspace'

export default function InviteMemberModal({ projectId, onInvited, onClose }: Props) {
  const [email,   setEmail]   = useState('')
  const [role,    setRole]    = useState<Role>('member')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [mode,    setMode]    = useState<InviteMode>('workspace')
  const [alreadyHadAccess, setAlreadyHadAccess] = useState(false)

  const handleInvite = async () => {
    if (!email.trim()) { setError('Email is required'); return }
    setSaving(true); setError('')

    const normalizedEmail = email.trim().toLowerCase()
    const { data: auth } = await supabase.auth.getUser()
    const currentUserId = auth.user?.id
    if (!currentUserId) {
      setError('Please sign in again before inviting members.')
      setSaving(false); return
    }

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('workspace_id')
      .eq('id', projectId)
      .single()

    if (projectErr) {
      setError('Could not load project access settings.')
      setSaving(false); return
    }

    if (project?.workspace_id) {
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id,user_id,email')
        .eq('workspace_id', project.workspace_id)
        .eq('email', normalizedEmail)

      if (existingMember && existingMember.length > 0) {
        setAlreadyHadAccess(true)
        setMode('workspace')
        setSuccess(true)
        setSaving(false)
        setTimeout(() => { onInvited(); onClose() }, 1200)
        return
      }

      const { data: existingInvite } = await supabase
        .from('workspace_invites')
        .select('id')
        .eq('workspace_id', project.workspace_id)
        .eq('email', normalizedEmail)
        .eq('status', 'pending')

      if (existingInvite && existingInvite.length > 0) {
        setError('An invite is already pending for this email.')
        setSaving(false); return
      }

      const { error: inviteErr } = await supabase.from('workspace_invites').insert({
        workspace_id: project.workspace_id,
        invited_by: currentUserId,
        email: normalizedEmail,
        role: role === 'manager' ? 'admin' : 'member',
      })

      if (inviteErr) { setError(inviteErr.message); setSaving(false); return }

      setAlreadyHadAccess(false)
      setMode('workspace')
      setSuccess(true)
      setSaving(false)
      setTimeout(() => { onInvited(); onClose() }, 1400)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!profile) {
      setError('No NexTask account found with that email. They need to sign up first.')
      setSaving(false); return
    }

    const { data: existing } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', profile.id)
      .maybeSingle()

    if (existing) {
      setError('This person is already a member of this project.')
      setSaving(false); return
    }

    const { error: err } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: profile.id,
      role,
    })

    if (err) { setError(err.message); setSaving(false); return }

    setMode('direct')
    setSuccess(true)
    setSaving(false)
    setTimeout(() => { onInvited(); onClose() }, 1200)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '24px', width: '380px', boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: '#e2e2e8', fontSize: '15px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>Invite Team Member</h3>
          <button onClick={onClose} aria-label="Close invite modal" style={{ background: 'none', border: 'none', color: '#3d3d52', cursor: 'pointer', fontSize: '18px' }}>x</button>
        </div>

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#22c55e' }}>OK</div>
            <p style={{ color: '#e2e2e8', fontSize: '14px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{alreadyHadAccess ? 'Already has access' : mode === 'workspace' ? 'Invite sent' : 'Member added'}</p>
            <p style={{ color: '#6b6b7b', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0, textAlign: 'center' }}>
              {alreadyHadAccess ? 'They should appear in the team through workspace access.' : mode === 'workspace' ? 'They will appear here after accepting the workspace invite.' : 'They now have project access.'}
            </p>
          </div>
        ) : (
          <>
            <label style={labelStyle}>Email address</label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              onKeyDown={e => { if (e.key === 'Enter') void handleInvite() }}
              style={inputStyle}
            />

            <label style={{ ...labelStyle, marginTop: '2px' }}>Role</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {(['manager', 'member'] as Role[]).map(r => (
                <button key={r}
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1, padding: '8px', border: `1px solid ${role === r ? '#7c3aed' : '#1e1e2e'}`,
                    borderRadius: '7px', background: role === r ? 'rgba(124,58,237,0.12)' : 'transparent',
                    color: role === r ? '#a78bfa' : '#6b6b7b', cursor: 'pointer',
                    fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: role === r ? 600 : 400,
                    transition: 'all 0.1s',
                  }}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>

            <p style={{ color: '#4b4b63', fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: '0 0 16px', lineHeight: 1.5 }}>
              {role === 'manager'
                ? 'Managers can help manage project details, members, features, and milestones.'
                : 'Members can view the project and update assigned work.'}
            </p>

            {error && <p style={{ color: '#ef4444', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px', lineHeight: 1.45 }}>{error}</p>}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
              <button onClick={() => { void handleInvite() }} disabled={saving || !email.trim()} style={primaryBtnStyle(!!email.trim() && !saving)}>
                {saving ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', color: '#6b6b7b', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e2e', borderRadius: '7px', padding: '8px 12px', color: '#e2e2e8', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: '14px' }
const secondaryBtnStyle: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '7px', color: '#6b6b7b', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }
const primaryBtnStyle = (enabled: boolean): React.CSSProperties => ({ flex: 1, padding: '8px 16px', background: enabled ? '#7c3aed' : 'rgba(124,58,237,0.3)', border: 'none', borderRadius: '7px', color: enabled ? 'white' : 'rgba(255,255,255,0.3)', cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 })
