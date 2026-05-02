interface Props {
  value: boolean
  onChange: (v: boolean) => void
  projectId?: string | null
  disabled?: boolean
}

export default function ShowOnFlowToggle({ value, onChange, projectId, disabled = false }: Props) {
  // Only show if task belongs to a project
  if (!projectId) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px',
      background: value ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${value ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '10px',
      transition: 'all 0.2s',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }} onClick={() => { if (!disabled) onChange(!value) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>⚡</span>
        <div>
          <p style={{ color: value ? '#a78bfa' : 'rgba(255,255,255,0.6)', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0 }}>
            Show on Flow
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '2px 0 0' }}>
            {value ? 'Visible on the Flow execution graph' : 'Hidden from Flow graph'}
          </p>
        </div>
      </div>

      {/* Toggle pill */}
      <div style={{
        width: '40px', height: '22px', borderRadius: '11px',
        background: value ? '#8b5cf6' : 'rgba(255,255,255,0.15)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        boxShadow: value ? '0 0 10px rgba(139,92,246,0.5)' : 'none',
      }}>
        <div style={{
          position: 'absolute', top: '3px',
          left: value ? '21px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: 'white', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
    </div>
  )
}
