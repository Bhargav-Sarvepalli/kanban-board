import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

interface Props {
  currentUrl: string | null
  fallbackText: string          // initials or emoji fallback
  fallbackIcon?: string | null  // optional workspace icon fallback
  accentColor?: string          // tint color for the fallback
  bucket: 'project-logos' | 'workspace-logos'
  entityId: string              // project.id or workspace.id
  table: 'projects' | 'workspaces'
  size?: number                 // px, default 48
  onUploaded: (url: string) => void
  editable?: boolean
}

export default function LogoUpload({
  currentUrl, fallbackText, fallbackIcon = null, accentColor = '#7c3aed',
  bucket, entityId, table, size = 48,
  onUploaded, editable = true,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [hovered,   setHovered]   = useState(false)
  const [error,     setError]     = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setImageFailed(false), [currentUrl])

  const handleFile = async (file: File) => {
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) { setError('Use JPG, PNG, WebP, or GIF'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Max 5MB'); return }

    setUploading(true); setError('')
    try {
      const ext  = file.name.split('.').pop() ?? 'png'
      const path = `${entityId}/logo.${ext}`

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) throw upErr

      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      const publicUrl = `${data.publicUrl}?t=${Date.now()}` // cache bust

      const { error: dbErr } = await supabase.from(table).update({ logo_url: publicUrl }).eq('id', entityId)
      if (dbErr) throw dbErr
      setImageFailed(false)
      onUploaded(publicUrl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const initials = fallbackText
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const radius = size >= 40 ? '10px' : '6px'

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onClick={() => editable && !uploading && inputRef.current?.click()}
        onMouseEnter={() => editable && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: `${size}px`, height: `${size}px`,
          borderRadius: radius,
          overflow: 'hidden', flexShrink: 0,
          cursor: editable ? 'pointer' : 'default',
          position: 'relative',
          border: `1.5px solid ${hovered && editable ? accentColor + '80' : 'rgba(255,255,255,0.08)'}`,
          transition: 'border-color 0.15s',
        }}>

        {/* Logo or fallback */}
        {currentUrl && !imageFailed ? (
          <img
            src={currentUrl}
            alt={fallbackText}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: `${Math.round(size * (fallbackIcon ? 0.42 : 0.35))}px`,
            fontWeight: 600, color: accentColor,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '-0.02em',
          }}>
            {fallbackIcon || initials}
          </div>
        )}

        {/* Upload overlay on hover */}
        {editable && hovered && !uploading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 5l3-3 3 3M2 12h12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        {/* Spinner */}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '16px', height: '16px',
              border: '2px solid rgba(255,255,255,0.2)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'luSpin 0.7s linear infinite',
            }} />
          </div>
        )}
      </div>

      {error && (
        <p style={{
          position: 'absolute', top: '100%', left: 0,
          marginTop: '4px', fontSize: '10px',
          color: '#ef4444', whiteSpace: 'nowrap',
          fontFamily: 'Inter, sans-serif',
        }}>{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <style>{`@keyframes luSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
