# wallpaper_todo

A todo widget that lives on your Windows desktop / wallpaper. When you turn on your
computer it's already there — your tasks in front of you, no app to open.

It's a self-contained **Electron** widget: a frameless, transparent panel pinned to the
**bottom** of the window z-order (like a Rainmeter desktop widget). It rests on the desktop,
drops below other windows when you click away, and rises so you can type when you click it.
A tray icon and a global hotkey are always-available ways to summon it.

> **Phase 1 (this branch): the polished offline widget.** Data is stored locally and works
> with no network. Optional cross-device cloud sync (Firebase + email/password) is a planned
> Phase 2 — the data layer is already built "sync-ready" for it. See the bottom of this file.

## Features

- ✅ **Tasks** — add, complete (with satisfying strike-through), inline-edit (click the text),
  delete, and drag-to-reorder.
- 🎚️ **Priorities** — High / Medium / Low, shown as a colored bar on the left of each task.
- 📅 **Due dates** — per task, with badges that turn **red when overdue** and **amber when due
  today**.
- 🗂️ **Lists** — group tasks (Work / Personal / Errands by default; add/rename/recolor/delete
  your own). Filter with the tabs at the top.
- ⏰ **Clock, date & progress** — live clock, greeting, and an "X of Y done" progress bar.
- 🎨 **Theme presets** — switch instantly between **Minimal Glass, Bold Dark Card, Neon Retro,
  Light Paper**, and the open-source palettes **Nord, Dracula, Solarized**. Easy to add your own
  (see below).
- 🚀 **Starts on login** (toggle in Settings) and summons with **Ctrl+Alt+T**.

## Requirements

- Windows 10/11
- [Node.js](https://nodejs.org/) 18+ (developed on Node 24)

## Run it

```bash
npm install
npm start
```

The widget appears on your desktop. If you ever lose it, click the tray icon (the checkmark)
→ **Show / Focus**, or press **Ctrl+Alt+T**.

### Tray menu

Right-click the tray icon for: **Show / Focus**, **Reset position & size**, **Theme ▸**,
**Start on login**, and **Quit**. (Closing the widget with the **—** button just hides it — it
keeps running in the tray.)

## Where your data lives

Tasks, lists, and settings are stored as JSON in Electron's per-user data folder:

```
%APPDATA%\wallpaper-todo\    ->  todos.json, lists.json, settings.json
```

Nothing leaves your machine in Phase 1.

## Adding your own theme

Themes are just CSS custom properties. To add one, drop a `.json` file into either:

- `src/themes/` (ships with the app), or
- `%APPDATA%\wallpaper-todo\themes\` (your personal themes — no rebuild needed)

Copy an existing file (e.g. `src/themes/nord.json`) and change the values:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "vars": {
    "accent": "#ff8c42",
    "panel-bg": "rgba(20,20,28,0.6)",
    "text": "#ffffff"
    /* ...see any built-in theme for the full list of variables... */
  }
}
```

It shows up automatically in the theme switcher (the ◐ button and Settings) and the tray.

## Packaging (optional)

To build a standalone `.exe` (portable + installer) so autostart points at a stable path:

```bash
npm run build
```

Output lands in `dist/`. (Regenerate the icon any time with `npm run icon`.)

## Development preview

You can iterate on the UI in a normal browser (no Electron) using the harness in `dev/`, which
mocks the data bridge:

```bash
# serve the repo, then open http://localhost:8777/dev/preview.html
npx http-server -p 8777    # or: py -m http.server 8777
```

## How it behaves on the wallpaper (design note)

The widget is pinned to the **bottom** of the window stack (via a single `SetWindowPos` call
through `koffi`) so it sits on the desktop and drops behind other windows — but it's still a
real, focusable window, which is what lets you **type** into it. It is *not* painted behind the
desktop icons; that would prevent keyboard input on Windows. If `koffi` ever fails to load, the
widget still runs (it just falls back to a simpler always-on-bottom behavior).

## Roadmap — Phase 2: cloud sync (not in this branch)

The store (`src/store.js`) already stamps `updatedAt` and uses soft-delete tombstones, so a
Firebase (Firestore) + email/password sync layer can slot in behind it without a UI rewrite:
offline-first mirror, last-write-wins by `updatedAt`, tombstone deletes, and a real-time
listener. Setup (creating a free Firebase project, pasting its config, Firestore security rules)
will be documented here when that lands.

## License

MIT
