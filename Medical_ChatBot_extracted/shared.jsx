/* Shared components — icons, sidebar, topbar, badges */

const Icon = ({ name, size = 16, stroke = 1.6, color = 'currentColor' }) => {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    pill: <><path d="M10.5 4.5l-6 6a4.243 4.243 0 006 6l6-6a4.243 4.243 0 00-6-6z"/><path d="M7.5 7.5l6 6"/></>,
    chat: <><path d="M21 12a8 8 0 11-15.06 3.94L4 21l5.06-1.94A8 8 0 0121 12z"/></>,
    doc: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/></>,
    users: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.8-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M21 19c0-2.5-2-4.5-4.5-4.5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 014 17.96l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2.91a2 2 0 110-4H3a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82L4.12 7.2A2 2 0 116.95 4.37l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06A2 2 0 1119.71 7.04l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    send: <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></>,
    upload: <><path d="M4 17v3a1 1 0 001 1h14a1 1 0 001-1v-3"/><path d="M16 7l-4-4-4 4"/><path d="M12 3v13"/></>,
    download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1.6 14a2 2 0 01-2 1.8H8.6a2 2 0 01-2-1.8L5 6"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4z"/></>,
    check: <><path d="M5 12l5 5L20 7"/></>,
    x: <><path d="M18 6L6 18M6 6l12 12"/></>,
    chevronDown: <><path d="M6 9l6 6 6-6"/></>,
    chevronRight: <><path d="M9 6l6 6-6 6"/></>,
    chevronLeft: <><path d="M15 6l-6 6 6 6"/></>,
    bell: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></>,
    logOut: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>,
    moreH: <><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></>,
    home: <><path d="M3 12L12 3l9 9"/><path d="M5 10v10h14V10"/></>,
    alert: <><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z"/></>,
    paperclip: <><path d="M21.44 11.05l-9.19 9.19a6 6 0 11-8.49-8.49l8.57-8.57A4 4 0 1118 8.84l-8.59 8.57a2 2 0 11-2.83-2.83l8.49-8.48"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="M17.94 17.94A10.06 10.06 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24"/><path d="M1 1l22 22"/></>,
    activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
    cache: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/></>,
    siren: <><path d="M7 18v-6a5 5 0 0110 0v6"/><path d="M5 21h14"/><path d="M21 12h1M2 12h1M5.5 5.5l.7.7M18.5 5.5l-.7.7M12 2v1"/></>,
    file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></>,
    key: <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,
    sparkle: <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></>,
    arrowRight: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    refresh: <><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></>,
  };
  return <svg {...common} style={{display:'block',flexShrink:0}}>{paths[name]}</svg>;
};

const Logo = ({ size = 32 }) => (
  <div className="pc-brand-mark" style={{ width: size, height: size, borderRadius: size * 0.28 }}>
    <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 4.5l-6 6a4.243 4.243 0 006 6l6-6a4.243 4.243 0 00-6-6z"/>
      <path d="M7.5 7.5l6 6"/>
    </svg>
  </div>
);

const Brand = () => (
  <div className="pc-brand">
    <Logo />
    <div>
      <div className="pc-brand-name">Aspira</div>
      <div className="pc-brand-tag">Pharmacy Assistant</div>
    </div>
  </div>
);

const NavItem = ({ icon, label, count, active, danger }) => (
  <div className={`pc-nav-item${active ? ' active' : ''}`}>
    <Icon name={icon} size={16} />
    <span>{label}</span>
    {count !== undefined && <span className="pc-nav-count">{count}</span>}
  </div>
);

const Sidebar = ({ active, role = 'master_admin', name = 'Layla H.', initials = 'LH' }) => {
  const isMaster = role === 'master_admin';
  const isUser = role === 'user';
  const roleLabel = isMaster ? 'Master Admin' : (isUser ? 'User' : 'Admin');
  const badgeCls = isMaster ? 'pc-badge-master' : (isUser ? 'pc-badge-user' : 'pc-badge-admin');

  return (
    <aside className="pc-sidebar">
      <Brand />
      <nav className="pc-nav">
        {!isUser && <div className="pc-nav-section">Workspace</div>}
        {!isUser && <NavItem icon="home" label="Overview" active={active === 'overview'} />}
        <NavItem icon="chat" label={isUser ? 'Conversations' : 'Chat'} count={isUser ? 4 : 12} active={active === 'chat'} />
        {!isUser && <NavItem icon="doc" label="Documents" count={3} active={active === 'docs'} />}
        {!isUser && <NavItem icon="chart" label="Analytics" active={active === 'analytics'} />}

        {isMaster && <div className="pc-nav-section">Administration</div>}
        {isMaster && <NavItem icon="users" label="Admins" count={4} active={active === 'admins'} />}

        <div className="pc-nav-section">Account</div>
        <NavItem icon="settings" label="Settings" active={active === 'settings'} />
      </nav>

      <div className="pc-sidebar-foot">
        <div className="pc-user-row">
          <div className={`pc-avatar${isUser ? ' user-bg' : ''}`}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--pc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ marginTop: 2 }}><span className={`pc-badge ${badgeCls}`}>{roleLabel}</span></div>
          </div>
          <Icon name="moreH" size={16} color="var(--pc-text-3)" />
        </div>
      </div>
    </aside>
  );
};

const TopBar = ({ title, sub, actions }) => (
  <div className="pc-topbar">
    <div>
      <div className="pc-page-title">{title}</div>
      {sub && <div className="pc-page-sub">{sub}</div>}
    </div>
    <div className="pc-topbar-spacer"/>
    <div className="pc-topbar-actions">{actions}</div>
  </div>
);

const Card = ({ title, sub, action, children, padded = true, style }) => (
  <div className="pc-card" style={style}>
    {(title || action) && (
      <div className="pc-card-head">
        <div>
          {title && <div className="pc-card-title">{title}</div>}
          {sub && <div className="pc-card-sub" style={{ marginTop: 2 }}>{sub}</div>}
        </div>
        {action}
      </div>
    )}
    <div className={padded ? 'pc-card-body' : ''} style={padded ? null : { padding: 0 }}>{children}</div>
  </div>
);

const StatusDot = ({ tone = 'success' }) => {
  const color = tone === 'success' ? 'var(--pc-success)' : tone === 'warn' ? 'var(--pc-warn)' : 'var(--pc-danger)';
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }}/>;
};

const Frame = ({ children, label }) => (
  <div className="pc-app" data-screen-label={label}>
    {children}
  </div>
);

Object.assign(window, { Icon, Logo, Brand, NavItem, Sidebar, TopBar, Card, StatusDot, Frame });
