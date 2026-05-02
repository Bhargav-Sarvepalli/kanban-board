import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

interface Milestone { id: string; name: string; position: number }

interface Props {
  projectId: string
  onAdded: () => void
  onClose: () => void
}

const FEATURE_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#db2777', '#0891b2', '#65a30d',
]

export default function AddFeatureModal({ projectId, onAdded, onClose }: Props) {
  const [name,        setName]        = useState('')
  const [color,       setColor]       = useState(FEATURE_COLORS[0])
  const [milestoneId, setMilestoneId] = useState('')
  const [milestones,  setMilestones]  = useState<Milestone[]>([])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    supabase.from('project_milestones')
      .select('id,name,position')
      .eq('project_id', projectId)
      .order('position')
      .then(({ data }) => { if (data) setMilestones(data) })
  }, [projectId])

  const handleSave = async () => {
    if (!name.trim()) { setError('Feature name is required'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('project_features').insert({
      project_id: projectId,
      name: name.trim(),
      color,
      milestone_id: milestoneId || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    onAdded()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '24px', width: '380px', boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: '#e2e2e8', fontSize: '15px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>Add Feature</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#3d3d52', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        {/* Name */}
        <label style={labelStyle}>Feature name *</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Authentication, Dashboard UI"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          style={inputStyle}
        />

        {/* Color */}
        <label style={{ ...labelStyle, marginTop: '14px' }}>Color</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {FEATURE_COLORS.map(c => (
            <div key={c}
              onClick={() => setColor(c)}
              style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${color === c ? '#e2e2e8' : 'transparent'}`, boxSizing: 'border-box', transition: 'border-color 0.1s' }}
            />
          ))}
        </div>

        {/* Milestone */}
        {milestones.length > 0 && (
          <>
            <label style={labelStyle}>Link to phase <span style={{ color: '#3d3d52' }}>(optional)</span></label>
            <select value={milestoneId} onChange={e => setMilestoneId(e.target.value)} style={{ ...inputStyle, marginBottom: '14px', cursor: 'pointer' }}>
              <option value="">No phase</option>
              {milestones.map(m => <option key={m.id} value={m.id} style={{ background: '#111118' }}>{m.name}</option>)}
            </select>
          </>
        )}

        {error && <p style={{ color: '#dc2626', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} style={primaryBtnStyle(!!name.trim() && !saving)}>
            {saving ? 'Adding…' : 'Add feature'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', color: '#6b6b7b', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e2e', borderRadius: '7px', padding: '8px 12px', color: '#e2e2e8', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: '14px' }
const secondaryBtnStyle: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '7px', color: '#6b6b7b', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }
const primaryBtnStyle = (enabled: boolean): React.CSSProperties => ({ flex: 1, padding: '8px 16px', background: enabled ? '#7c3aed' : 'rgba(124,58,237,0.3)', border: 'none', borderRadius: '7px', color: enabled ? 'white' : 'rgba(255,255,255,0.3)', cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 })