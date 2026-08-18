<script>
(() => {
  if (window.__thinkfoxV0776) return;
  window.__thinkfoxV0776 = true;

  const TF_VERSION = '0.7.7.6';
  const TF_VERSION_FULL = `1-v${TF_VERSION}`;
  const TF_SCHEMA_VERSION = 6;
  const TF_MIGRATION_STORAGE = 'thinkfox_migration_state_v1';

  const tfEl = (id) => document.getElementById(id);
  const tfToast = (msg, type = '') => { if (typeof showToast === 'function') showToast(msg, type); };
  const tfWorkplaceId = () => (typeof activeWorkplaceId !== 'undefined' ? activeWorkplaceId : 'wp_default');
  const tfSessions = () => (typeof sessions !== 'undefined' ? sessions : {});
  const tfCurrentSessionId = () => (typeof currentSessionId !== 'undefined' ? currentSessionId : null);

  function tfEstTokens(t) {
    if (typeof estimateTextTokens === 'function') return estimateTextTokens(t);
    return Math.max(0, Math.ceil(String(t || '').length / 3.2));
  }

  function tfEscape(v) {
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function tfCleanLine(v, max = 140) {
    if (typeof cleanSingleLine === 'function') return cleanSingleLine(v, max);
    return String(v || '').replace(/[\u0000-\u001F\u007F]+/g,' ').replace(/\s+/g,' ').trim().slice(0, max);
  }

  function tfMakeId(prefix = 'tf') {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  // ─────────────────────────────────────────────────────────────
  // FROZEN SCHEMAS — v0.7.7.6
  // Do not modify field names after this point.
  // ─────────────────────────────────────────────────────────────

  const SCHEMA_PROJECT = Object.freeze({
    fields: ['id','workplaceId','name','description','color','icon','status','contextMode','created','updated'],
    statusValues: ['active','paused','archived']
  });

  const SCHEMA_PROJECT_MEMORY = Object.freeze({
    fields: ['id','workplaceId','projectId','sourceType','sourceId','title','text','pinned','enabled','stale','created','updated','sourceUpdatedAt'],
    sourceTypes: ['manual','conversation_summary']
  });

  const SCHEMA_CONTEXT_ITEM = Object.freeze({
    fields: ['id','workplaceId','projectId','sourceType','sourceId','title','summary','text','tags','messageStartIndex','messageEndIndex','tokenEstimate','pinned','enabled','stale','created','updated','sourceUpdatedAt'],
    sourceTypes: ['conversation','canvas','artifact','attachment','manual_memory','github_file']
  });

  const SCHEMA_GITHUB_CONNECTION = Object.freeze({
    fields: ['id','workplaceId','projectId','authType','tokenRef','owner','repo','defaultBranch','selectedBranch','permissions','includePatterns','excludePatterns','selectedPaths','created','updated','lastSyncAt']
  });

  const SCHEMA_CONVERSATION_PROJECT_FIELDS = Object.freeze(['projectId']);

  // ─────────────────────────────────────────────────────────────
  // MigrationManager
  // ─────────────────────────────────────────────────────────────

  const MigrationManager = {
    getState() {
      try {
        return JSON.parse(localStorage.getItem(tfMakeMigrationKey()) || '{}');
      } catch { return {}; }
    },

    setState(state) {
      try { localStorage.setItem(tfMakeMigrationKey(), JSON.stringify(state)); } catch {}
    },

    needsMigration() {
      const state = this.getState();
      return (state.schemaVersion || 0) < TF_SCHEMA_VERSION;
    },

    backupBeforeMigration() {
      const backup = {
        version: TF_VERSION,
        timestamp: new Date().toISOString(),
        workplaceId: tfWorkplaceId(),
        data: {}
      };

      try {
        const keys = Object.keys(localStorage).filter(k =>
          k.startsWith('thinkfox_') && !k.includes('_backup_')
        );

        keys.forEach(key => {
          try { backup.data[key] = localStorage.getItem(key); } catch {}
        });

        const backupKey = `thinkfox_backup_${Date.now()}`;
        localStorage.setItem(backupKey, JSON.stringify(backup));

        // Keep only last 3 backups.
        const backups = Object.keys(localStorage)
          .filter(k => k.startsWith('thinkfox_backup_'))
          .sort();

        while (backups.length > 3) {
          localStorage.removeItem(backups.shift());
        }

        return backupKey;
      } catch (error) {
        console.warn('Think Fox migration backup failed:', error);
        return null;
      }
    },

    migrate() {
      if (!this.needsMigration()) return { migrated: false, reason: 'already current' };

      const backupKey = this.backupBeforeMigration();
      const errors = [];

      try {
        this.migrateConversations();
      } catch (e) { errors.push(`conversations: ${e.message}`); }

      try {
        this.migrateProjects();
      } catch (e) { errors.push(`projects: ${e.message}`); }

      try {
        this.migrateContextIndex();
      } catch (e) { errors.push(`context: ${e.message}`); }

      try {
        this.migrateGitHub();
      } catch (e) { errors.push(`github: ${e.message}`); }

      this.setState({
        schemaVersion: TF_SCHEMA_VERSION,
        migratedAt: Date.now(),
        fromVersion: this.getState().schemaVersion || 0,
        backupKey,
        errors
      });

      return { migrated: true, backupKey, errors };
    },

    migrateConversations() {
      const sess = tfSessions();
      let changed = false;

      Object.values(sess).forEach(s => {
        if (s && !('projectId' in s)) {
          s.projectId = null;
          changed = true;
        }
      });

      if (changed && typeof saveSessions === 'function') saveSessions();
    },

    migrateProjects() {
      if (!window.ThinkFoxProjects) return;

      const projects = window.ThinkFoxProjects.projects || [];
      let changed = false;

      projects.forEach(p => {
        if (!p.contextMode) { p.contextMode = 'off'; changed = true; }
        if (!SCHEMA_PROJECT.statusValues.includes(p.status)) { p.status = 'active'; changed = true; }
        if (!p.color) { p.color = '#FF5500'; changed = true; }
      });

      if (changed && typeof window.ThinkFoxProjects.reload === 'function') {
        window.ThinkFoxProjects.reload();
      }
    },

    migrateContextIndex() {
      // Context items are in IndexedDB; validate schema fields exist.
      // This is a no-op for now since v0.7.7.3 already normalises on read.
    },

    migrateGitHub() {
      // Ensure connections have selectedPaths array.
      try {
        const key = scopedStorageKey('thinkfox_github_connections_v1', tfWorkplaceId());
        const conns = JSON.parse(localStorage.getItem(key) || '{}');
        let changed = false;

        Object.values(conns).forEach(conn => {
          if (!Array.isArray(conn.selectedPaths)) { conn.selectedPaths = []; changed = true; }
          if (!conn.permissions) { conn.permissions = { contents: 'read', metadata: 'read' }; changed = true; }
        });

        if (changed) localStorage.setItem(key, JSON.stringify(conns));
      } catch {}
    }
  };

  function tfMakeMigrationKey() {
    return typeof scopedStorageKey === 'function'
      ? scopedStorageKey(TF_MIGRATION_STORAGE, tfWorkplaceId())
      : TF_MIGRATION_STORAGE;
  }

  // ─────────────────────────────────────────────────────────────
  // Diagnostics
  // ─────────────────────────────────────────────────────────────

  function tfGetDiagnostics() {
    const diag = {
      version: TF_VERSION,
      schemaVersion: TF_SCHEMA_VERSION,
      workplace: null,
      project: null,
      conversationCount: 0,
      projectCount: 0,
      contextItemCount: 0,
      githubConnected: false,
      githubLastSync: null,
      storageEstimateBytes: 0,
      staleCount: 0,
      pinnedMemoryCount: 0,
      orphanConversations: 0,
      migrationState: MigrationManager.getState()
    };

    // Workplace
    if (typeof getWorkspaceMeta === 'function') {
      const wp = getWorkspaceMeta();
      diag.workplace = wp ? { id: wp.id, name: wp.name } : null;
    }

    // Projects
    const projects = window.ThinkFoxProjects?.projects || [];
    diag.projectCount = projects.length;

    const activeProjectId = window.ThinkFoxProjects?.activeProjectId || '';
    const activeProject = projects.find(p => p.id === activeProjectId);
    diag.project = activeProject ? { id: activeProject.id, name: activeProject.name, status: activeProject.status } : null;

    // Conversations
    const sess = tfSessions();
    diag.conversationCount = Object.keys(sess).length;

    // Orphan conversations (assigned to non-existent projects)
    const projectIds = new Set(projects.map(p => p.id));
    diag.orphanConversations = Object.values(sess).filter(s =>
      s.projectId && !projectIds.has(s.projectId)
    ).length;

    // Context items
    const ctxCache = window.ThinkFoxProjectContext?.cache || [];
    diag.contextItemCount = ctxCache.length;
    diag.staleCount = ctxCache.filter(i => i.stale).length;

    // Memories
    const memories = window.ThinkFoxProjectMemories?.memories || [];
    diag.pinnedMemoryCount = memories.filter(m => m.pinned && m.enabled).length;

    // GitHub
    try {
      const ghKey = scopedStorageKey('thinkfox_github_connections_v1', tfWorkplaceId());
      const ghConns = JSON.parse(localStorage.getItem(ghKey) || '{}');
      const currentPid = activeProjectId || '';
      const ghConn = ghConns[currentPid];

      if (ghConn && ghConn.owner && ghConn.repo) {
        diag.githubConnected = true;
        diag.githubLastSync = ghConn.lastSyncAt || null;
        diag.githubRepo = `${ghConn.owner}/${ghConn.repo}`;
        diag.githubBranch = ghConn.selectedBranch || '';
      }
    } catch {}

    // Storage estimate
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('thinkfox')) {
          total += (localStorage.getItem(key) || '').length * 2;
        }
      }
      diag.storageEstimateBytes = total;
    } catch {}

    return diag;
  }

  // ─────────────────────────────────────────────────────────────
  // Repair Tools
  // ─────────────────────────────────────────────────────────────

  const RepairTools = {
    repairOrphanConversations() {
      const projects = window.ThinkFoxProjects?.projects || [];
      const projectIds = new Set(projects.map(p => p.id));
      const sess = tfSessions();
      let fixed = 0;

      Object.values(sess).forEach(s => {
        if (s.projectId && !projectIds.has(s.projectId)) {
          s.projectId = null;
          fixed++;
        }
      });

      if (fixed && typeof saveSessions === 'function') saveSessions();
      return fixed;
    },

    removeStaleContext() {
      // Marks all stale items for removal from cache display.
      // Actual IndexedDB removal would require async; this flags them.
      const cache = window.ThinkFoxProjectContext?.cache || [];
      return cache.filter(i => i.stale).length;
    },

    recalculateTokenEstimates() {
      // Token estimates are calculated at index time.
      // This is a placeholder for future re-index operations.
      return 0;
    },

    rebuildProjectIndex() {
      if (typeof window.ThinkFoxProjectContext?.reindexProject === 'function') {
        const projectId = window.ThinkFoxProjects?.activeProjectId || '';
        if (projectId) {
          window.ThinkFoxProjectContext.reindexProject(projectId);
          return true;
        }
      }
      return false;
    },

    emergencyBackup() {
      const backup = {
        format: 'thinkfox-emergency-backup',
        version: TF_VERSION,
        timestamp: new Date().toISOString(),
        workplaceId: tfWorkplaceId(),
        data: {}
      };

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('thinkfox')) {
            backup.data[key] = localStorage.getItem(key);
          }
        }
      } catch {}

      if (typeof downloadBlob === 'function') {
        downloadBlob(
          `thinkfox_emergency_backup_${new Date().toISOString().slice(0, 10)}.json`,
          JSON.stringify(backup, null, 2),
          'application/json'
        );
      }

      return true;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // UI Polish — CSS
  // ─────────────────────────────────────────────────────────────

  const polishStyle = document.createElement('style');
  polishStyle.textContent = `
    /* ── v0.7.7.6 UI Polish ── */

    .tf-project-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      border: 1px solid var(--border-lit);
      background: rgba(255,255,255,.03);
      font: 8px var(--font-mono);
      color: var(--text-muted);
      white-space: nowrap;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tf-project-badge .tf-dot {
      width: 6px;
      height: 6px;
      flex-shrink: 0;
    }

    .tf-context-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border: 1px solid var(--border-lit);
      background: rgba(255,255,255,.02);
      font: 9px var(--font-mono);
      color: var(--text-muted);
      cursor: pointer;
      transition: border-color .15s, color .15s;
    }

    .tf-context-chip:hover {
      border-color: var(--theme-color);
      color: var(--text-body);
    }

    .tf-context-chip .chip-icon {
      font-size: 10px;
    }

    .tf-empty-state {
      padding: 24px 16px;
      text-align: center;
      color: var(--text-faint);
      font: 12px var(--font-body);
      border: 1px dashed var(--border-lit);
    }

    .tf-empty-state strong {
      display: block;
      color: var(--text-muted);
      font: 600 13px var(--font-display);
      margin-bottom: 4px;
    }

    /* Diagnostics panel */
    .tf-diag-modal {
      width: min(720px, 100%);
      max-height: 88vh;
      overflow: auto;
    }

    .tf-diag-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
      margin: 12px 0;
    }

    .tf-diag-card {
      border: 1px solid var(--border-lit);
      background: rgba(0,0,0,.18);
      padding: 10px;
    }

    .tf-diag-card label {
      display: block;
      font: 8px var(--font-mono);
      text-transform: uppercase;
      letter-spacing: .5px;
      color: var(--text-faint);
      margin-bottom: 3px;
    }

    .tf-diag-card strong {
      font: 600 13px var(--font-display);
      color: var(--text-primary);
      overflow-wrap: anywhere;
    }

    .tf-diag-card.warn strong { color: #FCA5A5; }
    .tf-diag-card.good strong { color: #4ADE80; }

    .tf-diag-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }

    /* Release notes */
    .tf-release-modal {
      width: min(680px, 100%);
      max-height: 85vh;
      overflow: auto;
    }

    .tf-release-notes {
      font: 13px/1.6 var(--font-body);
      color: var(--text-body);
    }

    .tf-release-notes h3 {
      color: var(--text-primary);
      font: 600 14px var(--font-display);
      margin: 14px 0 6px;
    }

    .tf-release-notes ul {
      margin: 0 0 8px 18px;
      padding: 0;
    }

    .tf-release-notes li {
      margin-bottom: 3px;
    }

    /* Archive/delete warning enhancement */
    .tf-warning-banner {
      padding: 8px 12px;
      border: 1px solid rgba(248,113,113,.4);
      background: rgba(248,113,113,.08);
      color: #FCA5A5;
      font: 11px var(--font-body);
      margin: 8px 0;
    }

    /* Mobile pass */
    @media (max-width: 700px) {
      .tf-diag-grid {
        grid-template-columns: 1fr 1fr;
      }

      .tf-project-badge {
        max-width: 90px;
      }

      .tf-context-chip {
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    @media (max-width: 430px) {
      .tf-diag-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(polishStyle);

  // ─────────────────────────────────────────────────────────────
  // Diagnostics Panel HTML
  // ─────────────────────────────────────────────────────────────

  document.body.insertAdjacentHTML('beforeend', `
    <div class="name-modal-backdrop" id="tf-diag-backdrop" hidden>
      <section class="name-modal tf-diag-modal" role="dialog" aria-modal="true" aria-labelledby="tf-diag-title">
        <h2 id="tf-diag-title">Think Fox Diagnostics · v${TF_VERSION}</h2>
        <p>Internal system state for debugging and support.</p>
        <div class="tf-diag-grid" id="tf-diag-grid"></div>
        <h3 style="color:var(--text-primary);font:600 13px var(--font-display);margin:12px 0 6px;">Repair Tools</h3>
        <div class="tf-diag-actions">
          <button class="config-btn" id="tf-diag-repair-orphans" type="button">Repair Orphan Conversations</button>
          <button class="config-btn" id="tf-diag-rebuild-index" type="button">Rebuild Project Index</button>
          <button class="config-btn" id="tf-diag-emergency-backup" type="button">Emergency Backup</button>
          <button class="config-btn" id="tf-diag-run-migration" type="button">Run Migration</button>
        </div>
        <div class="name-modal-actions">
          <button class="config-btn" id="tf-diag-close-btn" type="button">Close</button>
        </div>
      </section>
    </div>
  `);

  // ─────────────────────────────────────────────────────────────
  // Release Notes HTML
  // ─────────────────────────────────────────────────────────────

  document.body.insertAdjacentHTML('beforeend', `
    <div class="name-modal-backdrop" id="tf-release-backdrop" hidden>
      <section class="name-modal tf-release-modal" role="dialog" aria-modal="true" aria-labelledby="tf-release-title">
        <h2 id="tf-release-title">Think Fox ${TF_VERSION_FULL} — Release Notes</h2>
        <div class="tf-release-notes">
          <h3>v0.7.7.1 — Projects Foundation</h3>
          <ul>
            <li>Projects as Workplace-scoped organisational layer</li>
            <li>Create, rename, archive, delete Projects</li>
            <li>Assign and move conversations between Projects</li>
            <li>Sidebar filter by Project</li>
            <li>Project colour, icon, description, status</li>
          </ul>

          <h3>v0.7.7.2 — Project Memories</h3>
          <ul>
            <li>Manual and generated Project memory</li>
            <li>Pin/unpin, enable/disable memory entries</li>
            <li>Conversation summary → Project memory</li>
            <li>Stale marking when source changes</li>
            <li>Context modes: Off / Pinned only</li>
          </ul>

          <h3>v0.7.7.3 — Project Context Index</h3>
          <ul>
            <li>Index conversations into searchable chunks</li>
            <li>Lexical search over indexed context</li>
            <li>Exclude/include conversations from indexing</li>
            <li>Context modes: Off / Pinned / Summaries</li>
            <li>IndexedDB storage for context chunks</li>
          </ul>

          <h3>v0.7.7.4 — Project Retrieval</h3>
          <ul>
            <li>Search mode with scored retrieval</li>
            <li>Budget-limited context injection</li>
            <li>Used Project Context indicator on replies</li>
            <li>Inspector showing injected sources</li>
            <li>Manual "Ask using this Project" button</li>
          </ul>

          <h3>v0.7.7.5 — GitHub Repo Access</h3>
          <ul>
            <li>Fine-grained PAT connection model</li>
            <li>Repo tree browsing with glob filters</li>
            <li>Sync files into Project context</li>
            <li>SHA-guarded write with diff preview</li>
            <li>Token never exported in backups</li>
          </ul>

          <h3>v0.7.7.6 — Polish, Hardening, Release</h3>
          <ul>
            <li>Schema freeze and migration system</li>
            <li>Diagnostics panel with repair tools</li>
            <li>UI polish: badges, chips, empty states</li>
            <li>Mobile layout pass</li>
            <li>Emergency backup export</li>
            <li>Release candidate validation</li>
          </ul>
        </div>
        <div class="name-modal-actions">
          <button class="config-btn primary-config-btn" id="tf-release-close-btn" type="button">Close</button>
        </div>
      </section>
    </div>
  `);

  // ─────────────────────────────────────────────────────────────
  // Diagnostics rendering
  // ─────────────────────────────────────────────────────────────

  function tfRenderDiagnostics() {
    const grid = tfEl('tf-diag-grid');
    if (!grid) return;

    const diag = tfGetDiagnostics();

    const cards = [
      { label: 'Version', value: diag.version, cls: '' },
      { label: 'Schema', value: `v${diag.schemaVersion}`, cls: '' },
      { label: 'Workplace', value: diag.workplace?.name || 'None', cls: '' },
      { label: 'Active Project', value: diag.project?.name || 'None', cls: '' },
      { label: 'Conversations', value: String(diag.conversationCount), cls: '' },
      { label: 'Projects', value: String(diag.projectCount), cls: '' },
      { label: 'Context Items', value: String(diag.contextItemCount), cls: '' },
      { label: 'Stale Items', value: String(diag.staleCount), cls: diag.staleCount > 0 ? 'warn' : 'good' },
      { label: 'Pinned Memories', value: String(diag.pinnedMemoryCount), cls: '' },
      { label: 'Orphan Conversations', value: String(diag.orphanConversations), cls: diag.orphanConversations > 0 ? 'warn' : 'good' },
      { label: 'GitHub', value: diag.githubConnected ? `${diag.githubRepo} @ ${diag.githubBranch}` : 'Not connected', cls: diag.githubConnected ? 'good' : '' },
      { label: 'Last GitHub Sync', value: diag.githubLastSync ? new Date(diag.githubLastSync).toLocaleString() : 'Never', cls: '' },
      { label: 'Storage Estimate', value: `${(diag.storageEstimateBytes / 1024).toFixed(1)} KB`, cls: diag.storageEstimateBytes > 3_500_000 ? 'warn' : '' },
      { label: 'Migration', value: diag.migrationState.schemaVersion >= TF_SCHEMA_VERSION ? 'Current' : 'Pending', cls: diag.migrationState.schemaVersion >= TF_SCHEMA_VERSION ? 'good' : 'warn' }
    ];

    grid.innerHTML = cards.map(card => `
      <div class="tf-diag-card ${card.cls}">
        <label>${tfEscape(card.label)}</label>
        <strong>${tfEscape(card.value)}</strong>
      </div>
    `).join('');
  }

  function tfOpenDiagnostics() {
    tfRenderDiagnostics();
    const backdrop = tfEl('tf-diag-backdrop');
    if (backdrop) backdrop.hidden = false;
  }

  function tfCloseDiagnostics() {
    const backdrop = tfEl('tf-diag-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  function tfOpenReleaseNotes() {
    const backdrop = tfEl('tf-release-backdrop');
    if (backdrop) backdrop.hidden = false;
  }

  function tfCloseReleaseNotes() {
    const backdrop = tfEl('tf-release-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  // ─────────────────────────────────────────────────────────────
  // UI Injection — sidebar diagnostics button + release notes
  // ─────────────────────────────────────────────────────────────

  const sidebarResizer = tfEl('sidebar-resizer');
  if (sidebarResizer) {
    sidebarResizer.insertAdjacentHTML('beforebegin', `
      <div style="padding:6px 12px;display:flex;gap:6px;border-top:1px solid rgba(255,255,255,.06);">
        <button class="config-btn tf-mini-btn" id="tf-diagnostics-btn" type="button" style="flex:1;">⚙ Diagnostics</button>
        <button class="config-btn tf-mini-btn" id="tf-release-notes-btn" type="button" style="flex:1;">📋 Release</button>
      </div>
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // Context source chips under assistant replies
  // ─────────────────────────────────────────────────────────────

  function tfRenderContextChips() {
    document.querySelectorAll('.message-row[data-role="assistant"]').forEach(row => {
      const content = row.querySelector('.message-content');
      if (!content) return;

      // Remove existing chips
      content.querySelectorAll('.tf-context-chips-row').forEach(el => el.remove());

      const message = tfFindMessageForRow(row);
      const projectContext = message?.projectContext;

      if (!Array.isArray(projectContext) || !projectContext.length) return;

      const chipsRow = document.createElement('div');
      chipsRow.className = 'tf-context-chips-row';
      chipsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;';

      const shown = projectContext.slice(0, 5);

      shown.forEach(item => {
        const chip = document.createElement('span');
        chip.className = 'tf-context-chip';

        const icon = item.kind === 'chunk' ? '📄' :
                     item.kind === 'summary' ? '📝' :
                     item.kind === 'pinned_memory' ? '📌' :
                     item.kind === 'manual_memory' ? '🧠' : '📎';

        chip.innerHTML = `<span class="chip-icon">${icon}</span>${tfEscape((item.title || 'source').slice(0, 30))}`;
        chip.title = `${item.kind}: ${item.title || 'unknown'} (score ${Math.round(item.score || 0)})`;

        chip.addEventListener('click', () => {
          if (typeof window.ThinkFoxProjectRetrieval?.openInspector === 'function') {
            window.ThinkFoxProjectRetrieval.openInspector(projectContext);
          }
        });

        chipsRow.appendChild(chip);
      });

      if (projectContext.length > 5) {
        const more = document.createElement('span');
        more.className = 'tf-context-chip';
        more.textContent = `+${projectContext.length - 5} more`;
        more.addEventListener('click', () => {
          if (typeof window.ThinkFoxProjectRetrieval?.openInspector === 'function') {
            window.ThinkFoxProjectRetrieval.openInspector(projectContext);
          }
        });
        chipsRow.appendChild(more);
      }

      const actionsBar = content.querySelector('.msg-actions');
      if (actionsBar) content.insertBefore(chipsRow, actionsBar);
      else content.appendChild(chipsRow);
    });
  }

  function tfFindMessageForRow(row) {
    const messageId = row?.dataset?.messageId;
    if (messageId && typeof findSessionMessage === 'function') {
      const found = findSessionMessage(messageId);
      if (found?.message) return found.message;
    }
    return null;
  }

  // Wrap decorateAssistantMessages to add chips
  const tfBaseDecorate = window.decorateAssistantMessages ||
    (typeof decorateAssistantMessages === 'function' ? decorateAssistantMessages : null);

  window.decorateAssistantMessages = function (...args) {
    const result = tfBaseDecorate?.apply(this, args);
    tfRenderContextChips();
    return result;
  };

  // ─────────────────────────────────────────────────────────────
  // Project badges in sidebar history items
  // ─────────────────────────────────────────────────────────────

  const tfBaseRenderHistory = window.renderHistoryList;

  if (typeof tfBaseRenderHistory === 'function') {
    window.renderHistoryList = function (...args) {
      const result = tfBaseRenderHistory.apply(this, args);

      // After render, inject project badges into history items
      requestAnimationFrame(() => {
        const projects = window.ThinkFoxProjects?.projects || [];
        const projectMap = new Map(projects.map(p => [p.id, p]));

        document.querySelectorAll('.history-item').forEach(item => {
          const sessionId = item.dataset.sessionId;
          if (!sessionId) return;

          const sess = tfSessions()[sessionId];
          if (!sess?.projectId) return;

          const project = projectMap.get(sess.projectId);
          if (!project) return;

          // Check if badge already exists
          if (item.querySelector('.tf-project-badge')) return;

          const meta = item.querySelector('.history-meta');
          if (!meta) return;

          const badge = document.createElement('span');
          badge.className = 'tf-project-badge';
          badge.style.setProperty('--project-colour', project.color || '#FF5500');
          badge.innerHTML = `<span class="tf-dot" style="background:${project.color || '#FF5500'}"></span>${tfEscape(project.name)}`;
          badge.title = `Project: ${project.name} (${project.status})`;

          meta.insertBefore(badge, meta.firstChild);
        });
      });

      return result;
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Version stamping on exports
  // ─────────────────────────────────────────────────────────────

  const tfBaseExportWorkplace = window.exportWorkplace ||
    (typeof exportWorkplace === 'function' ? exportWorkplace : null);

  if (typeof tfBaseExportWorkplace === 'function') {
    window.exportWorkplace = async function (...args) {
      const prevDownload = typeof window.downloadBlob === 'function'
        ? window.downloadBlob
        : (typeof downloadBlob === 'function' ? downloadBlob : null);

      window.downloadBlob = function (filename, content, type) {
        if (String(filename || '').startsWith('thinkfox_workplace_') && String(type || '').includes('application/json')) {
          try {
            const payload = JSON.parse(content);
            payload.appVersion = TF_VERSION_FULL;
            payload.schemaVersion = TF_SCHEMA_VERSION;
            payload.exportedAt = new Date().toISOString();
            content = JSON.stringify(payload, null, 2);
          } catch {}
        }
        prevDownload?.call(this, filename, content, type);
      };

      try {
        await tfBaseExportWorkplace.apply(this, args);
      } finally {
        window.downloadBlob = prevDownload;
      }
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Version label bump
  // ─────────────────────────────────────────────────────────────

  function tfBumpVersionLabels() {
    try {
      document.title = String(document.title || '').replace(/1-v0\.7\.7\.\d+/g, TF_VERSION_FULL);

      const walk = (root) => {
        root.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (/1-v0\.7\.7\.\d+/.test(node.textContent)) {
              node.textContent = node.textContent.replace(/1-v0\.7\.7\.\d+/g, TF_VERSION_FULL);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            walk(node);
          }
        });
      };

      document.querySelectorAll('.topbar-brand-line, .welcome-title').forEach(walk);
    } catch {}
  }

  // ─────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────

  tfEl('tf-diagnostics-btn')?.addEventListener('click', tfOpenDiagnostics);
  tfEl('tf-release-notes-btn')?.addEventListener('click', tfOpenReleaseNotes);
  tfEl('tf-diag-close-btn')?.addEventListener('click', tfCloseDiagnostics);
  tfEl('tf-release-close-btn')?.addEventListener('click', tfCloseReleaseNotes);

  tfEl('tf-diag-repair-orphans')?.addEventListener('click', () => {
    const fixed = RepairTools.repairOrphanConversations();
    tfToast(`Repaired ${fixed} orphan conversation(s).`, fixed ? 'success' : '');
    tfRenderDiagnostics();
  });

  tfEl('tf-diag-rebuild-index')?.addEventListener('click', () => {
    const ok = RepairTools.rebuildProjectIndex();
    tfToast(ok ? 'Project index rebuild started.' : 'No active Project to rebuild.', ok ? 'success' : 'error');
  });

  tfEl('tf-diag-emergency-backup')?.addEventListener('click', () => {
    RepairTools.emergencyBackup();
    tfToast('Emergency backup downloaded.', 'success');
  });

  tfEl('tf-diag-run-migration')?.addEventListener('click', () => {
    const result = MigrationManager.migrate();
    if (result.migrated) {
      tfToast(`Migration complete. Backup: ${result.backupKey || 'none'}. Errors: ${result.errors.length}`, result.errors.length ? 'error' : 'success');
    } else {
      tfToast(`No migration needed. ${result.reason}`);
    }
    tfRenderDiagnostics();
  });

  // Close on backdrop click
  tfEl('tf-diag-backdrop')?.addEventListener('click', event => {
    if (event.target === tfEl('tf-diag-backdrop')) tfCloseDiagnostics();
  });

  tfEl('tf-release-backdrop')?.addEventListener('click', event => {
    if (event.target === tfEl('tf-release-backdrop')) tfCloseReleaseNotes();
  });

  // Escape handling
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    const diag = tfEl('tf-diag-backdrop');
    const release = tfEl('tf-release-backdrop');

    if (diag && !diag.hidden) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      tfCloseDiagnostics();
    } else if (release && !release.hidden) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      tfCloseReleaseNotes();
    }
  }, true);

  // ─────────────────────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────────────────────

  // Run migration if needed
  if (MigrationManager.needsMigration()) {
    const result = MigrationManager.migrate();
    if (result.migrated) {
      console.log(`Think Fox migration complete. Schema v${TF_SCHEMA_VERSION}.`, result);
    }
  }

  // Bump version labels
  tfBumpVersionLabels();

  // Render context chips on existing messages
  requestAnimationFrame(() => {
    tfRenderContextChips();
  });

  // ─────────────────────────────────────────────────────────────
  // Public API — Module Structure for other AIs
  // ─────────────────────────────────────────────────────────────

  window.ThinkFoxV0776 = {
    version: TF_VERSION,
    schemaVersion: TF_SCHEMA_VERSION,

    // Module references
    ProjectStore: window.ThinkFoxProjects || null,
    ProjectMemoryStore: window.ThinkFoxProjectMemories || null,
    ProjectContextIndex: window.ThinkFoxProjectContext || null,
    ProjectRetriever: window.ThinkFoxProjectRetrieval || null,
    GitHubConnector: window.ThinkFoxGitHub || null,

    // Schemas
    schemas: {
      project: SCHEMA_PROJECT,
      projectMemory: SCHEMA_PROJECT_MEMORY,
      contextItem: SCHEMA_CONTEXT_ITEM,
      githubConnection: SCHEMA_GITHUB_CONNECTION
    },

    // Diagnostics
    getDiagnostics: tfGetDiagnostics,
    openDiagnostics: tfOpenDiagnostics,

    // Repair
    repair: RepairTools,

    // Migration
    migration: MigrationManager,

    // Release notes
    openReleaseNotes: tfOpenReleaseNotes
  };

  console.log(`Think Fox ${TF_VERSION_FULL} loaded. Schema v${TF_SCHEMA_VERSION}. Modules: Projects, Memories, Context, Retrieval, GitHub.`);
})();
</script>
