'use strict';

// Renderer-side data store. The single abstraction the UI talks to.
// - stamps ids / updatedAt on every write
// - uses soft-delete tombstones (deleted:true) instead of hard removal
// - persists through window.api (which writes JSON in the main process)
// These three properties are exactly what a Phase 2 cloud sync (last-write-wins
// + cross-device deletes) needs, so the cloud backend can slot in behind here
// without the UI changing.
window.store = (() => {
  const state = { todos: [], lists: [], settings: {} };

  const uuid = () =>
    'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const now = () => Date.now();

  // --- persistence (debounced) ---
  let todoTimer = null;
  let listTimer = null;
  let settingsTimer = null;

  function saveTodos() {
    clearTimeout(todoTimer);
    todoTimer = setTimeout(() => window.api.saveTodos(state.todos), 250);
  }
  function saveLists() {
    clearTimeout(listTimer);
    listTimer = setTimeout(() => window.api.saveLists(state.lists), 250);
  }
  function saveSettings() {
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => window.api.saveSettings(state.settings), 250);
  }

  async function init() {
    const s = await window.api.getState();
    state.todos = Array.isArray(s.todos) ? s.todos : [];
    state.lists = Array.isArray(s.lists) ? s.lists : [];
    state.settings = s.settings || {};
    // Normalize legacy/missing fields.
    for (const t of state.todos) {
      if (t.updatedAt == null) t.updatedAt = t.createdAt || now();
      if (t.deleted == null) t.deleted = false;
      if (t.order == null) t.order = t.createdAt || 0;
    }
    return state;
  }

  // --- selectors ---
  const activeLists = () => state.lists.filter((l) => !l.deleted);
  const activeTodos = () => state.todos.filter((t) => !t.deleted);

  function todosForFilter(filter) {
    let items = activeTodos();
    if (filter && filter !== 'all') items = items.filter((t) => t.listId === filter);
    if (state.settings.hideCompleted) items = items.filter((t) => !t.done);
    // Sort: incomplete first, then by explicit order, then newest.
    return items.sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }

  function listById(id) {
    return state.lists.find((l) => l.id === id) || null;
  }

  function progress(filter) {
    let items = activeTodos();
    if (filter && filter !== 'all') items = items.filter((t) => t.listId === filter);
    const total = items.length;
    const done = items.filter((t) => t.done).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function countFor(filter) {
    let items = activeTodos();
    if (filter && filter !== 'all') items = items.filter((t) => t.listId === filter);
    return items.filter((t) => !t.done).length;
  }

  // --- todo mutations ---
  function addTodo({ text, priority = 'none', dueDate = null, listId }) {
    const t = now();
    const lists = activeLists();
    const todo = {
      id: uuid(),
      text: text.trim(),
      done: false,
      priority,
      dueDate: dueDate || null,
      listId: listId || (lists[0] && lists[0].id) || null,
      order: -t, // newest incomplete floats to top of its section
      createdAt: t,
      completedAt: null,
      updatedAt: t,
      deleted: false,
    };
    state.todos.push(todo);
    saveTodos();
    return todo;
  }

  function updateTodo(id, patch) {
    const todo = state.todos.find((t) => t.id === id);
    if (!todo) return null;
    Object.assign(todo, patch, { updatedAt: now() });
    saveTodos();
    return todo;
  }

  function toggleTodo(id) {
    const todo = state.todos.find((t) => t.id === id);
    if (!todo) return null;
    todo.done = !todo.done;
    todo.completedAt = todo.done ? now() : null;
    todo.updatedAt = now();
    saveTodos();
    return todo;
  }

  function deleteTodo(id) {
    const todo = state.todos.find((t) => t.id === id);
    if (!todo) return;
    todo.deleted = true; // tombstone (kept for cross-device sync later)
    todo.updatedAt = now();
    saveTodos();
  }

  function reorder(filter, orderedIds) {
    // Assign ascending order values in the given sequence.
    orderedIds.forEach((id, i) => {
      const todo = state.todos.find((t) => t.id === id);
      if (todo) {
        todo.order = i;
        todo.updatedAt = now();
      }
    });
    saveTodos();
  }

  // --- list mutations ---
  function addList(name, color) {
    const list = { id: uuid(), name: name.trim(), color, updatedAt: now(), deleted: false };
    state.lists.push(list);
    saveLists();
    return list;
  }
  function updateList(id, patch) {
    const list = state.lists.find((l) => l.id === id);
    if (!list) return;
    Object.assign(list, patch, { updatedAt: now() });
    saveLists();
  }
  function deleteList(id) {
    const remaining = activeLists().filter((l) => l.id !== id);
    // Move orphaned todos to the first remaining list (or null).
    const target = remaining[0] ? remaining[0].id : null;
    for (const t of state.todos) {
      if (t.listId === id) {
        t.listId = target;
        t.updatedAt = now();
      }
    }
    const list = state.lists.find((l) => l.id === id);
    if (list) {
      list.deleted = true;
      list.updatedAt = now();
    }
    saveLists();
    saveTodos();
  }

  // --- settings ---
  function getSetting(key, fallback) {
    return state.settings[key] ?? fallback;
  }
  function setSetting(key, value) {
    state.settings[key] = value;
    saveSettings();
  }

  return {
    state,
    init,
    activeLists,
    activeTodos,
    todosForFilter,
    listById,
    progress,
    countFor,
    addTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    reorder,
    addList,
    updateList,
    deleteList,
    getSetting,
    setSetting,
  };
})();
