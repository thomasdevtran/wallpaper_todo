'use strict';

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
  nativeImage,
  screen,
} = require('electron');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths & persistence helpers
// ---------------------------------------------------------------------------
const userDir = app.getPath('userData');
const files = {
  todos: path.join(userDir, 'todos.json'),
  lists: path.join(userDir, 'lists.json'),
  settings: path.join(userDir, 'settings.json'),
};
const userThemesDir = path.join(userDir, 'themes');
const builtinThemesDir = path.join(__dirname, 'src', 'themes');

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error('readJSON failed for', file, err);
    return fallback;
  }
}

function writeJSON(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file); // atomic-ish replace to avoid partial writes
    return true;
  } catch (err) {
    console.error('writeJSON failed for', file, err);
    return false;
  }
}

// Seed defaults on first run --------------------------------------------------
const now = () => Date.now();

function defaultLists() {
  const t = now();
  return [
    { id: 'list-work', name: 'Work', color: '#6ea8fe', updatedAt: t, deleted: false },
    { id: 'list-personal', name: 'Personal', color: '#b48ef7', updatedAt: t, deleted: false },
    { id: 'list-errands', name: 'Errands', color: '#4ade80', updatedAt: t, deleted: false },
  ];
}

function defaultSettings() {
  return {
    theme: 'glass',
    bounds: null, // {x,y,width,height}
    opacity: 1,
    showClock: true,
    autoStart: false,
    hotkey: 'CommandOrControl+Alt+T',
    hideCompleted: false,
    activeListFilter: 'all',
    cloud: { enabled: false }, // Phase 2
    _seeded: false,
  };
}

function ensureSeeded() {
  let settings = readJSON(files.settings, null);
  if (!settings) {
    settings = defaultSettings();
    writeJSON(files.lists, defaultLists());
    writeJSON(files.todos, []);
    settings._seeded = true;
    writeJSON(files.settings, settings);
  }
  return settings;
}

// ---------------------------------------------------------------------------
// koffi: keep the window pinned to the bottom of the z-order (desktop layer)
// ---------------------------------------------------------------------------
let SetWindowPos = null;
try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  // BOOL SetWindowPos(HWND, HWND hWndInsertAfter, int X, int Y, int cx, int cy, UINT flags)
  SetWindowPos = user32.func(
    'bool __stdcall SetWindowPos(uintptr_t hWnd, uintptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags)'
  );
} catch (err) {
  console.warn('koffi unavailable — falling back to setAlwaysOnTop(false):', err.message);
}

const HWND_BOTTOM = 1n;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOACTIVATE = 0x0010;
const SWP_FLAGS = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE;

function hwndOf(win) {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0));
}

function pinToBottom(win) {
  if (!win || win.isDestroyed()) return;
  try {
    if (SetWindowPos) {
      SetWindowPos(hwndOf(win), HWND_BOTTOM, 0, 0, 0, 0, SWP_FLAGS);
    } else {
      win.setAlwaysOnTop(false);
    }
  } catch (err) {
    console.error('pinToBottom failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
let win = null;
let tray = null;
let settings = null;
let bottomTimer = null;

function clampToScreen(bounds) {
  if (!bounds) return null;
  const area = screen.getPrimaryDisplay().workArea;
  const width = Math.min(bounds.width || 380, area.width);
  const height = Math.min(bounds.height || 520, area.height);
  let x = bounds.x;
  let y = bounds.y;
  if (typeof x !== 'number' || x < area.x - 50 || x > area.x + area.width - 50) x = undefined;
  if (typeof y !== 'number' || y < area.y - 50 || y > area.y + area.height - 50) y = undefined;
  return { x, y, width, height };
}

function createWindow() {
  const saved = clampToScreen(settings.bounds);
  win = new BrowserWindow({
    width: (saved && saved.width) || 380,
    height: (saved && saved.height) || 560,
    x: saved ? saved.x : undefined,
    y: saved ? saved.y : undefined,
    minWidth: 280,
    minHeight: 240,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    focusable: true,
    skipTaskbar: true,
    alwaysOnTop: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.setOpacity(settings.opacity ?? 1);

  win.once('ready-to-show', () => {
    win.show();
    pinToBottom(win);
  });

  // Drop to the desktop layer whenever we lose focus.
  win.on('blur', () => pinToBottom(win));

  // Periodically re-assert bottom, but never while the user is interacting.
  bottomTimer = setInterval(() => {
    if (win && !win.isDestroyed() && !win.isFocused() && win.isVisible()) {
      pinToBottom(win);
    }
  }, 2000);

  // Persist bounds (debounced).
  let boundsTimer = null;
  const saveBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      settings.bounds = win.getBounds();
      writeJSON(files.settings, settings);
    }, 400);
  };
  win.on('move', saveBounds);
  win.on('resize', saveBounds);

  win.on('closed', () => {
    win = null;
  });
}

function showAndFocus() {
  if (!win) return;
  if (!win.isVisible()) win.show();
  win.setAlwaysOnTop(true); // brief lift so it comes above other windows...
  win.focus();
  win.setAlwaysOnTop(false); // ...then let normal z-order rules resume.
}

function resetPosition() {
  if (!win) return;
  const area = screen.getPrimaryDisplay().workArea;
  const width = 380;
  const height = 560;
  const x = area.x + area.width - width - 32;
  const y = area.y + 48;
  win.setBounds({ x, y, width, height });
  settings.bounds = { x, y, width, height };
  writeJSON(files.settings, settings);
  showAndFocus();
}

// ---------------------------------------------------------------------------
// Themes: merge built-in + user-supplied theme files
// ---------------------------------------------------------------------------
function loadThemes() {
  const themes = [];
  const seen = new Set();
  for (const dir of [builtinThemesDir, userThemesDir]) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch (_) {
      continue;
    }
    for (const file of entries) {
      const data = readJSON(path.join(dir, file), null);
      if (!data || !data.vars) continue;
      const id = data.id || path.basename(file, '.json');
      if (seen.has(id)) {
        // user theme overrides a built-in with the same id
        const idx = themes.findIndex((t) => t.id === id);
        if (idx >= 0) themes[idx] = { id, name: data.name || id, vars: data.vars };
        continue;
      }
      seen.add(id);
      themes.push({ id, name: data.name || id, vars: data.vars });
    }
  }
  return themes;
}

// ---------------------------------------------------------------------------
// Auto-start on login
// ---------------------------------------------------------------------------
function applyAutoStart(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      // In production this points at the packaged exe; in dev it points at electron.exe.
      args: [],
    });
  } catch (err) {
    console.error('setLoginItemSettings failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
function trayImage() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  try {
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
    }
  } catch (_) {}
  return nativeImage.createEmpty();
}

function buildTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('Wallpaper Todo');
  refreshTrayMenu();
  tray.on('click', showAndFocus);
}

function refreshTrayMenu() {
  if (!tray) return;
  const themes = loadThemes();
  const themeItems = themes.map((t) => ({
    label: t.name,
    type: 'radio',
    checked: settings.theme === t.id,
    click: () => {
      settings.theme = t.id;
      writeJSON(files.settings, settings);
      if (win) win.webContents.send('apply-theme', t.id);
      refreshTrayMenu();
    },
  }));

  const menu = Menu.buildFromTemplate([
    { label: 'Show / Focus', click: showAndFocus },
    { label: 'Reset position & size', click: resetPosition },
    { type: 'separator' },
    { label: 'Theme', submenu: themeItems.length ? themeItems : [{ label: '(none found)', enabled: false }] },
    {
      label: 'Start on login',
      type: 'checkbox',
      checked: !!settings.autoStart,
      click: (item) => {
        settings.autoStart = item.checked;
        writeJSON(files.settings, settings);
        applyAutoStart(item.checked);
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
function registerIpc() {
  ipcMain.handle('state:get', () => ({
    todos: readJSON(files.todos, []),
    lists: readJSON(files.lists, defaultLists()),
    settings,
  }));

  ipcMain.handle('todos:save', (_e, todos) => writeJSON(files.todos, todos));
  ipcMain.handle('lists:save', (_e, lists) => {
    const ok = writeJSON(files.lists, lists);
    refreshTrayMenu();
    return ok;
  });

  ipcMain.handle('settings:save', (_e, next) => {
    const prevAuto = settings.autoStart;
    const prevOpacity = settings.opacity;
    settings = { ...settings, ...next };
    const ok = writeJSON(files.settings, settings);
    if (settings.autoStart !== prevAuto) applyAutoStart(settings.autoStart);
    if (win && settings.opacity !== prevOpacity) win.setOpacity(settings.opacity ?? 1);
    refreshTrayMenu();
    return ok;
  });

  ipcMain.handle('themes:get', () => loadThemes());

  ipcMain.on('window:hide', () => { if (win) win.hide(); });
  ipcMain.on('window:reset', () => resetPosition());
  ipcMain.on('window:quit', () => { app.isQuitting = true; app.quit(); });
  ipcMain.on('window:blurToBottom', () => pinToBottom(win));
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showAndFocus);

  app.whenReady().then(() => {
    settings = ensureSeeded();
    // Make sure settings has any new default keys.
    settings = { ...defaultSettings(), ...settings };

    registerIpc();
    createWindow();
    buildTray();

    // Global hotkey to summon the widget.
    const hk = settings.hotkey || 'CommandOrControl+Alt+T';
    try {
      globalShortcut.register(hk, () => {
        showAndFocus();
        if (win) win.webContents.send('focus-quick-add');
      });
    } catch (err) {
      console.error('Failed to register hotkey', hk, err);
    }

    if (settings.autoStart) applyAutoStart(true);

    // Smoke-test hook: WT_SMOKE_MS=4000 npx electron .  -> boots then quits.
    if (process.env.WT_SMOKE_MS) {
      setTimeout(() => { app.isQuitting = true; app.quit(); }, Number(process.env.WT_SMOKE_MS));
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    // Keep running in the tray; only quit explicitly.
    if (app.isQuitting) app.quit();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (bottomTimer) clearInterval(bottomTimer);
  });
}
