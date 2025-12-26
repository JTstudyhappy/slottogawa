# CSS Structure

This folder is now modularized. Load `style.css` only; it imports the rest.

- `style.css`: single entry that imports all modules.
- `base.css`: fonts, root variables, global resets, shared animations.
- `cabinet.css`: cabinet body, screen, reels, payline indicators.
- `controls.css`: control panel, buttons, stand, bet buttons, action button.
- `cards.css`: card drawer, slots, active/locked states.
- `overlays.css`: ad overlay, shop overlay, shop button, timers.
- `led.css`: LED border strips/dots, active modes, multi-reel width helpers.

## Adding new components
- Prefer creating a focused file (e.g., `progress.css`) and import it from `style.css`.
- Keep selectors scoped to specific blocks to avoid leaking styles.
- Use existing variables from `base.css` for colors/typography; add new ones there when needed.
- If a component shares patterns (buttons, overlays), reuse classes or extend them instead of duplicating.
- Run a quick lint check in the editor to catch syntax issues (no nested @imports, no empty rules).
