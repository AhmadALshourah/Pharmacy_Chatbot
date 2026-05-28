const BASE = '/api';

// ── Token storage ─────────────────────────────────────────────────────────────

export const token = {
  get:     ()           => localStorage.getItem('pharmacy_token'),
  getType: ()           => localStorage.getItem('pharmacy_token_type') || 'admin',
  set:     (t, type = 'admin') => {
    localStorage.setItem('pharmacy_token', t);
    localStorage.setItem('pharmacy_token_type', type);
  },
  clear: () => {
    localStorage.removeItem('pharmacy_token');
    localStorage.removeItem('pharmacy_token_type');
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

export async function login(username, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  token.set(data.access_token, 'admin');
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

export async function userLogin(username, password) {
  const data = await request('/user/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  token.set(data.access_token, 'user');
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
export async function* streamChat(message, sessionId, history = []) {
  const body = {
    message,
    history: history.map(m => ({ role: m.role, content: m.content })),
  };
  // Only include session_id if we have a real one (not null/undefined)
  if (sessionId != null) body.session_id = sessionId;

  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
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

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalytics(period = '30d') {
  return request(`/analytics?period=${period}`);
}
