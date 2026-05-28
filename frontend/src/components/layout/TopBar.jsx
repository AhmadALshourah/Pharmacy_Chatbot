import Icon from '../ui/Icon';
import { useLayout } from '../../contexts/LayoutContext';

export default function TopBar({ title, sub, actions }) {
  const { openSidebar } = useLayout();

  return (
    <div className="pc-topbar">
      {/* Hamburger — mobile only */}
      <button
        className="pc-hamburger"
        onClick={openSidebar}
        aria-label="Open menu"
      >
        <Icon name="menu" size={18} />
      </button>

      <div>
        <div className="pc-page-title">{title}</div>
        {sub && <div className="pc-page-sub">{sub}</div>}
      </div>
      <div className="pc-topbar-spacer" />
      {actions && <div className="pc-topbar-actions">{actions}</div>}
    </div>
  );
}
