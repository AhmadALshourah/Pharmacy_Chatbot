import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
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

  // Admin-only routes (dashboard, documents, analytics, admins) block user tokens
  if (requireAdmin && principal.principalType !== 'admin') {
    return <Navigate to="/user/chat" replace />;
  }

  return children;
}
