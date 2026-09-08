'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The renderer never touches Node/fs directly. Everything goes through this
// small, explicit surface — which also makes the Phase 2 cloud backend a
// drop-in behind the same calls.
contextBridge.exposeInMainWorld('api', {
  // Data
  getState: () => ipcRenderer.invoke('state:get'),
  saveTodos: (todos) => ipcRenderer.invoke('todos:save', todos),
  saveLists: (lists) => ipcRenderer.invoke('lists:save', lists),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getThemes: () => ipcRenderer.invoke('themes:get'),

  // Window / app controls
  hideWindow: () => ipcRenderer.send('window:hide'),
  resetWindow: () => ipcRenderer.send('window:reset'),
  quit: () => ipcRenderer.send('window:quit'),
  dropToBottom: () => ipcRenderer.send('window:blurToBottom'),

  // Events from main -> renderer
  onApplyTheme: (cb) => ipcRenderer.on('apply-theme', (_e, id) => cb(id)),
  onFocusQuickAdd: (cb) => ipcRenderer.on('focus-quick-add', () => cb()),
});
