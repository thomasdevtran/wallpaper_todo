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
  const deletedTasks = [];
  let noticeAction = null;

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
    if (diff < 0) { label = 'Overdue · ' + due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); cls = 'overdue'; }
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
    const check = el('button', 'check');
    check.type = 'button';
    check.setAttribute('aria-label', `Complete ${todo.text}`);
    check.setAttribute('aria-pressed', String(!!todo.done));
    check.innerHTML = CHECK_SVG;
    check.firstElementChild.setAttribute('aria-hidden', 'true');
    check.title = 'Toggle complete';
    check.addEventListener('click', (e) => { e.stopPropagation(); onToggle(li, todo.id); });

    // main
    const main = el('div', 'todo-main');
    const textEl = el('div', 'todo-text', todo.text);
    textEl.title = 'Click to edit';
    textEl.addEventListener('click', () => beginEdit(li, todo.id, textEl));
    main.appendChild(textEl);

    const meta = el('div', 'todo-meta');
    if (currentFilter === 'all') {
      const list = store.listById(todo.listId);
      if (list && !list.deleted) {
        const badge = el('span', 'list-badge', list.name);
        badge.style.setProperty('--list-color', list.color);
        meta.appendChild(badge);
      }
    }
    if (todo.priority && todo.priority !== 'none') {
      const label = todo.priority[0].toUpperCase() + todo.priority.slice(1);
      meta.appendChild(el('span', `priority-badge ${todo.priority}`, label + ' priority'));
    }
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
    del.type = 'button';
    del.setAttribute('aria-label', `Delete ${todo.text}`);
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
    li.querySelector('.check').setAttribute('aria-pressed', String(!!todo.done));
    if (store.getSetting('hideCompleted', false) && todo.done) {
      animateOut(li);
    }
    updateProgress();
    renderTabs();
  }

  function showNotice(message, label, action) {
    dom.notice.hidden = false;
    dom.noticeMessage.textContent = message;
    dom.noticeAction.hidden = !action;
    dom.noticeAction.textContent = label || '';
    noticeAction = action || null;
  }

  function showDeleteNotice() {
    const count = deletedTasks.length;
    if (!count) { dom.notice.hidden = true; noticeAction = null; return; }
    showNotice(count === 1 ? 'Task deleted.' : `${count} tasks deleted.`, 'Undo', () => {
      const id = deletedTasks.pop();
      const todo = store.updateTodo(id, { deleted: false });
      if (currentFilter !== 'all' && currentFilter !== todo.listId) {
        currentFilter = store.activeLists().some((list) => list.id === todo.listId) ? todo.listId : 'all';
        store.setSetting('activeListFilter', currentFilter);
        if (currentFilter !== 'all') dom.qaList.value = currentFilter;
      }
      if (todo.done) store.setSetting('hideCompleted', false);
      renderTodos(); renderTabs(); showDeleteNotice();
      [...dom.todoList.children].find((row) => row.dataset.id === id)?.focus();
    });
  }

  function onDelete(li, id) {
    if (li.classList.contains('removing')) return;
    // Persist immediately; switching filters during the animation must not resurrect it.
    store.deleteTodo(id);
    deletedTasks.push(id);
    showDeleteNotice();
    updateProgress(); renderTabs();
    animateOut(li);
  }

  function animateOut(li, after) {
    if (li.classList.contains('removing')) return;
    const hadFocus = li.contains(document.activeElement);
    const nextId = (li.nextElementSibling || li.previousElementSibling)?.dataset.id;
    li.classList.add('removing');
    if (hadFocus) {
      const next = [...dom.todoList.children].find((row) => row.dataset.id === nextId && !row.classList.contains('removing'));
      (next || dom.qaText).focus();
    }
    setTimeout(() => { li.remove(); if (after) after(); updateEmptyState(); }, 200);
  }

  function beginEdit(li, id, textEl) {
    if (li.querySelector('.todo-text-input')) return;
    li.draggable = false;
    const input = el('input', 'todo-text-input');
    input.setAttribute('aria-label', 'Edit task');
    input.maxLength = 500;
    input.value = store.state.todos.find((t) => t.id === id)?.text || textEl.textContent;
    textEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const commit = (save) => {
      if (finished) return;
      finished = true;
      li.draggable = true;
      const val = input.value.trim();
      if (save && val) {
        store.updateTodo(id, { text: val });
        textEl.textContent = val;
        li.querySelector('.check').setAttribute('aria-label', `Complete ${val}`);
        li.querySelector('.del-btn').setAttribute('aria-label', `Delete ${val}`);
      }
      input.replaceWith(textEl);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(true); li.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); commit(false); li.focus(); }
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
    const focusedId = dom.tabs.contains(document.activeElement) ? document.activeElement.dataset.filter : null;
    dom.tabs.innerHTML = '';
    const lists = store.activeLists();
    const makeTab = (id, name, color) => {
      const tab = el('button', 'tab' + (currentFilter === id ? ' active' : ''));
      tab.type = 'button';
      tab.dataset.filter = id;
      tab.setAttribute('aria-pressed', String(currentFilter === id));
      if (color) {
        const dot = el('span', 'dot');
        dot.style.background = color;
        tab.appendChild(dot);
      }
      tab.appendChild(el('span', null, name));
      const cnt = store.countFor(id);
      if (cnt) tab.appendChild(el('span', 'count', String(cnt)));
      tab.addEventListener('click', () => {
        currentFilter = id;
        store.setSetting('activeListFilter', id);
        if (id !== 'all') dom.qaList.value = id;
        renderTabs(); renderTodos();
      });
      return tab;
    };
    dom.tabs.appendChild(makeTab('all', 'All', null));
    for (const l of lists) dom.tabs.appendChild(makeTab(l.id, l.name, l.color));
    if (focusedId) [...dom.tabs.children].find((tab) => tab.dataset.filter === focusedId)?.focus();
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
    if (prev && store.activeLists().some((list) => list.id === prev)) sel.value = prev;
    else if (currentFilter !== 'all' && store.activeLists().some((list) => list.id === currentFilter)) sel.value = currentFilter;
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
  const popTrigger = (pop) => $(pop === dom.settingsPop ? 'btn-settings' : 'btn-theme');

  function closePopovers(restoreFocus = false) {
    const open = [dom.settingsPop, dom.themePop].find((pop) => !pop.hidden);
    for (const pop of [dom.settingsPop, dom.themePop]) {
      pop.hidden = true;
      popTrigger(pop).setAttribute('aria-expanded', 'false');
    }
    if (restoreFocus && open) popTrigger(open).focus();
  }

  function togglePop(pop, show) {
    const target = show ?? pop.hidden;
    closePopovers();
    if (target) {
      pop.hidden = false;
      popTrigger(pop).setAttribute('aria-expanded', 'true');
      (pop.querySelector('.theme-choice.active') || pop.querySelector('button, select, input'))?.focus();
    } else {
      popTrigger(pop).focus();
    }
  }

  function renderThemeMenu() {
    dom.themeChoices.innerHTML = '';
    const cur = store.getSetting('theme', 'glass');
    for (const t of themes.getList()) {
      const btn = el('button', 'theme-choice' + (t.id === cur ? ' active' : ''));
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(t.id === cur));
      const sw = el('span', 'swatch');
      sw.style.background = `linear-gradient(135deg, ${t.vars.accent} 0 50%, ${t.vars['panel-bg']} 50% 100%)`;
      btn.append(sw, el('span', null, t.name));
      btn.addEventListener('click', () => { selectTheme(t.id); closePopovers(true); });
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
      color.setAttribute('aria-label', `Color for ${l.name}`);
      color.value = l.color || '#6ea8fe';
      color.addEventListener('change', () => { store.updateList(l.id, { color: color.value }); renderTabs(); });
      const name = el('input');
      name.type = 'text';
      name.setAttribute('aria-label', `Rename ${l.name}`);
      name.maxLength = 40;
      name.value = l.name;
      name.addEventListener('change', () => { if (name.value.trim()) { store.updateList(l.id, { name: name.value.trim() }); renderTabs(); renderQuickAddLists(); renderTodos(); } });
      const del = el('button', 'del-list', '×');
      del.title = 'Delete list';
      del.type = 'button';
      del.setAttribute('aria-label', `Delete ${l.name} list`);
      del.addEventListener('click', () => {
        if (store.activeLists().length <= 1) { name.focus(); return; } // keep at least one
        store.deleteList(l.id);
        if (currentFilter === l.id) {
          currentFilter = 'all';
          store.setSetting('activeListFilter', 'all');
        }
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
    dom.notice = $('flow-notice');
    dom.noticeMessage = $('flow-message');
    dom.noticeAction = $('flow-action');
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
    dom.noticeAction.addEventListener('click', () => noticeAction?.());
    $('flow-dismiss').addEventListener('click', () => { dom.notice.hidden = true; dom.qaText.focus(); });
    for (const pop of [dom.settingsPop, dom.themePop]) {
      const trigger = popTrigger(pop);
      trigger.setAttribute('aria-controls', pop.id);
      trigger.setAttribute('aria-expanded', 'false');
    }
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
        closePopovers();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (!dom.settingsPop.hidden || !dom.themePop.hidden)) {
        e.preventDefault();
        closePopovers(true);
      }
    });
    document.addEventListener('focusin', (e) => {
      if (!e.target.closest('.popover') && !e.target.closest('.head-actions')) closePopovers();
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
