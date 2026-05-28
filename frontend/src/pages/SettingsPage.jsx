import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import Card from '../components/ui/Card';
import Icon from '../components/ui/Icon';
import { changePassword } from '../services/api';

function PasswordStrength({ value }) {
  const checks = [
    value.length >= 8,
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];
  const score = checks.filter(Boolean).length;
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][score] || '';
  const color = ['', 'var(--pc-danger)', 'var(--pc-warn)', 'var(--pc-primary)', 'var(--pc-success)'][score];

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < score ? color : 'var(--pc-surface-3)', transition: 'background .2s' }} />
        ))}
      </div>
      {value && <div style={{ fontSize: 11.5, color: color, marginTop: 4 }}>{label} · {value.length} chars</div>}
    </div>
  );
}

export default function SettingsPage() {
  const { admin, logout } = useAuth();
  const navigate          = useNavigate();
  const role     = admin?.role ?? 'admin';
  const name     = admin?.username ?? 'Admin';
  const initials = name.slice(0, 2).toUpperCase();
  const isMaster = role === 'master_admin';

  const [pwForm,   setPwForm]   = useState({ current: '', newPw: '', confirm: '' });
  const [pwError,  setPwError]  = useState('');
  const [pwOk,     setPwOk]     = useState(false);
  const [saving,   setSaving]   = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }
    if (pwForm.newPw.length < 8)         { setPwError('Password must be at least 8 characters.'); return; }
    setSaving(true); setPwError(''); setPwOk(false);
    try {
      await changePassword(pwForm.current, pwForm.newPw);
      setPwOk(true);
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      setPwError(err.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      <div className="pc-shell">
        <Sidebar active="settings" role={role} name={name} initials={initials} />

        <main className="pc-main">
          <TopBar title="Settings" sub="Profile · Security · Preferences" />

          <div className="pc-content" style={{ overflowY: 'auto' }}>
            <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Profile */}
              <Card title="Profile" sub="Your personal information">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                  <div className="pc-avatar" style={{ width: 64, height: 64, fontSize: 22, background: isMaster ? 'var(--pc-role-master)' : 'var(--pc-role-admin)' }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--pc-text-3)', marginTop: 2 }}>
                      {admin?.email ?? 'No email set'}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span className={`pc-badge ${isMaster ? 'pc-badge-master' : 'pc-badge-admin'}`}>
                        {isMaster ? 'Master Admin' : 'Admin'}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="pc-field">
                    <label className="pc-label">Username</label>
                    <input className="pc-input" defaultValue={name} disabled style={{ background: 'var(--pc-surface-2)', color: 'var(--pc-text-3)' }} />
                  </div>
                  <div className="pc-field">
                    <label className="pc-label">Email</label>
                    <input className="pc-input" defaultValue={admin?.email ?? ''} placeholder="your@email.com" />
                  </div>
                </div>
              </Card>

              {/* Change password */}
              <Card title="Change password" sub="Use a strong unique password">
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="pc-field">
                    <label className="pc-label">Current password</label>
                    <input className="pc-input" type="password" value={pwForm.current}
                      onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="••••••••••••" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="pc-field">
                      <label className="pc-label">New password</label>
                      <input className="pc-input" type="password" value={pwForm.newPw}
                        onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} placeholder="••••••••••••" />
                      <PasswordStrength value={pwForm.newPw} />
                    </div>
                    <div className="pc-field">
                      <label className="pc-label">Confirm new password</label>
                      <input className="pc-input" type="password" value={pwForm.confirm}
                        onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••••••" />
                    </div>
                  </div>
                  {pwError && (
                    <div style={{ fontSize: 12.5, color: 'var(--pc-danger)', display: 'flex', gap: 6 }}>
                      <Icon name="alert" size={13} /> {pwError}
                    </div>
                  )}
                  {pwOk && (
                    <div style={{ fontSize: 12.5, color: 'var(--pc-success)', display: 'flex', gap: 6 }}>
                      <Icon name="check" size={13} /> Password updated successfully.
                    </div>
                  )}
                  <button type="submit" className="pc-btn pc-btn-primary" style={{ alignSelf: 'flex-start', marginTop: 4 }} disabled={saving}>
                    {saving ? 'Saving…' : 'Update password'}
                  </button>
                </form>
              </Card>

              {/* Session */}
              <Card title="Session" sub="JWT token management">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon name="clock" size={18} color="var(--pc-text-2)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 550 }}>Active session</div>
                    <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>Signed in as {name}</div>
                  </div>
                  <button className="pc-btn pc-btn-secondary" onClick={handleLogout}>
                    <Icon name="logOut" size={14} /> Sign out
                  </button>
                </div>
              </Card>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
