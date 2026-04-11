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

export default function WorkspacePanel({ userId, currentWorkspace, onWorkspaceChange, onClose }: Props) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [tab, setTab] = useState<'workspaces' | 'members'>('workspaces')

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

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  useEffect(() => {
    if (currentWorkspace) fetchMembers()
  }, [currentWorkspace, fetchMembers])

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return
    setCreating(true)
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: newWorkspaceName.trim(), owner_id: userId })
      .select()
      .single()
    if (error) {
      toast.error('Failed to create workspace')
    } else {
      toast.success('Workspace created!')
      setNewWorkspaceName('')
      fetchWorkspaces()
      onWorkspaceChange(data)
    }
    setCreating(false)
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
        role: 'member',
      })

    if (insertError) toast.error('Failed to invite member')
    else { toast.success('Member invited!'); setInviteEmail(''); fetchMembers() }
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

  const isOwner = currentWorkspace?.owner_id === userId

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
              <motion.div
                key="workspaces"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                {/* Create workspace */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    color: 'rgba(255,255,255,0.3)', fontSize: '10px',
                    fontFamily: 'Space Mono', letterSpacing: '0.15em',
                    display: 'block', marginBottom: '8px',
                  }}>
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
                        fontSize: '13px', fontFamily: 'Space Grotesk',
                        outline: 'none',
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={createWorkspace}
                      disabled={creating}
                      style={{
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        border: 'none', borderRadius: '10px',
                        padding: '10px 16px', color: 'white',
                        cursor: 'pointer', fontSize: '13px',
                        fontFamily: 'Space Grotesk', fontWeight: 700,
                        whiteSpace: 'nowrap',
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
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px',
                  }}>👤</div>
                  <div>
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>
                      Personal Board
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
                      Private tasks only you can see
                    </p>
                  </div>
                  {currentWorkspace === null && (
                    <div style={{ marginLeft: 'auto', color: '#8b5cf6', fontSize: '12px' }}>✓ Active</div>
                  )}
                </motion.div>

                {/* Workspace list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {workspaces.map(ws => (
                    <motion.div
                      key={ws.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => { onWorkspaceChange(ws); onClose() }}
                      style={{
                        padding: '12px 16px', borderRadius: '12px',
                        border: `1px solid ${currentWorkspace?.id === ws.id ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        background: currentWorkspace?.id === ws.id ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '12px',
                      }}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '13px', fontWeight: 700,
                        fontFamily: 'Space Grotesk',
                      }}>
                        {ws.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>
                          {ws.name}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
                          {ws.owner_id === userId ? 'Owner' : 'Member'}
                        </p>
                      </div>
                      {currentWorkspace?.id === ws.id && (
                        <div style={{ marginLeft: 'auto', color: '#8b5cf6', fontSize: '12px' }}>✓ Active</div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {workspaces.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'Space Mono', textAlign: 'center', padding: '20px 0' }}>
                    NO WORKSPACES YET
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="members"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                {!currentWorkspace ? (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontFamily: 'Space Grotesk', textAlign: 'center', padding: '20px 0' }}>
                    Select a workspace first to manage members
                  </p>
                ) : (
                  <>
                    {isOwner && (
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{
                          color: 'rgba(255,255,255,0.3)', fontSize: '10px',
                          fontFamily: 'Space Mono', letterSpacing: '0.15em',
                          display: 'block', marginBottom: '8px',
                        }}>
                          INVITE BY EMAIL
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                              fontSize: '13px', fontFamily: 'Space Grotesk',
                              outline: 'none',
                            }}
                          />
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={inviteMember}
                            disabled={inviting}
                            style={{
                              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                              border: 'none', borderRadius: '10px',
                              padding: '10px 16px', color: 'white',
                              cursor: 'pointer', fontSize: '13px',
                              fontFamily: 'Space Grotesk', fontWeight: 700,
                            }}
                          >
                            {inviting ? '...' : 'Invite'}
                          </motion.button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                        <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>
                          {currentWorkspace.owner_id === userId ? 'You (Owner)' : 'Owner'}
                        </p>
                        <div style={{
                          marginLeft: 'auto',
                          background: 'rgba(139,92,246,0.15)',
                          border: '1px solid rgba(139,92,246,0.3)',
                          borderRadius: '6px', padding: '2px 8px',
                          color: '#8b5cf6', fontSize: '10px', fontFamily: 'Space Mono',
                        }}>OWNER</div>
                      </div>

                      {members.map(member => (
                        <div
                          key={member.id}
                          style={{
                            padding: '12px 16px', borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.02)',
                            display: 'flex', alignItems: 'center', gap: '12px',
                          }}
                        >
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '12px', fontWeight: 700,
                          }}>
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>
                              {member.email}
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
                              Member
                            </p>
                          </div>
                          {isOwner && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => removeMember(member.id)}
                              style={{
                                marginLeft: 'auto',
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