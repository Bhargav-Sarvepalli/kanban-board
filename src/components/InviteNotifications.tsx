import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Profile } from '../types'
import toast from 'react-hot-toast'
import WorkspaceAvatar from './WorkspaceAvatar'

interface WorkspaceInvite {
  id: string
  workspace_id: string
  invited_by: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  workspace?: { name: string; color: string; icon: string | null; logo_url: string | null }
  inviter?: Profile
}

interface Props {
  userId: string
  userEmail: string
  onInviteAccepted: () => void
}

const ROLE_COLOR: Record<string, string> = {
  admin:  '#a78bfa',
  member: '#34d399',
  viewer: '#fb923c',
}

export default function InviteNotifications({ userId, userEmail, onInviteAccepted }: Props) {
  const [open, setOpen] = useState(false)
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchInvites = useCallback(async () => {
    const profileEmail = userEmail.trim().toLowerCase()
    const { data: authData } = await supabase.auth.getUser()
    const authEmail = authData.user?.email?.trim().toLowerCase() ?? ''
    const knownEmails = Array.from(new Set([profileEmail, authEmail].filter(Boolean)))

    if (knownEmails.length === 0) {
      setInvites([])
      return
    }

    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[InviteNotifications] fetch failed', error)
      return
    }
    if (!data) {
      setInvites([])
      return
    }

    const matchingInvites = data.filter(invite => knownEmails.includes(invite.email.trim().toLowerCase()))

    const enriched = await Promise.all(matchingInvites.map(async (inv) => {
      const [wsResult, inviterResult] = await Promise.all([
        supabase.from('workspaces').select('name, color, icon, logo_url').eq('id', inv.workspace_id).single(),
        supabase.from('profiles').select('*').eq('id', inv.invited_by).single(),
      ])
      return { ...inv, workspace: wsResult.data ?? undefined, inviter: inviterResult.data ?? undefined }
    }))

    setInvites(enriched)
  }, [userEmail])

  useEffect(() => {
    const load = async () => { await fetchInvites() }
    void load()
    const channel = supabase
      .channel(`invites-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_invites' }, () => { void fetchInvites() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, userEmail, fetchInvites])

  const handleAccept = async (invite: WorkspaceInvite) => {
    setProcessing(invite.id)
    const { error } = await supabase.rpc('accept_workspace_invite', { target_invite_id: invite.id })
    if (error) {
      console.error('[InviteNotifications] accept failed', error)
      toast.error(error.message || 'Failed to join workspace')
      setProcessing(null)
      return
    }
    toast.success(`Joined ${invite.workspace?.name ?? 'workspace'}! 🎉`)
    setInvites(prev => prev.filter(i => i.id !== invite.id))
    onInviteAccepted()
    if (invites.length <= 1) setOpen(false)
    setProcessing(null)
  }

  const handleReject = async (invite: WorkspaceInvite) => {
    setProcessing(invite.id)
    const { error } = await supabase.from('workspace_invites').update({ status: 'rejected' }).eq('id', invite.id)
    if (error) { toast.error('Failed to decline invite'); setProcessing(null); return }
    toast.success('Invite declined')
    setInvites(prev => prev.filter(i => i.id !== invite.id))
    if (invites.length <= 1) setOpen(false)
    setProcessing(null)
  }

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative',
          background: invites.length > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${invites.length > 0 ? 'rgba(248,113,113,0.46)' : 'rgba(255,255,255,0.16)'}`,
          borderRadius: '10px', width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s',
        }}
      >
        🔔
        {invites.length > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{
              position: 'absolute', top: '-5px', right: '-5px',
              background: 'linear-gradient(135deg, #ef4444, #ec4899)',
              color: 'white', fontSize: '9px', fontWeight: 700,
              fontFamily: 'Space Mono', width: '16px', height: '16px',
              borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: '1.5px solid #000',
            }}
          >
            {invites.length}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9997 }} onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                width: '320px', zIndex: 9998,
                background: '#111', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px', boxShadow: '0 24px 60px rgba(0,0,0,0.9)', overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>
                  WORKSPACE INVITES
                </span>
                {invites.length > 0 && (
                  <span style={{ fontSize: '10px', fontFamily: 'Space Mono', color: '#a78bfa', background: 'rgba(167,139,250,0.12)', padding: '2px 7px', borderRadius: '5px' }}>
                    {invites.length} pending
                  </span>
                )}
              </div>

              {invites.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '22px', margin: '0 0 8px' }}>📭</p>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: 0 }}>
                    No pending invites
                  </p>
                </div>
              ) : (
                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {invites.map(invite => (
                    <div key={invite.id} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <WorkspaceAvatar
                          name={invite.workspace?.name ?? 'Workspace'}
                          logoUrl={invite.workspace?.logo_url ?? null}
                          icon={invite.workspace?.icon}
                          color={invite.workspace?.color ?? '#8b5cf6'}
                          size={36}
                          radius={10}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {invite.workspace?.name ?? 'Unknown workspace'}
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
                            From {invite.inviter?.full_name ?? invite.inviter?.email ?? 'someone'}
                          </p>
                        </div>
                        <span style={{
                          fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                          padding: '2px 8px', borderRadius: '5px',
                          color: ROLE_COLOR[invite.role] ?? '#fff',
                          background: `${ROLE_COLOR[invite.role] ?? '#fff'}15`,
                          border: `1px solid ${ROLE_COLOR[invite.role] ?? '#fff'}30`,
                          fontFamily: 'Space Mono', flexShrink: 0,
                        }}>
                          {invite.role.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <motion.button
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => handleAccept(invite)}
                          disabled={processing === invite.id}
                          style={{
                            flex: 1, padding: '8px',
                            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
                            borderRadius: '8px', color: '#34d399',
                            cursor: processing === invite.id ? 'not-allowed' : 'pointer',
                            fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600,
                          }}
                        >
                          {processing === invite.id ? '⟳' : '✓ Accept'}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => handleReject(invite)}
                          disabled={processing === invite.id}
                          style={{
                            flex: 1, padding: '8px',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '8px', color: '#f87171',
                            cursor: processing === invite.id ? 'not-allowed' : 'pointer',
                            fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600,
                          }}
                        >
                          ✕ Decline
                        </motion.button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
