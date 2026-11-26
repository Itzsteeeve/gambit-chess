# Gambit — design

The board is the product; everything around it is quiet glass. `src/styles/tokens.css` is the single source of truth — this file only states the rules.

## Principles

- **Glass over a solid board.** The board is opaque; everything around it is glass floating over an ambient backdrop (`.app::before`, muted green light fields `--ambient-1..4`, kept close to `--bg`: depth, not colour) with a faint film grain (`.app::after`, `--grain-opacity`). Three materials, all tokens: `thin` (toolbar/review bar capsule, clocks, toasts, ghost buttons), `regular` (header capsule, side panel, start card), `thick` (dialogs, popovers, promotion picker, tooltips). Each has a fill, a backdrop blur + saturate, a 1px top-lit edge ring (masked `::before`) and a soft shadow. Mapping lives in `src/styles/glass.css`; no glass inside glass — content inside a panel or dialog sits in *inset groups* (`--group` tint, `--radius-md`, hairline ring, inset row separators), iOS-style: the coach and review cards, piece-set and info tables, every settings section (small muted label above its group). Choices of board theme and appearance are small previews ringed with `--primary` (outline, 3 px offset), not tinted cards.
- **Two appearances.** `html[data-appearance='dark'|'light']` switches every colour token; `gambit.appearance` is `system | light | dark` (`lib/appearance.ts`, pre-paint script in `index.html`). `html[data-transparency='reduced']` (setting or `prefers-reduced-transparency`) and browsers without `backdrop-filter` get opaque surfaces.
- **One calm green.** Both appearances lean slightly green. `--primary` (sage-emerald) marks the primary action, selection, switches and progress; `--good` is the chess green (best move, default arrows). `--gold` winner + brand, `--amber` hints, `--danger` destructive / check / low time, `--premove` (cool blue) premoves only.
- **Not generated-looking.** No neon, no purple/blue gradient blobs, no coloured glows under buttons (primary buttons get a faint sheen and a neutral 1px shadow), no gradient text. If a surface needs attention, use tone and spacing. Move-quality tones (`--tone-*`) appear only as small dots/badges.
- **Shape.** Pills for buttons, segmented controls, tabs, clocks and the toolbar; radii 8 / 12 / 22 / 30 (`--radius-sm/md/lg/xl`), board `--radius-board`. Primary buttons are lit pills (top sheen, coloured shadow).
- **Type scale 12 / 13 / 15 / 20** (`--fs-xs/sm/md/lg`), plus 30/44 for display numbers. System font (SF Pro on Apple), Inter elsewhere. Sentence case; the only uppercase labels are the move-list column headers.
- **Tokens only.** Colours, radii, spacing (4 px grid), durations and easings come from `tokens.css`; board themes are `[data-theme]` token sets (emerald, walnut, midnight, blush, slate, frost) independent of the appearance.
- **Liquid refraction** (`html.liquid`, Chromium only) bends the backdrop of the floating toolbar through the `#liquid-glass` SVG filter. Elsewhere it is plain blur; never add it to things that move.
- **Eval graph.** Black's share is a tinted well (`--graph-black`), White's an ivory area fading downward, joined by a monotone curve (`smoothPath` in `review.ts`, never overshoots) that eases to new values; a dot marks the shown ply.
- **Alive, but quiet.** No pointer-following highlights (rejected: they read as a gimmick). The ambient fields drift once a minute (off with motion off); the side-panel tab thumb slides with a slight overshoot; screens rise in once on mount (`glass-rise`, 560 ms).
- **Motion is functional and short.** Moves 210–380 ms by distance (the piece lifts while it glides, knights higher), arrows fade in once (140 ms), flip 260 ms, dialogs 200 ms in (spring) / 160 ms out, presses spring back (`--ease-spring`). Nothing else loops except the "thinking" dots. A move rating "lands" once with its own gesture (`ratings.css`); only brilliant and great add rings, a flat wash over the coach and a board effect, all under 1.1 s. `html[data-motion='off']` and `prefers-reduced-motion` reduce everything to instant (dialogs then close without waiting).

## Layout

- Desktop: board column (player strip / eval bar + board / player strip / toolbar) and a narrow side panel (`--sidebar-w`) at the right edge of the page, exactly as tall as the board column; the spare width goes mostly left of the board. The board size is computed from the viewport (`--board-size`), never scrolls the page.
- One panel, never a second column: the coach and the review strip are compact flat sections at the top of the "Partie" tab. Coach actions are plain text buttons (no icons, no coloured outlines). While loading it dims the previous comment instead of replacing it. Very short windows drop the graph.
- ≤ 1180 px portrait and ≤ 760 px: stacked; the side panel follows the board at the same width. Phones hide secondary labels, not functions.
- Pieces sit dead centre on their square. Black pieces shown outside the board get a light backdrop (`--shell-piece-backdrop`).
- The start screen is a still board preview plus one card: primary "Hrát"/"Pokračovat", ghost secondary, text actions.

## Board overlays (bottom → top)

squares → last-move / selection / premove / check / hint overlays → move dots → pieces → rating badge → arrows and marks (one SVG, `pointer-events: none`) → promotion picker. User arrows: green, Shift red, Ctrl amber, Alt blue; hint arrow amber; best move in review green; premove blue.
