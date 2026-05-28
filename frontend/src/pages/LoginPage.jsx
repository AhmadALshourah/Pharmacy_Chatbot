import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/ui/Icon';

export default function LoginPage() {
  const { login, loginUser } = useAuth();
  const navigate             = useNavigate();

  const [role,    setRole]    = useState('admin');
  const [form,    setForm]    = useState({ username: '', password: '' });
  const [showPw,  setShowPw]  = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter username and password.');
      return;
    }
    setLoading(true);
    try {
      if (role === 'user') {
        await loginUser(form.username.trim(), form.password);
        navigate('/user/chat', { replace: true });
      } else {
        await login(form.username.trim(), form.password);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      <div className="pc-login-shell">

        {/* Left brand panel */}
        <div className="pc-login-aside">
          <div className="pc-login-aside-pattern" />

          {/* Logo */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'grid', placeItems: 'center' }}>
              <Icon name="pill" size={18} color="white" stroke={2} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>Aspira</div>
              <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Pharmacy Assistant</div>
            </div>
          </div>

          {/* Hero text */}
          <div style={{ position: 'relative', maxWidth: 420 }}>
            <div style={{ fontSize: 38, lineHeight: 1.12, fontWeight: 500, letterSpacing: '-0.025em', marginBottom: 18 }}>
              Verified medication answers, in your language.
            </div>
            <div style={{ fontSize: 14.5, opacity: 0.78, lineHeight: 1.6, maxWidth: 380 }}>
              Aspira retrieves answers from your pharmacy's PDF knowledge base — no hallucinations, every reply cites its sources, in Arabic or English.
            </div>

            <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Retrieval-grounded', 'Top-4 chunks from your indexed PDFs cited on every reply'],
                ['Emergency-aware', 'Critical keyword detection in EN + AR with hotline fallback'],
                ['Bilingual', 'Replies in the language you write — Arabic or English'],
              ].map(([t, d]) => (
                <div key={t} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.14)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Icon name="check" size={12} color="white" stroke={2.4} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 1 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', fontSize: 11.5, opacity: 0.5 }}>
            © 2026 Aspira Health · gpt-4o-mini · FAISS retrieval
          </div>
        </div>

        {/* Right form */}
        <div className="pc-login-form-wrap">
          <div className="pc-login-form">
            <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--pc-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 550 }}>Sign in</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 18 }}>Welcome back</div>

            {/* Role toggle */}
            <div className="pc-role-toggle" style={{ marginBottom: 22 }}>
              <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>
                <Icon name="key" size={13} /> Admin
              </button>
              <button type="button" className={role === 'user' ? 'active' : ''} onClick={() => setRole('user')}>
                <Icon name="users" size={13} /> User
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="pc-field">
                <label className="pc-label">Username</label>
                <input
                  className="pc-input"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  placeholder={role === 'admin' ? 'e.g. master_admin' : 'e.g. Ahmad'}
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="pc-field">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="pc-label">Password</label>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="pc-input"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    disabled={loading}
                    style={{ width: '100%', paddingRight: 38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pc-text-3)', padding: 0 }}
                  >
                    <Icon name={showPw ? 'eye' : 'eyeOff'} size={16} />
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--pc-danger-soft)', border: '1px solid var(--pc-danger-border)', borderRadius: 8, fontSize: 13, color: 'var(--pc-danger)' }}>
                  <Icon name="alert" size={14} />
                  {error}
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--pc-text-2)', marginTop: 2 }}>
                <input type="checkbox" defaultChecked style={{ accentColor: 'var(--pc-primary)' }} />
                Keep me signed in for 8 hours
              </label>

              <button
                type="submit"
                className="pc-btn pc-btn-primary"
                disabled={loading}
                style={{ height: 42, justifyContent: 'center', marginTop: 8, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
                {!loading && <Icon name="arrowRight" size={14} stroke={2} />}
              </button>
            </form>

            <div style={{ marginTop: 24, padding: 12, background: 'var(--pc-surface-2)', border: '1px solid var(--pc-divider)', borderRadius: 10, fontSize: 12, color: 'var(--pc-text-2)', display: 'flex', gap: 10 }}>
              <Icon name="alert" size={14} color="var(--pc-warn)" />
              <div>Aspira does not provide diagnoses. Replies always recommend consulting a licensed pharmacist.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
