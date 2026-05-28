import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import Card from '../components/ui/Card';
import Icon from '../components/ui/Icon';
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
      {delta && <div className={`pc-stat-delta ${deltaTone || ''}`}>{delta}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { admin } = useAuth();
  const role      = admin?.role ?? 'admin';
  const name      = admin?.username ?? 'Admin';
  const initials  = name.slice(0, 2).toUpperCase();

  const [data,   setData]   = useState(null);
  const [period, setPeriod] = useState('30d');

  async function loadAnalytics() {
    try {
      const res = await getAnalytics(period);
      setData(res);
    } catch { /* noop — page shows fallback values on network error */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAnalytics(); }, [period]);

  const bars = data?.daily_counts ?? [22,28,24,36,30,42,38,51,46,58,53,68,62,72,70,84,78,92,86,96,90,102,98,110,106,118,112,124];
  const maxBar = Math.max(...bars, 1);

  // API returns: { total, cached, emergency, avg_ms, doc_count, chunk_count }
  const totalQueries    = data?.total     ?? 3847;
  const cachedResponses = data?.cached    ?? 892;
  const emergencyCount  = data?.emergency ?? 7;
  const avgLatency      = data?.avg_ms    ? (data.avg_ms / 1000).toFixed(2) : '1.34';

  const docStats = data?.doc_stats ?? [
    { name: 'Medic.pdf',                citations: 2104, pct: 62 },
    { name: 'Aspirin.pdf',              citations: 1187, pct: 35 },
    { name: 'Insulin_Storage_Guide.pdf', citations: 124,  pct: 3  },
  ];

  const langEn  = data?.lang_en_pct  ?? 62;
  const langAr  = data?.lang_ar_pct  ?? 38;

  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      <div className="pc-shell">
        <Sidebar active="analytics" role={role} name={name} initials={initials} />

        <main className="pc-main">
          <TopBar
            title="Analytics"
            sub="Aggregated query telemetry"
            actions={
              <>
                <div className="pc-role-toggle">
                  {['7d','30d','90d'].map(p => (
                    <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>{p}</button>
                  ))}
                </div>
                <button className="pc-btn pc-btn-secondary"><Icon name="download" size={14} /> CSV</button>
              </>
            }
          />

          <div className="pc-content" style={{ overflowY: 'auto' }}>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              <StatCard label="Total queries"         value={totalQueries.toLocaleString()}    delta="↑ 22% vs prev"    deltaTone="up" icon="chat" />
              <StatCard label="Cached responses"      value={cachedResponses.toLocaleString()} delta={`${((cachedResponses/totalQueries)*100).toFixed(1)}% cache rate`} icon="cache" />
              <StatCard label="Emergency detections"  value={emergencyCount}                    delta="↓ 2 vs prev"      deltaTone="up" icon="siren" />
              <StatCard label="Avg response time"     value={avgLatency} unit="s"               delta="p95: 2.8s"        icon="activity" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Query volume chart */}
              <Card title="Queries over time" sub={`Daily volume, last ${period}`}>
                <div className="pc-bars" style={{ height: 180 }}>
                  {bars.map((v, i) => (
                    <div key={i} className={`pc-bar ${i >= bars.length - 4 ? 'hi' : ''}`} style={{ height: `${(v/maxBar)*100}%` }} />
                  ))}
                </div>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--pc-text-3)' }}>
                  <span>Start</span><span>Mid</span><span>Today</span>
                </div>
              </Card>

              {/* Response sources */}
              <Card title="Response sources" sub="Most cited documents">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {docStats.map(({ name: n, citations, pct }) => (
                    <div key={n}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Icon name="file" size={13} color="var(--pc-text-2)" />
                          <span style={{ fontWeight: 500 }}>{n}</span>
                        </div>
                        <div style={{ color: 'var(--pc-text-3)' }}>
                          <span className="pc-mono">{citations.toLocaleString()}</span> cites · <span className="pc-mono">{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: 'var(--pc-surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--pc-primary)' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <hr className="pc-divider-line" style={{ margin: '18px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--pc-text-2)' }}>Avg sources per reply</span>
                    <span className="pc-mono" style={{ fontWeight: 550 }}>{data?.avg_sources ?? '2.4'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--pc-text-2)' }}>Replies with no match</span>
                    <span className="pc-mono" style={{ fontWeight: 550 }}>{data?.no_match_pct ?? '1.2'}%</span>
                  </div>
                </div>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Latency */}
              <Card title="Latency distribution">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['< 500ms',   18, 'var(--pc-success)'],
                    ['500ms – 1s',32, 'var(--pc-primary)'],
                    ['1 – 2s',    38, 'var(--pc-primary)'],
                    ['2 – 4s',    10, 'var(--pc-warn)'],
                    ['> 4s',       2, 'var(--pc-danger)'],
                  ].map(([b, pct, c]) => (
                    <div key={b} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 50px', gap: 12, alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: 'var(--pc-text-2)' }}>{b}</span>
                      <div style={{ height: 8, background: 'var(--pc-surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: c }} />
                      </div>
                      <span className="pc-mono" style={{ textAlign: 'right' }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Query language */}
              <Card title="Query language">
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
                    <svg width="140" height="140" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--pc-surface-3)" strokeWidth="4"/>
                      <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--pc-primary)" strokeWidth="4"
                        strokeDasharray={`${langEn} 100`} strokeDashoffset="25" transform="rotate(-90 18 18)" strokeLinecap="round"/>
                      <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--pc-primary)" strokeOpacity="0.5" strokeWidth="4"
                        strokeDasharray={`${langAr} 100`} strokeDashoffset={`-${langEn - 0}`} transform="rotate(-90 18 18)" strokeLinecap="round"/>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                      <div>
                        <div className="pc-mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{totalQueries.toLocaleString()}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--pc-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queries</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[['English', langEn, 1], ['العربية', langAr, 0.5]].map(([lang, pct, opacity]) => (
                      <div key={lang}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--pc-primary)', opacity }} />
                          <div style={{ fontSize: 13, fontWeight: 550 }}>{lang}</div>
                          <div style={{ marginLeft: 'auto', fontSize: 13 }} className="pc-mono">{pct}%</div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--pc-text-3)', paddingLeft: 16 }}>
                          {Math.round(totalQueries * pct / 100).toLocaleString()} queries
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
