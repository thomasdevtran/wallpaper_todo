'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // DOM refs
  const dom = {};
  let currentFilter = 'all';

  // ---------------------------------------------------------------------------
  // Clock / greeting
  // ---------------------------------------------------------------------------
  function tick() {
    const d = new Date();
    if (store.getSetting('showClock', true)) {
      dom.clock.textContent = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      dom.date.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    const h = d.getHours();
    dom.greeting.textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  // ---------------------------------------------------------------------------
  // Due date helpers
  // ---------------------------------------------------------------------------
  function parseDue(str) {
    if (!str) return null;
    const [y, m, day] = str.split('-').map(Number);
    if (!y || !m || !day) return null;
    return new Date(y, m - 1, day);
  }
  function dueInfo(str) {
    const due = parseDue(str);
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    let label, cls = '';
    if (diff < 0) { label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); cls = 'overdue'; }
    else if (diff === 0) { label = 'Today'; cls = 'today'; }
    else if (diff === 1) { label = 'Tomorrow'; }
    else if (diff < 7) { label = due.toLocaleDateString(undefined, { weekday: 'short' }); }
    else { label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    return { label, cls };
  }

  // ---------------------------------------------------------------------------
  // Todo element
  // ---------------------------------------------------------------------------
  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>';

  function createTodoEl(todo) {
    const li = el('li', 'todo');
    li.dataset.id = todo.id;
    li.tabIndex = 0;
    if (todo.done) li.classList.add('done');
    if (todo.priority && todo.priority !== 'none') li.classList.add('p-' + todo.priority);
    li.draggable = true;

    // checkbox
    const check = el('div', 'check');
    check.innerHTML = CHECK_SVG;
    check.title = 'Toggle complete';
    check.addEventListener('click', (e) => { e.stopPropagation(); onToggle(li, todo.id); });

    // main
    const main = el('div', 'todo-main');
    const textEl = el('div', 'todo-text', todo.text);
    textEl.title = 'Click to edit';
    textEl.addEventListener('click', () => beginEdit(li, todo.id, textEl));
    main.appendChild(textEl);

    const meta = el('div', 'todo-meta');
    if (todo.dueDate) {
      const info = dueInfo(todo.dueDate);
      if (info) {
        const badge = el('span', 'due-badge ' + info.cls);
        badge.textContent = info.label;
        meta.appendChild(badge);
      }
    }
    if (meta.children.length) main.appendChild(meta);

    // delete
    const del = el('button', 'del-btn', '×');
    del.title = 'Delete';
    del.addEventListener('click', (e) => { e.stopPropagation(); onDelete(li, todo.id); });

    li.append(check, main, del);

    // keyboard: space=toggle, delete=remove, enter=edit
    li.addEventListener('keydown', (e) => {
      if (e.target !== li) return;
      if (e.key === ' ') { e.preventDefault(); onToggle(li, todo.id); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDelete(li, todo.id); }
      else if (e.key === 'Enter') { e.preventDefault(); beginEdit(li, todo.id, textEl); }
    });

    return li;
  }

  function onToggle(li, id) {
    const todo = store.toggleTodo(id);
    if (!todo) return;
    li.classList.toggle('done', todo.done);
    if (store.getSetting('hideCompleted', false) && todo.done) {
      animateOut(li);
    }
    updateProgress();
    renderTabs();
  }

  function onDelete(li, id) {
    animateOut(li, () => { store.deleteTodo(id); updateProgress(); renderTabs(); updateEmptyState(); });
  }

  function animateOut(li, after) {
    li.classList.add('removing');
    setTimeout(() => { li.remove(); if (after) after(); updateEmptyState(); }, 200);
  }

  function beginEdit(li, id, textEl) {
    if (li.querySelector('.todo-text-input')) return;
    li.draggable = false;
    const input = el('input', 'todo-text-input');
    input.value = store.state.todos.find((t) => t.id === id)?.text || textEl.textContent;
    textEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = (save) => {
      li.draggable = true;
      const val = input.value.trim();
      if (save && val) {
        store.updateTodo(id, { text: val });
        textEl.textContent = val;
      }
      input.replaceWith(textEl);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
    });
    input.addEventListener('blur', () => commit(true));
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function renderTodos() {
    dom.todoList.innerHTML = '';
    const items = store.todosForFilter(currentFilter);
    for (const t of items) dom.todoList.appendChild(createTodoEl(t));
    updateEmptyState();
    updateProgress();
  }

  function updateEmptyState() {
    const has = dom.todoList.querySelector('.todo:not(.removing)');
    dom.empty.hidden = !!has;
  }

  function updateProgress() {
    const p = store.progress(currentFilter);
    dom.progressFill.style.width = p.pct + '%';
    dom.progressLabel.textContent = `${p.done} of ${p.total} done`;
  }

  function renderTabs() {
    dom.tabs.innerHTML = '';
    const lists = store.activeLists();
    const makeTab = (id, name, color) => {
      const tab = el('button', 'tab' + (currentFilter === id ? ' active' : ''));
      if (color) {
        const dot = el('span', 'dot');
        dot.style.background = color;
        tab.appendChild(dot);
      }
      tab.appendChild(el('span', null, name));
      const cnt = store.countFor(id);
      if (cnt) tab.appendChild(el('span', 'count', String(cnt)));
      tab.addEventListener('click', () => { currentFilter = id; store.setSetting('activeListFilter', id); renderTabs(); renderTodos(); });
      return tab;
    };
    dom.tabs.appendChild(makeTab('all', 'All', null));
    for (const l of lists) dom.tabs.appendChild(makeTab(l.id, l.name, l.color));
  }

  function renderQuickAddLists() {
    const sel = dom.qaList;
    const prev = sel.value;
    sel.innerHTML = '';
    for (const l of store.activeLists()) {
      const o = el('option', null, l.name);
      o.value = l.id;
      sel.appendChild(o);
    }
    if (prev && store.listById(prev)) sel.value = prev;
    else if (currentFilter !== 'all' && store.listById(currentFilter)) sel.value = currentFilter;
  }

  // ---------------------------------------------------------------------------
  // Quick add
  // ---------------------------------------------------------------------------
  function onQuickAdd(e) {
    e.preventDefault();
    const text = dom.qaText.value.trim();
    if (!text) return;
    const todo = store.addTodo({
      text,
      priority: dom.qaPriority.value,
      dueDate: dom.qaDate.value || null,
      listId: dom.qaList.value || null,
    });
    // If it belongs to the current filter (or All), animate it in at the top.
    if (currentFilter === 'all' || currentFilter === todo.listId) {
      const node = createTodoEl(todo);
      node.classList.add('enter');
      dom.todoList.insertBefore(node, dom.todoList.firstChild);
    }
    dom.qaText.value = '';
    dom.qaPriority.value = 'none';
    dom.qaDate.value = '';
    updateEmptyState();
    updateProgress();
    renderTabs();
    dom.qaText.focus();
  }

  // ---------------------------------------------------------------------------
  // Drag to reorder
  // ---------------------------------------------------------------------------
  let dragEl = null;
  function setupDrag() {
    const list = dom.todoList;
    list.addEventListener('dragstart', (e) => {
      const li = e.target.closest('.todo');
      if (!li) return;
      dragEl = li;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    list.addEventListener('dragend', () => {
      if (!dragEl) return;
      dragEl.classList.remove('dragging');
      dragEl = null;
      const ids = [...list.querySelectorAll('.todo')].map((n) => n.dataset.id);
      store.reorder(currentFilter, ids);
    });
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragEl) return;
      const after = getDragAfter(list, e.clientY);
      if (after == null) list.appendChild(dragEl);
      else list.insertBefore(dragEl, after);
    });
  }
  function getDragAfter(container, y) {
    const els = [...container.querySelectorAll('.todo:not(.dragging)')];
    let closest = { offset: -Infinity, element: null };
    for (const child of els) {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
    }
    return closest.element;
  }

  // ---------------------------------------------------------------------------
  // Popovers (settings + theme)
  // ---------------------------------------------------------------------------
  function togglePop(pop, show) {
    const target = show ?? pop.hidden;
    dom.settingsPop.hidden = true;
    dom.themePop.hidden = true;
    if (target) pop.hidden = false;
  }

  function renderThemeMenu() {
    dom.themeChoices.innerHTML = '';
    const cur = store.getSetting('theme', 'glass');
    for (const t of themes.getList()) {
      const btn = el('button', 'theme-choice' + (t.id === cur ? ' active' : ''));
      const sw = el('span', 'swatch');
      sw.style.background = `linear-gradient(135deg, ${t.vars.accent} 0 50%, ${t.vars['panel-bg']} 50% 100%)`;
      btn.append(sw, el('span', null, t.name));
      btn.addEventListener('click', () => { selectTheme(t.id); dom.themePop.hidden = true; });
      dom.themeChoices.appendChild(btn);
    }
  }

  function selectTheme(id) {
    themes.apply(id);
    store.setSetting('theme', id);
    if (dom.setTheme) dom.setTheme.value = id;
    renderThemeMenu();
  }

  function renderListsEditor() {
    dom.listsEditor.innerHTML = '';
    const lists = store.activeLists();
    for (const l of lists) {
      const row = el('div', 'list-edit-row');
      const color = el('input');
      color.type = 'color';
      color.value = l.color || '#6ea8fe';
      color.addEventListener('change', () => { store.updateList(l.id, { color: color.value }); renderTabs(); });
      const name = el('input');
      name.type = 'text';
      name.value = l.name;
      name.addEventListener('change', () => { if (name.value.trim()) { store.updateList(l.id, { name: name.value.trim() }); renderTabs(); renderQuickAddLists(); } });
      const del = el('button', 'del-list', '×');
      del.title = 'Delete list';
      del.addEventListener('click', () => {
        if (store.activeLists().length <= 1) { name.focus(); return; } // keep at least one
        store.deleteList(l.id);
        if (currentFilter === l.id) currentFilter = 'all';
        renderListsEditor(); renderTabs(); renderQuickAddLists(); renderTodos();
      });
      row.append(color, name, del);
      dom.listsEditor.appendChild(row);
    }
  }

  function renderSettings() {
    // Theme select
    dom.setTheme.innerHTML = '';
    for (const t of themes.getList()) {
      const o = el('option', null, t.name);
      o.value = t.id;
      dom.setTheme.appendChild(o);
    }
    dom.setTheme.value = store.getSetting('theme', 'glass');
    dom.setOpacity.value = store.getSetting('opacity', 1);
    dom.setHideCompleted.checked = !!store.getSetting('hideCompleted', false);
    dom.setAutostart.checked = !!store.getSetting('autoStart', false);
    renderListsEditor();
  }

  // ---------------------------------------------------------------------------
  // Wire up
  // ---------------------------------------------------------------------------
  function cacheDom() {
    dom.greeting = $('greeting');
    dom.clock = $('clock');
    dom.date = $('date');
    dom.progressFill = $('progress-fill');
    dom.progressLabel = $('progress-label');
    dom.tabs = $('list-tabs');
    dom.todoList = $('todo-list');
    dom.empty = $('empty-state');
    dom.qaForm = $('quick-add');
    dom.qaText = $('qa-text');
    dom.qaPriority = $('qa-priority');
    dom.qaDate = $('qa-date');
    dom.qaList = $('qa-list');
    dom.settingsPop = $('settings-pop');
    dom.themePop = $('theme-pop');
    dom.themeChoices = $('theme-choices');
    dom.setTheme = $('set-theme');
    dom.setOpacity = $('set-opacity');
    dom.setHideCompleted = $('set-hidecompleted');
    dom.setAutostart = $('set-autostart');
    dom.listsEditor = $('lists-editor');
  }

  function wireEvents() {
    dom.qaForm.addEventListener('submit', onQuickAdd);
    // Explicit Enter handling — reliable across environments (don't rely on
    // implicit single-input form submission).
    dom.qaText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onQuickAdd(e); }
    });

    $('btn-theme').addEventListener('click', (e) => { e.stopPropagation(); renderThemeMenu(); togglePop(dom.themePop); });
    $('btn-settings').addEventListener('click', (e) => { e.stopPropagation(); renderSettings(); togglePop(dom.settingsPop); });
    $('btn-hide').addEventListener('click', () => window.api.hideWindow());

    dom.setTheme.addEventListener('change', () => selectTheme(dom.setTheme.value));
    dom.setOpacity.addEventListener('input', () => store.setSetting('opacity', parseFloat(dom.setOpacity.value)));
    dom.setHideCompleted.addEventListener('change', () => { store.setSetting('hideCompleted', dom.setHideCompleted.checked); renderTodos(); renderTabs(); });
    dom.setAutostart.addEventListener('change', () => store.setSetting('autoStart', dom.setAutostart.checked));

    $('add-list-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('new-list-name').value.trim();
      if (!name) return;
      store.addList(name, $('new-list-color').value);
      $('new-list-name').value = '';
      renderListsEditor(); renderTabs(); renderQuickAddLists();
    });

    $('btn-reset').addEventListener('click', () => window.api.resetWindow());
    $('btn-quit').addEventListener('click', () => window.api.quit());

    // Close popovers on outside click / Escape.
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.popover') && !e.target.closest('.head-actions')) {
        dom.settingsPop.hidden = true;
        dom.themePop.hidden = true;
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { dom.settingsPop.hidden = true; dom.themePop.hidden = true; }
    });

    // From main process
    window.api.onApplyTheme((id) => selectTheme(id));
    window.api.onFocusQuickAdd(() => { dom.qaText.focus(); });

    setupDrag();
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  async function init() {
    cacheDom();
    await themes.load();
    await store.init();
    currentFilter = store.getSetting('activeListFilter', 'all');
    if (currentFilter !== 'all' && !store.listById(currentFilter)) currentFilter = 'all';
    themes.apply(store.getSetting('theme', 'glass'));
    renderTabs();
    renderQuickAddLists();
    renderTodos();
    wireEvents();
    tick();
    setInterval(tick, 1000);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
