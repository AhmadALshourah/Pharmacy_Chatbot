import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import Icon from '../components/ui/Icon';
import { streamChat, getSessions, deleteSession, getSessionMessages, getUserSessionSupport, sendUserSupportReply } from '../services/api';

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

// C1: escape HTML special chars BEFORE applying any markup so LLM/PDF
// content can never inject executable scripts via dangerouslySetInnerHTML.
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function Message({ msg, initials }) {
  const isUser      = msg.role === 'user';
  const isEmergency = msg.emergency;
  const isStreaming  = msg.streaming;

  // Escape first, then apply safe markup (bold + line-breaks only)
  const htmlContent = escapeHtml(msg.content || '')
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
            {/* Attached images render above the text so the question reads in order */}
            {msg.images?.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6,
                marginBottom: msg.content ? 8 : 0,
              }}>
                {msg.images.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'block', lineHeight: 0,
                      border: '1px solid var(--pc-border)', borderRadius: 8,
                      overflow: 'hidden', maxWidth: 160, maxHeight: 160,
                    }}
                    title="Open full size"
                  >
                    <img
                      src={src}
                      alt={`attachment ${i + 1}`}
                      style={{ display: 'block', maxWidth: 160, maxHeight: 160, objectFit: 'cover' }}
                    />
                  </a>
                ))}
              </div>
            )}
            <span dangerouslySetInnerHTML={{ __html: htmlContent }} />
            {isStreaming && (
              <span style={{ display: 'inline-block', width: 8, height: 15, background: 'var(--pc-primary)', verticalAlign: 'text-bottom', marginLeft: 2, borderRadius: 1, animation: 'blink .7s step-end infinite' }} />
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Image attachment limits (mirror backend config.py) ───────────────────────
const MAX_IMAGES_PER_MESSAGE = 3;
const MAX_IMAGE_BYTES        = 4 * 1024 * 1024;
const ALLOWED_IMAGE_MIME     = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ── Main Chat Page ────────────────────────────────────────────────────────────

export default function ChatPage({ userRole = false }) {
  const { principal } = useAuth();
  // M1: flattened the triple-nested ternary into two readable checks
  const isUserPrincipal = userRole || principal?.principalType === 'user';
  const role     = isUserPrincipal ? 'user' : (principal?.role ?? 'admin');
  const name     = principal?.username ?? 'User';
  const initials = name.slice(0, 2).toUpperCase();

  const [sessions,          setSessions]          = useState([]);
  const [sessionFilter,     setSessionFilter]      = useState('');  // H18
  const [chatSidebarOpen,   setChatSidebarOpen]   = useState(false); // L3: mobile toggle
  const [activeSession,     setActiveSession]      = useState(null);
  const [currentSessionId,  setCurrentSessionId]   = useState(null);
  const [messages,          setMessages]           = useState([]);
  const [input,             setInput]              = useState('');
  const [streaming,         setStreaming]          = useState(false);

  // Pending image attachments for the next outgoing message.
  // Each entry: { id, dataUrl, name, size, type }
  const [attachments,       setAttachments]        = useState([]);
  const [attachError,       setAttachError]        = useState('');
  const fileInputRef = useRef(null);

  // Support thread state (user side only)
  const [supportMsgs,       setSupportMsgs]       = useState([]);
  const [showSupport,       setShowSupport]       = useState(false);
  const [supportReply,      setSupportReply]      = useState('');
  const [sendingSupport,    setSendingSupport]    = useState(false);
  const supportThreadRef = useRef(null);

  const threadRef      = useRef(null);
  // H11: use a ref so handleSend always reads the latest messages without stale closure
  const messagesRef    = useRef([]);
  // H13: AbortController ref so we can truly cancel the underlying fetch
  const abortCtrlRef   = useRef(null);
  // H12: track which session the active stream belongs to
  const streamingForId = useRef(null);

  // Keep messagesRef in sync with state (H11)
  useEffect(() => { messagesRef.current = messages; }, [messages]);

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
    abortStream();              // H13: cancel any in-progress stream before switching
    setChatSidebarOpen(false);  // L3: auto-close mobile sidebar on selection
    setActiveSession(session);
    setCurrentSessionId(session.id);
    try {
      const msgs = await getSessionMessages(session.id);
      const fmt = msgs.map(m => ({
        id:         `hist-${m.id}`,   // H15: stable key from DB id
        role:       m.role,
        content:    m.content,
        images:     Array.isArray(m.images) ? m.images : [],
        senderName: m.role === 'user' ? name : 'Aspira',
        initials,
        time: new Date(m.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: false,
        }),
      }));
      setMessages(fmt);

      // Load support thread for users
      if (isUserPrincipal) {
        try {
          const support = await getUserSessionSupport(session.id);
          setSupportMsgs(support || []);
          setShowSupport((support || []).length > 0);
        } catch { setSupportMsgs([]); }
      }
    } catch { /* noop — show empty chat if messages fail to load; user can retry by re-selecting */
      setMessages([]);
    }
  }

  // Abort any in-progress stream (H13)
  function abortStream() {
    abortCtrlRef.current?.abort();
    abortCtrlRef.current = null;
  }

  // New conversation
  function handleNewSession() {
    abortStream();
    setActiveSession(null);
    setCurrentSessionId(null);
    setMessages([]);
    setStreaming(false);
    setSupportMsgs([]);
    setShowSupport(false);
    setSupportReply('');
    setAttachments([]);
    setAttachError('');
  }

  // ── Image attachment handlers ──────────────────────────────────────────────
  async function handleSelectFiles(e) {
    const files = Array.from(e.target.files || []);
    // Always reset the input so the same file can be picked again later
    e.target.value = '';
    if (!files.length) return;

    setAttachError('');
    const accepted = [];
    let firstError = '';

    for (const file of files) {
      if (attachments.length + accepted.length >= MAX_IMAGES_PER_MESSAGE) {
        firstError = `You can attach at most ${MAX_IMAGES_PER_MESSAGE} images per message.`;
        break;
      }
      if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
        firstError ||= `"${file.name}" is not a supported image type.`;
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        firstError ||= `"${file.name}" is too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)} MB).`;
        continue;
      }
      try {
        const dataUrl = await readFileAsDataURL(file);
        accepted.push({
          id:      `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dataUrl,
          name:    file.name,
          size:    file.size,
          type:    file.type,
        });
      } catch {
        firstError ||= `Could not read "${file.name}".`;
      }
    }

    if (accepted.length) setAttachments(prev => [...prev, ...accepted]);
    if (firstError)      setAttachError(firstError);
  }

  function removeAttachment(id) {
    setAttachments(prev => prev.filter(a => a.id !== id));
    setAttachError('');
  }

  function openFilePicker() {
    setAttachError('');
    fileInputRef.current?.click();
  }

  // User sends support reply
  async function handleSendSupportReply(e) {
    e.preventDefault();
    const text = supportReply.trim();
    if (!text || !activeSession) return;
    setSendingSupport(true);
    try {
      const msg = await sendUserSupportReply(activeSession.id, text);
      setSupportMsgs(prev => [...prev, msg]);
      setSupportReply('');
      if (supportThreadRef.current) {
        supportThreadRef.current.scrollTop = supportThreadRef.current.scrollHeight;
      }
    } catch { /* noop */ } finally {
      setSendingSupport(false);
    }
  }

  // Delete a session
  async function handleDeleteSession(e, sessionId) {
    e.stopPropagation();
    // L7: guard against accidental single-click deletion of entire history
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) handleNewSession();
    } catch { /* noop — session already removed or network error; UI is already updated */ }
  }

  // Send message with real-time SSE streaming
  async function handleSend() {
    const text = input.trim();
    const outgoingImages = attachments.map(a => a.dataUrl);
    // Allow image-only sends as long as there's *some* text — the backend
    // requires a non-empty message field (Pydantic min_length=1)
    if (!text || streaming) return;

    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    // H11: read history from ref — never stale even if state hasn't re-rendered
    const history = messagesRef.current.map(m => ({
      role: m.role,
      content: m.content,
      images: Array.isArray(m.images) ? m.images : [],
    }));

    // H15: stable string id on every message so React doesn't re-use DOM nodes
    const msgId   = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const userMsg = {
      id: msgId(), role: 'user', content: text,
      images: outgoingImages,
      senderName: name, initials, time: now,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setAttachError('');
    setStreaming(true);

    // H13: create a fresh AbortController for this stream
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    // H12: record which session this stream is for
    const thisSessionId = currentSessionId;
    streamingForId.current = thisSessionId;

    const placeholderId = msgId();
    const botPlaceholder = { id: placeholderId, role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, botPlaceholder]);

    const startMs = Date.now();

    try {
      for await (const event of streamChat(text, thisSessionId, history, ctrl.signal, outgoingImages)) {
        // H12: if the user switched sessions, stop writing to old message list
        if (streamingForId.current !== thisSessionId) break;

        if (event.token !== undefined) {
          setMessages(prev => {
            const msgs = [...prev];
            const idx = msgs.findLastIndex(m => m.id === placeholderId);
            if (idx !== -1) msgs[idx] = { ...msgs[idx], content: event.token };
            return msgs;
          });
        }

        if (event.done) {
          const elapsed = ((Date.now() - startMs) / 1000).toFixed(2) + 's';
          const doneTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

          setMessages(prev => {
            const msgs = [...prev];
            const idx = msgs.findLastIndex(m => m.id === placeholderId);
            if (idx !== -1) msgs[idx] = {
              id:        placeholderId,
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

          if (event.session_id != null) {
            setCurrentSessionId(event.session_id);
            setActiveSession(s => s ?? { id: event.session_id, title: text.slice(0, 60) });
          }

          loadSessions();
        }

        if (event.error) throw new Error(event.error);
      }
    } catch (err) {
      // AbortError is expected when the user navigates away — swallow silently
      if (err.name === 'AbortError') return;
      const errTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      setMessages(prev => {
        const msgs = [...prev];
        const idx = msgs.findLastIndex(m => m.id === placeholderId);
        if (idx !== -1) msgs[idx] = {
          id: placeholderId, role: 'assistant',
          content: `Error: ${err.message}`, streaming: false, time: errTime,
        };
        return msgs;
      });
    } finally {
      setStreaming(false);
      if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
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

  // ── Composer helpers shared by empty-state + main composer ───────────────
  const attachLimitReached = attachments.length >= MAX_IMAGES_PER_MESSAGE;

  const attachmentPreviews = (attachments.length > 0 || attachError) && (
    <div style={{ marginBottom: 8 }}>
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {attachments.map(a => (
            <div
              key={a.id}
              style={{
                position: 'relative',
                border: '1px solid var(--pc-border)',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--pc-surface-2)',
              }}
            >
              <img
                src={a.dataUrl}
                alt={a.name}
                title={`${a.name} · ${(a.size / 1024).toFixed(0)} KB`}
                style={{ display: 'block', width: 56, height: 56, objectFit: 'cover' }}
              />
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => removeAttachment(a.id)}
                style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', color: 'white',
                  border: 0, cursor: 'pointer', padding: 0,
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Icon name="x" size={11} color="white" stroke={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}
      {attachError && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--pc-danger)' }}>
          {attachError}
        </div>
      )}
    </div>
  );

  const renderAttachButton = (extraStyle = {}) => (
    <button
      type="button"
      className="pc-send-btn"
      onClick={openFilePicker}
      disabled={streaming || attachLimitReached}
      title={attachLimitReached
        ? `Max ${MAX_IMAGES_PER_MESSAGE} images per message`
        : 'Attach image (PNG, JPG, WEBP, GIF — up to 4 MB)'}
      style={{
        background: 'transparent',
        color: 'var(--pc-text-2)',
        border: '1px solid var(--pc-border)',
        ...extraStyle,
      }}
    >
      <Icon name="image" size={14} stroke={2} />
    </button>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      {/* Hidden file picker shared by both composer instances */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME.join(',')}
        multiple
        onChange={handleSelectFiles}
        style={{ display: 'none' }}
      />
      <div className="pc-shell">
        <Sidebar active="chat" role={role} name={name} initials={initials} />

        <main className="pc-main" style={{ background: 'var(--pc-bg)' }}>
          <div className="pc-chat-shell">

            {/* L3: mobile overlay — tap to close chat sessions sidebar */}
            {chatSidebarOpen && (
              <div
                onClick={() => setChatSidebarOpen(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 199,
                  background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
                }}
              />
            )}

            {/* ── Session list sidebar ── */}
            <div className={`pc-chat-sidebar${chatSidebarOpen ? ' pc-chat-sidebar-open' : ''}`}>
              <div className="pc-chat-sidebar-head">
                <button className="pc-new-chat" onClick={handleNewSession}>
                  <Icon name="plus" size={14} stroke={2.2} /> New conversation
                </button>
                <div style={{ position: 'relative', marginTop: 10 }}>
                  {/* H18: wired filter state */}
                  <input
                    className="pc-input"
                    placeholder="Search history…"
                    value={sessionFilter}
                    onChange={e => setSessionFilter(e.target.value)}
                    style={{ height: 34, fontSize: 12.5, paddingLeft: 32 }}
                  />
                  <div style={{ position: 'absolute', left: 10, top: 9, color: 'var(--pc-text-3)' }}>
                    <Icon name="search" size={14} />
                  </div>
                </div>
              </div>

              <div className="pc-chat-sessions">
                {/* H18: filter sessions by title */}
                {(() => {
                  const visible = sessionFilter
                    ? sessions.filter(s =>
                        (s.title || '').toLowerCase().includes(sessionFilter.toLowerCase())
                      )
                    : sessions;
                  return visible.length === 0 ? (
                  <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
                    <div>
                      <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--pc-surface-3)', color: 'var(--pc-text-3)', margin: '0 auto 10px', display: 'grid', placeItems: 'center' }}>
                        <Icon name="chat" size={20} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--pc-text-2)' }}>
                        {sessionFilter ? 'No matches' : 'No conversations yet'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--pc-text-3)', marginTop: 2 }}>
                        {sessionFilter ? 'Try a different search term' : 'Your chat history will appear here'}
                      </div>
                    </div>
                  </div>
                ) : (
                  visible.map(s => (
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
                ); })()}
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
                      {attachmentPreviews}
                      <textarea
                        className="pc-composer-input"
                        placeholder="Ask about a medication, dosage, or interaction…"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                      />
                      <div className="pc-composer-row">
                        <span className="pc-composer-hint">In Arabic or English · attach a photo of a medication if needed</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {renderAttachButton()}
                          <button className="pc-send-btn" onClick={handleSend} disabled={!input.trim() || streaming}>
                            <Icon name="send" size={14} stroke={2} />
                          </button>
                        </div>
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
                    {/* L3: hamburger visible only on mobile (≤640px) */}
                    <button
                      className="pc-hamburger"
                      onClick={() => setChatSidebarOpen(true)}
                      aria-label="Open sessions"
                      style={{ marginRight: 4 }}
                    >
                      <Icon name="menu" size={16} />
                    </button>
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="pc-pill"><Icon name="sparkle" size={12} /> gpt-4o-mini</span>
                      {/* Support button — visible only for user role when session is active */}
                      {isUserPrincipal && activeSession && (
                        <button
                          className={`pc-btn pc-btn-ghost pc-btn-sm${showSupport ? '' : ''}`}
                          title="Support thread with admin"
                          onClick={() => setShowSupport(s => !s)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 12, padding: '0 8px', height: 28,
                            color: showSupport ? 'var(--pc-primary)' : 'var(--pc-text-3)',
                            border: '1px solid var(--pc-border)',
                            borderColor: showSupport ? 'var(--pc-primary)' : 'var(--pc-border)',
                          }}
                        >
                          <Icon name="messageCircle" size={13} />
                          Support{supportMsgs.length > 0 ? ` (${supportMsgs.length})` : ''}
                        </button>
                      )}
                      {!isUserPrincipal && (
                        <button
                          className="pc-btn pc-btn-ghost pc-btn-icon"
                          title="Delete conversation"
                          onClick={e => {
                            if (currentSessionId) handleDeleteSession(e, currentSessionId);
                          }}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Thread */}
                  <div className="pc-chat-thread" ref={threadRef}>
                    <div className="pc-chat-inner">
                      {/* H15: key on stable msg.id, not array index */}
                      {messages.map(msg => (
                        <Message key={msg.id} msg={msg} initials={initials} />
                      ))}
                    </div>
                  </div>

                  {/* Support thread panel — user only */}
                  {isUserPrincipal && showSupport && activeSession && (
                    <div style={{
                      borderTop: '1px solid var(--pc-border)',
                      background: 'var(--pc-surface)',
                      flexShrink: 0, maxHeight: 260, display: 'flex', flexDirection: 'column',
                    }}>
                      {/* Support header */}
                      <div style={{
                        padding: '8px 16px', borderBottom: '1px solid var(--pc-border)',
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12.5, fontWeight: 600, color: 'var(--pc-primary)',
                        flexShrink: 0,
                      }}>
                        <Icon name="messageCircle" size={13} />
                        Support Thread
                        <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--pc-text-3)', marginLeft: 'auto' }}>
                          Messages from the admin team
                        </span>
                      </div>

                      {/* Support messages */}
                      <div ref={supportThreadRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
                        {supportMsgs.length === 0 ? (
                          <div style={{ fontSize: 12.5, color: 'var(--pc-text-3)', textAlign: 'center', padding: '8px 0' }}>
                            No messages from the admin team yet.
                          </div>
                        ) : supportMsgs.map(m => {
                          const isAdmin  = m.sender_type === 'admin';
                          const isMyReply = !isAdmin;
                          return (
                            <div key={m.id} style={{
                              display: 'flex', gap: 8,
                              flexDirection: isMyReply ? 'row-reverse' : 'row',
                              alignItems: 'flex-end', marginBottom: 8,
                            }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                background: isAdmin ? 'var(--pc-primary)' : 'var(--pc-role-user)',
                                color: 'white', display: 'grid', placeItems: 'center',
                                fontSize: 10, fontWeight: 600,
                              }}>
                                {m.sender_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{
                                maxWidth: '70%',
                                background: isMyReply ? 'var(--pc-primary)' : 'var(--pc-surface-2)',
                                color: isMyReply ? 'white' : 'var(--pc-text)',
                                borderRadius: isMyReply ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                padding: '6px 10px', fontSize: 13, lineHeight: 1.45,
                                border: isMyReply ? 'none' : '1px solid var(--pc-border)',
                              }}>
                                {!isMyReply && (
                                  <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--pc-primary)', marginBottom: 2 }}>
                                    {m.sender_name}
                                  </div>
                                )}
                                {m.content}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Reply input */}
                      <form onSubmit={handleSendSupportReply} style={{
                        padding: '8px 12px', borderTop: '1px solid var(--pc-border)',
                        display: 'flex', gap: 6, flexShrink: 0,
                      }}>
                        <input
                          className="pc-input"
                          placeholder="Reply to admin…"
                          value={supportReply}
                          onChange={e => setSupportReply(e.target.value)}
                          style={{ flex: 1, height: 32, fontSize: 13 }}
                          disabled={sendingSupport}
                        />
                        <button
                          type="submit"
                          className="pc-btn pc-btn-primary pc-btn-icon"
                          disabled={sendingSupport || !supportReply.trim()}
                          style={{ height: 32, width: 32, flexShrink: 0 }}
                        >
                          <Icon name="send" size={13} />
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Composer */}
                  <div className="pc-composer">
                    <div className="pc-composer-inner">
                      <div className="pc-composer-box">
                        {attachmentPreviews}
                        <textarea
                          className="pc-composer-input"
                          placeholder="Ask about medications, interactions, dosage… (Arabic or English)"
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          rows={1}
                        />
                        <div className="pc-composer-row">
                          <span className="pc-composer-hint">Shift + Enter for new line · 2000 char max · attach up to {MAX_IMAGES_PER_MESSAGE} images</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {renderAttachButton()}
                            <button className="pc-send-btn" onClick={handleSend} disabled={!input.trim() || streaming}>
                              <Icon name="send" size={14} stroke={2} />
                            </button>
                          </div>
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

    </div>
  );
}
