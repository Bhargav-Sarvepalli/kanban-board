import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createBrowserVoiceProvider } from '../../services/voice/browserVoiceProvider'
import { VoiceService } from '../../services/voice/voiceService'

interface NexBriefingCardProps {
  briefingText: string
  summary: string
  onRegenerate: () => void
  regenerating?: boolean
}

type VoiceState = 'idle' | 'speaking' | 'paused'

function BriefingButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: '40px',
        borderRadius: '12px',
        border: primary ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.16)',
        background: primary
          ? 'linear-gradient(135deg, #8b5cf6, #ec4899)'
          : 'rgba(255,255,255,0.055)',
        color: disabled ? '#77778c' : '#f7f7fb',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '12px',
        fontWeight: 850,
        padding: '9px 12px',
        boxShadow: primary ? '0 16px 38px rgba(124,58,237,0.28)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {children}
    </button>
  )
}

export default function NexBriefingCard({ briefingText, summary, onRegenerate, regenerating = false }: NexBriefingCardProps) {
  const voice = useMemo(() => new VoiceService(createBrowserVoiceProvider()), [])
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')

  useEffect(() => () => voice.stop(), [voice])

  const readBriefing = async (replay = false) => {
    try {
      setVoiceState('speaking')
      if (replay) await voice.replay(briefingText)
      else await voice.speak(briefingText)
      setVoiceState('idle')
    } catch (error) {
      console.error('[Daily voice]', error)
      setVoiceState('idle')
      toast.error('Could not read briefing in this browser')
    }
  }

  return (
    <section style={{
      border: '1px solid rgba(167,139,250,0.24)',
      borderRadius: '18px',
      background: 'linear-gradient(160deg, rgba(124,58,237,0.14), rgba(255,255,255,0.045) 42%, rgba(6,182,212,0.08))',
      boxShadow: '0 24px 70px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <p style={{ color: '#c4b5fd', fontSize: '11px', fontWeight: 900, letterSpacing: '0.15em', margin: 0, textTransform: 'uppercase' }}>Nex briefing</p>
        <h2 style={{ color: '#fff', fontSize: '21px', margin: '7px 0 0', letterSpacing: '-0.03em' }}>Why this plan</h2>
        <p style={{ color: '#b8b8cc', fontSize: '12px', lineHeight: 1.45, margin: '7px 0 0' }}>{summary}</p>
      </div>

      <div style={{ padding: '18px' }}>
        <p style={{ color: '#f1f1f7', fontSize: '14px', lineHeight: 1.65, margin: 0 }}>
          {briefingText}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: '18px' }}>
          <BriefingButton primary onClick={() => void readBriefing(false)} disabled={voiceState === 'speaking'}>
            Read Briefing
          </BriefingButton>
          <BriefingButton onClick={() => { voice.pause(); setVoiceState('paused') }} disabled={voiceState !== 'speaking'}>
            Pause
          </BriefingButton>
          <BriefingButton onClick={() => { voice.resume(); setVoiceState('speaking') }} disabled={voiceState !== 'paused'}>
            Resume
          </BriefingButton>
          <BriefingButton onClick={() => { voice.stop(); setVoiceState('idle') }} disabled={voiceState === 'idle'}>
            Stop
          </BriefingButton>
          <BriefingButton onClick={() => void readBriefing(true)} disabled={voiceState === 'speaking'}>
            Replay
          </BriefingButton>
          <BriefingButton onClick={onRegenerate} disabled={regenerating || voiceState === 'speaking'}>
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </BriefingButton>
        </div>
      </div>
    </section>
  )
}

