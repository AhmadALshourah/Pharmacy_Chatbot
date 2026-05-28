import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }   from './contexts/AuthContext';
import { ThemeProvider }  from './contexts/ThemeContext';
import { ToastProvider }  from './contexts/ToastContext';
import { LayoutProvider } from './contexts/LayoutContext';
import ToastContainer     from './components/ui/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage      from './pages/LoginPage';
import DashboardPage  from './pages/DashboardPage';
import ChatPage       from './pages/ChatPage';
import DocumentsPage  from './pages/DocumentsPage';
import AnalyticsPage  from './pages/AnalyticsPage';
import AdminsPage     from './pages/AdminsPage';
import SettingsPage   from './pages/SettingsPage';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LayoutProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                {/* Admin-only routes */}
                <Route path="/dashboard" element={<ProtectedRoute requireAdmin><DashboardPage /></ProtectedRoute>} />
                <Route path="/chat"      element={<ProtectedRoute requireAdmin><ChatPage /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute requireAdmin><DocumentsPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute requireAdmin><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/admins"    element={<ProtectedRoute requireAdmin><AdminsPage /></ProtectedRoute>} />
                <Route path="/settings"  element={<ProtectedRoute requireAdmin><SettingsPage /></ProtectedRoute>} />

                {/* User route */}
                <Route path="/user/chat" element={<ProtectedRoute><ChatPage userRole /></ProtectedRoute>} />

                {/* Default */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              <ToastContainer />
            </AuthProvider>
          </BrowserRouter>
        </LayoutProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
