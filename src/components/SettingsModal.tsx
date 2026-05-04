import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'
import type { Profile } from '../types'
import Avatar from './Avatar'

type DefaultView = 'today' | 'board' | 'calendar' | 'pomodoro'
type Tab = 'profile' | 'preferences' | 'account'

interface Props {
  userId: string
  profile: Profile | null
  onClose: () => void
  onProfileUpdated: (profile: Profile) => void
  nexEnabled: boolean
  onToggleNex: () => void
  defaultView: DefaultView
  onDefaultViewChange: (view: DefaultView) => void
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'account', label: 'Account' },
]

const defaultViews: { id: DefaultView; label: string; desc: string }[] = [
  { id: 'today', label: 'Today', desc: 'Daily focus' },
  { id: 'board', label: 'Board', desc: 'Kanban work' },
  { id: 'calendar', label: 'Calendar', desc: 'Schedule' },
  { id: 'pomodoro', label: 'Timer', desc: 'Deep work' },
]

const panelLabel: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.46)',
  fontSize: '11px',
  fontWeight: 850,
  letterSpacing: '0.12em',
  marginBottom: '8px',
  textTransform: 'uppercase',
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.035)',
  color: 'white',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '13px',
  outline: 'none',
  padding: '12px 14px',
}

function Toggle({ active, onClick, label, description }: {
  active: boolean
  onClick: () => void
  label: string
  description: string
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.025)',
    }}>
      <div>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.86)', fontSize: '13px', fontWeight: 760 }}>{label}</p>
        <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.38)', fontSize: '12px', lineHeight: 1.35 }}>{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '999px',
          border: active ? '1px solid rgba(139,92,246,0.72)' : '1px solid rgba(255,255,255,0.14)',
          background: active ? 'rgba(139,92,246,0.72)' : 'rgba(255,255,255,0.08)',
          cursor: 'pointer',
          padding: 0,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: '3px',
          left: active ? '23px' : '3px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: active ? 'white' : 'rgba(255,255,255,0.48)',
          transition: 'left 0.18s ease',
          boxShadow: active ? '0 0 14px rgba(255,255,255,0.5)' : 'none',
        }} />
      </button>
    </div>
  )
}

export default function SettingsModal({
  userId,
  profile,
  onClose,
  onProfileUpdated,
  nexEnabled,
  onToggleNex,
  defaultView,
  onDefaultViewChange,
}: Props) {
  const [tab, setTab] = useState<Tab>('profile')
  const [selectedDefaultView, setSelectedDefaultView] = useState(defaultView)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [memberSince, setMemberSince] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchMeta = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.created_at) return
      setMemberSince(new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }))
    }
    void fetchMeta()
  }, [])

  useEffect(() => {
    setSelectedDefaultView(defaultView)
  }, [defaultView])

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', userId)
        .select()
        .single()
      if (error) throw error

      setAvatarUrl(url)
      onProfileUpdated(data)
      toast.success('Photo updated')
    } catch (err) {
      console.error('Avatar upload error:', err)
      toast.error('Could not upload photo')
    } finally {
      setUploadingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [userId, onProfileUpdated])

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    setSavingProfile(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', userId)
      .select()
      .single()
    setSavingProfile(false)
    if (error) {
      toast.error('Could not save profile')
      return
    }
    onProfileUpdated(data)
    toast.success('Profile saved')
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0,0,0,0.68)',
          backdropFilter: 'blur(8px)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 'min(480px, 100vw)',
            display: 'flex',
            flexDirection: 'column',
            background: '#0b0c12',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '-28px 0 80px rgba(0,0,0,0.48)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.44)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em' }}>SETTINGS</p>
              <h2 style={{ margin: '4px 0 0', color: 'white', fontSize: '18px', fontWeight: 820, letterSpacing: 0 }}>Workspace Preferences</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '11px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.62)',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {tabs.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                style={{
                  flex: 1,
                  height: '36px',
                  borderRadius: '11px',
                  border: tab === item.id ? '1px solid rgba(139,92,246,0.42)' : '1px solid transparent',
                  background: tab === item.id ? 'rgba(139,92,246,0.16)' : 'transparent',
                  color: tab === item.id ? '#c4b5fd' : 'rgba(255,255,255,0.46)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 760,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 22px' }}>
            <AnimatePresence mode="wait">
              {tab === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingAvatar}
                      style={{ border: 'none', background: 'transparent', padding: 0, cursor: uploadingAvatar ? 'wait' : 'pointer' }}
                    >
                      <Avatar name={fullName || profile?.email || 'User'} avatarUrl={avatarUrl} size={76} />
                    </button>
                    <div>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploadingAvatar}
                        style={{
                          height: '34px',
                          padding: '0 14px',
                          borderRadius: '10px',
                          border: '1px solid rgba(139,92,246,0.3)',
                          background: 'rgba(139,92,246,0.12)',
                          color: '#c4b5fd',
                          cursor: uploadingAvatar ? 'wait' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 760,
                        }}
                      >
                        {uploadingAvatar ? 'Uploading...' : 'Change photo'}
                      </button>
                      <p style={{ margin: '7px 0 0', color: 'rgba(255,255,255,0.36)', fontSize: '12px' }}>JPG, PNG, GIF or WebP under 5MB.</p>
                    </div>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={panelLabel}>Full Name</label>
                    <input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void handleSaveProfile() }}
                      placeholder="Your name"
                      style={fieldStyle}
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={panelLabel}>Email</label>
                    <div style={{ ...fieldStyle, color: 'rgba(255,255,255,0.55)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email ?? '-'}</span>
                      <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: '11px', flexShrink: 0 }}>Read only</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    style={{
                      width: '100%',
                      height: '44px',
                      border: '1px solid rgba(255,255,255,0.14)',
                      borderRadius: '12px',
                      background: savingProfile ? 'rgba(139,92,246,0.28)' : 'linear-gradient(180deg, #9f7aea, #7c3aed)',
                      color: 'white',
                      cursor: savingProfile ? 'wait' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 820,
                      boxShadow: savingProfile ? 'none' : '0 16px 36px rgba(124,58,237,0.32)',
                    }}
                  >
                    {savingProfile ? 'Saving...' : 'Save profile'}
                  </button>
                </motion.div>
              )}

              {tab === 'preferences' && (
                <motion.div key="preferences" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={panelLabel}>Default View</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {defaultViews.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedDefaultView(item.id)
                            onDefaultViewChange(item.id)
                            toast.success(`${item.label} set as default`)
                          }}
                          style={{
                            minHeight: '72px',
                            padding: '12px',
                            textAlign: 'left',
                            borderRadius: '14px',
                            border: selectedDefaultView === item.id ? '1px solid rgba(139,92,246,0.55)' : '1px solid rgba(255,255,255,0.08)',
                            background: selectedDefaultView === item.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.025)',
                            color: selectedDefaultView === item.id ? '#ddd6fe' : 'rgba(255,255,255,0.74)',
                            cursor: 'pointer',
                            fontFamily: 'Inter, system-ui, sans-serif',
                          }}
                        >
                          <strong style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>{item.label}</strong>
                          <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '12px' }}>{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    <Toggle
                      active={nexEnabled}
                      onClick={onToggleNex}
                      label="Nex Assistant"
                      description="Show the assistant orb for quick task and project help."
                    />
                  </div>
                </motion.div>
              )}

              {tab === 'account' && (
                <motion.div key="account" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
                  <label style={panelLabel}>Account Details</label>
                  <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.025)' }}>
                    {[
                      { label: 'Email', value: profile?.email ?? '-' },
                      { label: 'Member since', value: memberSince || '-' },
                      { label: 'User ID', value: `${userId.slice(0, 8)}...` },
                    ].map((row, index) => (
                      <div key={row.label} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        padding: '13px 14px',
                        borderBottom: index < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '12px' }}>{row.label}</span>
                        <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '18px', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.78)', fontSize: '13px', fontWeight: 760 }}>Privacy-first workspace</p>
                    <p style={{ margin: '5px 0 0', color: 'rgba(255,255,255,0.38)', fontSize: '12px', lineHeight: 1.45 }}>
                      Profile settings are kept here. Workspace members, invites, projects, and task data stay inside their own app surfaces.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
