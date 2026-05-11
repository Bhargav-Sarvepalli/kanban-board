import { useState } from 'react'
import type { EnergyLevel, MorningSetupInput, SleepQuality } from '../../types/daily'

interface MorningSetupFormProps {
  onGenerate: (input: MorningSetupInput) => void
  loading?: boolean
}

const sleepOptions: { value: SleepQuality; label: string; hint: string }[] = [
  { value: 'poor', label: 'Poor', hint: 'Use lighter blocks' },
  { value: 'okay', label: 'Okay', hint: 'Steady execution' },
  { value: 'good', label: 'Good', hint: 'Protect deep work' },
]

const energyOptions: { value: EnergyLevel; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'Shorter sessions' },
  { value: 'medium', label: 'Medium', hint: 'Balanced day' },
  { value: 'high', label: 'High', hint: 'Hard work first' },
]

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#b9b9ce',
  fontSize: '11px',
  fontWeight: 850,
  letterSpacing: '0.12em',
  marginBottom: '9px',
  textTransform: 'uppercase',
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '14px',
  background: 'rgba(255,255,255,0.055)',
  color: '#f7f7fb',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '14px',
  lineHeight: 1.45,
  outline: 'none',
  padding: '13px 14px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
}

function ChoiceButton<T extends string>({
  active,
  label,
  hint,
  value,
  onSelect,
}: {
  active: boolean
  label: string
  hint: string
  value: T
  onSelect: (value: T) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(value)}
      style={{
        flex: 1,
        minWidth: '120px',
        padding: '14px',
        borderRadius: '14px',
        border: active ? '1px solid rgba(167,139,250,0.78)' : '1px solid rgba(255,255,255,0.16)',
        background: active
          ? 'linear-gradient(135deg, rgba(124,58,237,0.82), rgba(219,39,119,0.62))'
          : 'rgba(255,255,255,0.045)',
        color: active ? '#fff' : '#d8d8e8',
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: active ? '0 14px 36px rgba(124,58,237,0.22), inset 0 1px 0 rgba(255,255,255,0.22)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <span style={{ display: 'block', fontSize: '14px', fontWeight: 850 }}>{label}</span>
      <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: active ? 'rgba(255,255,255,0.78)' : '#9f9fb6' }}>{hint}</span>
    </button>
  )
}

export default function MorningSetupForm({ onGenerate, loading = false }: MorningSetupFormProps) {
  const [wakeUpTime, setWakeUpTime] = useState('8:30 AM')
  const [sleepQuality, setSleepQuality] = useState<SleepQuality>('okay')
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('medium')
  const [availableHours, setAvailableHours] = useState(6)
  const [mainFocus, setMainFocus] = useState('')
  const [hardCommitments, setHardCommitments] = useState('')
  const [extraContext, setExtraContext] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return
    onGenerate({
      wakeUpTime,
      sleepQuality,
      energyLevel,
      availableHours: Math.min(12, Math.max(1, Number(availableHours) || 1)),
      mainFocus,
      hardCommitments,
      extraContext,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{
      width: '100%',
      maxWidth: '980px',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: '22px',
      background: 'linear-gradient(145deg, rgba(20,20,31,0.96), rgba(9,9,14,0.96))',
      boxShadow: '0 26px 80px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />
      <div style={{ padding: '28px', display: 'grid', gap: '24px' }}>
        <div>
          <p style={{ color: '#7dd3fc', fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', margin: 0, textTransform: 'uppercase' }}>Start your day with Nex</p>
          <h2 style={{ color: '#fff', fontSize: '30px', lineHeight: 1.05, margin: '8px 0 8px', letterSpacing: '-0.04em' }}>Build a realistic plan</h2>
          <p style={{ color: '#c6c6d8', fontSize: '14px', lineHeight: 1.55, margin: 0, maxWidth: '640px' }}>
            Tell Nex how your morning looks. Nex will create the schedule on screen and a separate briefing that explains the strategy.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <label>
            <span style={labelStyle}>Wake-up time</span>
            <input value={wakeUpTime} onChange={e => setWakeUpTime(e.target.value)} placeholder="8:30 AM" style={fieldStyle} />
          </label>
          <label>
            <span style={labelStyle}>Available work hours</span>
            <input type="number" min={1} max={12} step={0.5} value={availableHours} onChange={e => setAvailableHours(Number(e.target.value))} style={fieldStyle} />
          </label>
        </div>

        <div>
          <span style={labelStyle}>Sleep quality</span>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {sleepOptions.map(option => (
              <ChoiceButton key={option.value} {...option} active={sleepQuality === option.value} onSelect={setSleepQuality} />
            ))}
          </div>
        </div>

        <div>
          <span style={labelStyle}>Energy level</span>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {energyOptions.map(option => (
              <ChoiceButton key={option.value} {...option} active={energyLevel === option.value} onSelect={setEnergyLevel} />
            ))}
          </div>
        </div>

        <label>
          <span style={labelStyle}>Main focus</span>
          <input value={mainFocus} onChange={e => setMainFocus(e.target.value)} placeholder="Finish FLOW merge system" style={fieldStyle} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <label>
            <span style={labelStyle}>Hard commitments / meetings</span>
            <textarea value={hardCommitments} onChange={e => setHardCommitments(e.target.value)} placeholder="Class from 2 PM to 3 PM" rows={4} style={{ ...fieldStyle, resize: 'vertical' }} />
          </label>
          <label>
            <span style={labelStyle}>Extra context</span>
            <textarea value={extraContext} onChange={e => setExtraContext(e.target.value)} placeholder="I slept late yesterday and want to go gym in the evening." rows={4} style={{ ...fieldStyle, resize: 'vertical' }} />
          </label>
        </div>

        <button type="submit" disabled={loading} style={{
          height: '52px',
          border: 'none',
          borderRadius: '16px',
          background: loading ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg, #8b5cf6, #ec4899, #06b6d4)',
          color: '#fff',
          cursor: loading ? 'wait' : 'pointer',
          fontSize: '15px',
          fontWeight: 900,
          boxShadow: loading ? 'none' : '0 18px 48px rgba(124,58,237,0.35)',
        }}>
          {loading ? 'Nex is planning your day...' : 'Generate My Day'}
        </button>
      </div>
    </form>
  )
}

