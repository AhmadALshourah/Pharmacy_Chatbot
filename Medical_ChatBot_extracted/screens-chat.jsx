/* Chat — Admin chat, Emergency state, User chat */

const ChatSessionList = ({ active = 0, isUser = false }) => {
  const today = isUser ? [
    ['Can I take Aspirin with my blood pressure med?', '2m'],
    ['How long does paracetamol last?', '1h'],
  ] : [
    ['Side effects of Aspirin 500mg', 'now'],
    ['Warfarin interactions with NSAIDs', '14m'],
    ['Refrigerated insulin storage', '42m'],
  ];
  const yesterday = isUser ? [
    ['الجرعة الآمنة للإيبوبروفين', 'Yd'],
  ] : [
    ['Max daily acetaminophen adults', 'Yd'],
    ['Drug interactions module overview', 'Yd'],
  ];
  const earlier = isUser ? [
    ['Stomach pain after antibiotics', '3d'],
  ] : [
    ['Pediatric dosing chart questions', '3d'],
    ['Storage of vaccines', '5d'],
    ['Lab interaction reference', '1w'],
  ];

  const Group = ({ label, items, baseIdx = 0 }) => (
    <>
      <div className="pc-session-group-label">{label}</div>
      {items.map(([t, when], i) => (
        <div key={t} className={`pc-session${baseIdx + i === active ? ' active' : ''}`}>
          <span className="pc-session-text">{t}</span>
          <span style={{ fontSize: 11, color: 'var(--pc-text-3)' }}>{when}</span>
          <span className="pc-session-del"><Icon name="trash" size={13} color="var(--pc-text-3)"/></span>
        </div>
      ))}
    </>
  );

  return (
    <div className="pc-chat-sessions">
      <Group label="Today" items={today} baseIdx={0}/>
      <Group label="Yesterday" items={yesterday} baseIdx={today.length}/>
      <Group label="Earlier" items={earlier} baseIdx={today.length + yesterday.length}/>
    </div>
  );
};

const SourcePills = ({ files }) => (
  <div className="pc-sources">
    <span className="pc-sources-label">Sources</span>
    {files.map(f => (
      <span key={f} className="pc-source-pill">
        <Icon name="file" size={11}/> {f}
      </span>
    ))}
  </div>
);

const ChatScreen = ({ user = false }) => (
  <Frame label={user ? '09 User Chat' : '03 Admin Chat'}>
    <div className="pc-shell">
      <Sidebar active="chat" role={user ? 'user' : 'master_admin'} name={user ? 'Ahmad Y.' : 'Layla H.'} initials={user ? 'AY' : 'LH'}/>
      <main className="pc-main" style={{ background: 'var(--pc-bg)' }}>
        <div className="pc-chat-shell">
          {/* Chat session sidebar */}
          <div className="pc-chat-sidebar">
            <div className="pc-chat-sidebar-head">
              <button className="pc-new-chat"><Icon name="plus" size={14} stroke={2.2}/> New conversation</button>
              <div style={{ position: 'relative', marginTop: 10 }}>
                <input className="pc-input" placeholder="Search history…" style={{ height: 34, fontSize: 12.5, paddingLeft: 32, background: 'var(--pc-surface)' }}/>
                <div style={{ position: 'absolute', left: 10, top: 9, color: 'var(--pc-text-3)' }}><Icon name="search" size={14}/></div>
              </div>
            </div>
            <ChatSessionList active={0} isUser={user}/>
          </div>

          {/* Chat main */}
          <div className="pc-chat-main">
            <div className="pc-chat-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--pc-primary-soft)', color: 'var(--pc-primary)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="chat" size={16}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Side effects of Aspirin 500mg</div>
                  <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>4 messages · started 09:42</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="pc-pill"><Icon name="sparkle" size={12}/> gpt-4o-mini</span>
                <button className="pc-btn pc-btn-ghost pc-btn-icon"><Icon name="download" size={15}/></button>
                <button className="pc-btn pc-btn-ghost pc-btn-icon"><Icon name="trash" size={15}/></button>
              </div>
            </div>

            <div className="pc-chat-thread">
              <div className="pc-chat-inner">
                {/* User msg */}
                <div className="pc-msg">
                  <div className="pc-msg-avatar user">{user ? 'AY' : 'LH'}</div>
                  <div className="pc-msg-body">
                    <div className="pc-msg-name">{user ? 'Ahmad' : 'Layla'}<span className="pc-msg-time">09:42</span></div>
                    <div className="pc-msg-content">
                      What are the side effects of Aspirin 500mg, and are there any interactions with ibuprofen I should know about?
                    </div>
                  </div>
                </div>

                {/* Bot msg */}
                <div className="pc-msg">
                  <div className="pc-msg-avatar bot"><Icon name="pill" size={14} color="white" stroke={2.2}/></div>
                  <div className="pc-msg-body">
                    <div className="pc-msg-name">Aspira<span className="pc-msg-time">09:42 · 1.21s</span></div>
                    <div className="pc-msg-content">
                      <p><strong>Aspirin 500mg — common side effects</strong></p>
                      <ul>
                        <li>Gastrointestinal upset, heartburn, nausea</li>
                        <li>Increased bleeding tendency, easy bruising</li>
                        <li>Tinnitus or hearing changes at high doses</li>
                        <li>Allergic reactions (rash, wheezing) in sensitive individuals</li>
                      </ul>
                      <p style={{ marginTop: 10 }}><strong>Less common but serious:</strong> gastric ulcer, hemorrhagic stroke risk in predisposed patients, Reye's syndrome in children with viral infections.</p>

                      <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--pc-warn-soft)', borderRadius: 10, border: '1px solid var(--pc-warn-border)', display: 'flex', gap: 10 }}>
                        <Icon name="alert" size={16} color="var(--pc-warn)"/>
                        <div style={{ fontSize: 13.5, color: 'var(--pc-warn-text)' }}>
                          <strong>Interaction — Moderate severity:</strong> Aspirin + Ibuprofen can reduce aspirin's cardioprotective effect and compound GI bleeding risk. If both are needed, take ibuprofen at least <em>8 hours before</em> or <em>30 minutes after</em> immediate-release aspirin.
                        </div>
                      </div>

                      <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--pc-text-2)' }}>
                        <em>Always consult a licensed pharmacist or physician before combining medications, especially if you have cardiovascular conditions or take anticoagulants.</em>
                      </p>
                    </div>
                    <SourcePills files={['Aspirin.pdf', 'Medic.pdf']}/>

                    <div style={{ marginTop: 12, display: 'flex', gap: 4 }}>
                      <button className="pc-btn pc-btn-ghost pc-btn-sm" style={{ padding: '0 8px' }}><Icon name="check" size={12}/> Helpful</button>
                      <button className="pc-btn pc-btn-ghost pc-btn-sm" style={{ padding: '0 8px' }}><Icon name="x" size={12}/> Not quite</button>
                      <button className="pc-btn pc-btn-ghost pc-btn-sm" style={{ padding: '0 8px' }}><Icon name="refresh" size={12}/> Regenerate</button>
                    </div>
                  </div>
                </div>

                {/* User follow-up */}
                <div className="pc-msg">
                  <div className="pc-msg-avatar user">{user ? 'AY' : 'LH'}</div>
                  <div className="pc-msg-body">
                    <div className="pc-msg-name">{user ? 'Ahmad' : 'Layla'}<span className="pc-msg-time">09:44</span></div>
                    <div className="pc-msg-content">And what about taking it with warfarin? Patient is on 5mg daily.</div>
                  </div>
                </div>

                {/* Streaming bot msg */}
                <div className="pc-msg">
                  <div className="pc-msg-avatar bot"><Icon name="pill" size={14} color="white" stroke={2.2}/></div>
                  <div className="pc-msg-body">
                    <div className="pc-msg-name">Aspira<span className="pc-msg-time" style={{ color: 'var(--pc-primary)' }}>● streaming…</span></div>
                    <div className="pc-msg-content">
                      <p><strong>Aspirin + Warfarin — High-severity interaction.</strong></p>
                      <p>Combining aspirin with warfarin substantially increases bleeding risk because both medications affect hemostasis through different mechanisms: warfarin inhibits vitamin-K-dependent clotting factors while aspirin irreversibly inhibits platelet aggregation</p>
                      <span style={{ display: 'inline-block', width: 8, height: 16, background: 'var(--pc-primary)', verticalAlign: 'text-bottom', animation: 'none' }}/>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Composer */}
            <div className="pc-composer">
              <div className="pc-composer-inner">
                <div className="pc-composer-box">
                  <textarea className="pc-composer-input" placeholder="Ask about medications, interactions, dosage… (Arabic or English)" defaultValue=""/>
                  <div className="pc-composer-row">
                    <button className="pc-btn pc-btn-ghost pc-btn-sm pc-btn-icon"><Icon name="paperclip" size={14}/></button>
                    <span className="pc-composer-hint">Shift + Enter for new line · 2000 char max</span>
                    <button className="pc-send-btn" disabled><Icon name="send" size={14} color="currentColor" stroke={2}/></button>
                  </div>
                </div>
                <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, color: 'var(--pc-text-3)' }}>
                  Aspira retrieves answers from indexed PDFs · Always verify with a licensed pharmacist
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </Frame>
);

const ChatEmergencyScreen = () => (
  <Frame label="03b Chat — Emergency">
    <div className="pc-shell">
      <Sidebar active="chat" role="master_admin"/>
      <main className="pc-main" style={{ background: 'var(--pc-bg)' }}>
        <div className="pc-chat-shell">
          <div className="pc-chat-sidebar">
            <div className="pc-chat-sidebar-head">
              <button className="pc-new-chat"><Icon name="plus" size={14} stroke={2.2}/> New conversation</button>
            </div>
            <div className="pc-chat-sessions">
              <div className="pc-session-group-label">Today</div>
              <div className="pc-session active">
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--pc-danger)', flexShrink: 0 }}/>
                <span className="pc-session-text">Patient took 12 Aspirin tablets</span>
                <span style={{ fontSize: 11, color: 'var(--pc-danger)' }}>!</span>
              </div>
              <div className="pc-session">
                <span className="pc-session-text">Side effects of Aspirin 500mg</span>
                <span style={{ fontSize: 11, color: 'var(--pc-text-3)' }}>10m</span>
              </div>
            </div>
          </div>

          <div className="pc-chat-main">
            <div className="pc-chat-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--pc-danger-soft)', color: 'var(--pc-danger)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="siren" size={16}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Patient took 12 Aspirin tablets</div>
                  <div style={{ fontSize: 12, color: 'var(--pc-danger)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="pc-dot" style={{ width: 5, height: 5 }}/>
                    Emergency flagged · 11:02
                  </div>
                </div>
              </div>
              <span className="pc-badge pc-badge-danger"><Icon name="alert" size={11}/> Emergency keyword detected</span>
            </div>

            <div className="pc-chat-thread">
              <div className="pc-chat-inner">
                <div className="pc-msg">
                  <div className="pc-msg-avatar user">LH</div>
                  <div className="pc-msg-body">
                    <div className="pc-msg-name">Layla<span className="pc-msg-time">11:02</span></div>
                    <div className="pc-msg-content">My patient just told me he took too many Aspirin tablets — about 12 in the last hour. What do I do?</div>
                  </div>
                </div>

                <div className="pc-msg">
                  <div className="pc-msg-avatar bot" style={{ background: 'var(--pc-danger)' }}>
                    <Icon name="alert" size={14} color="white" stroke={2.4}/>
                  </div>
                  <div className="pc-msg-body" style={{ minWidth: 0 }}>
                    <div className="pc-msg-name" style={{ color: 'var(--pc-danger)' }}>
                      Aspira · Emergency response<span className="pc-msg-time">11:02 · bypassing LLM</span>
                    </div>

                    <div className="pc-emergency">
                      <div className="pc-emergency-head">
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--pc-danger)', color: 'white', display: 'grid', placeItems: 'center' }}>
                          <Icon name="siren" size={18} stroke={2}/>
                        </div>
                        <div>
                          <div className="pc-emergency-title">This may be a medical emergency — call now</div>
                          <div style={{ fontSize: 12.5, color: 'var(--pc-danger-text-mid)', marginTop: 1 }}>Detected: <em>"took too many"</em> + medication overdose pattern</div>
                        </div>
                      </div>
                      <div className="pc-emergency-body">
                        Aspirin overdose can cause salicylate toxicity — symptoms include rapid breathing, ringing in ears, confusion, and vomiting. <strong>Do not wait for symptoms.</strong> Contact emergency services or poison control immediately.
                      </div>

                      <div className="pc-emergency-table">
                        <div className="pc-emergency-row"><span>Emergency (Jordan)</span><span className="num">911</span></div>
                        <div className="pc-emergency-row"><span>Civil Defense (Jordan)</span><span className="num">911</span></div>
                        <div className="pc-emergency-row"><span>International emergency</span><span className="num">112</span></div>
                        <div className="pc-emergency-row"><span>Poison Control (Jordan)</span><span className="num">+962 6 5530000</span></div>
                        <div className="pc-emergency-row"><span>US Poison Control</span><span className="num">1-800-222-1222</span></div>
                      </div>

                      <div style={{ marginTop: 14, fontSize: 13, color: 'var(--pc-danger-text-strong)' }}>
                        <strong>While waiting for help:</strong> Keep the patient awake, do not induce vomiting unless instructed, and have the medication packaging ready to show responders.
                      </div>
                    </div>

                    <div style={{ marginTop: 14, fontSize: 12, color: 'var(--pc-text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="alert" size={12}/>
                      Emergency replies are returned instantly without consulting the LLM — to prevent any delay in critical situations.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pc-composer">
              <div className="pc-composer-inner">
                <div className="pc-composer-box">
                  <textarea className="pc-composer-input" placeholder="Reply or describe the situation in more detail…"/>
                  <div className="pc-composer-row">
                    <button className="pc-btn pc-btn-ghost pc-btn-sm pc-btn-icon"><Icon name="paperclip" size={14}/></button>
                    <span className="pc-composer-hint" style={{ color: 'var(--pc-danger)' }}>If life-threatening, call emergency services before continuing here</span>
                    <button className="pc-send-btn"><Icon name="send" size={14} stroke={2}/></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </Frame>
);

/* User chat — empty-state variant on first launch */
const UserChatEmptyScreen = () => (
  <Frame label="09 User Chat (empty)">
    <div className="pc-shell">
      <Sidebar active="chat" role="user" name="Ahmad Y." initials="AY"/>
      <main className="pc-main" style={{ background: 'var(--pc-bg)' }}>
        <div className="pc-chat-shell">
          <div className="pc-chat-sidebar">
            <div className="pc-chat-sidebar-head">
              <button className="pc-new-chat"><Icon name="plus" size={14} stroke={2.2}/> New conversation</button>
            </div>
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
              <div>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--pc-surface-3)', color: 'var(--pc-text-3)', margin: '0 auto 10px', display: 'grid', placeItems: 'center' }}>
                  <Icon name="chat" size={20}/>
                </div>
                <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--pc-text-2)' }}>No conversations yet</div>
                <div style={{ fontSize: 12, color: 'var(--pc-text-3)', marginTop: 2 }}>Your chat history will appear here</div>
              </div>
            </div>
          </div>

          <div className="pc-chat-main">
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 32 }}>
              <div style={{ maxWidth: 580, width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--pc-primary)', color: 'white', margin: '0 auto 18px', display: 'grid', placeItems: 'center' }}>
                    <Icon name="pill" size={26} color="white" stroke={2}/>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>Hi Ahmad — how can I help?</div>
                  <div style={{ fontSize: 14.5, color: 'var(--pc-text-2)', maxWidth: 460, margin: '0 auto', lineHeight: 1.55 }}>
                    Ask anything about your medications. I answer in Arabic or English using your pharmacy's verified PDFs — and cite the source on every reply.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  {[
                    ['What can I take with Aspirin for a headache?', 'Drug interactions'],
                    ['Maximum daily dose of paracetamol', 'Dosage limits'],
                    ['كيف أخزن الإنسولين في الصيف؟', 'Storage in Arabic'],
                    ['Side effects of antibiotics on the stomach', 'Side effects'],
                  ].map(([q, tag]) => (
                    <div key={q} style={{ background: 'var(--pc-surface)', border: '1px solid var(--pc-border)', borderRadius: 11, padding: 14, cursor: 'pointer', transition: 'border-color .12s' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--pc-primary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>{tag}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--pc-text)', lineHeight: 1.4 }}>{q}</div>
                    </div>
                  ))}
                </div>

                <div className="pc-composer-box" style={{ padding: '14px 14px 12px' }}>
                  <textarea className="pc-composer-input" placeholder="Ask about a medication, dosage, or interaction…"/>
                  <div className="pc-composer-row">
                    <button className="pc-btn pc-btn-ghost pc-btn-sm pc-btn-icon"><Icon name="paperclip" size={14}/></button>
                    <span className="pc-composer-hint">In Arabic or English · we'll cite the source</span>
                    <button className="pc-send-btn"><Icon name="send" size={14} stroke={2}/></button>
                  </div>
                </div>

                <div style={{ marginTop: 18, padding: 12, background: 'var(--pc-warn-soft)', border: '1px solid var(--pc-warn-border)', borderRadius: 10, fontSize: 12.5, color: 'var(--pc-warn-text)', display: 'flex', gap: 10 }}>
                  <Icon name="alert" size={14}/>
                  <div>Aspira does not diagnose. Always consult a licensed pharmacist or doctor before making medical decisions.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </Frame>
);

Object.assign(window, { ChatScreen, ChatEmergencyScreen, UserChatEmptyScreen });
