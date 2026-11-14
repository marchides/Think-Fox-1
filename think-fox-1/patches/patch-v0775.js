<script>
(() => {
    if (window.__thinkfoxGitHubV0775) return;
    window.__thinkfoxGitHubV0775 = true;

    if (!window.ThinkFoxProjects || typeof scopedStorageKey !== 'function') {
        console.warn('Think Fox GitHub v0.7.7.5 requires the v0.7.7.1+ patches.');
        return;
    }

    // ─────────────────────────────────────────────────────────────
    // v0.7.7.5 — GitHub Repo Access
    // Fine-grained PAT, local-only token, SHA-guarded writes.
    // ─────────────────────────────────────────────────────────────

    const GH_CONN_STORAGE   = 'thinkfox_github_connections_v1';
    const GH_TOKEN_STORAGE  = 'thinkfox_github_tokens_v1'; // NEVER exported
    const GH_FILES_DB       = 'thinkfox_github_files';
    const GH_CTX_DB         = 'thinkfox_project_context'; // shared with v0.7.7.3
    const GH_CTX_STORE      = 'items';
    const GH_API            = 'https://api.github.com';

    const GH_MAX_FILE_CHARS = 200000;
    const GH_MAX_FILE_BYTES = 1_000_000;
    const GH_CONTEXT_BUDGET_TOKENS = 6000;
    const GH_MAX_INJECT_FILES = 8;
    const GH_MIN_INJECT_SCORE = 6;

    const GH_DEFAULT_INCLUDE = 'src/**/*.js\nsrc/**/*.ts\n*.html\n*.md\npackage.json';
    const GH_DEFAULT_EXCLUDE = 'node_modules/**\ndist/**\nbuild/**\n.git/**\n*.png\n*.jpg\n*.zip';

    let ghConnections = {};   // projectId -> connection
    let ghTokens = {};        // projectId -> token (local only)
let ghTreeCache = [];     // blobs of last loaded tree
let ghCtxCache = [];      // github_file context items for current project
let ghWriteState = { mode: 'update', path: '', baseText: '', baseSha: '', remoteSha: '', remoteChanged: false, previewed: false };
let ghFilesDbPromise = null;
let ghCtxDbPromise = null;

const ghEl = (id) => document.getElementById(id);

// ── Helpers ──────────────────────────────────────────────────

const ghWorkplaceId = () => (typeof activeWorkplaceId !== 'undefined' ? activeWorkplaceId : 'wp_default');
const ghSessions = () => (typeof sessions !== 'undefined' ? sessions : {});
const ghCurrentSessionId = () => (typeof currentSessionId !== 'undefined' ? currentSessionId : null);

function ghToast(msg, type = '') { if (typeof showToast === 'function') showToast(msg, type); else console.log('Think Fox:', msg); }

function ghEscape(v) {
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function ghEstTokens(t) {
    if (typeof estimateTextTokens === 'function') return estimateTextTokens(t);
    return Math.max(0, Math.ceil(String(t || '').length / 3.2));
}

function ghConnKey(id = ghWorkplaceId()) { return scopedStorageKey(GH_CONN_STORAGE, id); }
function ghTokenKey(id = ghWorkplaceId()) { return scopedStorageKey(GH_TOKEN_STORAGE, id); }

function ghLoadStore() {
    try { ghConnections = JSON.parse(localStorage.getItem(ghConnKey()) || '{}') || {}; } catch { ghConnections = {}; }
    try { ghTokens = JSON.parse(localStorage.getItem(ghTokenKey()) || '{}') || {}; } catch { ghTokens = {}; }
}

function ghSaveConnections() {
    try { localStorage.setItem(ghConnKey(), JSON.stringify(ghConnections)); if (typeof touchWorkplace === 'function') touchWorkplace(); } catch {}
}

function ghSaveTokens() {
    try { localStorage.setItem(ghTokenKey(), JSON.stringify(ghTokens)); } catch {}
}

function ghGetProjects() { return Array.isArray(window.ThinkFoxProjects?.projects) ? window.ThinkFoxProjects.projects : []; }
function ghActiveProjectId() { return String(window.ThinkFoxProjects?.activeProjectId || ''); }

function ghCurrentProjectId() {
    const sid = ghCurrentSessionId();
    const sess = sid ? ghSessions()[sid] : null;
    const pid = String(sess?.projectId || '');
    if (pid && ghGetProjects().some(p => p.id === pid)) return pid;
    const active = ghActiveProjectId();
    if (active && ghGetProjects().some(p => p.id === active)) return active;
    return '';
}

function ghConn(projectId = ghCurrentProjectId()) { return projectId ? (ghConnections[projectId] || null) : null; }
function ghToken(projectId = ghCurrentProjectId()) { return projectId ? (ghTokens[projectId] || '') : ''; }

function ghMaskToken(token) {
    const t = String(token || '');
    return t ? `••••${t.slice(-4)}` : 'no token';
}

// ── Base64 (unicode-safe) ────────────────────────────────────

function ghB64ToText(b64) {
    const bin = atob(String(b64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function ghTextToB64(text) {
    const bytes = new TextEncoder().encode(String(text));
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
}

// ── Glob matching ────────────────────────────────────────────

function ghGlobToRegExp(pattern) {
    let g = String(pattern || '').trim();
    if (!g) return null;
    g = g.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0001')
    .replace(/\*\*/g, '\u0002')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0001/g, '(?:.*/)?')
    .replace(/\u0002/g, '.*');
    return new RegExp(`^${g}$`);
}

function ghParsePatterns(text) {
    return String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 60);
}

function ghPathMatches(path, includePatterns, excludePatterns) {
    const base = path.split('/').pop();
    const excluded = (excludePatterns || []).some(p => {
        const re = ghGlobToRegExp(p);
        return re && (re.test(path) || (!p.includes('/') && re.test(base)));
    });
    if (excluded) return false;
    if (!includePatterns || !includePatterns.length) return true;
    return includePatterns.some(p => {
        const re = ghGlobToRegExp(p);
        return re && (re.test(path) || (!p.includes('/') && re.test(base)));
    });
}

function ghLanguageFromPath(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    const map = { js:'javascript', mjs:'javascript', cjs:'javascript', jsx:'jsx', ts:'typescript', tsx:'tsx', html:'html', htm:'html', css:'css', scss:'scss', md:'markdown', json:'json', py:'python', rb:'ruby', go:'go', rs:'rust', java:'java', c:'c', h:'c', cpp:'cpp', hpp:'cpp', cs:'csharp', php:'php', sh:'shell', yml:'yaml', yaml:'yaml', xml:'xml', sql:'sql', txt:'text' };
    return map[ext] || 'text';
}

// ── IndexedDB: file contents ─────────────────────────────────

function ghOpenFilesDB() {
    if (ghFilesDbPromise) return ghFilesDbPromise;
    ghFilesDbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable.'));
        const req = indexedDB.open(GH_FILES_DB, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('files')) {
                const store = db.createObjectStore('files', { keyPath: 'id' });
                try { store.createIndex('projectId', 'projectId'); } catch {}
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return ghFilesDbPromise;
}

async function ghIdbPut(record) {
    const db = await ghOpenFilesDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function ghIdbGet(id) {
    const db = await ghOpenFilesDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction('files', 'readonly').objectStore('files').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function ghIdbDelete(id) {
    const db = await ghOpenFilesDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function ghIdbAllForProject(projectId) {
    const db = await ghOpenFilesDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction('files', 'readonly').objectStore('files').getAll();
        req.onsuccess = () => resolve((req.result || []).filter(f => f.projectId === projectId));
        req.onerror = () => reject(req.error);
    });
}

// ── IndexedDB: project context items (shared DB, same version) ─

function ghOpenCtxDB() {
    if (ghCtxDbPromise) return ghCtxDbPromise;
    ghCtxDbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable.'));
        const req = indexedDB.open(GH_CTX_DB, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(GH_CTX_STORE)) {
                db.createObjectStore(GH_CTX_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return ghCtxDbPromise;
}

async function ghCtxPut(items) {
    if (!items.length) return;
    const db = await ghOpenCtxDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(GH_CTX_STORE, 'readwrite');
        items.forEach(item => tx.objectStore(GH_CTX_STORE).put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function ghCtxDelete(id) {
    const db = await ghOpenCtxDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(GH_CTX_STORE, 'readwrite');
        tx.objectStore(GH_CTX_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function ghCtxAllForProject(projectId) {
    const db = await ghOpenCtxDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(GH_CTX_STORE, 'readonly').objectStore(GH_CTX_STORE).getAll();
        req.onsuccess = () => resolve((req.result || []).filter(i => i.projectId === projectId && i.sourceType === 'github_file'));
        req.onerror = () => reject(req.error);
    });
}

function ghFileRecordId(projectId, path) { return `ghfile::${projectId}::${path}`; }
function ghCtxItemId(projectId, path) { return `ghctx::${projectId}::${path}`; }
function ghSourceId(conn, path) { return `github:${conn.owner}/${conn.repo}:${path}`; }

function ghBuildContextItem(conn, projectId, file) {
    const now = Date.now();
    return {
        id: ghCtxItemId(projectId, file.path),
 workplaceId: ghWorkplaceId(),
 projectId,
 sourceType: 'github_file',
 sourceId: ghSourceId(conn, file.path),
 owner: conn.owner,
 repo: conn.repo,
 branch: file.branch || conn.selectedBranch,
 path: file.path,
 sha: file.sha,
 title: file.path,
 summary: `GitHub file ${file.path} @ ${file.branch || conn.selectedBranch} (${String(file.sha || '').slice(0, 7)})`,
 text: String(file.text || '').slice(0, GH_MAX_FILE_CHARS),
 language: file.language || ghLanguageFromPath(file.path),
 tags: ['github', file.language || ghLanguageFromPath(file.path)],
 messageStartIndex: null,
 messageEndIndex: null,
 tokenEstimate: ghEstTokens(file.text || ''),
 pinned: false,
 enabled: true,
 stale: false,
 created: file.created || now,
 updated: now,
 sourceUpdatedAt: now
    };
}

async function ghRefreshCtxCache() {
    const projectId = ghCurrentProjectId();
    ghCtxCache = projectId ? await ghCtxAllForProject(projectId) : [];
    ghUpdateStatusLine();
}

// ── GitHub REST API ──────────────────────────────────────────

async function ghApi(path, { method = 'GET', body, token } = {}) {
    const headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${GH_API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    let payload = null;
    try { payload = await res.json(); } catch {}

    if (!res.ok) {
        let msg = payload?.message || payload?.error || `HTTP ${res.status}`;
        if (res.status === 401) msg = 'Authentication failed — token is invalid or expired.';
        if (res.status === 403 && /rate limit/i.test(msg)) msg = 'GitHub rate limit hit. Try again later.';
        if (res.status === 404) msg = 'Not found — check owner/repo, branch, path, and token repository access.';
        const err = new Error(msg);
        err.status = res.status;
        err.payload = payload;
        throw err;
    }

    return payload;
}

async function ghTestConnection(owner, repo, token) {
    const data = await ghApi(`/repos/${owner}/${repo}`, { token });
    return {
        defaultBranch: data.default_branch || 'main',
            private: Boolean(data.private),
                canRead: Boolean(data.permissions?.pull),
 canWrite: Boolean(data.permissions?.push)
    };
}

async function ghListBranches(conn, token) {
    const data = await ghApi(`/repos/${conn.owner}/${conn.repo}/branches?per_page=100`, { token });
    return (Array.isArray(data) ? data : []).map(b => b.name);
}

async function ghGetTree(conn, token, branch) {
    const data = await ghApi(`/repos/${conn.owner}/${conn.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { token });
    return {
        truncated: Boolean(data.truncated),
 blobs: (data.tree || []).filter(n => n.type === 'blob')
    };
}

async function ghReadFile(conn, token, path, branch) {
    const data = await ghApi(`/repos/${conn.owner}/${conn.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`, { token });
    if (Array.isArray(data)) throw new Error('Path is a directory, not a file.');
    if (Number(data.size) > GH_MAX_FILE_BYTES) throw new Error(`File is ${data.size} bytes — larger than the ${GH_MAX_FILE_BYTES} byte read limit.`);
    if (data.encoding !== 'base64' || typeof data.content !== 'string') throw new Error('GitHub returned no readable file content.');
    return { sha: data.sha, text: ghB64ToText(data.content), size: data.size };
}

async function ghWriteFile(conn, token, { path, branch, message, content, sha }) {
    const body = {
        message: message || `Think Fox: update ${path}`,
        content: ghTextToB64(content),
 branch
    };
    if (sha) body.sha = sha;
    return ghApi(`/repos/${conn.owner}/${conn.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        body,
        token
    });
}

// ── Connect / settings ───────────────────────────────────────

function ghSetStatus(msg, kind = '') {
    const el = ghEl('tf-gh-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = kind === 'error' ? '#F87171' : kind === 'good' ? '#4ADE80' : '';
}

async function ghConnectFromForm() {
    const projectId = ghCurrentProjectId();
    if (!projectId) { ghToast('Select a Project first.', 'error'); return; }

    const owner = (ghEl('tf-gh-owner')?.value || '').trim();
    const repo = (ghEl('tf-gh-repo')?.value || '').trim();
    const token = (ghEl('tf-gh-token')?.value || '').trim();

    if (!owner || !repo) { ghSetStatus('Enter owner and repo.', 'error'); return; }
    if (!token) { ghSetStatus('Enter a fine-grained personal access token.', 'error'); return; }

    ghSetStatus('Testing connection...');

    try {
        const info = await ghTestConnection(owner, repo, token);

        const existing = ghConnections[projectId] || {};
        ghConnections[projectId] = {
            id: existing.id || `gh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
 workplaceId: ghWorkplaceId(),
 projectId,
 authType: 'fine_grained_pat',
 tokenRef: 'local', // token itself lives in ghTokens only
 owner,
 repo,
 defaultBranch: info.defaultBranch,
     selectedBranch: existing.selectedBranch && existing.selectedBranch !== existing.defaultBranch
     ? existing.selectedBranch
     : info.defaultBranch,
     permissions: {
         contents: info.canWrite ? 'write' : 'read',
         metadata: 'read'
     },
     includePatterns: existing.includePatterns || ghParsePatterns(GH_DEFAULT_INCLUDE),
 excludePatterns: existing.excludePatterns || ghParsePatterns(GH_DEFAULT_EXCLUDE),
 selectedPaths: existing.selectedPaths || [],
 created: existing.created || Date.now(),
 updated: Date.now(),
 lastSyncAt: existing.lastSyncAt || null
        };

        ghTokens[projectId] = token;
        ghSaveConnections();
        ghSaveTokens();

        ghSetStatus(`Connected ${owner}/${repo} · default branch ${info.defaultBranch} · ${info.canWrite ? 'read/write' : 'read-only'} (${ghMaskToken(token)})`, 'good');
        ghToast('GitHub repository connected.', 'success');

        await ghRenderAll();
        await ghLoadBranches();
    } catch (error) {
        ghSetStatus(`Connection failed: ${error.message}`, 'error');
        ghToast(`GitHub connection failed: ${error.message}`, 'error');
    }
}

function ghDisconnect() {
    const projectId = ghCurrentProjectId();
    if (!projectId || !ghConn(projectId)) return;
    if (!confirm('Disconnect this repository? Synced context files remain until removed.')) return;

    delete ghConnections[projectId];
    delete ghTokens[projectId];
    ghSaveConnections();
    ghSaveTokens();
    ghTreeCache = [];
    ghRenderAll();
    ghSetStatus('Disconnected.');
}

async function ghLoadBranches() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);
    const token = ghToken(projectId);
    const select = ghEl('tf-gh-branch');
    if (!conn || !token || !select) return;

    try {
        const branches = await ghListBranches(conn, token);
        select.innerHTML = '';
        branches.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            opt.selected = name === conn.selectedBranch;
            select.appendChild(opt);
        });
        if (!branches.includes(conn.selectedBranch) && branches.length) {
            conn.selectedBranch = branches[0];
            select.value = branches[0];
            ghSaveConnections();
        }
    } catch (error) {
        ghSetStatus(`Branch list failed: ${error.message}`, 'error');
    }
}

async function ghLoadTree() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);
    const token = ghToken(projectId);
    if (!conn || !token) { ghSetStatus('Connect a repository first.', 'error'); return; }

    ghSetStatus(`Loading tree for ${conn.selectedBranch}...`);

    try {
        const { truncated, blobs } = await ghGetTree(conn, token, conn.selectedBranch);
        ghTreeCache = blobs;
        ghRenderTree();
        ghSetStatus(`Tree loaded: ${blobs.length} files${truncated ? ' (truncated by GitHub — large repo)' : ''}.`, 'good');
    } catch (error) {
        ghSetStatus(`Tree load failed: ${error.message}`, 'error');
    }
}

function ghSaveFilters() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);
    if (!conn) return;

    conn.includePatterns = ghParsePatterns(ghEl('tf-gh-include')?.value);
    conn.excludePatterns = ghParsePatterns(ghEl('tf-gh-exclude')?.value);

    const branch = ghEl('tf-gh-branch')?.value;
    if (branch) conn.selectedBranch = branch;

    conn.updated = Date.now();
    ghSaveConnections();
    ghRenderTree();
    ghSetStatus('Filters saved.', 'good');
}

// ── Tree rendering / selection ───────────────────────────────

function ghFilteredTree() {
    const conn = ghConn();
    if (!conn) return [];
    const term = (ghEl('tf-gh-tree-search')?.value || '').toLowerCase().trim();

    return ghTreeCache
    .filter(node => ghPathMatches(node.path, conn.includePatterns, conn.excludePatterns))
    .filter(node => !term || node.path.toLowerCase().includes(term))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 800);
}

function ghRenderTree() {
    const list = ghEl('tf-gh-tree-list');
    if (!list) return;
    list.innerHTML = '';

    const conn = ghConn();
    if (!conn) { list.innerHTML = '<div class="memory-empty">Connect a repository to browse files.</div>'; return; }
    if (!ghTreeCache.length) { list.innerHTML = '<div class="memory-empty">Load the repo tree to browse files.</div>'; return; }

    const visible = ghFilteredTree();
    const selected = new Set(conn.selectedPaths || []);

    if (!visible.length) { list.innerHTML = '<div class="memory-empty">No files match the current filters.</div>'; return; }

    visible.forEach(node => {
        const row = document.createElement('label');
        row.className = 'tf-gh-file-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(node.path);
        cb.addEventListener('change', () => {
            if (cb.checked) selected.add(node.path); else selected.delete(node.path);
            conn.selectedPaths = [...selected];
            conn.updated = Date.now();
            ghSaveConnections();
        });
        const label = document.createElement('span');
        label.textContent = node.path;
        label.title = `${node.path} · ${node.size} bytes`;
        row.append(cb, label);
        list.appendChild(row);
    });

    const count = ghEl('tf-gh-tree-count');
    if (count) count.textContent = `${visible.length} shown · ${selected.size} selected`;
}

function ghSelectAllFiltered(state) {
    const conn = ghConn();
    if (!conn) return;
    const selected = new Set(conn.selectedPaths || []);
    ghFilteredTree().forEach(node => state ? selected.add(node.path) : selected.delete(node.path));
    conn.selectedPaths = [...selected];
    ghSaveConnections();
    ghRenderTree();
}

// ── Sync into Project context ────────────────────────────────

async function ghSyncSelected() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);
    const token = ghToken(projectId);

    if (!conn || !token) { ghSetStatus('Connect a repository first.', 'error'); return; }
    if (!conn.selectedPaths?.length) { ghSetStatus('Select files in the tree first.', 'error'); return; }

    ghSetStatus(`Syncing ${conn.selectedPaths.length} file(s)...`);

    let ok = 0, failed = 0;

    for (const path of conn.selectedPaths) {
        try {
            const remote = await ghReadFile(conn, token, path, conn.selectedBranch);
            const existing = await ghIdbGet(ghFileRecordId(projectId, path));

            const record = {
                id: ghFileRecordId(projectId, path),
 projectId,
 workplaceId: ghWorkplaceId(),
 owner: conn.owner,
 repo: conn.repo,
 branch: conn.selectedBranch,
 path,
 sha: remote.sha,
 text: remote.text.slice(0, GH_MAX_FILE_CHARS),
 language: ghLanguageFromPath(path),
 size: remote.size,
 created: existing?.created || Date.now(),
 updated: Date.now()
            };

            await ghIdbPut(record);
            await ghCtxPut([ghBuildContextItem(conn, projectId, record)]);
            ok++;
        } catch (error) {
            failed++;
            console.warn('Think Fox GitHub sync failed for', path, error);
        }
    }

    conn.lastSyncAt = Date.now();
    ghSaveConnections();

    await ghRefreshCtxCache();
    if (typeof window.ThinkFoxProjectContext?.refreshCache === 'function') {
        try { await window.ThinkFoxProjectContext.refreshCache(); } catch {}
    }

    ghRenderSynced();
    ghSetStatus(`Sync complete: ${ok} updated, ${failed} failed.`, failed ? 'error' : 'good');
    ghToast(`GitHub sync: ${ok} file(s) into Project context.`, failed ? 'error' : 'success');
}

async function ghRefreshSyncedFile(projectId, path) {
    const conn = ghConn(projectId);
    const token = ghToken(projectId);
    if (!conn || !token) return;

    try {
        const remote = await ghReadFile(conn, token, path, conn.selectedBranch);
        const existing = await ghIdbGet(ghFileRecordId(projectId, path));

        const record = {
            ...(existing || {}),
 id: ghFileRecordId(projectId, path),
 projectId,
 workplaceId: ghWorkplaceId(),
 owner: conn.owner,
 repo: conn.repo,
 branch: conn.selectedBranch,
 path,
 sha: remote.sha,
 text: remote.text.slice(0, GH_MAX_FILE_CHARS),
 language: ghLanguageFromPath(path),
 size: remote.size,
 updated: Date.now()
        };

        await ghIdbPut(record);
        await ghCtxPut([ghBuildContextItem(conn, projectId, record)]);
        await ghRefreshCtxCache();
        ghRenderSynced();
        ghSetStatus(`Refreshed ${path} @ ${remote.sha.slice(0, 7)}.`, 'good');
    } catch (error) {
        ghSetStatus(`Refresh failed for ${path}: ${error.message}`, 'error');
    }
}

async function ghRemoveSyncedFile(projectId, path) {
    await ghIdbDelete(ghFileRecordId(projectId, path));
    await ghCtxDelete(ghCtxItemId(projectId, path));

    const conn = ghConn(projectId);
    if (conn && Array.isArray(conn.selectedPaths)) {
        conn.selectedPaths = conn.selectedPaths.filter(p => p !== path);
        ghSaveConnections();
    }

    await ghRefreshCtxCache();
    if (typeof window.ThinkFoxProjectContext?.refreshCache === 'function') {
        try { await window.ThinkFoxProjectContext.refreshCache(); } catch {}
    }

    ghRenderSynced();
    ghRenderTree();
}

async function ghCheckStale() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);
    const token = ghToken(projectId);
    if (!conn || !token) return;

    ghSetStatus('Checking remote SHAs...');

    try {
        const { blobs } = await ghGetTree(conn, token, conn.selectedBranch);
        const remoteShas = new Map(blobs.map(b => [b.path, b.sha]));
        const items = await ghCtxAllForProject(projectId);
        const dirty = [];

        for (const item of items) {
            const remoteSha = remoteShas.get(item.path);
            const stale = remoteSha ? remoteSha !== item.sha : true;
            if (stale !== Boolean(item.stale)) {
                item.stale = stale;
                item.updated = Date.now();
                dirty.push(item);
            }
        }

        if (dirty.length) await ghCtxPut(dirty);
        await ghRefreshCtxCache();
        ghRenderSynced();
        ghSetStatus(`Stale check done: ${items.filter(i => i.stale).length} stale of ${items.length}.`, 'good');
    } catch (error) {
        ghSetStatus(`Stale check failed: ${error.message}`, 'error');
    }
}

function ghRenderSynced() {
    const list = ghEl('tf-gh-synced-list');
    if (!list) return;
    list.innerHTML = '';

    const projectId = ghCurrentProjectId();

    if (!projectId || !ghCtxCache.length) {
        list.innerHTML = '<div class="memory-empty">No GitHub files synced into this Project yet.</div>';
        return;
    }

    ghCtxCache
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach(item => {
        const card = document.createElement('article');
        card.className = 'tf-gh-synced-card';
        card.innerHTML = `
        <div class="tf-ctx-head">
        <div class="tf-ctx-title">${ghEscape(item.path)}</div>
        <div class="tf-ctx-badges">
        <span class="tf-badge">${ghEscape(item.branch || '')}</span>
        <span class="tf-badge">@${ghEscape(String(item.sha || '').slice(0, 7))}</span>
        <span class="tf-badge">${Math.round(item.tokenEstimate || 0).toLocaleString()} tok</span>
        ${item.stale ? '<span class="tf-badge warn">STALE</span>' : '<span class="tf-badge good">FRESH</span>'}
        </div>
        </div>
        <div class="tf-ctx-actions"></div>
        `;
        const actions = card.querySelector('.tf-ctx-actions');

        const mk = (text, cls, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `config-btn ${cls}`.trim();
            b.textContent = text;
            b.addEventListener('click', fn);
            actions.appendChild(b);
            return b;
        };

        mk('Refresh', '', () => ghRefreshSyncedFile(projectId, item.path));
        mk('Load into Writer', '', () => ghLoadFileIntoWriter(item.path));
        mk('Remove', 'danger-btn', () => {
            if (confirm(`Remove ${item.path} from Project context?`)) ghRemoveSyncedFile(projectId, item.path);
        });

        list.appendChild(card);
    });
}

// ── Diff engine ──────────────────────────────────────────────

function ghDiffLines(oldText, newText) {
    const a = String(oldText || '').split('\n');
    const b = String(newText || '').split('\n');

    if (a.length * b.length > 250000) {
        return [
            ...a.map(text => ({ type: 'del', text })),
 ...b.map(text => ({ type: 'add', text }))
        ];
    }

    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));

    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    const ops = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
        if (a[i] === b[j]) { ops.push({ type: 'same', text: a[i] }); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', text: a[i] }); i++; }
        else { ops.push({ type: 'add', text: b[j] }); j++; }
    }
    while (i < m) { ops.push({ type: 'del', text: a[i++] }); }
    while (j < n) { ops.push({ type: 'add', text: b[j++] }); }

    return ops;
}

function ghRenderDiffHtml(ops, maxLines = 1200) {
    const shown = ops.slice(0, maxLines);
    const html = shown.map(op => {
        const cls = op.type === 'add' ? 'tf-diff-add' : op.type === 'del' ? 'tf-diff-del' : 'tf-diff-same';
        const prefix = op.type === 'add' ? '+' : op.type === 'del' ? '-' : ' ';
        return `<div class="${cls}">${prefix} ${ghEscape(op.text)}</div>`;
    }).join('');
    return html + (ops.length > maxLines ? `<div class="tf-diff-same">… ${ops.length - maxLines} more lines</div>` : '');
}

function ghToUnifiedDiff(oldText, newText, path) {
    const ops = ghDiffLines(oldText, newText);
    const a = String(oldText || '').split('\n');
    const b = String(newText || '').split('\n');

    const lines = [
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@ -1,${a.length} +1,${b.length} @@`
    ];

    ops.forEach(op => {
        if (op.type === 'same') lines.push(` ${op.text}`);
        else if (op.type === 'del') lines.push(`-${op.text}`);
        else lines.push(`+${op.text}`);
    });

    return lines.join('\n') + '\n';
}

// ── Writer / commits ─────────────────────────────────────────

function ghLoadFileIntoWriter(path) {
    ghWriteState.mode = 'update';
    ghWriteState.path = path;
    ghWriteState.previewed = false;
    ghWriteState.remoteChanged = false;

    const modeSelect = ghEl('tf-gh-write-mode');
    const pathInput = ghEl('tf-gh-write-path');
    if (modeSelect) modeSelect.value = 'update';
    if (pathInput) pathInput.value = path;

    ghIdbGet(ghFileRecordId(ghCurrentProjectId(), path)).then(record => {
        const ta = ghEl('tf-gh-write-content');
        if (ta) ta.value = record?.text || '';
        ghWriteState.baseText = record?.text || '';
        ghWriteState.baseSha = record?.sha || '';
        ghSetStatus(record ? `Loaded ${path} @ ${String(record.sha).slice(0, 7)} into writer.` : `No local copy of ${path}; content starts empty.`, record ? 'good' : '');
    });

    ghEl('tf-gh-diff-preview').innerHTML = '';
}

async function ghPreviewWrite() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);
    const token = ghToken(projectId);

    const mode = ghEl('tf-gh-write-mode')?.value || 'update';
    const path = (ghEl('tf-gh-write-path')?.value || '').trim().replace(/^\/+/, '');
    const content = ghEl('tf-gh-write-content')?.value || '';

    ghWriteState.mode = mode;
    ghWriteState.path = path;
    ghWriteState.previewed = false;
    ghWriteState.remoteChanged = false;

    if (!conn || !token) { ghSetStatus('Connect a repository first.', 'error'); return; }
    if (!path) { ghSetStatus('Enter a file path.', 'error'); return; }
    if (conn.permissions?.contents !== 'write') { ghSetStatus('This token/connection has read-only contents permission.', 'error'); return; }

    ghSetStatus('Reading latest remote file...');

    try {
        if (mode === 'update') {
            const remote = await ghReadFile(conn, token, path, conn.selectedBranch);
            ghWriteState.remoteSha = remote.sha;
            ghWriteState.remoteChanged = Boolean(ghWriteState.baseSha) && remote.sha !== ghWriteState.baseSha;

            const ops = ghDiffLines(remote.text, content);
            ghEl('tf-gh-diff-preview').innerHTML =
            (ghWriteState.remoteChanged
            ? '<div class="tf-diff-warn">⚠ Remote file changed since your last sync. Diff is against the latest remote version. Refresh the file in the synced list before committing if unsure.</div>'
            : '') + ghRenderDiffHtml(ops);

            ghWriteState.baseText = remote.text;
            ghWriteState.previewed = true;
            ghSetStatus(`Diff ready against remote @ ${remote.sha.slice(0, 7)}. Review, then commit.`, 'good');
        } else {
            let exists = true;
            try { await ghReadFile(conn, token, path, conn.selectedBranch); } catch { exists = false; }

            if (exists) {
                ghSetStatus('That file already exists on the remote. Use Update mode to modify it.', 'error');
                return;
            }

            ghWriteState.remoteSha = '';
            ghWriteState.previewed = true;
            ghEl('tf-gh-diff-preview').innerHTML =
            `<div class="tf-diff-same">New file: ${ghEscape(path)} (${ghEstTokens(content).toLocaleString()} tokens, ${content.length.toLocaleString()} chars)</div>` +
            ghRenderDiffHtml(ghDiffLines('', content), 300);
            ghSetStatus('New file preview ready. Review, then commit.', 'good');
        }
    } catch (error) {
        ghSetStatus(`Preview failed: ${error.message}`, 'error');
    }
}

async function ghCommitWrite() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);
    const token = ghToken(projectId);

    if (!conn || !token) { ghSetStatus('Connect a repository first.', 'error'); return; }
    if (!ghWriteState.previewed) { ghSetStatus('Preview the diff first.', 'error'); return; }

    const path = ghWriteState.path;
    const content = ghEl('tf-gh-write-content')?.value || '';
    const message = (ghEl('tf-gh-commit-message')?.value || '').trim() ||
    `Think Fox: ${ghWriteState.mode === 'create' ? 'create' : 'update'} ${path}`;

    const summary = ghWriteState.mode === 'create'
    ? `Create new file ${path} on ${conn.owner}/${conn.repo}@${conn.selectedBranch}?`
    : `Update ${path} on ${conn.owner}/${conn.repo}@${conn.selectedBranch}?`;

    if (!confirm(`${summary}\n\nCommit message:\n${message}\n\nThis pushes directly to the branch.`)) return;

    ghSetStatus('Committing...');

    try {
        const result = await ghWriteFile(conn, token, {
            path,
            branch: conn.selectedBranch,
            message,
            content,
            sha: ghWriteState.mode === 'update' ? ghWriteState.remoteSha : undefined
        });

        const commitSha = result?.commit?.sha || '';
        const commitUrl = result?.commit?.html_url || '';
        const fileSha = result?.content?.sha || '';

        ghSetStatus(`Committed ${commitSha.slice(0, 7)} · ${commitUrl}`, 'good');
        ghToast(`GitHub commit pushed: ${commitSha.slice(0, 7)}`, 'success');

        // Refresh local copies.
        const record = {
            id: ghFileRecordId(projectId, path),
 projectId,
 workplaceId: ghWorkplaceId(),
 owner: conn.owner,
 repo: conn.repo,
 branch: conn.selectedBranch,
 path,
 sha: fileSha || ghWriteState.remoteSha,
 text: content.slice(0, GH_MAX_FILE_CHARS),
 language: ghLanguageFromPath(path),
 size: content.length,
 created: Date.now(),
 updated: Date.now()
        };

        await ghIdbPut(record);
        await ghCtxPut([ghBuildContextItem(conn, projectId, record)]);
        await ghRefreshCtxCache();
        ghWriteState.baseSha = record.sha;
        ghWriteState.previewed = false;
        ghRenderSynced();
    } catch (error) {
        if (error.status === 409 || /sha/i.test(error.message || '')) {
            ghSetStatus(`Refused: remote changed. Refresh and preview again. (${error.message})`, 'error');
        } else {
            ghSetStatus(`Commit failed: ${error.message}`, 'error');
        }
        ghToast(`GitHub commit failed: ${error.message}`, 'error');
    }
}

function ghDownloadPatch() {
    const path = (ghEl('tf-gh-write-path')?.value || '').trim().replace(/^\/+/, '') || 'file.txt';
    const content = ghEl('tf-gh-write-content')?.value || '';
    const base = ghWriteState.mode === 'create' ? '' : (ghWriteState.baseText || '');

    const patch = ghToUnifiedDiff(base, content, path);
    const safeName = path.replace(/[^a-z0-9._-]+/gi, '_');

    if (typeof downloadBlob === 'function') {
        downloadBlob(`thinkfox_patch_${safeName}.patch`, patch, 'text/x-patch');
    } else {
        const blob = new Blob([patch], { type: 'text/x-patch' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `thinkfox_patch_${safeName}.patch`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    }

    ghSetStatus('Patch exported locally (no GitHub write).', 'good');
}

// ── Prompt context injection ─────────────────────────────────

function ghLastUserText() {
    const sid = ghCurrentSessionId();
    const sess = sid ? ghSessions()[sid] : null;
    if (!sess) return '';
    const messages = typeof getActiveBranchMessages === 'function'
    ? getActiveBranchMessages(sess)
    : (sess.messages || []);
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    let text = String(lastUser?.content || '');
    if (typeof stripThink === 'function') text = stripThink(text);
    return text.trim();
}

function ghScoreFile(query, item) {
    const terms = String(query || '').toLowerCase()
    .replace(/[^\w\s'/.*-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

    if (!terms.length) return 0;

    const haystack = `${item.title || ''}\n${item.path || ''}\n${item.text || ''}`.toLowerCase();
    let score = 0;

    for (const term of terms) {
        if (haystack.includes(term)) score += 4;
        if ((item.path || '').toLowerCase().includes(term)) score += 8;
    }

    if (item.stale) score -= 6;
    return score;
}

function ghBuildRepoContextSection() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);
    if (!conn) return '';

    const query = ghLastUserText();
    if (!query) return '';

    const candidates = ghCtxCache
    .filter(item => item.enabled !== false && String(item.text || '').trim())
    .map(item => ({ item, score: ghScoreFile(query, item) }))
    .filter(entry => entry.score >= GH_MIN_INJECT_SCORE)
    .sort((a, b) => b.score - a.score);

    if (!candidates.length) return '';

    const lines = [
        '',
        'GitHub repository:',
        `${conn.owner}/${conn.repo}`,
        `Branch: ${conn.selectedBranch}`,
        '',
        'Relevant repo files:'
    ];

    let usedTokens = 0;
    let count = 0;
    const fileBlocks = [];

    for (const { item, score } of candidates) {
        if (count >= GH_MAX_INJECT_FILES) break;

        let text = String(item.text || '').replace(/\u0000/g, '').trim();
        let block = `--- [file: ${item.path} @ ${String(item.sha || '').slice(0, 7)}] ---\n${text}\n--- end file ---`;
        let tokens = ghEstTokens(block);

        if (usedTokens + tokens > GH_CONTEXT_BUDGET_TOKENS) {
            const remaining = GH_CONTEXT_BUDGET_TOKENS - usedTokens;
            if (remaining < 250) break;
            const maxChars = Math.floor(remaining * 3);
            text = `${text.slice(0, maxChars)}\n[truncated]`;
            block = `--- [file: ${item.path} @ ${String(item.sha || '').slice(0, 7)}] ---\n${text}\n--- end file ---`;
            tokens = ghEstTokens(block);
            if (usedTokens + tokens > GH_CONTEXT_BUDGET_TOKENS) break;
        }

        lines.push(`[file: ${item.path} @ ${String(item.sha || '').slice(0, 7)}] (relevance ${score})`);
        fileBlocks.push(block);
        usedTokens += tokens;
        count++;
    }

    if (!count) return '';

    return ['', ...lines, '', ...fileBlocks].join('\n');
}

const ghBaseGetSystemPrompt = window.getSystemPrompt || (typeof getSystemPrompt === 'function' ? getSystemPrompt : null);

window.getSystemPrompt = function (...args) {
    let base = typeof ghBaseGetSystemPrompt === 'function'
    ? ghBaseGetSystemPrompt.apply(this, args)
    : '';

    const section = ghBuildRepoContextSection();
    if (!section) return base;

    if (String(base).includes('</project_context>')) {
        return base.replace('</project_context>', `${section}\n</project_context>`);
    }

    const conn = ghConn();
    return `${base}\n\n<project_context>\nProject: ${conn ? `${conn.owner}/${conn.repo}` : 'GitHub'}\n${section}\n</project_context>`;
};

// Refresh GitHub context cache before each generation.
const ghBaseGenerateResponse = window.generateResponse || (typeof generateResponse === 'function' ? generateResponse : null);

if (typeof ghBaseGenerateResponse === 'function') {
    window.generateResponse = async function (...args) {
        try { await ghRefreshCtxCache(); } catch {}
        return ghBaseGenerateResponse.apply(this, args);
    };
}

// ── UI injection ─────────────────────────────────────────────

const ghStyle = document.createElement('style');
ghStyle.textContent = `
.tf-github-modal { width: min(1100px, 100%); max-height: 92vh; overflow: auto; }
.tf-gh-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 8px; }
.tf-gh-section { border: 1px solid var(--border-lit); background: rgba(0,0,0,.16); padding: 10px; margin: 10px 0; }
.tf-gh-section h3 { color: var(--text-primary); font: 600 13px var(--font-display); margin-bottom: 8px; }
.tf-gh-section input[type="text"], .tf-gh-section input[type="password"],
.tf-gh-section select, .tf-gh-section textarea {
    width: 100%; background: var(--bg-void); border: 1px solid var(--border-lit);
    color: var(--text-body); padding: 7px 8px; font: 12px var(--font-body); outline: none;
}
.tf-gh-section textarea { font-family: var(--font-mono); font-size: 11px; line-height: 1.45; resize: vertical; }
.tf-gh-section input:focus, .tf-gh-section select:focus, .tf-gh-section textarea:focus { border-color: var(--theme-color); }
.tf-gh-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.tf-gh-status { font: 10px var(--font-mono); color: var(--text-muted); min-height: 14px; margin: 6px 0; }
.tf-gh-file-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; font: 11px var(--font-mono); color: var(--text-body); cursor: pointer; }
.tf-gh-file-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#tf-gh-tree-list { max-height: 260px; overflow: auto; border: 1px solid var(--border); padding: 6px; }
.tf-gh-synced-card { border: 1px solid var(--border-lit); background: rgba(0,0,0,.14); padding: 8px; margin-bottom: 6px; }
#tf-gh-diff-preview { max-height: 340px; overflow: auto; border: 1px solid var(--border); background: #0A0A0E; padding: 8px; font: 11px/1.5 var(--font-mono); white-space: pre; }
.tf-diff-add { color: #4ADE80; }
.tf-diff-del { color: #F87171; }
.tf-diff-same { color: var(--text-muted); }
.tf-diff-warn { color: #FCA5A5; border: 1px solid rgba(248,113,113,.4); padding: 6px; margin-bottom: 6px; white-space: normal; }
@media (max-width: 800px) { .tf-gh-grid { grid-template-columns: 1fr; } }
`;
document.head.appendChild(ghStyle);

const ghProjectContextRow = ghEl('tf-project-context');
if (ghProjectContextRow && !ghEl('tf-github-open-btn')) {
    ghProjectContextRow.insertAdjacentHTML('beforeend', `
    <div class="tf-project-row">
    <label>GitHub</label>
    <button class="config-btn tf-mini-btn" id="tf-github-open-btn" type="button">GitHub Repo</button>
    <span id="tf-gh-sidebar-state" class="tf-memory-inline-summary"></span>
    </div>
    `);
}

document.body.insertAdjacentHTML('beforeend', `
<div class="name-modal-backdrop" id="tf-gh-backdrop" hidden>
<section class="name-modal tf-github-modal" role="dialog" aria-modal="true" aria-labelledby="tf-gh-title">
<h2 id="tf-gh-title">GitHub Repo Access</h2>
<p>Fine-grained PAT · token stored locally only · never exported · writes require confirmation.</p>

<div class="tf-gh-status" id="tf-gh-status"></div>

<div class="tf-gh-section">
<h3>Connection</h3>
<div class="tf-gh-grid">
<input type="text" id="tf-gh-owner" placeholder="owner (user or org)" autocomplete="off" />
<input type="text" id="tf-gh-repo" placeholder="repository name" autocomplete="off" />
</div>
<input type="password" id="tf-gh-token" placeholder="Fine-grained personal access token (github_pat_...)" autocomplete="off" style="margin-top:8px;" />
<div class="tf-gh-actions">
<button class="config-btn primary-config-btn" id="tf-gh-connect-btn" type="button">Connect &amp; Test</button>
<button class="config-btn danger-btn" id="tf-gh-disconnect-btn" type="button">Disconnect</button>
</div>
</div>

<div class="tf-gh-section">
<h3>Branch &amp; Filters</h3>
<select id="tf-gh-branch" aria-label="Branch"></select>
<div class="tf-gh-grid" style="margin-top:8px;">
<div>
<div style="font:9px var(--font-mono);color:var(--text-faint);margin-bottom:4px;">INCLUDE PATTERNS (one per line)</div>
<textarea id="tf-gh-include" rows="6"></textarea>
</div>
<div>
<div style="font:9px var(--font-mono);color:var(--text-faint);margin-bottom:4px;">EXCLUDE PATTERNS (one per line)</div>
<textarea id="tf-gh-exclude" rows="6"></textarea>
</div>
</div>
<div class="tf-gh-actions">
<button class="config-btn" id="tf-gh-save-filters-btn" type="button">Save Filters</button>
<button class="config-btn" id="tf-gh-load-tree-btn" type="button">Load Repo Tree</button>
<button class="config-btn" id="tf-gh-check-stale-btn" type="button">Check Stale</button>
</div>
</div>

<div class="tf-gh-section">
<h3>Repo Files <span id="tf-gh-tree-count" style="font:9px var(--font-mono);color:var(--text-faint);"></span></h3>
<input type="search" id="tf-gh-tree-search" placeholder="Filter files..." />
<div id="tf-gh-tree-list" style="margin-top:6px;"></div>
<div class="tf-gh-actions">
<button class="config-btn" id="tf-gh-select-all-btn" type="button">Select All Shown</button>
<button class="config-btn" id="tf-gh-clear-selection-btn" type="button">Clear Selection</button>
<button class="config-btn primary-config-btn" id="tf-gh-sync-btn" type="button">Sync Selected to Project Context</button>
</div>
</div>

<div class="tf-gh-section">
<h3>Synced Context Files</h3>
<div id="tf-gh-synced-list"></div>
</div>

<div class="tf-gh-section">
<h3>Write</h3>
<div class="tf-gh-grid">
<select id="tf-gh-write-mode">
<option value="update">Update existing file</option>
<option value="create">Create new file</option>
</select>
<input type="text" id="tf-gh-write-path" placeholder="path/to/file.js" autocomplete="off" />
</div>
<textarea id="tf-gh-write-content" rows="12" placeholder="File content..." style="margin-top:8px;"></textarea>
<input type="text" id="tf-gh-commit-message" placeholder="Commit message (optional)" style="margin-top:8px;" />
<div class="tf-gh-actions">
<button class="config-btn" id="tf-gh-preview-btn" type="button">Preview Diff</button>
<button class="config-btn primary-config-btn" id="tf-gh-commit-btn" type="button">Commit to Branch</button>
<button class="config-btn" id="tf-gh-patch-btn" type="button">Export .patch</button>
</div>
<div id="tf-gh-diff-preview" style="margin-top:8px;"></div>
</div>

<div class="name-modal-actions">
<button class="config-btn" id="tf-gh-close-btn" type="button">Close</button>
</div>
</section>
</div>
`);

// ── Panel rendering ──────────────────────────────────────────

function ghUpdateStatusLine() {
    const el = ghEl('tf-gh-sidebar-state');
    if (!el) return;
    const conn = ghConn();
    el.textContent = conn
    ? `${conn.owner}/${conn.repo} @ ${conn.selectedBranch} · ${ghCtxCache.length} files`
    : 'Not connected';
    el.title = conn ? `Token: ${ghMaskToken(ghToken())}` : 'Connect a GitHub repository.';
}

async function ghRenderAll() {
    const projectId = ghCurrentProjectId();
    const conn = ghConn(projectId);

    const owner = ghEl('tf-gh-owner');
    const repo = ghEl('tf-gh-repo');
    const include = ghEl('tf-gh-include');
    const exclude = ghEl('tf-gh-exclude');

    if (owner) owner.value = conn?.owner || '';
    if (repo) repo.value = conn?.repo || '';
    if (include) include.value = (conn?.includePatterns || ghParsePatterns(GH_DEFAULT_INCLUDE)).join('\n');
    if (exclude) exclude.value = (conn?.excludePatterns || ghParsePatterns(GH_DEFAULT_EXCLUDE)).join('\n');

    const tokenInput = ghEl('tf-gh-token');
    if (tokenInput) tokenInput.placeholder = conn && ghToken(projectId)
        ? `Stored token ${ghMaskToken(ghToken(projectId))} — paste to replace`
        : 'Fine-grained personal access token (github_pat_...)';

    await ghRefreshCtxCache();
    ghRenderTree();
    ghRenderSynced();
    ghUpdateStatusLine();

    if (conn && ghToken(projectId)) ghLoadBranches();
}

function ghOpenPanel() {
    const backdrop = ghEl('tf-gh-backdrop');
    if (backdrop) backdrop.hidden = false;
    ghRenderAll();
}

function ghClosePanel() {
    const backdrop = ghEl('tf-gh-backdrop');
    if (backdrop) backdrop.hidden = true;
}

// ── Export / import (token never leaves) ─────────────────────

const ghBaseExport = window.exportWorkplace || (typeof exportWorkplace === 'function' ? exportWorkplace : null);

if (typeof ghBaseExport === 'function') {
    window.exportWorkplace = async function (id = ghWorkplaceId()) {
        let safeConnections = {};

        try {
            const stored = id === ghWorkplaceId()
            ? ghConnections
            : (JSON.parse(localStorage.getItem(ghConnKey(id)) || '{}') || {});

            Object.entries(stored).forEach(([projectId, conn]) => {
                safeConnections[projectId] = {
                    owner: conn.owner,
                    repo: conn.repo,
                    defaultBranch: conn.defaultBranch,
                        selectedBranch: conn.selectedBranch,
                        includePatterns: conn.includePatterns || [],
                        excludePatterns: conn.excludePatterns || [],
                        selectedPaths: conn.selectedPaths || [],
                        lastSyncAt: conn.lastSyncAt || null,
                        tokenIncluded: false
                };
            });
        } catch {}

        const prevDownload = typeof window.downloadBlob === 'function'
        ? window.downloadBlob
        : (typeof downloadBlob === 'function' ? downloadBlob : null);

        window.downloadBlob = function (filename, content, type) {
            if (String(filename || '').startsWith('thinkfox_workplace_') && String(type || '').includes('application/json')) {
                try {
                    const payload = JSON.parse(content);
                    payload.data = payload.data || {};
                    payload.data.githubConnections = safeConnections;
                    content = JSON.stringify(payload, null, 2);
                } catch (error) {
                    console.warn('Think Fox GitHub: export injection failed.', error);
                }
            }
            prevDownload?.call(this, filename, content, type);
        };

        try { await ghBaseExport(id); }
        finally { window.downloadBlob = prevDownload; }
    };
}

const ghBaseImport = window.importWorkplaceFile || (typeof importWorkplaceFile === 'function' ? importWorkplaceFile : null);

if (typeof ghBaseImport === 'function') {
    window.importWorkplaceFile = async function (file) {
        if (!file) return ghBaseImport?.(file);

        let text = '';
        try { text = await file.text(); } catch { return ghBaseImport?.(file); }

        let payload = null;
        try { payload = JSON.parse(text); } catch {}

        const clone = new File([text], file.name, { type: file.type || 'application/json' });
        const beforeIds = new Set((typeof workplaces !== 'undefined' ? workplaces : []).map(w => w.id));

        await ghBaseImport?.(clone);

        const newWorkplace = (typeof workplaces !== 'undefined' ? workplaces : []).find(w => !beforeIds.has(w.id));

        if (newWorkplace && payload?.format === 'thinkfox-workplace' && payload.data?.githubConnections) {
            const restored = {};

            Object.entries(payload.data.githubConnections).forEach(([projectId, conn]) => {
                restored[projectId] = {
                    id: `gh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                                                   workplaceId: newWorkplace.id,
                                                                   projectId,
                                                                   authType: 'fine_grained_pat',
                                                                   tokenRef: 'missing', // disconnected until token re-entered
                                                                   owner: String(conn.owner || ''),
                                                                   repo: String(conn.repo || ''),
                                                                   defaultBranch: String(conn.defaultBranch || 'main'),
                                                                       selectedBranch: String(conn.selectedBranch || conn.defaultBranch || 'main'),
                                                                   permissions: { contents: 'read', metadata: 'read' },
                                                                   includePatterns: Array.isArray(conn.includePatterns) ? conn.includePatterns : [],
                                                                   excludePatterns: Array.isArray(conn.excludePatterns) ? conn.excludePatterns : [],
                                                                   selectedPaths: Array.isArray(conn.selectedPaths) ? conn.selectedPaths : [],
                                                                   created: Date.now(),
                                                                   updated: Date.now(),
                                                                   lastSyncAt: conn.lastSyncAt || null
                };
            });

            try {
                localStorage.setItem(ghConnKey(newWorkplace.id), JSON.stringify(restored));
                localStorage.setItem(ghTokenKey(newWorkplace.id), JSON.stringify({}));
            } catch {}

            if (ghWorkplaceId() === newWorkplace.id) {
                ghLoadStore();
                ghRenderAll();
                ghToast('GitHub connections restored as disconnected — re-enter tokens to use them.');
            }
        }
    };
}

const ghBaseDeleteWorkplace = window.deleteWorkplace || (typeof deleteWorkplace === 'function' ? deleteWorkplace : null);

window.deleteWorkplace = async function (id, ...args) {
    const result = await ghBaseDeleteWorkplace?.apply(this, [id, ...args]);

    try {
        localStorage.removeItem(ghConnKey(id));
        localStorage.removeItem(ghTokenKey(id));

        const db = await ghOpenFilesDB();
        const all = await new Promise((resolve, reject) => {
            const req = db.transaction('files', 'readonly').objectStore('files').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });

        const doomed = all.filter(f => f.workplaceId === id);
        if (doomed.length) {
            await new Promise((resolve, reject) => {
                const tx = db.transaction('files', 'readwrite');
                doomed.forEach(f => tx.objectStore('files').delete(f.id));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }
    } catch {}

    if (ghWorkplaceId() === id) { ghLoadStore(); ghRenderAll(); }
    return result;
};

const ghBaseRefreshWorkspace = window.refreshWorkspaceScopedData || (typeof refreshWorkspaceScopedData === 'function' ? refreshWorkspaceScopedData : null);

window.refreshWorkspaceScopedData = function (...args) {
    const result = ghBaseRefreshWorkspace?.apply(this, args);
    ghLoadStore();
    ghTreeCache = [];
    ghRenderAll();
    return result;
};

// ── Version label bump 0.7.7.4 → 0.7.7.5 ─────────────────────

function ghBumpVersionLabels() {
    try {
        document.title = String(document.title || '').replace(/1-v0\.7\.7\.4/g, '1-v0.7.7.5');

        const walk = (root) => {
            root.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.includes('1-v0.7.7.4')) {
                        node.textContent = node.textContent.replace(/1-v0\.7\.7\.4/g, '1-v0.7.7.5');
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    walk(node);
                }
            });
        };

        document.querySelectorAll('.topbar-brand-line, .welcome-title').forEach(walk);
    } catch {}
}

// ── Events ───────────────────────────────────────────────────

ghEl('tf-github-open-btn')?.addEventListener('click', ghOpenPanel);
ghEl('tf-gh-close-btn')?.addEventListener('click', ghClosePanel);

ghEl('tf-gh-backdrop')?.addEventListener('click', event => {
    if (event.target === ghEl('tf-gh-backdrop')) ghClosePanel();
});

ghEl('tf-gh-connect-btn')?.addEventListener('click', ghConnectFromForm);
ghEl('tf-gh-disconnect-btn')?.addEventListener('click', ghDisconnect);
ghEl('tf-gh-save-filters-btn')?.addEventListener('click', ghSaveFilters);
ghEl('tf-gh-load-tree-btn')?.addEventListener('click', ghLoadTree);
ghEl('tf-gh-check-stale-btn')?.addEventListener('click', ghCheckStale);
ghEl('tf-gh-tree-search')?.addEventListener('input', () => ghRenderTree());
ghEl('tf-gh-select-all-btn')?.addEventListener('click', () => ghSelectAllFiltered(true));
ghEl('tf-gh-clear-selection-btn')?.addEventListener('click', () => ghSelectAllFiltered(false));
ghEl('tf-gh-sync-btn')?.addEventListener('click', ghSyncSelected);

ghEl('tf-gh-branch')?.addEventListener('change', function () {
    const conn = ghConn();
    if (conn && this.value) {
        conn.selectedBranch = this.value;
        conn.updated = Date.now();
        ghSaveConnections();
        ghTreeCache = [];
        ghRenderTree();
        ghSetStatus(`Branch set to ${this.value}. Load the tree to browse it.`);
    }
});

ghEl('tf-gh-write-mode')?.addEventListener('change', function () {
    ghWriteState.mode = this.value;
    ghWriteState.previewed = false;
    ghEl('tf-gh-diff-preview').innerHTML = '';
});

ghEl('tf-gh-preview-btn')?.addEventListener('click', ghPreviewWrite);
ghEl('tf-gh-commit-btn')?.addEventListener('click', ghCommitWrite);
ghEl('tf-gh-patch-btn')?.addEventListener('click', ghDownloadPatch);

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const backdrop = ghEl('tf-gh-backdrop');
    if (backdrop && !backdrop.hidden) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        ghClosePanel();
    }
}, true);

// Keep sidebar state synced with project switching.
setInterval(() => {
    ghUpdateStatusLine();
}, 1200);

// ── Boot ─────────────────────────────────────────────────────

ghLoadStore();
ghBumpVersionLabels();
ghRefreshCtxCache().then(() => ghUpdateStatusLine());

window.ThinkFoxGitHub = {
    version: '0.7.7.5',
    get connections() { return ghConnections; },
 connect: ghConnectFromForm,
 syncSelected: ghSyncSelected,
 refreshFile: ghRefreshSyncedFile,
 removeFile: ghRemoveSyncedFile,
 openPanel: ghOpenPanel
};
})();
</script>
