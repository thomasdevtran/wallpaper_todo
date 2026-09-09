'use strict';

// Browser-preview mock of the preload `window.api` bridge.
// Lets the real src/ UI run in a plain browser (no Electron) so the rendering,
// theming and interactions can be eyeballed. NOT shipped with the app.
(() => {
  const iso = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  };
  const now = Date.now();

  const lists = [
    { id: 'list-work', name: 'Work', color: '#6ea8fe', updatedAt: now, deleted: false },
    { id: 'list-personal', name: 'Personal', color: '#b48ef7', updatedAt: now, deleted: false },
    { id: 'list-errands', name: 'Errands', color: '#4ade80', updatedAt: now, deleted: false },
  ];

  let idc = 0;
  const mk = (o) => ({
    id: 'seed-' + idc++, done: false, priority: 'none', dueDate: null,
    listId: 'list-work', order: idc, createdAt: now, completedAt: null,
    updatedAt: now, deleted: false, ...o,
  });

  let todos = [
    mk({ text: 'Ship the Q3 report to leadership', priority: 'high', dueDate: iso(-2), listId: 'list-work' }),
    mk({ text: 'Reply to the design review thread', priority: 'medium', dueDate: iso(0), listId: 'list-work' }),
    mk({ text: 'Refactor the auth middleware', priority: 'low', dueDate: iso(1), listId: 'list-work' }),
    mk({ text: 'Book dentist appointment', priority: 'medium', dueDate: iso(4), listId: 'list-personal' }),
    mk({ text: 'Call mum', priority: 'none', listId: 'list-personal' }),
    mk({ text: 'Buy groceries — milk, eggs, coffee', priority: 'none', dueDate: iso(0), listId: 'list-errands' }),
    mk({ text: 'Renew gym membership', priority: 'low', done: true, completedAt: now, listId: 'list-errands' }),
  ];

  let settings = {
    theme: 'glass', bounds: null, opacity: 1, showClock: true, autoStart: false,
    hotkey: 'CommandOrControl+Alt+T', hideCompleted: false, activeListFilter: 'all', cloud: { enabled: false },
  };

  window.api = {
    getState: async () => ({ todos: JSON.parse(JSON.stringify(todos)), lists: JSON.parse(JSON.stringify(lists)), settings: JSON.parse(JSON.stringify(settings)) }),
    saveTodos: async (t) => { todos = t; return true; },
    saveLists: async (l) => { for (const x of l) if (!lists.find(z => z.id === x.id)) lists.push(x); else Object.assign(lists.find(z => z.id === x.id), x); return true; },
    saveSettings: async (s) => { settings = s; return true; },
    getThemes: async () => Promise.all(['glass', 'dark', 'neon', 'light', 'nord', 'dracula', 'solarized'].map(async (id) => {
      const response = await fetch(`../src/themes/${id}.json`);
      if (!response.ok) throw new Error(`Cannot load theme ${id}`);
      return response.json();
    })),
    hideWindow: () => console.log('[mock] hideWindow'),
    resetWindow: () => console.log('[mock] resetWindow'),
    quit: () => console.log('[mock] quit'),
    dropToBottom: () => {},
    onApplyTheme: () => {},
    onFocusQuickAdd: () => {},
  };
})();
