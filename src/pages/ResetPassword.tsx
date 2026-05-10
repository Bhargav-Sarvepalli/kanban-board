import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [saving, setSaving] = useState(false)
  const checkedRef = useRef(false)

  useEffect(() => {
    const checkSession = async () => {
      if (checkedRef.current) return
      checkedRef.current = true
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Reset link expired. Request a new one.')
        navigate('/auth')
        return
      }
      setCheckingSession(false)
    }
    void checkSession()
  }, [navigate])

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.045)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '12px',
    color: 'white',
    fontSize: '14px',
    fontFamily: 'Inter, system-ui, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const updatePassword = async () => {
    if (!password || !confirmPassword) {
      toast.error('Fill in both password fields')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Password updated')
    navigate('/app')
  }

  const handleEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void updatePassword()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'radial-gradient(circle at 30% 15%, rgba(236,72,153,0.12), transparent 34%), radial-gradient(circle at 70% 80%, rgba(6,182,212,0.1), transparent 32%), #050509',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36 }}
        style={{
          width: 'min(420px, 100%)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'linear-gradient(180deg, rgba(20,22,32,0.98), rgba(8,9,14,0.98))',
          boxShadow: '0 32px 90px rgba(0,0,0,0.62)',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)' }} />
        <div style={{ padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)',
              color: 'white',
              fontWeight: 900,
            }}>N</div>
            <div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.46)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em' }}>ACCOUNT SECURITY</p>
              <h1 style={{ margin: '3px 0 0', color: 'white', fontSize: '22px', letterSpacing: '-0.02em' }}>Set a new password</h1>
            </div>
          </div>

          {checkingSession ? (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.58)', fontSize: '13px' }}>Checking reset link...</p>
          ) : (
            <>
              <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder="New password"
                  autoComplete="new-password"
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </div>

              <button
                type="button"
                onClick={updatePassword}
                disabled={saving}
                style={{
                  width: '100%',
                  height: '46px',
                  border: 'none',
                  borderRadius: '14px',
                  background: saving ? 'rgba(139,92,246,0.38)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  color: 'white',
                  cursor: saving ? 'wait' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 820,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  boxShadow: '0 18px 42px rgba(139,92,246,0.32)',
                }}
              >
                {saving ? 'Updating...' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  height: '40px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.035)',
                  color: 'rgba(255,255,255,0.66)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 720,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
