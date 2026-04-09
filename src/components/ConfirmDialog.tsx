import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}: Props) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: '#080808',
            border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '360px',
            boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 40px ${danger ? 'rgba(239,68,68,0.08)' : 'rgba(139,92,246,0.08)'}`,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Top accent */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '2px',
            background: danger
              ? 'linear-gradient(90deg, #ef4444, #f97316)'
              : 'linear-gradient(90deg, #8b5cf6, #ec4899)',
          }} />

          {/* Icon */}
          <div style={{
            width: '48px', height: '48px',
            borderRadius: '12px',
            background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)',
            border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : 'rgba(139,92,246,0.2)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px',
            marginBottom: '16px',
          }}>
            {danger ? '⚠' : '?'}
          </div>

          {/* Title */}
          <h3 style={{
            color: 'white',
            fontSize: '16px',
            fontWeight: 700,
            margin: '0 0 8px',
            fontFamily: 'Space Grotesk',
            letterSpacing: '-0.01em',
          }}>
            {title}
          </h3>

          {/* Message */}
          <p style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '13px',
            lineHeight: 1.6,
            margin: '0 0 24px',
            fontFamily: 'Space Grotesk',
          }}>
            {message}
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '11px',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'Space Grotesk',
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            >
              {cancelLabel}
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              style={{
                flex: 1,
                background: danger
                  ? 'linear-gradient(135deg, #ef4444, #f97316)'
                  : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                border: 'none',
                borderRadius: '10px',
                padding: '11px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'Space Grotesk',
                fontWeight: 700,
                boxShadow: danger
                  ? '0 0 20px rgba(239,68,68,0.3)'
                  : '0 0 20px rgba(139,92,246,0.3)',
              }}
            >
              {confirmLabel}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ConfirmDialog