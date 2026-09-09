'use strict';

// Theme loader: pulls theme definitions (built-in + user-supplied) from main and
// applies them as CSS custom properties on :root. Adding a theme = dropping a
// JSON file in the themes folder — no code change.
window.themes = (() => {
  let list = [];
  let currentId = null;

  async function load() {
    try {
      list = await window.api.getThemes();
    } catch (err) {
      console.error('Failed to load themes:', err);
      list = [];
    }
    return list;
  }

  function getList() {
    return list;
  }

  function get(id) {
    return list.find((t) => t.id === id) || null;
  }

  function apply(id) {
    const theme = get(id) || list[0];
    if (!theme) return;
    currentId = theme.id;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars || {})) {
      root.style.setProperty(`--${key}`, value);
    }
    root.setAttribute('data-theme', theme.id);
  }

  function currentTheme() {
    return currentId;
  }

  return { load, getList, get, apply, currentTheme };
})();
