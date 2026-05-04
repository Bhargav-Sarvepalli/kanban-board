import { useState } from 'react'
import type { Profile, Workspace } from '../types'
import type { Project } from './Project/ProjectCreationWizard'
import LogoUpload from './LogoUpload'
import Avatar from './Avatar'

interface Props {
  // Auth
  userId: string
  profile: Profile | null
  // Workspace
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  onWorkspaceChange: (w: Workspace | null) => void
  onOpenWorkspacePanel: () => void
  // Project
  projects: Project[]
  currentProject: Project | null
  onProjectChange: (p: Project | null) => void
  onNewProject: () => void
  // Navigation
  currentView: string
  availableViews: readonly string[]
  onViewChange: (v: 'today' | 'board' | 'calendar' | 'flow' | 'dashboard' | 'pomodoro') => void
  // Actions
  onSettings: () => void
  onLogout: () => void
  onWorkspaceLogoUpdated: (url: string) => void
}

const NAV_ITEMS: { id: 'dashboard' | 'today' | 'board' | 'calendar' | 'flow' | 'pomodoro'; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (a) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    id: 'today',
    label: 'Today',
    icon: (a) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <path d="M5 1.5v2M11 1.5v2" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M1.5 6.5h13" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <circle cx="8" cy="10" r="1.5" fill={a ? '#7c3aed' : '#6b6b7b'}/>
      </svg>
    ),
  },
  {
    id: 'board',
    label: 'Board',
    icon: (a) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="4" height="14" rx="1.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <rect x="6" y="1" width="4" height="10" rx="1.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <rect x="11" y="1" width="4" height="7" rx="1.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    id: 'flow',
    label: 'Flow',
    icon: (a) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 8h3M12 8h3" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="8" cy="8" r="3" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <path d="M4 4l2.5 2.5M10 4l-2.5 2.5M4 12l2.5-2.5M10 12l-2.5-2.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (a) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <path d="M5 1.5v2M11 1.5v2M1.5 6.5h13" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4" strokeLinecap="round"/>
        <rect x="4" y="9" width="2" height="2" rx="0.5" fill={a ? '#7c3aed' : '#6b6b7b'}/>
        <rect x="7" y="9" width="2" height="2" rx="0.5" fill={a ? '#7c3aed' : '#6b6b7b'}/>
        <rect x="10" y="9" width="2" height="2" rx="0.5" fill={a ? '#7c3aed' : '#6b6b7b'}/>
      </svg>
    ),
  },
  {
    id: 'pomodoro',
    label: 'Timer',
    icon: (a) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8.5" r="5.5" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4"/>
        <path d="M8 5.5v3.2l2.1 1.2M6 1.5h4" stroke={a ? '#7c3aed' : '#6b6b7b'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

const S = {
  sidebar: (collapsed: boolean): React.CSSProperties => ({
    width: collapsed ? '56px' : '240px',
    minWidth: collapsed ? '56px' : '240px',
    height: '100vh',
    background: '#111118',
    borderRight: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease, min-width 0.2s ease',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
    zIndex: 50,
  }),
  section: (): React.CSSProperties => ({
    padding: '4px 8px',
  }),
  sectionLabel: (collapsed: boolean): React.CSSProperties => ({
    fontSize: '10px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    color: '#3d3d52',
    letterSpacing: '0.08em',
    padding: '8px 8px 4px',
    display: collapsed ? 'none' : 'block',
    textTransform: 'uppercase',
  }),
  navBtn: (active: boolean, collapsed: boolean): React.CSSProperties => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: collapsed ? '8px 0' : '7px 10px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    color: active ? '#a78bfa' : '#6b6b7b',
    fontSize: '13px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: active ? 500 : 400,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  divider: (): React.CSSProperties => ({
    height: '1px',
    background: '#1e1e2e',
    margin: '4px 8px',
  }),
}

export default function Sidebar({
  profile,
  workspaces, currentWorkspace, onWorkspaceChange, onOpenWorkspacePanel,
  projects, currentProject, onProjectChange, onNewProject,
  currentView, availableViews, onViewChange,
  onSettings, onLogout, onWorkspaceLogoUpdated,
}: Props) {
  const wsWithLogo = currentWorkspace
  const [wsLogoUrl,      setWsLogoUrl]      = useState(wsWithLogo?.logo_url ?? null)
  const [collapsed,      setCollapsed]      = useState(false)
  const [showWorkspaces, setShowWorkspaces] = useState(false)
  const [showProjects,   setShowProjects]   = useState(true)

  const visibleNav = NAV_ITEMS.filter(n => (availableViews as string[]).includes(n.id))

  const handleWorkspaceLogoUploaded = (url: string) => {
    setWsLogoUrl(url)
    onWorkspaceLogoUpdated(url)
  }

  return (
    <aside style={S.sidebar(collapsed)}>

      {/* ── TOP: Logo + collapse toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '16px 0' : '16px 12px', borderBottom: '1px solid #1e1e2e', flexShrink: 0 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'linear-gradient(135deg, #7c3aed, #db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>N</div>
            <span style={{ color: '#e2e2e8', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '-0.02em' }}>
              NEX<span style={{ color: '#7c3aed' }}>TASK</span>
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3d52', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6b6b7b' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3d3d52' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            {collapsed
              ? <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            }
          </svg>
        </button>
      </div>

      {/* ── WORKSPACE ── */}
      <div style={{ padding: '8px', borderBottom: '1px solid #1e1e2e', flexShrink: 0 }}>
        <button
          onClick={() => !collapsed && setShowWorkspaces(s => !s)}
          style={{ ...S.navBtn(false, collapsed), padding: collapsed ? '8px 0' : '6px 8px', justifyContent: collapsed ? 'center' : 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {/* Workspace logo */}
            {currentWorkspace ? (
              <LogoUpload
                currentUrl={wsLogoUrl}
                fallbackText={currentWorkspace.name}
                accentColor="#7c3aed"
                bucket="workspace-logos"
                entityId={currentWorkspace.id}
                table="workspaces"
                size={22}
                onUploaded={handleWorkspaceLogoUploaded}
                editable={true}
              />
            ) : (
              <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>👤</div>
            )}
            {!collapsed && (
              <span style={{ color: '#e2e2e8', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentWorkspace?.name ?? 'Personal'}
              </span>
            )}
          </div>
          {!collapsed && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showWorkspaces ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
              <path d="M2 4l4 4 4-4" stroke="#3d3d52" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Workspace dropdown */}
        {showWorkspaces && !collapsed && (
          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <button
              onClick={() => { onWorkspaceChange(null); setShowWorkspaces(false) }}
              style={{ ...S.navBtn(!currentWorkspace, false), padding: '5px 8px', fontSize: '12px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>👤</div>
              Personal
            </button>
            {workspaces.map(ws => (
              <button key={ws.id}
                onClick={() => { onWorkspaceChange(ws); setShowWorkspaces(false) }}
                style={{ ...S.navBtn(currentWorkspace?.id === ws.id, false), padding: '5px 8px', fontSize: '12px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'linear-gradient(135deg, #7c3aed, #db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
              </button>
            ))}
            <button
              onClick={() => { onOpenWorkspacePanel(); setShowWorkspaces(false) }}
              style={{ ...S.navBtn(false, false), padding: '5px 8px', fontSize: '12px', color: '#7c3aed' }}>
              + New workspace
            </button>
          </div>
        )}
      </div>

      {/* ── NAVIGATION ── */}
      <div style={S.section()}>
        {!collapsed && <p style={S.sectionLabel(false)}>Navigate</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {visibleNav.map(item => (
            <button key={item.id}
              onClick={() => {
                if (item.id === 'dashboard') { onViewChange('dashboard'); return }
                onViewChange(item.id)
              }}
              title={collapsed ? item.label : undefined}
              style={S.navBtn(currentView === item.id, collapsed)}
              onMouseEnter={e => { if (currentView !== item.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (currentView !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              {item.icon(currentView === item.id)}
              {!collapsed && item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PROJECTS (only when workspace active) ── */}
      {currentWorkspace && (
        <>
          <div style={S.divider()} />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!collapsed && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px' }}>
                <button
                  onClick={() => setShowProjects(s => !s)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3d52', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '5px', padding: 0, textTransform: 'uppercase' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: showProjects ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Projects
                </button>
                <button
                  onClick={onNewProject}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3d52', padding: '2px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7c3aed' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3d3d52' }}
                  title="New project">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}

            {showProjects && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
                {/* No project option */}
                <button
                  onClick={() => onProjectChange(null)}
                  title={collapsed ? 'No project' : undefined}
                  style={{ ...S.navBtn(!currentProject, collapsed), padding: collapsed ? '8px 0' : '5px 8px', fontSize: '12px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>—</div>
                  {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>No project</span>}
                </button>

                {projects.map(proj => (
                  <button key={proj.id}
                    onClick={() => onProjectChange(proj)}
                    title={collapsed ? proj.name : undefined}
                    style={{ ...S.navBtn(currentProject?.id === proj.id, collapsed), padding: collapsed ? '8px 0' : '5px 8px', fontSize: '12px' }}
                    onMouseEnter={e => { if (currentProject?.id !== proj.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (currentProject?.id !== proj.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    {/* Project logo / initials */}
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed33, #db277733)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#a78bfa' }}>
                      {(proj as Project & { logo_url?: string }).logo_url
                        ? <img src={(proj as Project & { logo_url?: string }).logo_url} alt={proj.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : proj.name.charAt(0).toUpperCase()
                      }
                    </div>
                    {!collapsed && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── BOTTOM: Settings + User ── */}
      <div style={{ borderTop: '1px solid #1e1e2e', padding: '8px', flexShrink: 0 }}>
        <button
          onClick={onSettings}
          title={collapsed ? 'Settings' : undefined}
          style={S.navBtn(false, collapsed)}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="#6b6b7b" strokeWidth="1.4"/>
            <path d="M8 1.5v1.25M8 13.25V14.5M14.5 8h-1.25M2.75 8H1.5M12.36 3.64l-.88.88M4.52 11.48l-.88.88M12.36 12.36l-.88-.88M4.52 4.52l-.88-.88" stroke="#6b6b7b" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {!collapsed && <span style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#6b6b7b' }}>Settings</span>}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: collapsed ? '8px 0' : '6px 8px', marginTop: '2px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <Avatar name={profile?.full_name ?? profile?.email ?? 'User'} avatarUrl={profile?.avatar_url} size={24} />
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#e2e2e8', fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name?.split(' ')[0] ?? profile?.email ?? 'User'}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3d52', padding: '2px', borderRadius: '4px', display: 'flex', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3d3d52' }}
              title="Sign out">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5M9 4l3 3-3 3M13 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
