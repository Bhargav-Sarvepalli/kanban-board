import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { motion } from 'framer-motion'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.search
      )
      if (error) {
        console.error('Auth error:', error)
        navigate('/auth')
      } else if (data.session) {
        navigate('/app')
      } else {
        navigate('/auth')
      }
    }
    handleCallback()
  }, [navigate])

  return (
    <div style={{
      background: '#000', height: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
        style={{
          width: '32px', height: '32px',
          border: '2px solid rgba(139,92,246,0.3)',
          borderTopColor: '#8b5cf6',
          borderRadius: '50%',
        }}
      />
      <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Grotesk', fontSize: '14px' }}>
        Signing you in...
      </p>
    </div>
  )
}