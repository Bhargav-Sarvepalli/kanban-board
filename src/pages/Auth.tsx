import { useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'

type AuthMode = 'login' | 'signup' | 'forgot'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const resetRedirectUrl = () => `${window.location.origin}/auth/callback?type=recovery`
  const normalizedEmail = email.trim().toLowerCase()
  const isForgot = mode === 'forgot'

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setPassword('')
    if (next !== 'signup') setFullName('')
  }

  const handleForgotPassword = async () => {
    if (!normalizedEmail) {
      toast.error('Enter your email first')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: resetRedirectUrl(),
    })
    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Reset link sent. Check your email.')
    switchMode('login')
  }

  const handleEmailAuth = async () => {
    if (mode === 'forgot') {
      await handleForgotPassword()
      return
    }
    if (!normalizedEmail || !password) return toast.error('Please fill in all fields')
    if (mode === 'signup' && !fullName.trim()) return toast.error('Please enter your full name')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      })
      if (error) {
        toast.error(error.message)
      } else {
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName.trim(),
            onboarding_completed: false,
            updated_at: new Date().toISOString(),
          })
        }
        toast.success('Account created. Check your email to confirm.')
        switchMode('login')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error) toast.error(error.message)
      else {
        toast.success('Welcome back')
        navigate('/app')
      }
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      toast.error(error.message)
      setGoogleLoading(false)
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    fontFamily: 'Inter, system-ui, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const labelStyle: CSSProperties = {
    color: 'rgba(255,255,255,0.48)',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    letterSpacing: '0.1em',
    display: 'block',
    marginBottom: '8px',
  }

  const handleInputFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(139,92,246,0.58)'
    e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.14)'
  }

  const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.12)'
    e.target.style.boxShadow = 'none'
  }

  const handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleEmailAuth()
  }

  const subtitle = mode === 'login'
    ? 'Welcome back'
    : mode === 'signup'
      ? 'Create your account'
      : 'Reset your password'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      cursor: 'default',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '-200px',
        left: '-200px',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-200px',
        right: '-200px',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', maxWidth: '420px', margin: '0 24px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              marginBottom: '8px',
            }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              fontWeight: 800,
              color: 'white',
              boxShadow: '0 0 20px rgba(139,92,246,0.4)',
            }}>N</div>
            <span style={{ fontWeight: 750, fontSize: '20px', color: 'white', letterSpacing: '-0.02em' }}>
              NEX<span style={{ color: '#8b5cf6' }}>TASK</span>
            </span>
          </motion.div>
          <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: '13px', margin: 0 }}>
            {subtitle}
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}>
          <div style={{
            height: '1px',
            marginBottom: '28px',
            background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(236,72,153,0.6), transparent)',
          }} />

          {!isForgot && (
            <>
              <motion.button
                whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.08)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGoogle}
                disabled={googleLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 650,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginBottom: '20px',
                  transition: 'background 0.2s',
                }}
              >
                {googleLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}
                  />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                    <path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 0 1 4.5 7.5V5.43H1.83a8 8 0 0 0 0 7.14l2.67-2.09z"/>
                    <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.54-2.54A8 8 0 0 0 1.83 5.43L4.5 7.5c.66-1.97 2.52-3.92 4.48-3.92z"/>
                  </svg>
                )}
                {googleLoading ? 'Redirecting...' : 'Continue with Google'}
              </motion.button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '11px', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </>
          )}

          <motion.div
            initial={false}
            animate={{ height: mode === 'signup' ? 'auto' : 0, opacity: mode === 'signup' ? 1 : 0, marginBottom: mode === 'signup' ? 12 : 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <label style={labelStyle}>FULL NAME</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              onKeyDown={handleEnter}
              placeholder="Your full name"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </motion.div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleEnter}
              placeholder="you@example.com"
              autoComplete="email"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {!isForgot && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <label style={labelStyle}>PASSWORD</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    style={{
                      margin: '0 0 8px',
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: '#c4b5fd',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleEnter}
                placeholder="Password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
              {mode === 'signup' && (
                <p style={{ color: 'rgba(255,255,255,0.34)', fontSize: '11px', margin: '6px 0 0' }}>
                  Minimum 6 characters
                </p>
              )}
            </div>
          )}

          {isForgot && (
            <p style={{ margin: '0 0 22px', color: 'rgba(255,255,255,0.52)', fontSize: '13px', lineHeight: 1.5 }}>
              We will email you a secure link to set a new password.
            </p>
          )}

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(139,92,246,0.5)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEmailAuth}
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 760,
              boxShadow: '0 0 20px rgba(139,92,246,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}
              />
            ) : mode === 'login' ? 'Sign in ->' : mode === 'signup' ? 'Create account ->' : 'Send reset link ->'}
          </motion.button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.48)', fontSize: '13px' }}>
          {mode === 'login' && "Don't have an account? "}
          {mode === 'signup' && 'Already have an account? '}
          {mode === 'forgot' && 'Remembered your password? '}
          <motion.span
            whileHover={{ color: '#c4b5fd' }}
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            style={{ color: '#8b5cf6', cursor: 'pointer', fontWeight: 700, transition: 'color 0.2s' }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </motion.span>
        </p>
      </motion.div>
    </div>
  )
}
