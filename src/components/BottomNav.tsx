import { useLocation, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const tabs = [
    {
      path: '/',
      label: 'Cellar',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#C9A84C' : '#8A9AAB'} strokeWidth="1.6" strokeLinecap="round">
          <rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/>
          <rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>
        </svg>
      )
    },
    {
      path: '/add',
      label: 'Add',
      center: true,
      icon: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D1B2A" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      )
    },
    {
      path: '/sommelier',
      label: 'Sommelier',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#C9A84C' : '#8A9AAB'} strokeWidth="1.6" strokeLinecap="round">
          <path d="M8 6h8M8 12h5"/><path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
          <circle cx="16.5" cy="16.5" r="2.5"/><line x1="18.5" y1="18.5" x2="20" y2="20"/>
        </svg>
      )
    },
  ]

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: '#152232', borderTop: '1px solid rgba(201,168,76,0.2)',
      display: 'flex', padding: '8px 0 12px', zIndex: 100,
    }}>
      {tabs.map(tab => {
        const active = location.pathname === tab.path
        return (
          <div key={tab.path} onClick={() => navigate(tab.path)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, cursor: 'pointer', position: 'relative', top: tab.center ? -10 : 0,
          }}>
            {tab.center ? (
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: '#C9A84C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(201,168,76,0.45)', transition: 'transform 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = ''}
              >
                {tab.icon(false)}
              </div>
            ) : (
              <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {tab.icon(active)}
              </div>
            )}
            <span style={{
              fontSize: 10, color: active ? '#C9A84C' : '#8A9AAB',
              fontWeight: 500, letterSpacing: 0.3,
              marginTop: tab.center ? 4 : 0,
            }}>
              {tab.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}