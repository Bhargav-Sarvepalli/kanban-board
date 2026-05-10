import { useState, type CSSProperties } from 'react'

interface Props {
  name: string
  logoUrl?: string | null
  icon?: string | null
  color?: string | null
  size?: number
  radius?: number
  danger?: boolean
  style?: CSSProperties
}

export default function WorkspaceAvatar({
  name,
  logoUrl,
  icon,
  color = '#8b5cf6',
  size = 32,
  radius,
  danger = false,
  style,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false)
  const accent = danger ? '#ef4444' : color ?? '#8b5cf6'
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'W'

  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius ?? Math.max(6, Math.round(size * 0.28)),
    overflow: 'hidden',
    flexShrink: 0,
    background: danger ? 'rgba(239,68,68,0.16)' : `${accent}22`,
    border: `1px solid ${danger ? 'rgba(239,68,68,0.45)' : `${accent}55`}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: danger ? '#f87171' : accent,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 800,
    fontSize: icon ? Math.round(size * 0.46) : Math.round(size * 0.34),
    lineHeight: 1,
    boxSizing: 'border-box',
    ...style,
  }

  if (logoUrl && !imageFailed) {
    return (
      <div style={base}>
        <img
          src={logoUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImageFailed(true)}
        />
      </div>
    )
  }

  return <div style={base}>{icon || initials}</div>
}
