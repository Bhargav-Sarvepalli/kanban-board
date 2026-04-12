interface Props {
  name: string
  avatarUrl?: string | null
  size?: number
  showTooltip?: boolean
}

export default function Avatar({ name, avatarUrl, size = 32, showTooltip = false }: Props) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const colors = [
    ['#8b5cf6', '#ec4899'],
    ['#06b6d4', '#8b5cf6'],
    ['#10b981', '#06b6d4'],
    ['#f59e0b', '#ef4444'],
    ['#ec4899', '#f59e0b'],
  ]

  const colorIndex = name.charCodeAt(0) % colors.length
  const [from, to] = colors[colorIndex]

  return (
    <div
      title={showTooltip ? name : undefined}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        border: '2px solid rgba(255,255,255,0.1)',
        position: 'relative',
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => {
            // fallback to initials if image fails
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: `linear-gradient(135deg, ${from}, ${to})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.35, fontWeight: 700,
          fontFamily: 'Space Grotesk', color: 'white',
        }}>
          {initials}
        </div>
      )}
    </div>
  )
}