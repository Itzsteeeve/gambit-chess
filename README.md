# Gambit

Chess in the browser. Play against Stockfish 19 (from 250 Elo up to full strength) or two players on one board. Everything runs locally in the browser: no server, no account. The UI is in Czech.

## Features

- **Play vs Stockfish**: 14 levels (250–2800 Elo plus "Max"); picking another level in the header immediately starts a new game. Choose your colour (White / Black / random); when you play Black, Stockfish moves first and the board turns towards you. Optional **handicap**: Stockfish starts without its f-pawn, a knight, a rook or its queen (custom start position; the PGN carries `[SetUp]` and `[FEN]` headers).
- **Two players locally** on one device.
- **Start screen**: "Play" starts immediately with your last settings, "Customize" opens the new-game dialog, plus "Two players locally". Clicking the logo goes home.
- **Hints** (first click selects a piece, second click shows the move arrow) and a **coach**: every move you make is rated (brilliant … blunder), with accuracy and the best alternative.
- **Evaluation bar** and **evaluation graph** in the Game panel (live) and in the result dialog; clicking the graph jumps to that move, coloured marks show blunders, mistakes and brilliant moves.
- **Game review**: clicking a move in the list shows that position read-only (←/→, Home/End, "Back to game"). The best move arrow and the move rating are shown for the viewed position.
- **Post-game analysis**: accuracy and counts of best/good moves, inaccuracies, mistakes and blunders for both sides, a "Next mistake" button. Unanalysed positions are completed in the background after the game (also in local games), with a progress indicator.
- **Premoves**: while Stockfish thinks you can queue your next move (blue highlight and arrow); it plays itself once it is your turn and the move is still legal. Right click or Esc cancels it.
- **Arrows and marks**: right-drag draws arrows, right-click draws circles; Shift = red, Ctrl = orange, Alt = blue. They disappear on the next move or left click.
- Clocks (none, 3+2, 5+0, 10+0, 15+10), resign, draw by agreement, rematch, undo/redo, board flip, PGN and FEN to clipboard.
- 5 board themes (Emerald, Walnut, Midnight, Blush, Slate) and 3 piece sets (Chessnut by default, Ivory & Onyx, Terracotta).
- Sounds, animations (can be turned off; `prefers-reduced-motion` is respected), responsive layout down to 320 px.
- Settings are stored in `localStorage` (keys `gambit.*`); a game in progress is intentionally not saved, so reloading the page shows the start screen.

## Controls

| Key / action | Function |
| --- | --- |
| click or drag | move a piece (on the opponent's turn: premove) |
| Enter / Space, arrows on the board | select a square and move from the keyboard |
| `N` | new game |
| `F` | flip the board |
| `M` | sound on/off |
| `←` / `→` | undo / redo; while reviewing or after the game, step through history |
| `Home` / `End` | start of the game / back to the game |
| `Esc` | cancel selection, premove or review |
| right click | mark a square, drag for an arrow |

## Commands

```bash
npm install          # postinstall copies the Stockfish WASM into public/engine
npm run dev          # dev server on http://localhost:5173
npm run build        # tsc -b && vite build
npm run preview      # preview the production build
npm test             # vitest (game logic, engine, rating, review)
npm run engine:copy  # re-copy the Stockfish files
```

## Docker

```bash
docker compose up -d --build   # the app is served on http://localhost:8080
```

### Behind a reverse proxy (e.g. `https://example.com/chess/`)

1. On the server, copy `.env.example` to `.env` next to `docker-compose.yml` and adjust it. `BASE_PATH` is the sub-path, `PROXY_NETWORK` the Docker network of the proxy container, and `COMPOSE_FILE` adds `docker-compose.proxy.yml`.
2. Add the locations from [`deploy/nginx-chess.conf`](deploy/nginx-chess.conf) to the proxy and reload it. It must forward to `gambit:4173` and keep the `/chess/` prefix.
3. Run `docker compose up -d --build`. Updating is `git pull` followed by the same command.

`BASE_PATH` is baked into the build, so rebuild after changing it. Server-specific settings belong in `.env` (ignored by git); do not edit the tracked files on the server.

## Tech

React 19, TypeScript, Vite, `chess.js` (rules), Stockfish 19 lite (WASM in two Web Workers: one plays, one analyses), plain CSS with tokens (`src/styles/tokens.css`). The design rules are in `DESIGN.md`, third-party licenses in `THIRD_PARTY.md`.
