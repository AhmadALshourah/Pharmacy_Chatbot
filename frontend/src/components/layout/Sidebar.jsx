import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import { useTheme }  from '../../contexts/ThemeContext';
import { useLayout } from '../../contexts/LayoutContext';

function NavItem({ icon, label, count, active, onClick }) {
  return (
    <div
      className={`pc-nav-item${active ? ' active' : ''}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
      {count !== undefined && (
        <span className="pc-nav-count">{count}</span>
      )}
    </div>
  );
}

export default function Sidebar({ active, role = 'master_admin', name, initials }) {
  const navigate    = useNavigate();
  const { dark, toggle: toggleTheme } = useTheme();
  const { sidebarOpen, closeSidebar } = useLayout();

  const isMaster = role === 'master_admin';
  const isUser   = role === 'user';

  const roleLabel = isMaster ? 'Master Admin' : isUser ? 'User' : 'Admin';
  const badgeCls  = isMaster ? 'pc-badge-master' : isUser ? 'pc-badge-user' : 'pc-badge-admin';
  const avatarBg  = isMaster
    ? 'var(--pc-role-master)'
    : isUser
    ? 'var(--pc-role-user)'
    : 'var(--pc-role-admin)';

  const displayInitials = initials || (name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U');

  function navigate_(path) {
    closeSidebar();
    navigate(path);
  }

  return (
    <>
      {/* Mobile overlay — click to close */}
      {sidebarOpen && (
        <div className="pc-sidebar-overlay" onClick={closeSidebar} />
      )}

      <aside className={`pc-sidebar${sidebarOpen ? ' pc-sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="pc-brand">
          <div className="pc-brand-mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 4.5l-6 6a4.243 4.243 0 006 6l6-6a4.243 4.243 0 00-6-6z"/>
              <path d="M7.5 7.5l6 6"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="pc-brand-name">Aspira</div>
            <div className="pc-brand-tag">Pharmacy Assistant</div>
          </div>
          {/* Close button — mobile only */}
          <button
            className="pc-sidebar-close"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="pc-nav">
          {!isUser && <div className="pc-nav-section">Workspace</div>}
          {!isUser && (
            <NavItem icon="home" label="Overview" active={active === 'overview'} onClick={() => navigate_('/dashboard')} />
          )}
          <NavItem
            icon="chat"
            label={isUser ? 'Conversations' : 'Chat'}
            active={active === 'chat'}
            onClick={() => navigate_(isUser ? '/user/chat' : '/chat')}
          />
          {!isUser && (
            <NavItem icon="inbox" label="Conversations" active={active === 'conversations'} onClick={() => navigate_('/conversations')} />
          )}
          {!isUser && (
            <NavItem icon="doc"   label="Documents" active={active === 'docs'}      onClick={() => navigate_('/documents')} />
          )}
          {!isUser && (
            <NavItem icon="chart" label="Analytics" active={active === 'analytics'} onClick={() => navigate_('/analytics')} />
          )}

          {isMaster && <div className="pc-nav-section">Administration</div>}
          {isMaster && (
            <NavItem icon="users" label="Admins" active={active === 'admins'} onClick={() => navigate_('/admins')} />
          )}

          <div className="pc-nav-section">Account</div>
          <NavItem icon="settings" label="Settings" active={active === 'settings'} onClick={() => navigate_(isUser ? '/user/settings' : '/settings')} />
        </nav>

        {/* User row + theme toggle */}
        <div className="pc-sidebar-foot">
          <div className="pc-user-row">
            <div className="pc-avatar" style={{ background: avatarBg }}>
              {displayInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--pc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name || 'User'}
              </div>
              <div style={{ marginTop: 2 }}>
                <span className={`pc-badge ${badgeCls}`}>{roleLabel}</span>
              </div>
            </div>
            <button
              className="pc-btn pc-btn-ghost pc-btn-icon"
              onClick={toggleTheme}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 28, height: 28, color: 'var(--pc-text-3)' }}
            >
              <Icon name={dark ? 'sun' : 'moon'} size={15} stroke={1.6} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
