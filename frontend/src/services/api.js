const BASE = '/api';

// ── Token storage ─────────────────────────────────────────────────────────────
// M11: when "Keep me signed in" is unchecked, tokens go into sessionStorage
// so they are cleared automatically when the browser tab/window is closed.
// localStorage is used when the checkbox is checked (default — 8-hour expiry).
const _KEY      = 'pharmacy_token';
const _TYPE_KEY = 'pharmacy_token_type';

function _store() {
  // Prefer localStorage; fall back to sessionStorage if that's where the token lives.
  return localStorage.getItem(_KEY) !== null ? localStorage : sessionStorage;
}

export const token = {
  get:     ()                         => _store().getItem(_KEY),
  getType: ()                         => _store().getItem(_TYPE_KEY) || 'admin',
  set:     (t, type = 'admin', remember = true) => {
    const store = remember ? localStorage : sessionStorage;
    // Clear the other store to avoid stale tokens in both places
    const other = remember ? sessionStorage : localStorage;
    other.removeItem(_KEY);
    other.removeItem(_TYPE_KEY);
    store.setItem(_KEY, t);
    store.setItem(_TYPE_KEY, type);
  },
  clear: () => {
    localStorage.removeItem(_KEY);
    localStorage.removeItem(_TYPE_KEY);
    sessionStorage.removeItem(_KEY);
    sessionStorage.removeItem(_TYPE_KEY);
  },
};

function authHeaders() {
  const t = token.get();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Admin auth ────────────────────────────────────────────────────────────────

export async function register(username, email, password, remember = true) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  token.set(data.access_token, 'admin', remember);
  return { ...data.admin, principalType: 'admin' };
}

export async function login(username, password, remember = true) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  token.set(data.access_token, 'admin', remember);
  return { ...data.admin, principalType: 'admin' };
}

export async function getMe() {
  const data = await request('/auth/me');
  return { ...data, principalType: 'admin' };
}

export async function changePassword(current_password, new_password) {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  });
}

// ── User auth ─────────────────────────────────────────────────────────────────

export async function registerUser(username, email, password, remember = true) {
  const data = await request('/user/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  token.set(data.access_token, 'user', remember);
  return { ...data.user, principalType: 'user' };
}

export async function userLogin(username, password, remember = true) {
  const data = await request('/user/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  token.set(data.access_token, 'user', remember);
  return { ...data.user, principalType: 'user' };
}

export async function getUserMe() {
  const data = await request('/user/me');
  return { ...data, principalType: 'user' };
}

// ── Admin management (Master Admin only) ─────────────────────────────────────

export async function getAdmins() {
  return request('/auth/admins');
}

export async function createAdmin({ username, email, password, role = 'admin' }) {
  return request('/auth/admins', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, role }),
  });
}

export async function deleteAdmin(adminId) {
  return request(`/auth/admins/${adminId}`, { method: 'DELETE' });
}

export async function toggleAdminStatus(adminId) {
  return request(`/auth/admins/${adminId}/toggle`, { method: 'PATCH' });
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function getHealth() {
  return request('/health');
}

// ── Chat sessions (role-aware) ────────────────────────────────────────────────

export async function getSessions() {
  const type = token.getType();
  return request(type === 'user' ? '/user/sessions' : '/sessions');
}

export async function deleteSession(sessionId) {
  const type = token.getType();
  return request(
    type === 'user' ? `/user/sessions/${sessionId}` : `/sessions/${sessionId}`,
    { method: 'DELETE' },
  );
}

export async function getSessionMessages(sessionId) {
  const type = token.getType();
  return request(
    type === 'user'
      ? `/user/sessions/${sessionId}/messages`
      : `/sessions/${sessionId}/messages`,
  );
}

// ── Chat SSE streaming ────────────────────────────────────────────────────────

/**
 * Stream a chat message.
 * Yields { token: string } while streaming, then { done: true, content, sources, session_id }.
 * On error yields { error: string }.
 */
/**
 * H13: accepts an AbortSignal so callers can genuinely cancel the underlying
 * fetch (not just break the JS loop — that leaves the server streaming).
 */
export async function* streamChat(message, sessionId, history = [], signal, images = []) {
  const body = {
    message,
    history: history.map(m => ({
      role: m.role,
      content: m.content,
      // Historical images are kept in the request shape for round-tripping,
      // but the backend currently only feeds the *latest* turn's images to
      // the vision model. Sending them back is harmless and future-proof.
      images: Array.isArray(m.images) ? m.images : [],
    })),
    images: Array.isArray(images) ? images : [],
  };
  // Only include session_id if we have a real one (not null/undefined)
  if (sessionId != null) body.session_id = sessionId;

  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
    signal,    // H13: wire the AbortController signal
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6));
        } catch { /* skip malformed lines */ }
      }
    }
  }

  if (buffer.startsWith('data: ')) {
    try { yield JSON.parse(buffer.slice(6)); } catch { /* skip malformed trailing line */ }
  }
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function getDocuments() {
  return request('/documents');
}

export async function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/documents/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteDocument(docId) {
  return request(`/documents/${docId}`, { method: 'DELETE' });
}

export async function rebuildIndex() {
  return request('/documents/rebuild', { method: 'POST' });
}

// ── Admin: conversation monitoring ────────────────────────────────────────────

export async function getAdminConversations() {
  return request('/admin/conversations');
}

export async function getAdminConversationMessages(sessionId) {
  return request(`/admin/conversations/${sessionId}/messages`);
}

export async function getAdminConversationSupport(sessionId) {
  return request(`/admin/conversations/${sessionId}/support`);
}

export async function sendAdminSupportMessage(sessionId, content) {
  return request(`/admin/conversations/${sessionId}/support`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// ── User: support thread (reading admin messages + replying) ──────────────────

export async function getUserSessionSupport(sessionId) {
  return request(`/user/sessions/${sessionId}/support`);
}

export async function sendUserSupportReply(sessionId, content) {
  return request(`/user/sessions/${sessionId}/support`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalytics(period = '30d') {
  return request(`/analytics?period=${period}`);
}
