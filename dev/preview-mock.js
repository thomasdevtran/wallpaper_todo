'use strict';

// Browser-preview mock of the preload `window.api` bridge.
// Lets the real src/ UI run in a plain browser (no Electron) so the rendering,
// theming and interactions can be eyeballed. NOT shipped with the app.
(() => {
  const iso = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
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

  // Only a few themes inline; the real getThemes() reads all JSON files.
  const THEMES = [
    { id: 'glass', name: 'Minimal Glass', vars: { font: "system-ui, sans-serif", radius: '16px', blur: '18px', 'panel-bg': 'rgba(20,22,30,0.55)', 'panel-border': 'rgba(255,255,255,0.14)', shadow: '0 20px 50px rgba(0,0,0,0.45)', 'accent-glow': 'none', text: '#f4f6fb', 'text-dim': 'rgba(244,246,251,0.66)', 'text-faint': 'rgba(244,246,251,0.40)', accent: '#6ea8fe', 'accent-contrast': '#0b1220', 'row-bg': 'rgba(255,255,255,0.05)', 'row-bg-hover': 'rgba(255,255,255,0.10)', 'input-bg': 'rgba(255,255,255,0.08)', 'input-border': 'rgba(255,255,255,0.16)', 'chip-bg': 'rgba(255,255,255,0.08)', 'priority-high': '#ff6b6b', 'priority-medium': '#ffcf5c', 'priority-low': '#7fdfa0', overdue: '#ff6b6b', 'due-today': '#ffcf5c', track: 'rgba(255,255,255,0.12)', danger: '#ff7b7b', scheme: 'dark', 'menu-bg': '#1b1e28', 'menu-text': '#f4f6fb' } },
    { id: 'dark', name: 'Bold Dark Card', vars: { font: "system-ui, sans-serif", radius: '14px', blur: '0px', 'panel-bg': '#16181d', 'panel-border': '#262a31', shadow: '0 18px 44px rgba(0,0,0,0.55)', 'accent-glow': 'none', text: '#e8eaed', 'text-dim': '#a2a8b3', 'text-faint': '#6b7280', accent: '#5b8dff', 'accent-contrast': '#0b1220', 'row-bg': '#1d2026', 'row-bg-hover': '#242830', 'input-bg': '#1b1e24', 'input-border': '#30343c', 'chip-bg': '#242830', 'priority-high': '#ef4444', 'priority-medium': '#f59e0b', 'priority-low': '#22c55e', overdue: '#ef4444', 'due-today': '#f59e0b', track: '#2a2e36', danger: '#f87171', scheme: 'dark', 'menu-bg': '#1d2026', 'menu-text': '#e8eaed' } },
    { id: 'neon', name: 'Neon Retro', vars: { font: "'Cascadia Code', monospace", radius: '12px', blur: '8px', 'panel-bg': 'rgba(10,10,18,0.72)', 'panel-border': 'rgba(0,229,255,0.45)', shadow: '0 0 28px rgba(0,229,255,0.22), 0 18px 44px rgba(0,0,0,0.6)', 'accent-glow': '0 0 10px rgba(22,245,199,0.7)', text: '#eaffff', 'text-dim': '#7fd6ff', 'text-faint': '#4b6b7a', accent: '#16f5c7', 'accent-contrast': '#05121a', 'row-bg': 'rgba(255,255,255,0.04)', 'row-bg-hover': 'rgba(0,229,255,0.08)', 'input-bg': 'rgba(0,0,0,0.35)', 'input-border': 'rgba(0,229,255,0.35)', 'chip-bg': 'rgba(0,229,255,0.10)', 'priority-high': '#ff2e88', 'priority-medium': '#ffe14d', 'priority-low': '#39ff14', overdue: '#ff2e88', 'due-today': '#ffe14d', track: 'rgba(0,229,255,0.18)', danger: '#ff2e88', scheme: 'dark', 'menu-bg': '#0b0b16', 'menu-text': '#eaffff' } },
  ];

  window.api = {
    getState: async () => ({ todos: JSON.parse(JSON.stringify(todos)), lists: JSON.parse(JSON.stringify(lists)), settings: JSON.parse(JSON.stringify(settings)) }),
    saveTodos: async (t) => { todos = t; return true; },
    saveLists: async (l) => { for (const x of l) if (!lists.find(z => z.id === x.id)) lists.push(x); else Object.assign(lists.find(z => z.id === x.id), x); return true; },
    saveSettings: async (s) => { settings = s; return true; },
    getThemes: async () => THEMES,
    hideWindow: () => console.log('[mock] hideWindow'),
    resetWindow: () => console.log('[mock] resetWindow'),
    quit: () => console.log('[mock] quit'),
    dropToBottom: () => {},
    onApplyTheme: () => {},
    onFocusQuickAdd: () => {},
  };
})();
