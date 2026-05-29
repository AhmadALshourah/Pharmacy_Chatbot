import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Route guard with three levels:
 *   - default        → any authenticated principal (admin OR user)
 *   - requireAdmin   → admin tokens only (blocks user tokens)
 *   - requireMaster  → master_admin role only (blocks admin + user tokens)
 *
 * Wrong-role navigations land on the correct home for that principal
 * instead of dumping them to a 403-from-backend screen.
 */
export default function ProtectedRoute({ children, requireAdmin = false, requireMaster = false }) {
  const { principal, loading } = useAuth();

  if (loading) {
    return (
      <div className="pc-app" style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--pc-text-3)' }}>Loading…</div>
      </div>
    );
  }

  if (!principal) {
    return <Navigate to="/login" replace />;
  }

  // Master-only routes (e.g. /admins) — both regular admins and users get pushed to their home
  if (requireMaster && principal.role !== 'master_admin') {
    const home = principal.principalType === 'user' ? '/user/chat' : '/dashboard';
    return <Navigate to={home} replace />;
  }

  // Admin-only routes block user tokens
  if ((requireAdmin || requireMaster) && principal.principalType !== 'admin') {
    return <Navigate to="/user/chat" replace />;
  }

  return children;
}
