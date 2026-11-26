# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # postinstall copies the Stockfish WASM into public/engine (scripts/copy-engine.mjs)
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # tsc -b && vite build (type check is the only static check)
npm run preview    # serve the production build
npm run engine:copy  # re-copy Stockfish files if public/engine is missing
npm test           # vitest run (node env, config in vitest.config.ts, tests in src/**/*.test.ts)
```

No linter is configured. Verify with `npx tsc -b` (strict) and `npm test`. No git repo.

## What this is

"Gambit" — a Czech-language, client-only React 19 + Vite + TypeScript chess app (chess.js for rules, Stockfish 19 lite WASM in Web Workers). All UI strings are Czech. Everything runs offline; no backend. `README.md` (Czech, user-facing) and `DESIGN.md` (design rules) are current; `src/styles/tokens.css` is the source of truth for visuals.

## Architecture

`src/App.tsx` is the single orchestrator: it owns all UI state (screen, selection, promotion, dialogs, hints, review ply, premove, undo-in-progress) and wires the hooks below to presentational components. There is no router or state library. `screen` is `'home' | 'game'`; every load starts on `StartScreen` (the game is not persisted).

**Game state — `src/game/gameModel.ts` + `useChessGame.ts`.** `GameModel` is a framework-free class (unit-tested) that wraps a `chess.js` instance and keeps an undo/redo stack of full `GameState` snapshots. `reset(setup?)` accepts a custom start FEN (handicap, see `handicap.ts`) plus PGN player/event headers; chess.js then writes `[SetUp "1"]`/`[FEN]`. `positionAt(ply)` returns the read-only snapshot after `ply` moves (used by review mode). It also maintains `pieces` (`pieces.ts`) with stable ids so the board can animate moves. Outcome detection lives in `gameModel.ts`/`notation.ts`. Finishing a game clears the redo stack; undo/redo are refused once there is an outcome. A flag fall is a draw if the opponent cannot mate.

**Custom positions and imports.** `startNewGame` takes an optional `startFen` ("Hrát odsud" and FEN import go through `NewGameDialog` in `'position'` dialog mode). Such a game does not persist colour or handicap; App `positionStart` makes rematch and level change replay it. `importGame.ts` parses pasted FEN/PGN and rejects illegal positions (Stockfish may crash on them); `GameModel.load` replays a record, ignoring unclaimed draws on the way, and ends it with an outcome (`record`, `unfinished` or what the board says). App `imported` marks such a game: it is neutral (`isEngineGame` false whatever the stored mode), opens in review without the result dialog and offers no rematch. A game may start with Black to move at any move number: number moves with `moveLabel`/`groupMoves` (from `move.before`), never from the ply index, and gate the opening book on `standardStart`.

**Player colour.** The human's colour for the current game is App state `humanColor` (resolved from the persisted `gambit.player-color` choice `'w' | 'b' | 'random'` in `startNewGame`); `engineColor = opposite(humanColor)`. There are no global colour constants. Orientation flips to the human's colour on a new engine game; the engine effect makes the first move when it plays White. Undo in engine mode takes back two plies on the human's turn and never removes Stockfish's first move when the human is Black.

**Two independent engine workers — `src/game/useStockfish.ts` + `uciEngine.ts`.**
- `useStockfishPlay` runs the opponent using the selected `EngineLevel` (`engineLevels.ts`). Below ~1320 Elo it fakes weakness with Skill Level, shallow depth and a random-move chance; it pads think time so replies are never instant.
- `useEngineAnalysis` runs a second worker for eval bar, hints, move ratings (`moveRating.ts`), cached per FEN, plus `evalSeries` (per-ply −1..1 White-POV values, built by `review.ts`), `progress`, `analyses` and `requestAnalysis(fen)` (jumps the queue, used for the reviewed position). `allowBook` is false for handicap games. `autoAnalyze` is on in Stockfish mode and, after a game ends, in local mode too (post-game background analysis of all plies).
- `UciEngine` is a promise wrapper that serialises UCI requests; requests accept an `AbortSignal`. After `dispose()` nothing respawns; a failed `init()` is not cached.
- The App effect that drives the engine's move is keyed on `fen`/`turn`/`outcome`/mode/level/`engineColor`/`screen`/`isUndoing`/`stockfishPlay.attempt` and reads callbacks through refs; its cleanup aborts the search. Engine failures surface as `engineError` (toast + inline "Zkusit znovu").

**Review mode.** `reviewPly` (null = live). The board then renders `positionAt(viewPly)` locked, the toolbar is replaced by `ReviewBar`, the side panel move list highlights the shown ply, and the best move of the shown position is drawn as a system arrow. Arrow keys browse while reviewing or after the game; otherwise ←/→ are undo/redo. Pure helpers (`summarizeSide`, `nextMistakePly`, `graphPoints`, `buildEvalSeries`) are in `review.ts` and tested.

**Coach explanations.** `tactics.ts` (board facts: legal-move static exchange evaluation, hanging pieces, forks, material outcome of a PV) → `explain.ts` (`explainHistoryMove` picks the reason; returns data) → `coachText.ts` (Czech sentences and declension, `speakableText` for TTS). Rule: claim a concrete reason only when board and engine line agree, otherwise just name the better move; wording stays impersonal. It reuses the cached depth-12 analyses, no extra search. Mate/stalemate positions get no engine line, so `terminalAnalysis` (`moveRating.ts`) supplies one (`{mate: 0, cp}`: `cp` carries the winner). App state `demo` shows a punishment or better-move position; while it is set the engine effect and the clock are paused and the board is locked. Voice is `lib/useSpeech.ts` (`gambit.coach-voice`), threat arrows `gambit.threats`.

**Ratings, openings, training.** `styles/ratings.css` holds one entrance animation per rating, switched on by a `.rating-fx` wrapper whose React key changes when a new verdict lands (the move list only animates verdicts that arrive after it mounted). Brilliant/great sounds are played by an App effect, once per move the coach turns to. `openings.ts` maps positions to Czech names (the test replays every line); it is independent of the rating book in `moveRating.ts`. `puzzles.ts` (pure, tested) turns rated mistakes into puzzles; App collects them whenever ratings change (never from imports) into `gambit.puzzles`. `TrainingScreen` (screen `'training'`) has its own `useChessGame` and analysis worker and judges attempts with `rateMove`.

**Side panel.** One tabbed panel (moves, piece/board picker, info). `CoachCard` and `AnalysisCard` sit inside the "Partie" tab above the move list (the user rejected a separate column). `CoachCard` keeps the last comment while the next rating is pending; the voice reads each move once, keyed on `move.after`. Visually hidden text inside a scrolling box needs a positioned ancestor, or it stretches the page.

**Premoves and arrows.** While the engine is to move, `premoveMode` lets the human pick their own pieces; targets come from `premove.ts` (geometry only, ignoring occupancy) and the queued move executes in an effect once it is the human's turn, if still legal. `Board` draws all arrows/marks in one SVG (`arrows.ts` geometry): system arrows (hint, best, premove) from props, user right-click arrows/marks as Board-local state cleared on any move or left click. Right click calls `onRightClick` first (cancels a premove).

**Modes.** `gameMode` is `'stockfish' | 'human'` (persisted). Live ratings and coach comments only in Stockfish mode (a local game gets them after it ends); the eval bar is always rendered (neutral/transparent when off) so the board column stays aligned.

**Dialogs.** `Modal` animates out (`data-state="closing"`, 160 ms; immediate with reduced motion) before calling `onClose`. Footer buttons use the render-prop form `footer={(close) => …}` and call `close()` or `close(action)`.

**Clock.** `useChessClock.ts` is paused whenever any dialog/promotion is open, a coach demonstration is shown or the start screen is shown. App stores a clock snapshot per ply and restores it on undo/redo; the first move of the game earns no increment.

**Persistence.** `useStoredState(key, initial, validate?)` (localStorage, keys `gambit.*`; invalid values fall back to the default) for mode, level, orientation, appearance, reduced transparency, board theme, coordinates, animations, tempo, player colour, handicap. Piece set lives in `pieceSets.ts` (`usePieceSet`, key `gambit.piece-set`).

**Styling ("Gambit Glass").** Plain CSS imported in order from `main.tsx`: `tokens → base → layout → board → pieces → panels → dialogs → ratings → glass → responsive`. `tokens.css` holds primitives plus two appearance sets (`html[data-appearance='dark'|'light']`) and the glass materials; `glass.css` maps components onto the thin/regular/thick materials and draws the ambient backdrop (`.app::before`), so component sheets keep layout and `glass.css` decides fills, blur, edges and shape. Appearance: `gambit.appearance` (`system|light|dark`) and `gambit.reduce-transparency`, applied by `useApplyAppearance` (`lib/appearance.ts`); the inline script in `index.html` sets the same attributes before first paint, keep the two in step. `html.liquid` (set in `main.tsx` for Chromium) enables the `#liquid-glass` SVG filter rendered in `App`. `--primary` is the UI blue; chess "good" (best move, arrows) is `--good`. Board themes are `[data-theme=...]` token sets (`BOARD_THEMES` in `game/constants.ts`: emerald, walnut, midnight, blush, slate, frost). Piece sets: `ivory` (own SVG, `PieceArt.tsx` + `PieceDefs.tsx`), `chessnut`, `terracotta` (bundled SVGs in `src/assets/pieces`, licenses in `THIRD_PARTY.md`). `html[data-motion]` toggles animations; `prefers-reduced-motion` must be respected.
