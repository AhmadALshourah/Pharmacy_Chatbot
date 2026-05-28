/**
 * M5: Centralise the role / name / initials extraction that was copy-pasted
 * across every page.  All pages now call this hook instead of repeating the
 * three-line pattern individually.
 */
import { useAuth } from '../contexts/AuthContext';

export function useCurrentPrincipal() {
  const { principal, admin, logout } = useAuth();

  const name      = principal?.username ?? 'User';
  const initials  = name.slice(0, 2).toUpperCase();
  // For admin pages that still read `admin` directly from context
  const role      = principal?.principalType === 'user'
    ? 'user'
    : (principal?.role ?? 'admin');
  const isMaster  = role === 'master_admin';
  const isUser    = role === 'user';

  return { name, initials, role, isMaster, isUser, principal, admin, logout };
}
