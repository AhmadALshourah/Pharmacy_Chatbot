import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import Icon from '../components/ui/Icon';
import { useToast } from '../contexts/ToastContext';
import { useCurrentPrincipal } from '../hooks/useCurrentPrincipal';
import {
  getAdminConversations,
  getAdminConversationMessages,
  getAdminConversationSupport,
  sendAdminSupportMessage,
} from '../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function userInitials(username) {
  return (username || 'U').slice(0, 2).toUpperCase();
}

// ── Session list item ─────────────────────────────────────────────────────────

function SessionItem({ session, selected, onClick }) {
  const ini = userInitials(session.username);
  return (
    <div
      onClick={() => onClick(session)}
      style={{
        display: 'flex', gap: 10, alignItems: 'center',
        padding: '10px 14px', cursor: 'pointer',
        borderBottom: '1px solid var(--pc-border)',
        background: selected ? 'var(--pc-surface-2)' : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--pc-hover)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div
        style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: 'var(--pc-role-user)', color: 'white',
          display: 'grid', placeItems: 'center',
          fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
        }}
      >
        {ini}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pc-text)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{session.username}</span>
          <span style={{ fontSize: 11, color: 'var(--pc-text-3)', fontWeight: 400, flexShrink: 0, marginLeft: 6 }}>
            {relativeTime(session.updated_at)}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: 'var(--pc-text-3)', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {session.title}
        </div>
      </div>
    </div>
  );
}

// ── AI conversation message bubble (read-only) ────────────────────────────────

function ConvMessage({ msg }) {
  const isUser = msg.role === 'user';
  const html   = escapeHtml(msg.content || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  return (
    <div className="pc-msg">
      <div className={`pc-msg-avatar ${isUser ? 'user' : 'bot'}`}>
        {isUser
          ? userInitials(msg.senderName || '')
          : <Icon name="pill" size={14} color="white" stroke={2.2} />
        }
      </div>
      <div className="pc-msg-body">
        <div className="pc-msg-name">
          {isUser ? (msg.senderName || 'User') : 'Aspira'}
          {msg.time && <span className="pc-msg-time">{msg.time}</span>}
        </div>
        <div className="pc-msg-content">
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}

// ── Support chat bubble ───────────────────────────────────────────────────────

function SupportMessage({ msg, currentAdminUsername }) {
  const isMine = msg.sender_type === 'admin' && msg.sender_name === currentAdminUsername;
  const ini    = userInitials(msg.sender_name);
  const bgColor = msg.sender_type === 'admin' ? 'var(--pc-primary)' : 'var(--pc-role-user)';

  return (
    <div style={{
      display: 'flex', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row',
      alignItems: 'flex-start', marginBottom: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: bgColor, color: 'white',
        display: 'grid', placeItems: 'center',
        fontSize: 11, fontWeight: 600,
      }}>
        {ini}
      </div>
      <div style={{ maxWidth: '70%' }}>
        <div style={{
          fontSize: 11, color: 'var(--pc-text-3)', marginBottom: 3,
          textAlign: isMine ? 'right' : 'left',
        }}>
          {msg.sender_name}
          <span style={{ marginLeft: 6 }}>
            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        </div>
        <div style={{
          background: isMine ? 'var(--pc-primary)' : 'var(--pc-surface-2)',
          color: isMine ? 'white' : 'var(--pc-text)',
          borderRadius: isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          padding: '8px 12px', fontSize: 13.5, lineHeight: 1.5,
          border: isMine ? 'none' : '1px solid var(--pc-border)',
        }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyDetail() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      color: 'var(--pc-text-3)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: 'var(--pc-surface-2)', border: '1px solid var(--pc-border)',
        display: 'grid', placeItems: 'center',
      }}>
        <Icon name="inbox" size={22} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pc-text-2)' }}>
        Select a conversation
      </div>
      <div style={{ fontSize: 12.5, textAlign: 'center', maxWidth: 220 }}>
        Pick a user session on the left to view the full conversation and send support messages.
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const { role, name, initials, admin } = useCurrentPrincipal();
  const toast = useToast();

  const [sessions,        setSessions]        = useState([]);
  const [filter,          setFilter]          = useState('');
  const [selected,        setSelected]        = useState(null);
  const [aiMessages,      setAiMessages]      = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);
  const [activeTab,       setActiveTab]       = useState('conversation');
  const [supportInput,    setSupportInput]    = useState('');
  const [sending,         setSending]         = useState(false);
  const [loadingDetail,   setLoadingDetail]   = useState(false);

  const convThreadRef    = useRef(null);
  const supportThreadRef = useRef(null);
  const supportInputRef  = useRef(null);

  // Auto-scroll AI thread
  useEffect(() => {
    if (convThreadRef.current) {
      convThreadRef.current.scrollTop = convThreadRef.current.scrollHeight;
    }
  }, [aiMessages, activeTab]);

  // Auto-scroll support thread
  useEffect(() => {
    if (supportThreadRef.current) {
      supportThreadRef.current.scrollTop = supportThreadRef.current.scrollHeight;
    }
  }, [supportMessages, activeTab]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await getAdminConversations();
      setSessions(data || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function handleSelectSession(session) {
    if (selected?.id === session.id) return;
    setSelected(session);
    setAiMessages([]);
    setSupportMessages([]);
    setActiveTab('conversation');
    setLoadingDetail(true);
    try {
      const [msgs, support] = await Promise.all([
        getAdminConversationMessages(session.id),
        getAdminConversationSupport(session.id),
      ]);
      setAiMessages(
        (msgs || []).map(m => ({
          ...m,
          senderName: m.role === 'user' ? session.username : 'Aspira',
          time: new Date(m.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false,
          }),
        }))
      );
      setSupportMessages(support || []);
    } catch {
      toast.error('Failed to load conversation.');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleSendSupport(e) {
    e.preventDefault();
    const text = supportInput.trim();
    if (!text || !selected) return;
    setSending(true);
    try {
      const msg = await sendAdminSupportMessage(selected.id, text);
      setSupportMessages(prev => [...prev, msg]);
      setSupportInput('');
      supportInputRef.current?.focus();
    } catch (err) {
      toast.error(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  function handleSupportKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendSupport(e);
    }
  }

  const filtered = sessions.filter(s =>
    s.username.toLowerCase().includes(filter.toLowerCase()) ||
    s.title.toLowerCase().includes(filter.toLowerCase())
  );

  const supportCount = supportMessages.length;

  return (
    <div className="pc-app" style={{ height: '100dvh', overflow: 'hidden' }}>
      <div className="pc-shell">
        <Sidebar active="conversations" role={role} name={name} initials={initials} />

        <main className="pc-main">
          <TopBar
            title="Conversations"
            sub={`${sessions.length} user session${sessions.length !== 1 ? 's' : ''}`}
          />

          {/* Split panel */}
          <div className="pc-content" style={{ overflow: 'hidden', padding: 0, display: 'flex' }}>

            {/* ── Left: session list ── */}
            <div style={{
              width: 300, flexShrink: 0,
              borderRight: '1px solid var(--pc-border)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Search */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pc-border)', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--pc-text-3)', pointerEvents: 'none',
                  }}>
                    <Icon name="search" size={13} />
                  </span>
                  <input
                    className="pc-input"
                    placeholder="Search user or session…"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 13, height: 32 }}
                  />
                </div>
              </div>

              {/* List */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <div style={{
                    padding: 24, textAlign: 'center',
                    color: 'var(--pc-text-3)', fontSize: 13,
                  }}>
                    {sessions.length === 0 ? 'No user conversations yet.' : 'No results.'}
                  </div>
                ) : filtered.map(s => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    selected={selected?.id === s.id}
                    onClick={handleSelectSession}
                  />
                ))}
              </div>
            </div>

            {/* ── Right: detail panel ── */}
            {!selected ? (
              <div style={{ flex: 1, display: 'flex' }}>
                <EmptyDetail />
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Detail header */}
                <div style={{
                  padding: '10px 16px', borderBottom: '1px solid var(--pc-border)',
                  display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                  background: 'var(--pc-surface)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--pc-role-user)', color: 'white',
                    display: 'grid', placeItems: 'center',
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {userInitials(selected.username)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--pc-text)' }}>
                      {selected.username}
                    </div>
                    <div style={{
                      fontSize: 11.5, color: 'var(--pc-text-3)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {selected.title}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--pc-text-3)', flexShrink: 0 }}>
                    {new Date(selected.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                </div>

                {/* Tabs */}
                <div style={{
                  display: 'flex', gap: 0, borderBottom: '1px solid var(--pc-border)',
                  flexShrink: 0, padding: '0 16px',
                }}>
                  {[
                    { key: 'conversation', label: 'AI Conversation', icon: 'chat' },
                    { key: 'support',      label: `Support${supportCount > 0 ? ` (${supportCount})` : ''}`, icon: 'messageCircle' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 4px', marginRight: 20,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                        color: activeTab === tab.key ? 'var(--pc-primary)' : 'var(--pc-text-3)',
                        borderBottom: activeTab === tab.key
                          ? '2px solid var(--pc-primary)'
                          : '2px solid transparent',
                        transition: 'color 0.12s',
                      }}
                    >
                      <Icon name={tab.icon} size={13} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {activeTab === 'conversation' ? (
                  <div ref={convThreadRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    {loadingDetail ? (
                      <div style={{ textAlign: 'center', color: 'var(--pc-text-3)', paddingTop: 40, fontSize: 13 }}>
                        Loading…
                      </div>
                    ) : aiMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--pc-text-3)', paddingTop: 40, fontSize: 13 }}>
                        No messages in this session.
                      </div>
                    ) : aiMessages.map(m => (
                      <ConvMessage key={m.id} msg={m} />
                    ))}
                  </div>
                ) : (
                  /* Support tab */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Support thread */}
                    <div ref={supportThreadRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                      {supportMessages.length === 0 ? (
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', height: '100%', gap: 10,
                          color: 'var(--pc-text-3)',
                        }}>
                          <Icon name="messageCircle" size={28} />
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--pc-text-2)' }}>No support messages yet</div>
                          <div style={{ fontSize: 12.5 }}>
                            Send a message below to start a support thread with {selected.username}.
                          </div>
                        </div>
                      ) : supportMessages.map(m => (
                        <SupportMessage
                          key={m.id}
                          msg={m}
                          currentAdminUsername={admin?.username}
                        />
                      ))}
                    </div>

                    {/* Support input */}
                    <div style={{
                      flexShrink: 0, padding: '10px 14px',
                      borderTop: '1px solid var(--pc-border)',
                      background: 'var(--pc-surface)',
                    }}>
                      <form onSubmit={handleSendSupport} style={{ display: 'flex', gap: 8 }}>
                        <textarea
                          ref={supportInputRef}
                          className="pc-input"
                          placeholder={`Message ${selected.username}… (Enter to send)`}
                          value={supportInput}
                          onChange={e => setSupportInput(e.target.value)}
                          onKeyDown={handleSupportKeyDown}
                          rows={2}
                          style={{ flex: 1, resize: 'none', fontSize: 13.5, lineHeight: 1.5 }}
                          disabled={sending}
                        />
                        <button
                          type="submit"
                          className="pc-btn pc-btn-primary pc-btn-icon"
                          disabled={sending || !supportInput.trim()}
                          style={{ height: 52, width: 44, alignSelf: 'flex-end', flexShrink: 0 }}
                          title="Send support message"
                        >
                          <Icon name="send" size={15} />
                        </button>
                      </form>
                      <div style={{ fontSize: 11, color: 'var(--pc-text-3)', marginTop: 5 }}>
                        The user will see your message when they open this session.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
