import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import Card from '../components/ui/Card';
import Icon from '../components/ui/Icon';
import { useToast } from '../contexts/ToastContext';
import { getAdmins, createAdmin, deleteAdmin, toggleAdminStatus } from '../services/api';

export default function AdminsPage() {
  const { admin } = useAuth();
  const role      = admin?.role ?? 'admin';
  const name      = admin?.username ?? 'Admin';
  const initials  = name.slice(0, 2).toUpperCase();

  const toast = useToast();

  const [admins,  setAdmins]  = useState([]);
  const [form,    setForm]    = useState({ username: '', email: '', password: '', role: 'admin' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => { loadAdmins(); }, []);

  async function loadAdmins() {
    try {
      const data = await getAdmins();
      setAdmins(data || []);
    } catch { /* noop — sidebar silently stays empty on network error */ }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) { setError('Username and password are required.'); return; }
    setSaving(true); setError('');
    try {
      await createAdmin(form);
      setForm({ username: '', email: '', password: '', role: 'admin' });
      await loadAdmins();
      toast.success(`Admin "${form.username}" created successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to create admin.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(adminId, currentlyActive) {
    const action = currentlyActive ? 'Deactivate' : 'Activate';
    if (!confirm(`${action} this admin?`)) return;
    try {
      await toggleAdminStatus(adminId);
      await loadAdmins();
      toast.success(`Admin ${currentlyActive ? 'deactivated' : 'activated'}.`);
    } catch (err) {
      toast.error(err.message || 'Failed to update admin status.');
    }
  }

  async function handleDelete(adminId) {
    if (!confirm('Remove this admin? This cannot be undone.')) return;
    try {
      await deleteAdmin(adminId);
      await loadAdmins();
      toast.success('Admin removed.');
    } catch (err) {
      toast.error(err.message || 'Failed to delete admin.');
    }
  }

  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      <div className="pc-shell">
        <Sidebar active="admins" role={role} name={name} initials={initials} />

        <main className="pc-main">
          <TopBar
            title="Admins"
            sub="Manage team access · Master Admin only"
            actions={null}
          />

          <div className="pc-content" style={{ overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

              {/* Team members table */}
              <Card title="Team members" sub={`${admins.length} member${admins.length !== 1 ? 's' : ''}`} padded={false}>
                <table className="pc-table">
                  <thead>
                    <tr><th>Member</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr>
                  </thead>
                  <tbody>
                    {admins.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--pc-text-3)', padding: 32 }}>No admins found.</td></tr>
                    ) : admins.map(m => {
                      const isSelf    = m.username === admin?.username;
                      const isMaster  = m.role === 'master_admin';
                      const badgeCls  = isMaster ? 'pc-badge-master' : 'pc-badge-admin';
                      const roleLabel = isMaster ? 'Master' : 'Admin';
                      const avatarBg  = isMaster ? 'var(--pc-role-master)' : 'var(--pc-role-admin)';
                      const ini       = m.username.slice(0, 2).toUpperCase();
                      return (
                        <tr key={m.id ?? m.username}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="pc-avatar" style={{ background: avatarBg }}>{ini}</div>
                              <div>
                                <div style={{ fontWeight: 550, fontSize: 13.5 }}>
                                  {m.username} {isSelf && <span style={{ color: 'var(--pc-text-3)', fontWeight: 400, fontSize: 12 }}>· you</span>}
                                </div>
                                {m.email && <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>{m.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td><span className={`pc-badge ${badgeCls}`}>{roleLabel}</span></td>
                          <td>
                            <span className={`pc-badge ${m.is_active !== false ? 'pc-badge-active' : 'pc-badge-inactive'}`}>
                              <span className="pc-dot" style={{ width: 5, height: 5 }} />
                              {m.is_active !== false ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--pc-text-3)', fontSize: 12 }}>
                            {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button
                                className="pc-btn pc-btn-ghost pc-btn-sm"
                                disabled={isSelf}
                                title={m.is_active !== false ? 'Deactivate' : 'Activate'}
                                style={isSelf ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                                onClick={() => !isSelf && handleToggle(m.id, m.is_active !== false)}
                              >
                                {m.is_active !== false ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                className="pc-btn pc-btn-ghost pc-btn-icon"
                                disabled={isSelf}
                                title="Delete admin"
                                style={isSelf ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                                onClick={() => !isSelf && handleDelete(m.id ?? m.username)}
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              {/* Invite form */}
              <Card title="Invite new admin" sub="They'll receive credentials via email">
                <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="pc-field">
                    <label className="pc-label">Username</label>
                    <input className="pc-input" placeholder="e.g. new_admin" value={form.username}
                      onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
                    <div className="pc-help">3–50 characters, lowercase + underscores</div>
                  </div>
                  <div className="pc-field">
                    <label className="pc-label">Email (optional)</label>
                    <input className="pc-input" type="email" value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="pc-field">
                    <label className="pc-label">Temporary password</label>
                    <input className="pc-input" value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                    <div className="pc-help">Min 8 chars · they'll be asked to change on first sign-in</div>
                  </div>
                  <div className="pc-field">
                    <label className="pc-label">Role</label>
                    <div className="pc-role-toggle" style={{ width: '100%' }}>
                      <button type="button" className={form.role === 'admin' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setForm(p => ({ ...p, role: 'admin' }))}>Admin</button>
                      <button type="button" className={form.role === 'master_admin' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setForm(p => ({ ...p, role: 'master_admin' }))}>Master</button>
                    </div>
                  </div>
                  {error && (
                    <div style={{ fontSize: 12.5, color: 'var(--pc-danger)', display: 'flex', gap: 6 }}>
                      <Icon name="alert" size={13} /> {error}
                    </div>
                  )}
                  <button type="submit" className="pc-btn pc-btn-primary" style={{ height: 40, justifyContent: 'center', marginTop: 4 }} disabled={saving}>
                    {saving ? 'Saving…' : 'Send invite'}
                  </button>
                </form>
              </Card>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
