# Desktop UI direction

Wallpaper Todo should feel at home in a carefully styled Linux desktop: a quiet
charcoal panel, one pastel accent, precise typography, and useful information at
a glance. The clock and task list carry the hierarchy; controls and metadata stay
subordinate. This is a design interpretation adapted to a compact Windows widget.

## Palette and surfaces

The default Minimal Glass theme uses Catppuccin Mocha colors: base `#1e1e2e`,
text `#cdd6f4`, secondary text `#bac2de`, muted text `#a6adc8`, and lavender
`#b4befe` for selected states and primary actions. Red, yellow, and green retain
their task-status meaning. A 95% opaque panel keeps arbitrary wallpapers from
competing with the content; translucent internal surfaces add subtle depth.

[Catppuccin's palette](https://catppuccin.com/palette/) supplies the colors.
Its [style guide](https://github.com/catppuccin/catppuccin/blob/main/docs/style-guide.md)
provides semantic background and text roles, with legibility taking precedence.
The [official Hyprland theme](https://github.com/catppuccin/hyprland) is a visual
reference for a coherent desktop palette.

## Hierarchy and interaction

- Use consistent gutters and rounded surfaces, with restrained borders.
- Keep system sans-serif for task content and tabular numerals for the clock.
- Use a small number of type sizes and weights; preserve readable metadata.
- Use crisp monochrome SVG controls, with accessible names and focus states.
- Make task status understandable through text or shape as well as color.
- Preserve keyboard access, expose row actions on focus, and respect reduced motion.
- Keep the composer anchored and usable at the widget's compact dimensions.

These choices draw on GNOME's guidance for
[typography](https://developer.gnome.org/hig/guidelines/typography.html),
[symbolic icons](https://developer.gnome.org/hig/guidelines/ui-icons.html),
[keyboard interaction](https://developer.gnome.org/hig/guidelines/keyboard.html),
and [accessible styling](https://developer.gnome.org/hig/guidelines/ui-styling.html).

## Review cases

Check the normal window, minimum dimensions, long task/list names, empty and
completed states, each theme, settings and theme popovers, keyboard navigation,
and both light and dark wallpapers. The browser preview must use the same markup
and styles as the Electron application so design review reflects the shipped UI.
