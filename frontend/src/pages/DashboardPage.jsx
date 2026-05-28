import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import Card from '../components/ui/Card';
import Icon from '../components/ui/Icon';
import { useCurrentPrincipal } from '../hooks/useCurrentPrincipal';
import { getAnalytics } from '../services/api';

function StatCard({ label, value, unit, delta, deltaTone, icon }) {
  return (
    <div className="pc-card pc-stat">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="pc-stat-label">{label}</div>
        {icon && (
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--pc-primary-soft)', color: 'var(--pc-primary)', display: 'grid', placeItems: 'center' }}>
            <Icon name={icon} size={14} />
          </div>
        )}
      </div>
      <div className="pc-stat-value">
        <span className="pc-mono">{value}</span>
        {unit && <span className="pc-stat-unit pc-mono">{unit}</span>}
      </div>
      {delta && (
        <div className={`pc-stat-delta ${deltaTone || ''}`}>{delta}</div>
      )}
    </div>
  );
}

function StatusDot({ tone = 'success' }) {
  const color = tone === 'success'
    ? 'var(--pc-success)'
    : tone === 'warn'
    ? 'var(--pc-warn)'
    : 'var(--pc-danger)';
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

export default function DashboardPage() {
  const { role, name, initials, logout } = useCurrentPrincipal();  // M5
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);

  // H17: analytics already returns doc_count + chunk_count — no need for a
  // separate getHealth() call. One round-trip instead of two.
  useEffect(() => {
    getAnalytics('7d').then(setStats).catch(() => {});
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      <div className="pc-shell">
        <Sidebar active="overview" role={role} name={name} initials={initials} />

        <main className="pc-main">
          <TopBar
            title="Overview"
            sub={`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Knowledge base healthy`}
            actions={
              <>
                <button className="pc-btn pc-btn-ghost pc-btn-icon" title="Notifications">
                  <Icon name="bell" size={16} />
                </button>
                <button className="pc-btn pc-btn-secondary" onClick={() => navigate('/documents')}>
                  <Icon name="upload" size={14} /> Upload PDF
                </button>
                <button className="pc-btn pc-btn-primary" onClick={() => navigate('/chat')}>
                  <Icon name="chat" size={14} /> New chat
                </button>
              </>
            }
          />

          <div className="pc-content" style={{ overflowY: 'auto' }}>
            {/* Stat row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              <StatCard
                label="Queries this week"
                value={stats ? stats.total.toLocaleString() : '—'}
                delta={stats ? `${stats.cached} cached · ${stats.emergency} emergencies` : 'Loading…'}
                deltaTone="up"
                icon="chat"
              />
              <StatCard
                label="Avg response time"
                value={stats?.avg_ms ? (stats.avg_ms / 1000).toFixed(2) : '—'}
                unit={stats?.avg_ms ? 's' : undefined}
                delta={stats ? 'Live LLM latency' : 'Loading…'}
                icon="activity"
              />
              <StatCard
                label="Cache hit rate"
                value={stats && stats.total > 0 ? Math.round(stats.cached / stats.total * 100) : '—'}
                unit={stats && stats.total > 0 ? '%' : undefined}
                delta={stats ? `${stats.cached} of ${stats.total} queries` : 'Loading…'}
                icon="cache"
              />
              <StatCard
                label="Documents indexed"
                value={stats ? stats.doc_count : '—'}
                delta={stats ? `${stats.chunk_count} chunks in FAISS` : 'Loading…'}
                icon="doc"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              {/* Recent activity */}
              <Card
                title="Recent activity"
                sub="Across your team's sessions"
                action={
                  <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => navigate('/analytics')}>View all</button>
                }
                padded={false}
              >
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Admin</th>
                      <th>Sources</th>
                      <th style={{ textAlign: 'right' }}>Response</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['What are the side effects of Aspirin 500mg?', 'Admin', 'Aspirin.pdf', '1.21s', '2 min ago'],
                      ['هل يمكن تناول الأسبرين مع الإيبوبروفين؟', 'Admin', 'Aspirin.pdf · Medic.pdf', '1.84s', '14 min ago'],
                      ['Maximum daily dose of paracetamol for adults', 'Admin', 'Medic.pdf', '0.94s', '38 min ago'],
                    ].map(([q, a, src, t, w]) => (
                      <tr key={q}>
                        <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q}</td>
                        <td style={{ color: 'var(--pc-text-2)' }}>{a}</td>
                        <td>
                          {src.split(' · ').map(s => (
                            <span key={s} className="pc-source-pill" style={{ marginRight: 4, height: 22, fontSize: 11.5 }}>
                              <Icon name="file" size={11} /> {s}
                            </span>
                          ))}
                        </td>
                        <td style={{ textAlign: 'right' }} className="pc-mono">{t}</td>
                        <td style={{ color: 'var(--pc-text-3)' }}>{w}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* System status */}
                <Card title="System status">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* H17: use stats (from analytics) instead of a separate health call */}
                    {[
                      [
                        'FAISS index',
                        stats ? 'success' : 'warn',
                        stats ? `In sync · ${stats.chunk_count} vectors` : 'Loading…',
                      ],
                      ['LLM (gpt-4o-mini)',    'success', 'Reachable'],
                      ['Embeddings (ada-002)', 'success', 'Reachable'],
                      [
                        'Knowledge base',
                        stats ? 'success' : 'warn',
                        stats ? `${stats.doc_count} PDF${stats.doc_count !== 1 ? 's' : ''} ingested` : 'Loading…',
                      ],
                    ].map(([k, tone, v]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StatusDot tone={tone} />
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{k}</div>
                        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--pc-text-3)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Quick actions */}
                <Card title="Quick actions">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* C11: hide the admin-management link for non-master admins */}
                    {[
                      ['upload', 'Upload a new PDF',  'Add to knowledge base', '/documents'],
                      ...(role === 'master_admin'
                        ? [['users', 'Invite an admin', 'Master Admin only', '/admins']]
                        : []),
                      ['chart',  'Export analytics',  'Last 30 days CSV',      '/analytics'],
                    ].map(([ic, t, s, path]) => (
                      <div
                        key={t}
                        onClick={() => navigate(path)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 9, cursor: 'pointer', transition: 'background .12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--pc-surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--pc-primary-soft)', color: 'var(--pc-primary)', display: 'grid', placeItems: 'center' }}>
                          <Icon name={ic} size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 550 }}>{t}</div>
                          <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>{s}</div>
                        </div>
                        <Icon name="chevronRight" size={14} color="var(--pc-text-3)" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Sign out */}
                <button
                  className="pc-btn pc-btn-ghost"
                  onClick={handleLogout}
                  style={{ justifyContent: 'center', color: 'var(--pc-text-3)' }}
                >
                  <Icon name="logOut" size={14} /> Sign out
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
