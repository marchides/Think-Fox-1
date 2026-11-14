<script>
(() => {
  if (window.__thinkfoxProjectsV0771) return;
  window.__thinkfoxProjectsV0771 = true;

  // Guard: this patch expects the v0.7.7 base runtime.
  if (
    typeof scopedStorageKey !== 'function' ||
    typeof sessions === 'undefined' ||
    typeof saveSessions !== 'function' ||
    typeof renderHistoryList !== 'function'
  ) {
    console.warn('Think Fox Projects v0.7.7.1 patch: base runtime not detected.');
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // v0.7.7.1 — Projects Foundation
  // Projects are Workplace-scoped.
  // Conversations remain flat and receive projectId only.
  // contextMode is hard-locked to "off" in this stage.
  // ─────────────────────────────────────────────────────────────

  const TF_PROJECT_INDEX_STORAGE = 'thinkfox_projects_index_v1';
  const TF_PROJECT_ACTIVE_STORAGE = 'thinkfox_active_project_v1';
  const TF_PROJECT_FILTER_STORAGE = 'thinkfox_project_filter_v1';

  let tfProjects = [];
  let tfActiveProjectId = '';
  let tfProjectFilter = 'current'; // current | all | unassigned | archived
  let tfEditingProjectId = null;

  const tfEl = (id) => document.getElementById(id);

  // ── Storage keys ─────────────────────────────────────────────

  function tfProjectsStorageKey(id = activeWorkplaceId) {
    return scopedStorageKey(TF_PROJECT_INDEX_STORAGE, id);
  }

  function tfActiveProjectStorageKey(id = activeWorkplaceId) {
    return scopedStorageKey(TF_PROJECT_ACTIVE_STORAGE, id);
  }

  function tfProjectFilterStorageKey(id = activeWorkplaceId) {
    return scopedStorageKey(TF_PROJECT_FILTER_STORAGE, id);
  }

  // ── Normalisation ────────────────────────────────────────────

  function tfNormalizeProject(raw, workplaceId = activeWorkplaceId) {
    if (!raw || typeof raw !== 'object') return null;

    const now = Date.now();
    const name = cleanSingleLine(raw.name || '', 80);
    if (!name) return null;

    const status = ['active', 'paused', 'archived'].includes(raw.status)
      ? raw.status
      : 'active';

    return {
      id: String(raw.id || makeLocalId('project')),
      workplaceId: String(raw.workplaceId || workplaceId || activeWorkplaceId),
      name,
      description: String(raw.description || '').replace(/\u0000/g, '').slice(0, 500),
      color: normaliseHexColour(raw.color, '#FF5500'),
      icon: cleanSingleLine(raw.icon || '', 8),
      status,
      contextMode: 'off',
      created: Number.isFinite(Number(raw.created)) ? Number(raw.created) : now,
      updated: Number.isFinite(Number(raw.updated)) ? Number(raw.updated) : now
    };
  }

  function tfProjectById(id) {
    if (!id) return null;
    return tfProjects.find(project => project.id === id) || null;
  }

  function tfVisibleProjects() {
    return tfProjects
      .filter(project => project.status !== 'archived')
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function tfConversationProject(sess) {
    if (!sess || !sess.projectId) return null;
    return tfProjectById(sess.projectId);
  }

  function tfConversationPassesProjectFilter(sess) {
    const project = tfConversationProject(sess);

    if (tfProjectFilter === 'archived') {
      return Boolean(project && project.status === 'archived');
    }

    // Archived Projects are hidden by default in all non-archived views.
    if (project && project.status === 'archived') return false;

    if (tfProjectFilter === 'all') return true;

    if (tfProjectFilter === 'unassigned') {
      return !project;
    }

    if (tfProjectFilter === 'current') {
      if (!tfActiveProjectId) return !project;
      return Boolean(project && project.id === tfActiveProjectId);
    }

    return true;
  }

  // ── Persistence ──────────────────────────────────────────────

  function tfLoadProjects() {
    try {
      const raw = JSON.parse(localStorage.getItem(tfProjectsStorageKey()) || '[]');
      tfProjects = Array.isArray(raw)
        ? raw.map(item => tfNormalizeProject(item)).filter(Boolean)
        : [];
    } catch {
      tfProjects = [];
    }

    try {
      tfActiveProjectId = String(localStorage.getItem(tfActiveProjectStorageKey()) || '');
    } catch {
      tfActiveProjectId = '';
    }

    try {
      tfProjectFilter = String(localStorage.getItem(tfProjectFilterStorageKey()) || 'current');
    } catch {
      tfProjectFilter = 'current';
    }

    if (!['current', 'all', 'unassigned', 'archived'].includes(tfProjectFilter)) {
      tfProjectFilter = 'current';
    }

    const active = tfProjectById(tfActiveProjectId);
    if (!active || active.status === 'archived') {
      tfActiveProjectId = '';
    }

    tfRenderProjectUI();
  }

  function tfSaveProjects() {
    try {
      localStorage.setItem(tfProjectsStorageKey(), JSON.stringify(tfProjects));
      localStorage.setItem(tfActiveProjectStorageKey(), tfActiveProjectId || '');
      localStorage.setItem(tfProjectFilterStorageKey(), tfProjectFilter);
      if (typeof touchWorkplace === 'function') touchWorkplace();
    } catch (error) {
      console.warn('Think Fox Projects: could not save projects.', error);
    }

    tfRenderProjectUI();
    if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
  }

  function tfReadStoredProjects(id) {
    try {
      const raw = JSON.parse(localStorage.getItem(tfProjectsStorageKey(id)) || '[]');
      return Array.isArray(raw)
        ? raw.map(item => tfNormalizeProject(item, id)).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  function tfReadStoredActiveProject(id) {
    try {
      return String(localStorage.getItem(tfActiveProjectStorageKey(id)) || '');
    } catch {
      return '';
    }
  }

  function tfReadStoredProjectFilter(id) {
    try {
      const value = String(localStorage.getItem(tfProjectFilterStorageKey(id)) || 'current');
      return ['current', 'all', 'unassigned', 'archived'].includes(value) ? value : 'current';
    } catch {
      return 'current';
    }
  }

  // ── CRUD / state control ─────────────────────────────────────

  function tfCreateProject(data) {
    const project = tfNormalizeProject({
      ...data,
      id: makeLocalId('project'),
      workplaceId: activeWorkplaceId,
      created: Date.now(),
      updated: Date.now()
    });

    if (!project) return null;

    tfProjects.unshift(project);
    tfSaveProjects();
    return project;
  }

  function tfUpdateProject(id, patch) {
    const project = tfProjectById(id);
    if (!project) return;

    const safePatch = { ...(patch || {}) };

    if ('name' in safePatch) {
      const name = cleanSingleLine(safePatch.name, 80);
      if (!name) delete safePatch.name;
      else safePatch.name = name;
    }

    if ('description' in safePatch) {
      safePatch.description = String(safePatch.description || '').replace(/\u0000/g, '').slice(0, 500);
    }

    if ('color' in safePatch) {
      safePatch.color = normaliseHexColour(safePatch.color, project.color);
    }

    if ('icon' in safePatch) {
      safePatch.icon = cleanSingleLine(safePatch.icon, 8);
    }

    if ('status' in safePatch) {
      if (!['active', 'paused', 'archived'].includes(safePatch.status)) {
        delete safePatch.status;
      }
    }

    delete safePatch.id;
    delete safePatch.workplaceId;
    delete safePatch.created;
    delete safePatch.contextMode;

    Object.assign(project, safePatch, { updated: Date.now() });

    if (project.status === 'archived' && tfActiveProjectId === project.id) {
      tfActiveProjectId = '';
    }

    tfSaveProjects();
  }

  function tfDeleteProject(id) {
    const project = tfProjectById(id);
    if (!project) return;

    if (!confirm(`Delete project "${project.name}"?\n\nConversations assigned to it will become Unassigned.`)) {
      return;
    }

    tfProjects = tfProjects.filter(item => item.id !== id);

    Object.values(sessions || {}).forEach(sess => {
      if (sess && sess.projectId === id) sess.projectId = null;
    });

    if (tfActiveProjectId === id) tfActiveProjectId = '';

    saveSessions();
    tfSaveProjects();
    showToast('Project deleted. Assigned conversations moved to Unassigned.', 'success');
  }

  function tfSetActiveProject(id) {
    const project = tfProjectById(id);
    tfActiveProjectId = project && project.status !== 'archived' ? project.id : '';
    tfSaveProjects();
  }

  function tfSetProjectFilter(mode) {
    tfProjectFilter = ['current', 'all', 'unassigned', 'archived'].includes(mode)
      ? mode
      : 'current';
    tfSaveProjects();
  }

  function tfAssignConversationProject(sessionId, projectId) {
    const sess = sessions[sessionId];
    if (!sess) return;

    const project = tfProjectById(projectId);
    sess.projectId = project ? project.id : null;

    saveSessions();
    if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
    tfUpdateTopbarProject();
  }

  function tfEditSessionProject(sessionId) {
    const sess = sessions[sessionId];
    if (!sess) return;

    const choices = tfProjects.length
      ? tfProjects.map((project, index) => `${index + 1}: ${project.name} (${project.status})`).join('\n')
      : 'No projects exist yet.';

    const currentIndex = tfProjects.findIndex(project => project.id === sess.projectId) + 1;

    const answer = prompt(
      `Move conversation to project:\n\n0: No project / Unassigned\n${choices}`,
      String(Math.max(0, currentIndex))
    );

    if (answer === null) return;

    const selected = Number.parseInt(answer, 10) || 0;
    if (selected < 0 || selected > tfProjects.length) return;

    tfAssignConversationProject(sessionId, selected === 0 ? null : tfProjects[selected - 1].id);
  }

  // ── UI injection ─────────────────────────────────────────────

  const tfStyle = document.createElement('style');
  tfStyle.textContent = `
    .tf-project-context {
      border-bottom: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.015);
      padding: 10px 12px;
      display: grid;
      gap: 8px;
    }

    .tf-project-row {
      display: grid;
      grid-template-columns: 62px minmax(0,1fr) auto;
      gap: 6px;
      align-items: center;
    }

    .tf-project-row label {
      font: 9px var(--font-mono);
      letter-spacing: .5px;
      text-transform: uppercase;
      color: var(--text-faint);
    }

    .tf-project-row select {
      width: 100%;
      min-width: 0;
      background: var(--bg-void);
      border: 1px solid var(--border);
      color: var(--text-body);
      padding: 5px 6px;
      font: 11px var(--font-body);
      outline: none;
    }

    .tf-project-row select:focus {
      border-color: var(--theme-color);
    }

    .tf-mini-btn {
      padding: 5px 8px;
      font-size: 11px;
      white-space: nowrap;
    }

    .tf-topbar-context {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 2px 0 1px;
      font: 10px var(--font-mono);
      color: var(--text-muted);
    }

    .tf-topbar-context span {
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border: 1px solid var(--border-lit);
      background: rgba(255,255,255,.02);
      padding: 2px 6px;
    }

    .history-project {
      --project-colour: var(--theme-color);
      display: inline-flex;
      align-items: center;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border: 1px solid color-mix(in srgb, var(--project-colour) 55%, transparent);
      padding: 1px 5px;
      color: var(--text-muted);
      font: 8px var(--font-mono);
    }

    .tf-project-modal {
      width: min(780px, 100%);
      max-height: 88vh;
      overflow: auto;
    }

    .tf-project-form {
      display: grid;
      gap: 8px;
      margin: 12px 0;
      padding: 12px;
      border: 1px solid var(--border-lit);
      background: rgba(0,0,0,.20);
    }

    .tf-project-form input,
    .tf-project-form select,
    .tf-project-form textarea {
      width: 100%;
      background: var(--bg-void);
      border: 1px solid var(--border-lit);
      color: var(--text-body);
      padding: 8px;
      font: 13px var(--font-body);
      outline: none;
    }

    .tf-project-form input:focus,
    .tf-project-form select:focus,
    .tf-project-form textarea:focus {
      border-color: var(--theme-color);
    }

    .tf-project-form textarea {
      min-height: 72px;
      resize: vertical;
    }

    .tf-project-field-row {
      display: grid;
      grid-template-columns: 58px 96px minmax(0,1fr);
      gap: 8px;
    }

    .tf-project-list {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }

    .tf-project-card {
      border: 1px solid var(--border-lit);
      background: rgba(0,0,0,.18);
      padding: 10px;
      display: grid;
      gap: 8px;
    }

    .tf-project-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .tf-project-card-title {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: var(--text-primary);
      font: 600 13px var(--font-display);
    }

    .tf-project-dot {
      width: 8px;
      height: 8px;
      flex: 0 0 auto;
      background: var(--theme-color);
    }

    .tf-project-desc {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .tf-project-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    @media (max-width: 700px) {
      .tf-project-row {
        grid-template-columns: minmax(0,1fr);
      }

      .tf-project-row label {
        display: none;
      }

      .tf-project-field-row {
        grid-template-columns: 1fr 1fr;
      }

      .tf-topbar-context span {
        max-width: 170px;
      }
    }
  `;
  document.head.appendChild(tfStyle);

  const sidebarHeader = document.querySelector('.sidebar-header');
  if (sidebarHeader) {
    sidebarHeader.insertAdjacentHTML('afterend', `
      <div class="tf-project-context" id="tf-project-context">
        <div class="tf-project-row">
          <label for="tf-workplace-select">Workplace</label>
          <select id="tf-workplace-select" aria-label="Switch Workplace"></select>
          <button class="config-btn tf-mini-btn" id="tf-workplace-open-btn" type="button">Open</button>
        </div>
        <div class="tf-project-row">
          <label for="tf-project-select">Project</label>
          <select id="tf-project-select" aria-label="Active Project"></select>
          <button class="config-btn tf-mini-btn" id="tf-project-manage-btn" type="button">Manage</button>
        </div>
        <div class="tf-project-row">
          <label for="tf-project-filter-select">Filter</label>
          <select id="tf-project-filter-select" aria-label="Project conversation filter">
            <option value="current">Current Project only</option>
            <option value="all">All Projects</option>
            <option value="unassigned">Unassigned</option>
            <option value="archived">Archived Projects</option>
          </select>
          <button class="config-btn tf-mini-btn" id="tf-assign-current-project-btn" type="button" title="Assign current conversation to the selected Project">Assign</button>
        </div>
      </div>
    `);
  }

  const brandLine = document.querySelector('.topbar-brand-line');
  if (brandLine) {
    brandLine.insertAdjacentHTML('afterend', `
      <div class="tf-topbar-context" id="tf-topbar-context"></div>
    `);
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div class="name-modal-backdrop" id="tf-project-modal-backdrop" hidden>
      <section class="name-modal tf-project-modal" role="dialog" aria-modal="true" aria-labelledby="tf-project-modal-title">
        <h2 id="tf-project-modal-title">Projects</h2>
        <p>Projects organise conversations inside this Workplace. Context injection remains off in v0.7.7.1.</p>

        <div class="tf-project-form">
          <input id="tf-project-name" maxlength="80" placeholder="Project name" />
          <textarea id="tf-project-description" maxlength="500" placeholder="Project description"></textarea>
          <div class="tf-project-field-row">
            <input type="color" id="tf-project-color" value="#FF5500" aria-label="Project colour" />
            <input id="tf-project-icon" maxlength="8" placeholder="Icon" aria-label="Project icon" />
            <select id="tf-project-status" aria-label="Project status">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div class="name-modal-actions">
            <button class="config-btn" id="tf-project-new-btn" type="button">New</button>
            <button class="config-btn primary-config-btn" id="tf-project-save-btn" type="button">Save Project</button>
          </div>
        </div>

        <div class="tf-project-list" id="tf-project-list"></div>

        <div class="name-modal-actions">
          <button class="config-btn" id="tf-project-close-btn" type="button">Close</button>
        </div>
      </section>
    </div>
  `);

  // ── Rendering ────────────────────────────────────────────────

  function tfRenderWorkplaceSelect() {
    const select = tfEl('tf-workplace-select');
    if (!select) return;

    select.innerHTML = '';

    (workplaces || [])
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .forEach(wp => {
        const option = document.createElement('option');
        option.value = wp.id;
        option.textContent = wp.name;
        option.selected = wp.id === activeWorkplaceId;
        select.appendChild(option);
      });
  }

  function tfRenderProjectSelect() {
    const select = tfEl('tf-project-select');
    if (!select) return;

    select.innerHTML = '';

    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = tfVisibleProjects().length ? 'No Project' : 'No Projects';
    select.appendChild(noneOption);

    tfVisibleProjects().forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = `${project.icon ? project.icon + ' ' : ''}${project.name}${project.status === 'paused' ? ' · Paused' : ''}`;
      option.selected = project.id === tfActiveProjectId;
      select.appendChild(option);
    });

    if (!tfProjectById(tfActiveProjectId)) {
      select.value = '';
    }
  }

  function tfRenderFilterSelect() {
    const select = tfEl('tf-project-filter-select');
    if (!select) return;
    select.value = tfProjectFilter;
  }

  function tfUpdateTopbarProject() {
    const box = tfEl('tf-topbar-context');
    if (!box) return;

    box.innerHTML = '';

    const addChip = (text, title = '') => {
      const span = document.createElement('span');
      span.textContent = text;
      if (title) span.title = title;
      box.appendChild(span);
    };

    const workplace = typeof getWorkspaceMeta === 'function' ? getWorkspaceMeta(activeWorkplaceId) : null;
    const activeProject = tfProjectById(tfActiveProjectId);
    const sess = currentSessionId ? sessions[currentSessionId] : null;
    const conversationProject = sess ? tfConversationProject(sess) : null;

    if (workplace) addChip(`Workplace: ${workplace.name}`);
    addChip(`Project: ${activeProject ? activeProject.name : 'None'}`);

    if (sess) {
      addChip(
        `Conversation: ${conversationProject ? conversationProject.name : 'Unassigned'}`,
        sess.title || 'Conversation'
      );
    }
  }

  function tfRenderProjectModalList() {
    const list = tfEl('tf-project-list');
    if (!list) return;

    list.innerHTML = '';

    if (!tfProjects.length) {
      list.innerHTML = '<div class="memory-empty">No projects in this Workplace yet.</div>';
      return;
    }

    const sorted = tfProjects.slice().sort((a, b) => {
      const archivedA = a.status === 'archived' ? 1 : 0;
      const archivedB = b.status === 'archived' ? 1 : 0;
      return archivedA - archivedB || a.name.localeCompare(b.name);
    });

    sorted.forEach(project => {
      const card = document.createElement('article');
      card.className = 'tf-project-card';

      const head = document.createElement('div');
      head.className = 'tf-project-card-head';

      const title = document.createElement('div');
      title.className = 'tf-project-card-title';

      const dot = document.createElement('span');
      dot.className = 'tf-project-dot';
      dot.style.background = project.color;

      const label = document.createElement('span');
      label.textContent = `${project.icon ? project.icon + ' ' : ''}${project.name}`;
      label.title = `${project.name} · ${project.status}`;

      title.append(dot, label);

      const status = document.createElement('span');
      status.className = `engine-live-state${project.status === 'active' ? ' live' : ''}`;
      status.textContent = project.status.toUpperCase();

      head.append(title, status);

      const desc = document.createElement('div');
      desc.className = 'tf-project-desc';
      desc.textContent = project.description || `Context mode: ${project.contextMode}`;

      const actions = document.createElement('div');
      actions.className = 'tf-project-actions';

      const makeButton = (text, className, onClick, disabled = false) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `config-btn ${className}`.trim();
        button.textContent = text;
        button.disabled = disabled;
        button.addEventListener('click', onClick);
        return button;
      };

      if (project.status !== 'archived') {
        actions.appendChild(
          makeButton(
            tfActiveProjectId === project.id ? 'Active' : 'Set Active',
            'primary-config-btn',
            () => tfSetActiveProject(project.id),
            tfActiveProjectId === project.id
          )
        );
      }

      actions.appendChild(makeButton('Edit', '', () => tfBeginProjectEdit(project.id)));
      actions.appendChild(
        makeButton(
          project.status === 'archived' ? 'Unarchive' : 'Archive',
          '',
          () => tfUpdateProject(project.id, { status: project.status === 'archived' ? 'active' : 'archived' })
        )
      );
      actions.appendChild(makeButton('Delete', 'danger-btn', () => tfDeleteProject(project.id)));

      card.append(head, desc, actions);
      list.appendChild(card);
    });
  }

  function tfRenderProjectUI() {
    tfRenderWorkplaceSelect();
    tfRenderProjectSelect();
    tfRenderFilterSelect();
    tfRenderProjectModalList();
    tfUpdateTopbarProject();
  }

  // ── Project form ─────────────────────────────────────────────

  function tfResetProjectForm() {
    tfEditingProjectId = null;

    const name = tfEl('tf-project-name');
    const description = tfEl('tf-project-description');
    const color = tfEl('tf-project-color');
    const icon = tfEl('tf-project-icon');
    const status = tfEl('tf-project-status');
    const save = tfEl('tf-project-save-btn');

    if (name) name.value = '';
    if (description) description.value = '';
    if (color) color.value = '#FF5500';
    if (icon) icon.value = '';
    if (status) status.value = 'active';
    if (save) save.textContent = 'Save Project';
  }

  function tfBeginProjectEdit(id) {
    const project = tfProjectById(id);
    if (!project) return;

    tfEditingProjectId = id;

    const name = tfEl('tf-project-name');
    const description = tfEl('tf-project-description');
    const color = tfEl('tf-project-color');
    const icon = tfEl('tf-project-icon');
    const status = tfEl('tf-project-status');
    const save = tfEl('tf-project-save-btn');

    if (name) name.value = project.name;
    if (description) description.value = project.description || '';
    if (color) color.value = project.color;
    if (icon) icon.value = project.icon || '';
    if (status) status.value = project.status;
    if (save) save.textContent = 'Update Project';

    tfEl('tf-project-name')?.focus();
  }

  function tfSaveProjectFromForm() {
    const name = cleanSingleLine(tfEl('tf-project-name')?.value || '', 80);

    if (!name) {
      showToast('Project needs a name.', 'error');
      tfEl('tf-project-name')?.focus();
      return;
    }

    const data = {
      name,
      description: String(tfEl('tf-project-description')?.value || '').replace(/\u0000/g, '').slice(0, 500),
      color: normaliseHexColour(tfEl('tf-project-color')?.value, '#FF5500'),
      icon: cleanSingleLine(tfEl('tf-project-icon')?.value || '', 8),
      status: ['active', 'paused', 'archived'].includes(tfEl('tf-project-status')?.value)
        ? tfEl('tf-project-status').value
        : 'active'
    };

    if (tfEditingProjectId) {
      tfUpdateProject(tfEditingProjectId, data);
      showToast('Project updated.', 'success');
    } else {
      const project = tfCreateProject(data);
      if (project && project.status !== 'archived' && !tfActiveProjectId) {
        tfSetActiveProject(project.id);
      }
      showToast('Project created.', 'success');
    }

    tfResetProjectForm();
  }

  function tfOpenProjectModal() {
    tfResetProjectForm();
    tfRenderProjectModalList();
    const backdrop = tfEl('tf-project-modal-backdrop');
    if (backdrop) backdrop.hidden = false;
    tfEl('tf-project-name')?.focus();
  }

  function tfCloseProjectModal() {
    const backdrop = tfEl('tf-project-modal-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  // ── Replace history rendering with Project-aware version ─────

  const tfRenderHistoryList = function () {
    if (typeof renderFolderStrip === 'function') renderFolderStrip();

    const searchTerm = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
    if (!historyList) return;

    historyList.innerHTML = '';

    let sorted = Object.entries(sessions || {})
      .filter(([, sess]) => tfConversationPassesProjectFilter(sess))
      .sort((a, b) => (b[1].created || 0) - (a[1].created || 0));

    if (activeFolderFilter !== 'all') {
      sorted = sorted.filter(([, sess]) => sess.folderId === activeFolderFilter);
    }

    if (searchTerm) {
      sorted = sorted.filter(([, sess]) => {
        const project = tfConversationProject(sess);

        if ((sess.title || '').toLowerCase().includes(searchTerm)) return true;
        if (project && project.name.toLowerCase().includes(searchTerm)) return true;
        if ((sess.tags || []).some(tag => tag.name.toLowerCase().includes(searchTerm))) return true;

        return (sess.messages || []).some(message =>
          String(message.content || '').toLowerCase().includes(searchTerm)
        );
      });
    }

    if (!sorted.length) {
      historyList.innerHTML = `
        <div style="padding:12px;color:var(--text-faint); font-family:var(--font-offside);">
          ${searchTerm ? 'No matches found.' : 'No conversations for this Project filter.'}
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    sorted.forEach(([id, sess]) => {
      const div = document.createElement('div');
      div.className = 'history-item' + (id === currentSessionId ? ' active' : '');
      div.draggable = true;
      div.dataset.sessionId = id;

      const folder = typeof getFolder === 'function' ? getFolder(sess.folderId) : null;
      const project = tfConversationProject(sess);

      const tags = (sess.tags || [])
        .map(tag => `<span class="history-tag" style="--tag-colour:${escapeHtml(tag.colour)}">${escapeHtml(tag.name)}</span>`)
        .join('');

      const projectChip = project
        ? `<span class="history-project" style="--project-colour:${escapeHtml(project.color)}" title="${escapeHtml(project.name)} (${escapeHtml(project.status)})">${project.icon ? escapeHtml(project.icon) + ' ' : ''}${escapeHtml(project.name)}</span>`
        : '';

      const folderChip = folder
        ? `<span class="history-folder" style="--folder-colour:${escapeHtml(folder.colour)}">${escapeHtml(folder.name)}</span>`
        : '';

      div.innerHTML = `
        <div class="history-copy">
          <span class="history-title-text">${escapeHtml(sess.title || 'New conversation')}</span>
          <div class="history-meta">
            ${projectChip}
            ${folderChip}
            ${tags}
          </div>
        </div>
        <div class="history-actions">
          <button class="hist-btn" data-project="${id}" aria-label="Move to project" title="Move to Project">🧩</button>
          <button class="hist-btn" data-folder="${id}" aria-label="Move to folder" title="Move to folder">📁</button>
          <button class="hist-btn" data-tags="${id}" aria-label="Edit tags" title="Edit coloured tags">🏷</button>
          <button class="hist-btn" data-rename="${id}" aria-label="Rename conversation" title="Rename">✏️</button>
          <button class="hist-btn" data-delete="${id}" aria-label="Delete conversation" title="Delete">🗑️</button>
        </div>
      `;

      div.addEventListener('dragstart', event => {
        event.dataTransfer?.setData('text/thinkfox-session', id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        div.classList.add('dragging');
      });

      div.addEventListener('dragend', () => div.classList.remove('dragging'));

      div.addEventListener('click', event => {
        if (!event.target.closest('.hist-btn')) loadSession(id);
      });

      div.querySelector('[data-project]')?.addEventListener('click', event => {
        event.stopPropagation();
        tfEditSessionProject(id);
      });

      div.querySelector('[data-folder]')?.addEventListener('click', event => {
        event.stopPropagation();
        editSessionFolder(id);
      });

      div.querySelector('[data-tags]')?.addEventListener('click', event => {
        event.stopPropagation();
        editSessionTags(id);
      });

      div.querySelector('[data-rename]')?.addEventListener('click', event => {
        event.stopPropagation();
        renameSession(id);
      });

      div.querySelector('[data-delete]')?.addEventListener('click', event => {
        event.stopPropagation();
        deleteSession(id);
      });

      fragment.appendChild(div);
    });

    historyList.appendChild(fragment);
  };

  window.renderHistoryList = tfRenderHistoryList;

  // ── Wrap core runtime for Workplace/session integration ──────

  const originalLoadSessions = typeof loadSessions === 'function' ? loadSessions : null;
  if (originalLoadSessions) {
    window.loadSessions = function () {
      const parsed = originalLoadSessions();
      Object.values(parsed || {}).forEach(sess => {
        if (sess && !('projectId' in sess)) sess.projectId = null;
      });
      return parsed;
    };
  }

  const originalNewSession = typeof newSession === 'function' ? newSession : null;
  if (originalNewSession) {
    window.newSession = function () {
      const id = originalNewSession();
      if (id && sessions[id] && !('projectId' in sessions[id])) {
        sessions[id].projectId = null;
        saveSessions();
      }
      return id;
    };
  }

  const originalSetTopbarTitle = typeof setTopbarTitle === 'function' ? setTopbarTitle : null;
  if (originalSetTopbarTitle) {
    window.setTopbarTitle = function (title) {
      originalSetTopbarTitle(title);
      tfUpdateTopbarProject();
    };
  }

  const originalRefreshWorkspaceScopedData = typeof refreshWorkspaceScopedData === 'function'
    ? refreshWorkspaceScopedData
    : null;

  if (originalRefreshWorkspaceScopedData) {
    window.refreshWorkspaceScopedData = function () {
      originalRefreshWorkspaceScopedData();
      tfLoadProjects();
    };
  }

  const originalRenderWorkplaces = typeof renderWorkplaces === 'function' ? renderWorkplaces : null;
  if (originalRenderWorkplaces) {
    window.renderWorkplaces = function () {
      originalRenderWorkplaces();
      tfRenderWorkplaceSelect();
    };
  }

  const originalDeleteWorkplace = typeof deleteWorkplace === 'function' ? deleteWorkplace : null;
  if (originalDeleteWorkplace) {
    window.deleteWorkplace = function (id) {
      const existedBefore = workplaces.some(wp => wp.id === id);
      originalDeleteWorkplace(id);

      if (existedBefore && !workplaces.some(wp => wp.id === id)) {
        try {
          localStorage.removeItem(tfProjectsStorageKey(id));
          localStorage.removeItem(tfActiveProjectStorageKey(id));
          localStorage.removeItem(tfProjectFilterStorageKey(id));
        } catch {}

        if (activeWorkplaceId === id) tfLoadProjects();
      }
    };
  }

  // Export injection: adds Projects to Workplace export payloads.
  const originalExportWorkplace = typeof exportWorkplace === 'function' ? exportWorkplace : null;
  const originalDownloadBlob = typeof downloadBlob === 'function' ? downloadBlob : null;

  if (originalExportWorkplace && originalDownloadBlob) {
    window.exportWorkplace = async function (id = activeWorkplaceId) {
      if (id === activeWorkplaceId) tfSaveProjects();

      const previousDownloadBlob = window.downloadBlob;

      window.downloadBlob = function (filename, content, type) {
        if (
          String(filename || '').startsWith('thinkfox_workplace_') &&
          String(type || '').includes('application/json')
        ) {
          try {
            const payload = JSON.parse(content);
            payload.data = payload.data || {};

            if (id === activeWorkplaceId) {
              payload.data.projects = tfProjects;
              payload.data.activeProjectId = tfActiveProjectId;
              payload.data.projectFilter = tfProjectFilter;
            } else {
              payload.data.projects = tfReadStoredProjects(id);
              payload.data.activeProjectId = tfReadStoredActiveProject(id);
              payload.data.projectFilter = tfReadStoredProjectFilter(id);
            }

            content = JSON.stringify(payload, null, 2);
          } catch (error) {
            console.warn('Think Fox Projects: export injection failed.', error);
          }
        }

        previousDownloadBlob(filename, content, type);
      };

      try {
        await originalExportWorkplace(id);
      } finally {
        window.downloadBlob = previousDownloadBlob;
      }
    };
  }

  // Import injection: restores Projects after Workplace import.
  const originalImportWorkplaceFile = typeof importWorkplaceFile === 'function' ? importWorkplaceFile : null;

  if (originalImportWorkplaceFile) {
    window.importWorkplaceFile = async function (file) {
      if (!file) return originalImportWorkplaceFile(file);

      let text = '';
      try {
        text = await file.text();
      } catch {
        return originalImportWorkplaceFile(file);
      }

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      const clone = new File([text], file.name, { type: file.type || 'application/json' });
      const beforeIds = new Set(workplaces.map(wp => wp.id));

      await originalImportWorkplaceFile(clone);

      const newWorkplace = workplaces.find(wp => !beforeIds.has(wp.id));

      if (newWorkplace && payload && payload.format === 'thinkfox-workplace') {
        const importedProjects = Array.isArray(payload.data?.projects)
          ? payload.data.projects.map(item => tfNormalizeProject(item, newWorkplace.id)).filter(Boolean)
          : [];

        try {
          localStorage.setItem(tfProjectsStorageKey(newWorkplace.id), JSON.stringify(importedProjects));
          localStorage.setItem(tfActiveProjectStorageKey(newWorkplace.id), String(payload.data?.activeProjectId || ''));
          localStorage.setItem(tfProjectFilterStorageKey(newWorkplace.id), String(payload.data?.projectFilter || 'current'));
        } catch {}

        if (activeWorkplaceId === newWorkplace.id) {
          tfLoadProjects();
          if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
          if (typeof window.renderWorkplaces === 'function') window.renderWorkplaces();
        }
      }
    };
  }

  // ── Events ───────────────────────────────────────────────────

  tfEl('tf-workplace-select')?.addEventListener('change', function () {
    if (this.value && this.value !== activeWorkplaceId) {
      switchWorkplace(this.value);
    }
  });

  tfEl('tf-workplace-open-btn')?.addEventListener('click', () => {
    if (typeof openWorkplaces === 'function') openWorkplaces();
  });

  tfEl('tf-project-select')?.addEventListener('change', function () {
    tfSetActiveProject(this.value);
  });

  tfEl('tf-project-filter-select')?.addEventListener('change', function () {
    tfSetProjectFilter(this.value);
  });

  tfEl('tf-project-manage-btn')?.addEventListener('click', tfOpenProjectModal);

  tfEl('tf-assign-current-project-btn')?.addEventListener('click', () => {
    if (!currentSessionId) {
      showToast('No active conversation to assign.', 'error');
      return;
    }

    tfAssignConversationProject(currentSessionId, tfActiveProjectId || null);

    showToast(
      tfActiveProjectId
        ? 'Conversation assigned to active Project.'
        : 'Conversation set to Unassigned.',
      'success'
    );
  });

  tfEl('tf-project-new-btn')?.addEventListener('click', tfResetProjectForm);
  tfEl('tf-project-save-btn')?.addEventListener('click', tfSaveProjectFromForm);
  tfEl('tf-project-close-btn')?.addEventListener('click', tfCloseProjectModal);

  tfEl('tf-project-modal-backdrop')?.addEventListener('click', event => {
    if (event.target === tfEl('tf-project-modal-backdrop')) tfCloseProjectModal();
  });

  document.addEventListener('keydown', event => {
    const backdrop = tfEl('tf-project-modal-backdrop');
    if (event.key === 'Escape' && backdrop && !backdrop.hidden) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      tfCloseProjectModal();
    }
  }, true);

  // ── Initial migration / boot ─────────────────────────────────

  let tfSessionsPatched = false;

  Object.values(sessions || {}).forEach(sess => {
    if (sess && !('projectId' in sess)) {
      sess.projectId = null;
      tfSessionsPatched = true;
    }
  });

  if (tfSessionsPatched) {
    try {
      saveSessions();
    } catch {}
  }

  tfLoadProjects();

  if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
  if (typeof window.renderWorkplaces === 'function') window.renderWorkplaces();

  tfUpdateTopbarProject();

  window.ThinkFoxProjects = {
    version: '0.7.7.1',
    get projects() { return tfProjects; },
    get activeProjectId() { return tfActiveProjectId; },
    get filter() { return tfProjectFilter; },
    create: tfCreateProject,
    update: tfUpdateProject,
    delete: tfDeleteProject,
    setActive: tfSetActiveProject,
    setFilter: tfSetProjectFilter,
    assignConversation: tfAssignConversationProject,
    reload: tfLoadProjects
  };
})();
</script>
