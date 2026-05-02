import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

interface Milestone { id: string; name: string; position: number }
interface Feature {
  id: string; name: string; color: string; milestone_id: string | null
}

interface Props {
  feature: Feature
  projectId: string
  onSaved: () => void
  onDeleted: () => void
  onClose: () => void
}

const PHASE_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#db2777', '#0891b2', '#65a30d',
  '#8b5cf6', '#16a34a', '#ea580c', '#0284c7',
]

export default function EditFeatureModal({ feature, projectId, onSaved, onDeleted, onClose }: Props) {
  const [name,        setName]        = useState(feature.name)
  const [color,       setColor]       = useState(feature.color)
  const [milestoneId, setMilestoneId] = useState(feature.milestone_id ?? '')
  const [milestones,  setMilestones]  = useState<Milestone[]>([])
  const [saving,      setSaving]      = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    supabase.from('project_milestones')
      .select('id,name,position')
      .eq('project_id', projectId)
      .order('position')
      .then(({ data }) => { if (data) setMilestones(data) })
  }, [projectId])

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('project_features').update({
      name: name.trim(),
      color,
      milestone_id: milestoneId || null,
    }).eq('id', feature.id)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
    onClose()
  }

  const handleDelete = async () => {
    setSaving(true)
    await supabase.from('project_features').delete().eq('id', feature.id)
    onDeleted()
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:11000, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#111118', border:'1px solid #252535', borderRadius:'12px', padding:'24px', width:'380px', boxShadow:'0 24px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
          <h3 style={{ color:'#e8e8f0', fontSize:'15px', fontFamily:'Inter, sans-serif', fontWeight:500, margin:0 }}>Edit Feature</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#5a5a72', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>

        <label style={labelStyle}>Feature name</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          style={inputStyle} />

        <label style={{ ...labelStyle, marginTop:'4px' }}>Color</label>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'14px' }}>
          {PHASE_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)}
              style={{ width:'24px', height:'24px', borderRadius:'50%', background:c, cursor:'pointer', border:`2.5px solid ${color === c ? '#e8e8f0' : 'transparent'}`, boxSizing:'border-box', transition:'border-color 0.1s' }} />
          ))}
        </div>

        <label style={labelStyle}>Phase <span style={{ color:'#5a5a72', fontWeight:400 }}>(optional)</span></label>
        <select value={milestoneId} onChange={e => setMilestoneId(e.target.value)}
          style={{ ...inputStyle, cursor:'pointer', marginBottom:'16px' }}>
          <option value="">No phase</option>
          {milestones.map(m => <option key={m.id} value={m.id} style={{ background:'#111118' }}>{m.name}</option>)}
        </select>

        {error && <p style={{ color:'#dc2626', fontSize:'12px', fontFamily:'Inter, sans-serif', marginBottom:'12px' }}>{error}</p>}

        {confirmDel ? (
          <div style={{ padding:'10px 12px', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'7px', marginBottom:'12px' }}>
            <p style={{ color:'#f87171', fontSize:'12px', fontFamily:'Inter, sans-serif', margin:'0 0 8px' }}>Delete "{feature.name}"? Tasks will lose their feature assignment.</p>
            <div style={{ display:'flex', gap:'7px' }}>
              <button onClick={handleDelete} disabled={saving} style={{ padding:'5px 14px', background:'#dc2626', border:'none', borderRadius:'5px', color:'white', fontSize:'12px', fontFamily:'Inter, sans-serif', fontWeight:500, cursor:'pointer' }}>Delete</button>
              <button onClick={() => setConfirmDel(false)} style={{ padding:'5px 14px', background:'transparent', border:'1px solid #252535', borderRadius:'5px', color:'#9090a8', fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : null}

        <div style={{ display:'flex', gap:'8px', justifyContent:'space-between' }}>
          <button onClick={() => setConfirmDel(true)}
            style={{ padding:'7px 14px', background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:'7px', color:'#f87171', cursor:'pointer', fontSize:'12px', fontFamily:'Inter, sans-serif' }}>
            Delete
          </button>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !name.trim()} style={primaryBtnStyle(!!name.trim() && !saving)}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display:'block', color:'#9090a8', fontSize:'11px', fontFamily:'Inter, sans-serif', fontWeight:600, marginBottom:'6px', letterSpacing:'0.04em', textTransform:'uppercase' }
const inputStyle: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.04)', border:'1px solid #252535', borderRadius:'7px', padding:'8px 12px', color:'#e8e8f0', fontSize:'13px', fontFamily:'Inter, sans-serif', outline:'none', marginBottom:'14px' }
const secondaryBtnStyle: React.CSSProperties = { padding:'7px 14px', background:'transparent', border:'1px solid #252535', borderRadius:'7px', color:'#9090a8', cursor:'pointer', fontSize:'13px', fontFamily:'Inter, sans-serif', fontWeight:500 }
const primaryBtnStyle = (enabled: boolean): React.CSSProperties => ({ padding:'7px 16px', background: enabled ? '#7c3aed' : 'rgba(124,58,237,0.3)', border:'none', borderRadius:'7px', color: enabled ? 'white' : 'rgba(255,255,255,0.3)', cursor: enabled ? 'pointer' : 'not-allowed', fontSize:'13px', fontFamily:'Inter, sans-serif', fontWeight:500 })