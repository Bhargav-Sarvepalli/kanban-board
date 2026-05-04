import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Profile } from '../types'
import Avatar from './Avatar'
import toast from 'react-hot-toast'

interface Props {
  userId: string
  profile: Profile | null
  onClose: () => void
  onProfileUpdated: (profile: Profile) => void
  nexEnabled: boolean
  onToggleNex: () => void
  defaultView: 'today' | 'board' | 'calendar' | 'flow' | 'pomodoro'
  onDefaultViewChange: (view: 'today' | 'board' | 'calendar' | 'flow' | 'pomodoro') => void
}

type Tab = 'profile' | 'preferences' | 'account'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile',     label: 'Profile',      icon: '👤' },
  { id: 'preferences', label: 'Preferences',  icon: '⚙' },
  { id: 'account',     label: 'Account',      icon: '🔐' },
]

export default function SettingsModal({
  userId, profile, onClose, onProfileUpdated,
  nexEnabled, onToggleNex, defaultView, onDefaultViewChange,
}: Props) {
  const [tab, setTab] = useState<Tab>('profile')
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [memberSince, setMemberSince] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Fetch account created date
    const fetchMeta = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.created_at) {
        setMemberSince(new Date(user.created_at).toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        }))
      }
    }
    void fetchMeta()
  }, [])

  const handleAvatarClick = () => fileRef.current?.click()

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }

    setUploadingAvatar(true)
    try {
      // Upload to Supabase Storage — path: userId/avatar.jpg
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      // Bust cache with timestamp
      const url = `${publicUrl}?t=${Date.now()}`

      // Save to profiles
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) throw updateError

      setAvatarUrl(url)
      onProfileUpdated(data)
      toast.success('Avatar updated!')
    } catch (err) {
      console.error('Avatar upload error:', err)
      toast.error('Failed to upload avatar')
    }
    setUploadingAvatar(false)
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = ''
  }, [userId, onProfileUpdated])

  const handleSaveProfile = async () => {
    if (!fullName.trim()) { toast.error('Name cannot be empty'); return }
    setSavingProfile(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', userId)
      .select()
      .single()
    if (error) toast.error('Failed to save profile')
    else { onProfileUpdated(data); toast.success('Profile updated!') }
    setSavingProfile(false)
  }

  const labelStyle = {
    display: 'block' as const,
    color: 'rgba(255,255,255,0.3)',
    fontSize: '10px', fontFamily: 'Space Mono, monospace',
    letterSpacing: '0.18em', marginBottom: '8px',
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '11px 14px',
    color: 'white', fontSize: '13px',
    fontFamily: 'Space Grotesk', outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 200,
        }}
      >
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '100%', maxWidth: '480px',
            background: '#070707',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Top accent */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              color: 'rgba(255,255,255,0.4)', fontSize: '11px',
              fontFamily: 'Space Mono', letterSpacing: '0.15em',
            }}>
              SETTINGS
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px',
              }}
            >✕</button>
          </div>

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: '2px',
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                  background: tab === t.id ? 'rgba(139,92,246,0.18)' : 'transparent',
                  color: tab === t.id ? '#a78bfa' : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk',
                  fontWeight: tab === t.id ? 600 : 400, transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <span style={{ fontSize: '13px' }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
            <AnimatePresence mode="wait">

              {/* ── PROFILE TAB ── */}
              {tab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Avatar */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                      <div
                        onClick={handleAvatarClick}
                        style={{ cursor: 'pointer', borderRadius: '50%', position: 'relative' }}
                      >
                        <Avatar
                          name={fullName || profile?.email || 'User'}
                          avatarUrl={avatarUrl}
                          size={88}
                        />
                        {/* Upload overlay */}
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.55)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity 0.2s',
                          fontSize: '22px',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                        >
                          {uploadingAvatar ? '⟳' : '📷'}
                        </div>
                      </div>

                      {/* Purple ring glow */}
                      <div style={{
                        position: 'absolute', inset: '-3px', borderRadius: '50%',
                        border: '2px solid rgba(139,92,246,0.4)',
                        pointerEvents: 'none',
                      }} />
                    </div>

                    <button
                      onClick={handleAvatarClick}
                      disabled={uploadingAvatar}
                      style={{
                        background: 'rgba(139,92,246,0.1)',
                        border: '1px solid rgba(139,92,246,0.25)',
                        borderRadius: '8px', padding: '6px 16px',
                        color: '#a78bfa', cursor: 'pointer',
                        fontSize: '12px', fontFamily: 'Space Grotesk',
                        transition: 'all 0.15s',
                      }}
                    >
                      {uploadingAvatar ? '⟳ Uploading...' : '📷 Change photo'}
                    </button>
                    <p style={{
                      color: 'rgba(255,255,255,0.2)', fontSize: '11px',
                      fontFamily: 'Space Grotesk', margin: '6px 0 0',
                    }}>
                      JPG, PNG or GIF · max 5MB
                    </p>

                    {/* Hidden file input */}
                    <input
                      ref={fileRef} type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {/* Full name */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>FULL NAME</label>
                    <input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveProfile()}
                      placeholder="Your full name"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  {/* Email — read only */}
                  <div style={{ marginBottom: '28px' }}>
                    <label style={labelStyle}>EMAIL</label>
                    <div style={{
                      ...inputStyle, display: 'flex', alignItems: 'center',
                      color: 'rgba(255,255,255,0.35)', cursor: 'default',
                      padding: '11px 14px',
                    }}>
                      <span style={{ flex: 1 }}>{profile?.email ?? '—'}</span>
                      <span style={{
                        fontSize: '9px', fontFamily: 'Space Mono',
                        padding: '2px 7px', borderRadius: '4px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em',
                      }}>
                        READ ONLY
                      </span>
                    </div>
                  </div>

                  {/* Save */}
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleSaveProfile} disabled={savingProfile}
                    style={{
                      width: '100%',
                      background: savingProfile ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                      border: 'none', borderRadius: '10px', padding: '12px',
                      color: 'white', cursor: savingProfile ? 'not-allowed' : 'pointer',
                      fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700,
                      boxShadow: savingProfile ? 'none' : '0 0 20px rgba(139,92,246,0.3)',
                    }}
                  >
                    {savingProfile ? '⟳ Saving...' : 'Save Profile →'}
                  </motion.button>
                </motion.div>
              )}

              {/* ── PREFERENCES TAB ── */}
              {tab === 'preferences' && (
                <motion.div
                  key="preferences"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Default view */}
                  <div style={{ marginBottom: '28px' }}>
                    <label style={labelStyle}>DEFAULT VIEW ON OPEN</label>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: '0 0 12px' }}>
                      Which view loads first when you open NexTask
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {([
                        { id: 'today',    label: '☀ Today',    desc: 'Daily focus' },
                        { id: 'board',    label: '⊞ Board',    desc: 'Kanban view' },
                        { id: 'calendar', label: '⊟ Calendar', desc: 'Month view'  },
                        { id: 'pomodoro', label: '◷ Timer', desc: 'Deep work' },
                      ] as const).map(v => (
                        <button
                          key={v.id}
                          onClick={() => onDefaultViewChange(v.id)}
                          style={{
                            flex: 1, padding: '12px 8px', borderRadius: '10px',
                            border: `1px solid ${defaultView === v.id ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            background: defaultView === v.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)',
                            color: defaultView === v.id ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                            cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk',
                            fontWeight: defaultView === v.id ? 600 : 400,
                            transition: 'all 0.15s', textAlign: 'center' as const,
                          }}
                        >
                          <div style={{ fontSize: '13px', marginBottom: '2px' }}>{v.label}</div>
                          <div style={{ fontSize: '10px', opacity: 0.6, fontFamily: 'Space Mono' }}>{v.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nex Assistant toggle */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>NEX AI ASSISTANT</label>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Mini orb */}
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: nexEnabled
                            ? 'radial-gradient(circle at 35% 30%, #ede9fe, #8b5cf6 40%, #4c1d95 80%)'
                            : 'rgba(255,255,255,0.08)',
                          boxShadow: nexEnabled ? '0 0 12px rgba(139,92,246,0.5)' : 'none',
                          transition: 'all 0.3s ease', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {!nexEnabled && <span style={{ fontSize: '14px', opacity: 0.4 }}>◉</span>}
                        </div>
                        <div>
                          <p style={{ color: nexEnabled ? '#c084fc' : 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0, transition: 'color 0.3s' }}>
                            Nex Assistant
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
                            Voice AI — click the orb or press Space
                          </p>
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={onToggleNex}
                        style={{
                          width: '44px', height: '24px', borderRadius: '12px',
                          background: nexEnabled ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)',
                          border: nexEnabled ? '1px solid rgba(139,92,246,0.7)' : '1px solid rgba(255,255,255,0.15)',
                          cursor: 'pointer', position: 'relative', transition: 'all 0.25s ease', outline: 'none',
                          padding: 0,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: '3px',
                          left: nexEnabled ? '22px' : '3px',
                          width: '16px', height: '16px', borderRadius: '50%',
                          background: nexEnabled ? '#c084fc' : 'rgba(255,255,255,0.4)',
                          boxShadow: nexEnabled ? '0 0 8px rgba(192,132,252,0.8)' : 'none',
                          transition: 'all 0.25s ease',
                        }} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── ACCOUNT TAB ── */}
              {tab === 'account' && (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Plan */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={labelStyle}>PLAN</label>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '12px',
                      background: 'rgba(139,92,246,0.06)',
                      border: '1px solid rgba(139,92,246,0.2)',
                    }}>
                      <div>
                        <p style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 700, fontFamily: 'Space Grotesk', margin: 0 }}>Free Plan</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '3px 0 0' }}>
                          Unlimited tasks · 5 AI uses/day · 1 workspace
                        </p>
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                        padding: '4px 10px', borderRadius: '6px',
                        background: 'rgba(139,92,246,0.15)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        color: '#a78bfa', fontFamily: 'Space Mono',
                      }}>
                        FREE
                      </span>
                    </div>
                  </div>

                  {/* Account info */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={labelStyle}>ACCOUNT INFO</label>
                    <div style={{
                      borderRadius: '12px', overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      {[
                        { label: 'Email', value: profile?.email ?? '—' },
                        { label: 'Member since', value: memberSince || '—' },
                        { label: 'User ID', value: userId.slice(0, 8) + '...' },
                      ].map((row, i, arr) => (
                        <div key={row.label} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 16px',
                          background: 'rgba(255,255,255,0.02)',
                          borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        }}>
                          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontFamily: 'Space Grotesk' }}>{row.label}</span>
                          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', fontFamily: 'Space Mono' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Danger zone */}
                  <div>
                    <label style={{ ...labelStyle, color: 'rgba(239,68,68,0.5)' }}>DANGER ZONE</label>
                    <div style={{
                      padding: '14px 16px', borderRadius: '12px',
                      background: 'rgba(239,68,68,0.04)',
                      border: '1px solid rgba(239,68,68,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: 'Space Grotesk', margin: 0 }}>
                          Delete account
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
                          Permanently remove all your data
                        </p>
                      </div>
                      <button
                        disabled
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: '8px', padding: '6px 14px',
                          color: 'rgba(239,68,68,0.4)',
                          fontSize: '12px', fontFamily: 'Space Grotesk',
                          cursor: 'not-allowed',
                        }}
                      >
                        Coming soon
                      </button>
                    </div>
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
