import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { motion } from 'framer-motion'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // First try to get existing session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          navigate('/app')
          return
        }

        // Try exchange code for session
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('Exchange error:', error)
            navigate('/auth')
          } else if (data.session) {
            navigate('/app')
          } else {
            navigate('/auth')
          }
        } else {
          // Check for hash params (implicit flow fallback)
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          if (accessToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get('refresh_token') ?? '',
            })
            if (data.session) navigate('/app')
            else navigate('/auth')
          } else {
            navigate('/auth')
          }
        }
      } catch (err) {
        console.error('Callback error:', err)
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