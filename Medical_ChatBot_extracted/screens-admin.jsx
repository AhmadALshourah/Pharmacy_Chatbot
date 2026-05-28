/* Login, Dashboard, Documents, Analytics, Admins, Settings */

const LoginScreen = ({ role = 'admin' }) => {
  const isAdmin = role === 'admin';
  return (
    <Frame label="01 Login">
      <div className="pc-login-shell">
        {/* Left brand panel */}
        <div className="pc-login-aside">
          <div className="pc-login-aside-pattern"/>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'grid', placeItems: 'center' }}>
              <Icon name="pill" size={18} color="white" stroke={2}/>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>Aspira</div>
              <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Pharmacy Assistant</div>
            </div>
          </div>

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
                    <Icon name="check" size={12} color="white" stroke={2.4}/>
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
              <button className={isAdmin ? 'active' : ''}>
                <Icon name="key" size={13}/> Admin
              </button>
              <button className={!isAdmin ? 'active' : ''}>
                <Icon name="users" size={13}/> User
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="pc-field">
                <label className="pc-label">Username</label>
                <input className="pc-input" defaultValue={isAdmin ? 'master_admin' : 'Ahmad'}/>
              </div>
              <div className="pc-field">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="pc-label">Password</label>
                  <a style={{ fontSize: 12, color: 'var(--pc-primary)', textDecoration: 'none' }}>Forgot?</a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input className="pc-input" type="password" defaultValue="••••••••••" style={{ width: '100%', paddingRight: 38 }}/>
                  <div style={{ position: 'absolute', right: 10, top: 10, color: 'var(--pc-text-3)' }}><Icon name="eyeOff" size={16}/></div>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--pc-text-2)', marginTop: 2 }}>
                <input type="checkbox" defaultChecked style={{ accentColor: 'var(--pc-primary)' }}/>
                Keep me signed in for 8 hours
              </label>

              <button className="pc-btn pc-btn-primary" style={{ height: 42, justifyContent: 'center', marginTop: 8 }}>
                Sign in
                <Icon name="arrowRight" size={14} stroke={2}/>
              </button>
            </div>

            <div style={{ marginTop: 24, padding: 12, background: 'var(--pc-surface-2)', border: '1px solid var(--pc-divider)', borderRadius: 10, fontSize: 12, color: 'var(--pc-text-2)', display: 'flex', gap: 10 }}>
              <Icon name="alert" size={14} color="var(--pc-warn)"/>
              <div>
                Aspira does not provide diagnoses. Replies always recommend consulting a licensed pharmacist.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
};

const StatCard = ({ label, value, unit, delta, deltaTone, icon }) => (
  <div className="pc-card pc-stat">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div className="pc-stat-label">{label}</div>
      {icon && <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--pc-primary-soft)', color: 'var(--pc-primary)', display: 'grid', placeItems: 'center' }}><Icon name={icon} size={14}/></div>}
    </div>
    <div className="pc-stat-value">
      <span className="pc-mono">{value}</span>
      {unit && <span className="pc-stat-unit pc-mono">{unit}</span>}
    </div>
    {delta && <div className={`pc-stat-delta ${deltaTone || ''}`}>{delta}</div>}
  </div>
);

const DashboardScreen = () => (
  <Frame label="02 Admin Dashboard">
    <div className="pc-shell">
      <Sidebar active="overview" role="master_admin"/>
      <main className="pc-main">
        <TopBar
          title="Overview"
          sub="Tuesday, May 28 · Knowledge base healthy"
          actions={
            <>
              <button className="pc-btn pc-btn-ghost pc-btn-icon"><Icon name="bell" size={16}/></button>
              <button className="pc-btn pc-btn-secondary"><Icon name="upload" size={14}/> Upload PDF</button>
              <button className="pc-btn pc-btn-primary"><Icon name="chat" size={14}/> New chat</button>
            </>
          }
        />
        <div className="pc-content" style={{ overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <StatCard label="Queries this week" value="1,284" delta="↑ 18.4% vs last week" deltaTone="up" icon="chat"/>
            <StatCard label="Avg response time" value="1.34" unit="s" delta="↓ 240ms faster" deltaTone="up" icon="activity"/>
            <StatCard label="Cache hit rate" value="34" unit="%" delta="23 of 67 today" icon="cache"/>
            <StatCard label="Documents indexed" value="3" delta="65 chunks · 47KB" icon="doc"/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <Card title="Recent activity" sub="Across your team's sessions" action={<button className="pc-btn pc-btn-ghost pc-btn-sm">View all</button>} padded={false}>
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
                    ['What are the side effects of Aspirin 500mg?', 'Layla H.', 'Aspirin.pdf', '1.21s', '2 min ago'],
                    ['هل يمكن تناول الأسبرين مع الإيبوبروفين؟', 'Omar K.', 'Aspirin.pdf · Medic.pdf', '1.84s', '14 min ago'],
                    ['Maximum daily dose of paracetamol for adults', 'Layla H.', 'Medic.pdf', '0.94s', '38 min ago'],
                    ['Storage requirements for refrigerated insulin', 'Sara N.', 'Medic.pdf', '1.12s', '1 hr ago'],
                    ['Drug interactions: warfarin and ibuprofen', 'Omar K.', 'Aspirin.pdf · Medic.pdf', '2.04s', '2 hr ago'],
                  ].map(([q, a, src, t, w]) => (
                    <tr key={q}>
                      <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q}</td>
                      <td style={{ color: 'var(--pc-text-2)' }}>{a}</td>
                      <td>
                        {src.split(' · ').map(s => <span key={s} className="pc-source-pill" style={{ marginRight: 4, height: 22, fontSize: 11.5 }}><Icon name="file" size={11}/> {s}</span>)}
                      </td>
                      <td style={{ textAlign: 'right' }} className="pc-mono">{t}</td>
                      <td style={{ color: 'var(--pc-text-3)' }}>{w}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card title="System status">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['FAISS index', 'success', 'In sync · 65 vectors'],
                    ['LLM (gpt-4o-mini)', 'success', 'Reachable · 0 errors today'],
                    ['Embeddings (ada-002)', 'success', 'Reachable'],
                    ['Rate limit', 'warn', '12 / 20 used in window'],
                  ].map(([k, tone, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <StatusDot tone={tone}/>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{k}</div>
                      <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--pc-text-3)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Quick actions">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['upload', 'Upload a new PDF', 'Add to knowledge base'],
                    ['users', 'Invite an admin', 'Master Admin only'],
                    ['chart', 'Export analytics', 'Last 30 days CSV'],
                  ].map(([ic, t, s]) => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 9, cursor: 'pointer' }} className="pc-quick">
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--pc-primary-soft)', color: 'var(--pc-primary)', display: 'grid', placeItems: 'center' }}><Icon name={ic} size={14}/></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 550 }}>{t}</div>
                        <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>{s}</div>
                      </div>
                      <Icon name="chevronRight" size={14} color="var(--pc-text-3)"/>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  </Frame>
);

const DocumentsScreen = () => (
  <Frame label="04 Documents">
    <div className="pc-shell">
      <Sidebar active="docs" role="master_admin"/>
      <main className="pc-main">
        <TopBar
          title="Documents"
          sub="3 PDFs · 65 chunks indexed in FAISS"
          actions={
            <>
              <div className="pc-pill"><Icon name="refresh" size={12}/> Last rebuild: 2 min ago</div>
              <button className="pc-btn pc-btn-secondary"><Icon name="download" size={14}/> Export list</button>
            </>
          }
        />
        <div className="pc-content" style={{ overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            <Card title="Knowledge base" sub="PDFs ingested for retrieval" padded={false}
                  action={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <input className="pc-input pc-btn-sm" style={{ width: 220, height: 32, paddingLeft: 32, fontSize: 12.5 }} placeholder="Search documents…"/>
                        <div style={{ position: 'absolute', left: 10, top: 8, color: 'var(--pc-text-3)' }}><Icon name="search" size={14}/></div>
                      </div>
                    </div>
                  }>
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Pages</th>
                    <th>Chunks</th>
                    <th>Size</th>
                    <th>Uploaded by</th>
                    <th>When</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Aspirin.pdf', 3, 22, '125 KB', 'Layla H.', 'May 27, 09:00'],
                    ['Medic.pdf', 18, 38, '892 KB', 'Layla H.', 'May 27, 09:04'],
                    ['Insulin_Storage_Guide.pdf', 2, 5, '76 KB', 'Omar K.', 'May 28, 08:12'],
                  ].map(([n, p, c, s, by, w]) => (
                    <tr key={n}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 36, borderRadius: 4, background: 'var(--pc-danger-soft)', color: 'var(--pc-danger)', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700 }}>PDF</div>
                          <div style={{ fontWeight: 550 }}>{n}</div>
                        </div>
                      </td>
                      <td className="pc-mono">{p}</td>
                      <td className="pc-mono">{c}</td>
                      <td className="pc-mono" style={{ color: 'var(--pc-text-2)' }}>{s}</td>
                      <td style={{ color: 'var(--pc-text-2)' }}>{by}</td>
                      <td style={{ color: 'var(--pc-text-3)' }}>{w}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button className="pc-btn pc-btn-ghost pc-btn-icon"><Icon name="eye" size={14}/></button>
                          <button className="pc-btn pc-btn-ghost pc-btn-icon"><Icon name="trash" size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card title="Add to knowledge base">
                <div className="pc-upload-zone">
                  <div className="pc-upload-icon"><Icon name="upload" size={20}/></div>
                  <div style={{ fontSize: 14, fontWeight: 550 }}>Drop a PDF or click to browse</div>
                  <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>PDF only · max 20MB · chunked at 1000 chars</div>
                  <button className="pc-btn pc-btn-primary pc-btn-sm" style={{ marginTop: 4 }}>Choose file</button>
                </div>

                <div style={{ marginTop: 14, padding: 12, background: 'var(--pc-surface-2)', borderRadius: 10, border: '1px solid var(--pc-divider)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 32, borderRadius: 4, background: 'var(--pc-danger-soft)', color: 'var(--pc-danger)', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 700 }}>PDF</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Antibiotics_Reference_v3.pdf</div>
                      <div style={{ fontSize: 11.5, color: 'var(--pc-text-3)' }}>1.2 MB · embedding…</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pc-primary)', fontWeight: 600 }} className="pc-mono">68%</div>
                  </div>
                  <div style={{ height: 4, background: 'var(--pc-divider)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: '68%', height: '100%', background: 'var(--pc-primary)' }}/>
                  </div>
                </div>
              </Card>

              <Card title="Ingestion pipeline">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                  {[
                    ['PyPDF2 text extraction', 'success'],
                    ['Chunking (1000 / 200 overlap)', 'success'],
                    ['ada-002 embeddings (1536-d)', 'success'],
                    ['FAISS rebuild (IndexFlatIP)', 'success'],
                  ].map(([t, tone]) => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--pc-success-soft)', color: 'var(--pc-success)', display: 'grid', placeItems: 'center' }}>
                        <Icon name="check" size={11} stroke={2.4}/>
                      </div>
                      <div>{t}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  </Frame>
);

const AnalyticsScreen = () => {
  const bars = [22, 28, 24, 36, 30, 42, 38, 51, 46, 58, 53, 68, 62, 72, 70, 84, 78, 92, 86, 96, 90, 102, 98, 110, 106, 118, 112, 124];
  const max = Math.max(...bars);
  return (
    <Frame label="05 Analytics">
      <div className="pc-shell">
        <Sidebar active="analytics" role="master_admin"/>
        <main className="pc-main">
          <TopBar
            title="Analytics"
            sub="Aggregated query telemetry · last 30 days"
            actions={
              <>
                <div className="pc-role-toggle">
                  <button>7d</button>
                  <button className="active">30d</button>
                  <button>90d</button>
                </div>
                <button className="pc-btn pc-btn-secondary"><Icon name="download" size={14}/> CSV</button>
              </>
            }
          />
          <div className="pc-content" style={{ overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              <StatCard label="Total queries" value="3,847" delta="↑ 22% vs prev" deltaTone="up" icon="chat"/>
              <StatCard label="Cached responses" value="892" delta="23.2% cache rate" icon="cache"/>
              <StatCard label="Emergency detections" value="7" delta="↓ 2 vs prev" deltaTone="up" icon="siren"/>
              <StatCard label="Avg response time" value="1.34" unit="s" delta="p95: 2.8s" icon="activity"/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Card title="Queries over time" sub="Daily volume, last 30 days" padded={true}>
                <div className="pc-bars" style={{ height: 180 }}>
                  {bars.map((v, i) => (
                    <div key={i} className={`pc-bar ${i >= 24 ? 'hi' : ''}`} style={{ height: `${(v/max)*100}%` }}/>
                  ))}
                </div>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--pc-text-3)' }}>
                  <span>Apr 28</span><span>May 12</span><span>May 28</span>
                </div>
              </Card>

              <Card title="Response sources" sub="Most cited documents">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    ['Medic.pdf', 2104, 62],
                    ['Aspirin.pdf', 1187, 35],
                    ['Insulin_Storage_Guide.pdf', 124, 3],
                  ].map(([n, c, pct]) => (
                    <div key={n}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Icon name="file" size={13} color="var(--pc-text-2)"/>
                          <span style={{ fontWeight: 500 }}>{n}</span>
                        </div>
                        <div style={{ color: 'var(--pc-text-3)' }}><span className="pc-mono">{c.toLocaleString()}</span> cites · <span className="pc-mono">{pct}%</span></div>
                      </div>
                      <div style={{ height: 6, background: 'var(--pc-surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--pc-primary)' }}/>
                      </div>
                    </div>
                  ))}
                </div>
                <hr className="pc-divider-line" style={{ margin: '18px 0' }}/>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--pc-text-2)' }}>Avg sources per reply</span><span className="pc-mono" style={{ fontWeight: 550 }}>2.4</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--pc-text-2)' }}>Replies with no match</span><span className="pc-mono" style={{ fontWeight: 550 }}>1.2%</span></div>
                </div>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Latency distribution">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['< 500ms', 18, 'var(--pc-success)'],
                    ['500ms – 1s', 32, 'var(--pc-primary)'],
                    ['1 – 2s', 38, 'var(--pc-primary)'],
                    ['2 – 4s', 10, 'var(--pc-warn)'],
                    ['> 4s', 2, 'var(--pc-danger)'],
                  ].map(([b, pct, c]) => (
                    <div key={b} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 50px', gap: 12, alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: 'var(--pc-text-2)' }}>{b}</span>
                      <div style={{ height: 8, background: 'var(--pc-surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: c }}/>
                      </div>
                      <span className="pc-mono" style={{ textAlign: 'right' }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Query language">
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ position: 'relative', width: 140, height: 140 }}>
                    <svg width="140" height="140" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--pc-surface-3)" strokeWidth="4"/>
                      <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--pc-primary)" strokeWidth="4" strokeDasharray="62 100" strokeDashoffset="25" transform="rotate(-90 18 18)" strokeLinecap="round"/>
                      <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--pc-primary)" strokeOpacity="0.5" strokeWidth="4" strokeDasharray="38 100" strokeDashoffset="-37" transform="rotate(-90 18 18)" strokeLinecap="round"/>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                      <div>
                        <div className="pc-mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>3,847</div>
                        <div style={{ fontSize: 10.5, color: 'var(--pc-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queries</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--pc-primary)' }}/>
                        <div style={{ fontSize: 13, fontWeight: 550 }}>English</div>
                        <div style={{ marginLeft: 'auto', fontSize: 13 }} className="pc-mono">62%</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--pc-text-3)', paddingLeft: 16 }}>2,385 queries</div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--pc-primary)', opacity: 0.5 }}/>
                        <div style={{ fontSize: 13, fontWeight: 550 }}>العربية</div>
                        <div style={{ marginLeft: 'auto', fontSize: 13 }} className="pc-mono">38%</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--pc-text-3)', paddingLeft: 16 }}>1,462 queries</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </Frame>
  );
};

const AdminsScreen = () => (
  <Frame label="06 Admins">
    <div className="pc-shell">
      <Sidebar active="admins" role="master_admin"/>
      <main className="pc-main">
        <TopBar
          title="Admins"
          sub="Manage team access · Master Admin only"
          actions={
            <button className="pc-btn pc-btn-primary"><Icon name="plus" size={14} stroke={2.2}/> Invite admin</button>
          }
        />
        <div className="pc-content" style={{ overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            <Card title="Team members" sub="4 admins · 1 master · 3 admins" padded={false}>
              <table className="pc-table">
                <thead>
                  <tr><th>Member</th><th>Role</th><th>Status</th><th>Last active</th><th>Created</th><th></th></tr>
                </thead>
                <tbody>
                  {[
                    { i: 'LH', n: 'Layla Hassan', e: 'layla@aspira.health', role: 'master_admin', active: true, last: 'Just now', c: 'Jan 14, 2025', self: true },
                    { i: 'OK', n: 'Omar Khalil', e: 'omar@aspira.health', role: 'admin', active: true, last: '12 min ago', c: 'Feb 02, 2025' },
                    { i: 'SN', n: 'Sara Nasrallah', e: 'sara@aspira.health', role: 'admin', active: true, last: '2 hr ago', c: 'Mar 18, 2025' },
                    { i: 'YA', n: 'Yara Abboud', e: 'yara@aspira.health', role: 'admin', active: false, last: '23 days ago', c: 'Mar 22, 2025' },
                  ].map(m => (
                    <tr key={m.e}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="pc-avatar" style={{ background: m.role === 'master_admin' ? 'var(--pc-role-master)' : 'var(--pc-role-admin)' }}>{m.i}</div>
                          <div>
                            <div style={{ fontWeight: 550, fontSize: 13.5 }}>{m.n} {m.self && <span style={{ color: 'var(--pc-text-3)', fontWeight: 400, fontSize: 12 }}>· you</span>}</div>
                            <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>{m.e}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`pc-badge ${m.role === 'master_admin' ? 'pc-badge-master' : 'pc-badge-admin'}`}>
                          {m.role === 'master_admin' ? 'Master' : 'Admin'}
                        </span>
                      </td>
                      <td>
                        <span className={`pc-badge ${m.active ? 'pc-badge-active' : 'pc-badge-inactive'}`}>
                          <span className="pc-dot" style={{ width: 5, height: 5 }}/>
                          {m.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--pc-text-2)' }}>{m.last}</td>
                      <td style={{ color: 'var(--pc-text-3)' }}>{m.c}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="pc-btn pc-btn-ghost pc-btn-icon" disabled={m.self} style={m.self ? { opacity: 0.3, cursor: 'not-allowed' } : null}><Icon name="moreH" size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Invite new admin" sub="They'll receive credentials via email">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="pc-field">
                  <label className="pc-label">Username</label>
                  <input className="pc-input" placeholder="e.g. new_admin" defaultValue="amir_q"/>
                  <div className="pc-help">3–50 characters, lowercase + underscores</div>
                </div>
                <div className="pc-field">
                  <label className="pc-label">Email</label>
                  <input className="pc-input" defaultValue="amir@aspira.health"/>
                </div>
                <div className="pc-field">
                  <label className="pc-label">Temporary password</label>
                  <input className="pc-input" defaultValue="A8k!mP2x@vR9"/>
                  <div className="pc-help">Min 8 chars · they'll be asked to change on first sign-in</div>
                </div>
                <div className="pc-field">
                  <label className="pc-label">Role</label>
                  <div className="pc-role-toggle" style={{ width: '100%' }}>
                    <button className="active" style={{ flex: 1, justifyContent: 'center' }}>Admin</button>
                    <button style={{ flex: 1, justifyContent: 'center' }}>Master</button>
                  </div>
                </div>
                <button className="pc-btn pc-btn-primary" style={{ height: 40, justifyContent: 'center', marginTop: 4 }}>Send invite</button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  </Frame>
);

const SettingsScreen = () => (
  <Frame label="07 Settings">
    <div className="pc-shell">
      <Sidebar active="settings" role="master_admin"/>
      <main className="pc-main">
        <TopBar title="Settings" sub="Profile · Security · Preferences"/>
        <div className="pc-content" style={{ overflowY: 'auto' }}>
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card title="Profile" sub="Your personal information">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                <div className="pc-avatar" style={{ width: 64, height: 64, fontSize: 22, background: 'var(--pc-role-master)' }}>LH</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Layla Hassan</div>
                  <div style={{ fontSize: 12.5, color: 'var(--pc-text-3)', marginTop: 2 }}>Member since January 14, 2025</div>
                  <div style={{ marginTop: 6 }}><span className="pc-badge pc-badge-master">Master Admin</span></div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button className="pc-btn pc-btn-secondary pc-btn-sm">Change avatar</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="pc-field"><label className="pc-label">Username</label><input className="pc-input" defaultValue="master_admin" disabled style={{ background: 'var(--pc-surface-2)', color: 'var(--pc-text-3)' }}/></div>
                <div className="pc-field"><label className="pc-label">Email</label><input className="pc-input" defaultValue="layla@aspira.health"/></div>
              </div>
            </Card>

            <Card title="Change password" sub="Use a strong unique password">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="pc-field"><label className="pc-label">Current password</label><input className="pc-input" type="password" defaultValue="••••••••••••"/></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="pc-field"><label className="pc-label">New password</label><input className="pc-input" type="password" defaultValue="••••••••••••"/></div>
                  <div className="pc-field"><label className="pc-label">Confirm new password</label><input className="pc-input" type="password" defaultValue="••••••••••••"/></div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {[1,1,1,1,0].map((on, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: on ? 'var(--pc-success)' : 'var(--pc-surface-3)' }}/>)}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--pc-text-3)' }}>Strong · 14 chars · mixed case, numbers, symbols</div>
                <button className="pc-btn pc-btn-primary" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Update password</button>
              </div>
            </Card>

            <Card title="Session" sub="JWT token · expires in 7h 24m">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name="clock" size={18} color="var(--pc-text-2)"/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 550 }}>Active session</div>
                  <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>Signed in at 09:34 · Token expires 17:34</div>
                </div>
                <button className="pc-btn pc-btn-secondary"><Icon name="logOut" size={14}/> Sign out</button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  </Frame>
);

Object.assign(window, { LoginScreen, DashboardScreen, DocumentsScreen, AnalyticsScreen, AdminsScreen, SettingsScreen });
