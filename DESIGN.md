# Gambit — design

The board is the product; everything around it is a quiet console. `src/styles/tokens.css` is the single source of truth — this file only states the rules.

## Principles

- **Flat surfaces.** Shell `--bg`, one surface `--surface` for panels and dialogs, `--surface-2/3` for controls and selected states. Separation by hairlines (`--line`), not by nested cards. No card-in-card, no glows, no gradients on chrome, no backdrop blur.
- **One green.** `--primary` (#81b64c) marks the primary action, selection and progress. Other accents have one job each: `--gold` winner + brand, `--amber` hints, `--danger` destructive / check / low time, `--premove` (cool blue) premoves only. Move-quality tones (`--tone-*`) appear only as small dots/badges.
- **Type scale 12 / 13 / 15 / 20** (`--fs-xs/sm/md/lg`), plus 28/40 for display numbers. Sentence case; the only uppercase labels are the move-list column headers.
- **Tokens only.** Colours, radii (`--radius-sm/md/lg`), spacing (4 px grid, `--space-*`), durations and easings come from tokens; board themes are `[data-theme]` token sets (emerald, walnut, midnight, blush, slate).
- **Motion is functional and short.** Moves 220 ms, flip 260 ms, dialogs 200 ms in / 160 ms out, presses 100 ms. Nothing loops except the "thinking" dots. `html[data-motion='off']` and `prefers-reduced-motion` reduce everything to instant (dialogs then close without waiting).

## Layout

- Desktop: board column (player strip / eval bar + board / player strip / toolbar) next to a fixed-width side panel (`--sidebar-w`). The board size is computed from the viewport (`--board-size`), never scrolls the page.
- ≤ 1180 px portrait and ≤ 760 px: stacked; the side panel follows the board at the same width. Phones hide secondary labels, not functions.
- The start screen is a still board preview plus one card: primary "Hrát"/"Pokračovat", ghost secondary, text actions.

## Board overlays (bottom → top)

squares → last-move / selection / premove / check / hint overlays → move dots → pieces → rating badge → arrows and marks (one SVG, `pointer-events: none`) → promotion picker. User arrows: green, Shift red, Ctrl amber, Alt blue; hint arrow amber; best move in review green; premove blue.
