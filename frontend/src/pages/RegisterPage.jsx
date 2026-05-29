import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/ui/Icon';

// ── Password strength meter ───────────────────────────────────────────────────
function PasswordStrength({ value }) {
  const checks = [
    value.length >= 8,
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = [
    '',
    'var(--pc-danger)',
    'var(--pc-warn)',
    'var(--pc-primary)',
    'var(--pc-success)',
  ];
  if (!value) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < score ? colors[score] : 'var(--pc-surface-3)',
              transition: 'background .2s',
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: colors[score], marginTop: 3 }}>
        {labels[score]} · {value.length} chars
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { principal, loading, register, registerUser } = useAuth();
  const navigate = useNavigate();

  const [role,    setRole]    = useState('user');
  const [form,    setForm]    = useState({ username: '', email: '', password: '', confirm: '' });
  const [showPw,  setShowPw]  = useState(false);
  const [remember, setRemember] = useState(true);
  const [error,   setError]   = useState('');
  const [busy,    setBusy]    = useState(false);

  // While restoring session — render nothing rather than the register form
  if (loading) {
    return (
      <div className="pc-app" style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--pc-text-3)' }}>Loading…</div>
      </div>
    );
  }

  // Already signed in → go home
  if (principal) {
    return <Navigate to={principal.principalType === 'user' ? '/user/chat' : '/dashboard'} replace />;
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { username, email, password, confirm } = form;
    if (!username.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (role === 'user') {
        await registerUser(username.trim(), email.trim(), password, remember);
        navigate('/user/chat', { replace: true });
      } else {
        await register(username.trim(), email.trim(), password, remember);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      <div className="pc-login-shell">

        {/* ── Left brand panel ── */}
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
              Your pharmacy knowledge base, ready in seconds.
            </div>
            <div style={{ fontSize: 14.5, opacity: 0.78, lineHeight: 1.6, maxWidth: 380 }}>
              Create your account and start getting verified answers from your pharmacy's PDF knowledge base — in Arabic or English.
            </div>

            <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Free to join',       'Create your account in under a minute'],
                ['Instant access',     'Chat with the pharmacy assistant right after sign-up'],
                ['Secure by default',  'Passwords hashed with bcrypt · JWT sessions'],
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

        {/* ── Right form ── */}
        <div className="pc-login-form-wrap">
          <div className="pc-login-form">
            <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--pc-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 550 }}>
              Get started
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 18 }}>
              Create your account
            </div>

            {/* Role toggle */}
            <div className="pc-role-toggle" style={{ marginBottom: 22 }}>
              <button type="button" className={role === 'user' ? 'active' : ''} onClick={() => { setRole('user'); setError(''); }}>
                <Icon name="users" size={13} /> User
              </button>
              <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => { setRole('admin'); setError(''); }}>
                <Icon name="key" size={13} /> Admin
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Username */}
              <div className="pc-field">
                <label className="pc-label">Username</label>
                <input
                  className="pc-input"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  placeholder={role === 'admin' ? 'e.g. dr_ahmad' : 'e.g. Ahmad'}
                  disabled={busy}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Email */}
              <div className="pc-field">
                <label className="pc-label">Email</label>
                <input
                  className="pc-input"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={busy}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Password */}
              <div className="pc-field">
                <label className="pc-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="pc-input"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    disabled={busy}
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
                <PasswordStrength value={form.password} />
              </div>

              {/* Confirm password */}
              <div className="pc-field">
                <label className="pc-label">Confirm password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="pc-input"
                    name="confirm"
                    type={showPw ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    disabled={busy}
                    style={{
                      width: '100%',
                      borderColor: form.confirm && form.confirm !== form.password
                        ? 'var(--pc-danger)' : undefined,
                    }}
                  />
                  {form.confirm && form.confirm === form.password && (
                    <div style={{ position: 'absolute', right: 10, top: 10, color: 'var(--pc-success)' }}>
                      <Icon name="check" size={16} stroke={2.5} />
                    </div>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--pc-danger-soft)', border: '1px solid var(--pc-danger-border)', borderRadius: 8, fontSize: 13, color: 'var(--pc-danger)' }}>
                  <Icon name="alert" size={14} />
                  {error}
                </div>
              )}

              {/* Admin note */}
              {role === 'admin' && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--pc-warn-soft)', border: '1px solid var(--pc-warn-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--pc-warn-text)' }}>
                  <Icon name="alert" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Admin accounts are created with standard access. A Master Admin can adjust permissions.</span>
                </div>
              )}

              {/* Keep me signed in */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--pc-text-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ accentColor: 'var(--pc-primary)', cursor: 'pointer' }}
                />
                Keep me signed in for 8 hours
              </label>

              {/* Submit */}
              <button
                type="submit"
                className="pc-btn pc-btn-primary"
                disabled={busy}
                style={{ height: 42, justifyContent: 'center', marginTop: 4, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Creating account…' : 'Create account'}
                {!busy && <Icon name="arrowRight" size={14} stroke={2} />}
              </button>
            </form>

            {/* Sign-in link */}
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--pc-text-3)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--pc-primary)', fontWeight: 550, textDecoration: 'none' }}>
                Sign in
              </Link>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: 'var(--pc-surface-2)', border: '1px solid var(--pc-divider)', borderRadius: 10, fontSize: 12, color: 'var(--pc-text-2)', display: 'flex', gap: 10 }}>
              <Icon name="alert" size={14} color="var(--pc-warn)" />
              <div>Aspira does not provide diagnoses. Always consult a licensed pharmacist.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
