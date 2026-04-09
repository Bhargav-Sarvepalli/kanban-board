import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleEmailAuth = async () => {
    if (!email || !password) return toast.error('Please fill in all fields')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    setLoading(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) toast.error(error.message)
      else {
        toast.success('Account created! Check your email to confirm.')
        setMode('login')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) toast.error(error.message)
      else { toast.success('Welcome back!'); navigate('/app') }
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.hostname === 'localhost'
          ? 'http://localhost:5173/auth/callback'
          : 'https://kanban-board-beige-seven.vercel.app/auth/callback',
      },
    })
    if (error) { toast.error(error.message); setGoogleLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Space Grotesk, sans-serif', cursor: 'default',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glows */}
      <div style={{
        position: 'absolute', top: '-200px', left: '-200px',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-200px', right: '-200px',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%', maxWidth: '420px',
          margin: '0 24px',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', marginBottom: '8px',
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: 800, color: 'white',
              boxShadow: '0 0 20px rgba(139,92,246,0.4)',
            }}>N</div>
            <span style={{ fontWeight: 700, fontSize: '20px', color: 'white', letterSpacing: '-0.02em' }}>
              NEX<span style={{ color: '#8b5cf6' }}>TASK</span>
            </span>
          </motion.div>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', margin: 0 }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px', padding: '32px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}>
          {/* Top gradient line */}
          <div style={{
            height: '1px', marginBottom: '28px',
            background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(236,72,153,0.6), transparent)',
          }} />

          {/* Google button */}
          <motion.button
            whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: '100%', padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', color: 'white',
              cursor: 'pointer', fontSize: '14px',
              fontFamily: 'Space Grotesk', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              marginBottom: '20px', transition: 'background 0.2s',
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

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'Space Mono' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Email field */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '11px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', color: 'white',
                fontSize: '14px', fontFamily: 'Space Grotesk',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {/* Password field */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '11px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', color: 'white',
                fontSize: '14px', fontFamily: 'Space Grotesk',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {/* Submit */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(139,92,246,0.5)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEmailAuth}
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: loading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none', borderRadius: '12px',
              color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontFamily: 'Space Grotesk', fontWeight: 700,
              boxShadow: '0 0 20px rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}
              />
            ) : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </motion.button>
        </div>

        {/* Toggle mode */}
        <p style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <motion.span
            whileHover={{ color: '#8b5cf6' }}
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{ color: '#8b5cf6', cursor: 'pointer', fontWeight: 600, transition: 'color 0.2s' }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </motion.span>
        </p>
      </motion.div>
    </div>
  )
}