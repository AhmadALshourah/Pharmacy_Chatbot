import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import Icon from '../components/ui/Icon';
import { streamChat, getSessions, deleteSession, getSessionMessages } from '../services/api';

// ── Source pills ──────────────────────────────────────────────────────────────

function SourcePills({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="pc-sources">
      <span className="pc-sources-label">Sources</span>
      {sources.map(s => (
        <span key={s} className="pc-source-pill">
          <Icon name="file" size={11} /> {s}
        </span>
      ))}
    </div>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────────

function Message({ msg, initials }) {
  const isUser      = msg.role === 'user';
  const isEmergency = msg.emergency;
  const isStreaming  = msg.streaming;

  const htmlContent = (msg.content || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  return (
    <div className="pc-msg">
      <div
        className={`pc-msg-avatar ${isUser ? 'user' : 'bot'}`}
        style={isEmergency ? { background: 'var(--pc-danger)' } : undefined}
      >
        {isUser
          ? (initials || 'U')
          : isEmergency
          ? <Icon name="alert"  size={14} color="white" stroke={2.4} />
          : <Icon name="pill"   size={14} color="white" stroke={2.2} />
        }
      </div>

      <div className="pc-msg-body">
        <div className="pc-msg-name" style={isEmergency ? { color: 'var(--pc-danger)' } : undefined}>
          {isUser ? (msg.senderName || 'You') : 'Aspira'}
          {msg.time && (
            <span className="pc-msg-time">
              {msg.time}
              {msg.elapsed && ` · ${msg.elapsed}`}
              {isEmergency && ' · bypassing LLM'}
            </span>
          )}
          {isStreaming && (
            <span className="pc-msg-time" style={{ color: 'var(--pc-primary)' }}>● streaming…</span>
          )}
        </div>

        {isEmergency ? (
          <div className="pc-emergency">
            <div className="pc-emergency-head">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--pc-danger)', color: 'white', display: 'grid', placeItems: 'center' }}>
                <Icon name="siren" size={18} stroke={2} />
              </div>
              <div>
                <div className="pc-emergency-title">This may be a medical emergency — call now</div>
                <div style={{ fontSize: 12.5, color: 'var(--pc-danger-text-mid)', marginTop: 1 }}>
                  Emergency keywords detected
                </div>
              </div>
            </div>
            <div className="pc-emergency-body" dangerouslySetInnerHTML={{ __html: htmlContent }} />
            <div className="pc-emergency-table">
              <div className="pc-emergency-row"><span>Emergency (Jordan)</span><span className="num">911</span></div>
              <div className="pc-emergency-row"><span>International emergency</span><span className="num">112</span></div>
              <div className="pc-emergency-row"><span>Poison Control (Jordan)</span><span className="num">+962 6 5530000</span></div>
              <div className="pc-emergency-row"><span>US Poison Control</span><span className="num">1-800-222-1222</span></div>
            </div>
          </div>
        ) : (
          <div className="pc-msg-content">
            <span dangerouslySetInnerHTML={{ __html: htmlContent }} />
            {isStreaming && (
              <span style={{ display: 'inline-block', width: 8, height: 15, background: 'var(--pc-primary)', verticalAlign: 'text-bottom', marginLeft: 2, borderRadius: 1, animation: 'blink .7s step-end infinite' }} />
            )}
          </div>
        )}

        {!isUser && !isStreaming && msg.sources?.length > 0 && (
          <SourcePills sources={msg.sources} />
        )}
      </div>
    </div>
  );
}

// ── Main Chat Page ────────────────────────────────────────────────────────────

export default function ChatPage({ userRole = false }) {
  const { principal } = useAuth();
  const role      = userRole ? 'user' : (principal?.principalType === 'user' ? 'user' : (principal?.role ?? 'admin'));
  const name      = principal?.username ?? 'User';
  const initials  = name.slice(0, 2).toUpperCase();

  const [sessions,          setSessions]          = useState([]);
  const [activeSession,     setActiveSession]      = useState(null);
  const [currentSessionId,  setCurrentSessionId]   = useState(null);
  const [messages,          setMessages]           = useState([]);
  const [input,             setInput]              = useState('');
  const [streaming,         setStreaming]          = useState(false);

  const threadRef   = useRef(null);
  const abortRef    = useRef(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await getSessions();
      setSessions(data || []);
    } catch { /* noop — sidebar silently stays empty on network error */ }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Select a session and load its messages
  async function handleSelectSession(session) {
    if (activeSession?.id === session.id) return;
    setActiveSession(session);
    setCurrentSessionId(session.id);
    try {
      const msgs = await getSessionMessages(session.id);
      const fmt = msgs.map(m => ({
        role:       m.role,
        content:    m.content,
        senderName: m.role === 'user' ? name : 'Aspira',
        initials,
        time: new Date(m.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: false,
        }),
      }));
      setMessages(fmt);
    } catch {
      setMessages([]);
    }
  }

  // New conversation
  function handleNewSession() {
    setActiveSession(null);
    setCurrentSessionId(null);
    setMessages([]);
  }

  // Delete a session
  async function handleDeleteSession(e, sessionId) {
    e.stopPropagation();
    try {
      await deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) handleNewSession();
    } catch { /* noop */ }
  }

  // Send message with real-time SSE streaming
  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Append user message
    const userMsg = { role: 'user', content: text, senderName: name, initials, time: now };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    abortRef.current = false;

    // Build history from current messages (before the new user msg)
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    // Add a streaming placeholder for the bot response
    const botPlaceholder = { role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, botPlaceholder]);

    const startMs = Date.now();

    try {
      for await (const event of streamChat(text, currentSessionId, history)) {
        if (abortRef.current) break;

        if (event.token !== undefined) {
          // Update the streaming placeholder with accumulated content
          setMessages(prev => {
            const msgs = [...prev];
            msgs[msgs.length - 1] = { ...botPlaceholder, content: event.token };
            return msgs;
          });
        }

        if (event.done) {
          const elapsed = ((Date.now() - startMs) / 1000).toFixed(2) + 's';
          const doneTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

          setMessages(prev => {
            const msgs = [...prev];
            msgs[msgs.length - 1] = {
              role:      'assistant',
              content:   event.content ?? '',
              sources:   event.sources  ?? [],
              emergency: event.emergency ?? false,
              streaming: false,
              time:      doneTime,
              elapsed,
            };
            return msgs;
          });

          // Store the real session_id for subsequent messages
          if (event.session_id != null) {
            setCurrentSessionId(event.session_id);
            setActiveSession(s => s ?? { id: event.session_id, title: text.slice(0, 60) });
          }

          loadSessions();
        }

        if (event.error) throw new Error(event.error);
      }
    } catch (err) {
      const errTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = {
          role:     'assistant',
          content:  `Error: ${err.message}`,
          streaming: false,
          time:     errTime,
        };
        return msgs;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Prompt suggestions ──────────────────────────────────────────────────────
  const SUGGESTIONS = [
    ['What can I take with Aspirin for a headache?', 'Drug interactions'],
    ['Maximum daily dose of paracetamol',            'Dosage limits'],
    ['كيف أخزن الإنسولين في الصيف؟',                'Storage in Arabic'],
    ['Side effects of antibiotics on the stomach',  'Side effects'],
  ];

  const hasMessages  = messages.length > 0;
  const sessionTitle = activeSession?.title ?? (messages[0]?.content?.slice(0, 50) ?? 'New conversation');

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      <div className="pc-shell">
        <Sidebar active="chat" role={role} name={name} initials={initials} />

        <main className="pc-main" style={{ background: 'var(--pc-bg)' }}>
          <div className="pc-chat-shell">

            {/* ── Session list sidebar ── */}
            <div className="pc-chat-sidebar">
              <div className="pc-chat-sidebar-head">
                <button className="pc-new-chat" onClick={handleNewSession}>
                  <Icon name="plus" size={14} stroke={2.2} /> New conversation
                </button>
                <div style={{ position: 'relative', marginTop: 10 }}>
                  <input
                    className="pc-input"
                    placeholder="Search history…"
                    style={{ height: 34, fontSize: 12.5, paddingLeft: 32 }}
                  />
                  <div style={{ position: 'absolute', left: 10, top: 9, color: 'var(--pc-text-3)' }}>
                    <Icon name="search" size={14} />
                  </div>
                </div>
              </div>

              <div className="pc-chat-sessions">
                {sessions.length === 0 ? (
                  <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
                    <div>
                      <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--pc-surface-3)', color: 'var(--pc-text-3)', margin: '0 auto 10px', display: 'grid', placeItems: 'center' }}>
                        <Icon name="chat" size={20} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--pc-text-2)' }}>No conversations yet</div>
                      <div style={{ fontSize: 12, color: 'var(--pc-text-3)', marginTop: 2 }}>Your chat history will appear here</div>
                    </div>
                  </div>
                ) : (
                  sessions.map(s => (
                    <div
                      key={s.id}
                      className={`pc-session${activeSession?.id === s.id ? ' active' : ''}`}
                      onClick={() => handleSelectSession(s)}
                    >
                      <span className="pc-session-text">{s.title || 'Untitled'}</span>
                      <span className="pc-session-del" onClick={e => handleDeleteSession(e, s.id)}>
                        <Icon name="trash" size={13} color="var(--pc-text-3)" />
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Chat main area ── */}
            <div className="pc-chat-main">
              {!hasMessages ? (
                /* Empty / welcome state */
                <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 32 }}>
                  <div style={{ maxWidth: 580, width: '100%' }}>
                    <div style={{ textAlign: 'center', marginBottom: 36 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--pc-primary)', color: 'white', margin: '0 auto 18px', display: 'grid', placeItems: 'center' }}>
                        <Icon name="pill" size={26} color="white" stroke={2} />
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>
                        Hi {name} — how can I help?
                      </div>
                      <div style={{ fontSize: 14.5, color: 'var(--pc-text-2)', maxWidth: 460, margin: '0 auto', lineHeight: 1.55 }}>
                        Ask anything about medications. I answer in Arabic or English using your pharmacy's verified PDFs — and cite the source on every reply.
                      </div>
                    </div>

                    {/* Suggestion cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                      {SUGGESTIONS.map(([q, tag]) => (
                        <div
                          key={q}
                          onClick={() => setInput(q)}
                          style={{ background: 'var(--pc-surface)', border: '1px solid var(--pc-border)', borderRadius: 11, padding: 14, cursor: 'pointer', transition: 'border-color .12s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--pc-primary)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--pc-border)'}
                        >
                          <div style={{ fontSize: 10.5, color: 'var(--pc-primary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>{tag}</div>
                          <div style={{ fontSize: 13.5, color: 'var(--pc-text)', lineHeight: 1.4 }}>{q}</div>
                        </div>
                      ))}
                    </div>

                    {/* Inline composer */}
                    <div className="pc-composer-box" style={{ padding: '14px 14px 12px' }}>
                      <textarea
                        className="pc-composer-input"
                        placeholder="Ask about a medication, dosage, or interaction…"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                      />
                      <div className="pc-composer-row">
                        <span className="pc-composer-hint">In Arabic or English · we'll cite the source</span>
                        <button className="pc-send-btn" onClick={handleSend} disabled={!input.trim() || streaming}>
                          <Icon name="send" size={14} stroke={2} />
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 18, padding: 12, background: 'var(--pc-warn-soft)', border: '1px solid var(--pc-warn-border)', borderRadius: 10, fontSize: 12.5, color: 'var(--pc-warn-text)', display: 'flex', gap: 10 }}>
                      <Icon name="alert" size={14} />
                      <div>Aspira does not diagnose. Always consult a licensed pharmacist or doctor before making medical decisions.</div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="pc-chat-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--pc-primary-soft)', color: 'var(--pc-primary)', display: 'grid', placeItems: 'center' }}>
                        <Icon name="chat" size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{sessionTitle}</div>
                        <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>
                          {messages.length} message{messages.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className="pc-pill"><Icon name="sparkle" size={12} /> gpt-4o-mini</span>
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-icon"
                        title="Delete conversation"
                        onClick={e => currentSessionId && handleDeleteSession(e, currentSessionId)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Thread */}
                  <div className="pc-chat-thread" ref={threadRef}>
                    <div className="pc-chat-inner">
                      {messages.map((msg, i) => (
                        <Message key={i} msg={msg} initials={initials} />
                      ))}
                    </div>
                  </div>

                  {/* Composer */}
                  <div className="pc-composer">
                    <div className="pc-composer-inner">
                      <div className="pc-composer-box">
                        <textarea
                          className="pc-composer-input"
                          placeholder="Ask about medications, interactions, dosage… (Arabic or English)"
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          rows={1}
                        />
                        <div className="pc-composer-row">
                          <span className="pc-composer-hint">Shift + Enter for new line · 2000 char max</span>
                          <button className="pc-send-btn" onClick={handleSend} disabled={!input.trim() || streaming}>
                            <Icon name="send" size={14} stroke={2} />
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, color: 'var(--pc-text-3)' }}>
                        Aspira retrieves answers from indexed PDFs · Always verify with a licensed pharmacist
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </main>
      </div>

      <style>{`
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
      `}</style>
    </div>
  );
}
