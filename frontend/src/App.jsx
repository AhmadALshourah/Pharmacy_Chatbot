import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }   from './contexts/AuthContext';
import { ThemeProvider }  from './contexts/ThemeContext';
import { ToastProvider }  from './contexts/ToastContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { useAuth }        from './contexts/AuthContext';
import ToastContainer     from './components/ui/Toast';
import ErrorBoundary      from './components/ErrorBoundary';
import ProtectedRoute     from './components/ProtectedRoute';
import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import DashboardPage  from './pages/DashboardPage';
import ChatPage       from './pages/ChatPage';
import DocumentsPage  from './pages/DocumentsPage';
import AnalyticsPage  from './pages/AnalyticsPage';
import AdminsPage          from './pages/AdminsPage';
import SettingsPage        from './pages/SettingsPage';
import ConversationsPage   from './pages/ConversationsPage';

/**
 * Replaces the old catch-all <Navigate to="/dashboard">.
 * - Not signed in  → /login
 * - Signed in as user  → /user/chat
 * - Signed in as admin → /dashboard
 * Prevents the double-redirect that previously hit users.
 */
function AuthRedirect() {
  const { principal, loading } = useAuth();
  if (loading) return null;
  if (!principal) return <Navigate to="/login" replace />;
  return <Navigate to={principal.principalType === 'user' ? '/user/chat' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
      <ToastProvider>
        <LayoutProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login"    element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Admin-only routes */}
                <Route path="/dashboard" element={<ProtectedRoute requireAdmin><DashboardPage /></ProtectedRoute>} />
                <Route path="/chat"          element={<ProtectedRoute requireAdmin><ChatPage /></ProtectedRoute>} />
                <Route path="/conversations" element={<ProtectedRoute requireAdmin><ConversationsPage /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute requireAdmin><DocumentsPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute requireAdmin><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/admins"    element={<ProtectedRoute requireMaster><AdminsPage /></ProtectedRoute>} />
                <Route path="/settings"  element={<ProtectedRoute requireAdmin><SettingsPage /></ProtectedRoute>} />

                {/* User routes — any authenticated principal */}
                <Route path="/user/chat"     element={<ProtectedRoute><ChatPage userRole /></ProtectedRoute>} />
                <Route path="/user/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

                {/* Smart catch-all — redirects based on auth state + role */}
                <Route path="*" element={<AuthRedirect />} />
              </Routes>
              <ToastContainer />
            </AuthProvider>
          </BrowserRouter>
        </LayoutProvider>
      </ToastProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
