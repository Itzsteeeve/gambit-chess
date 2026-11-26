# Gambit

Chess in the browser. Play against Stockfish 19 (from 250 Elo up to full strength) or two players on one board. Everything runs locally in the browser: no server, no account. The UI is in Czech.

## Versions

| Branch | What it is | Needs |
| --- | --- | --- |
| `main` | **Without a server.** Play vs Stockfish, two players locally, review, training. A static site: `npm run build` and host `dist/` anywhere (or the Docker image below). | nothing but a static web server |
| `server` | **With a server.** Everything from `main` plus **online multiplayer** (lobby, rooms, quick pairing, live games). A small Node server serves the app and a WebSocket. | Node or Docker, and WebSocket forwarding in the reverse proxy |

New offline features go to `main` first and are merged into `server`.

## Features

- **Play vs Stockfish**: 14 levels (250–2800 Elo plus "Max"); picking another level in the header immediately starts a new game. Choose your colour (White / Black / random); when you play Black, Stockfish moves first and the board turns towards you. Optional **handicap**: Stockfish starts without its f-pawn, a knight, a rook or its queen (custom start position; the PGN carries `[SetUp]` and `[FEN]` headers).
- **Two players locally** on one device.
- **Start screen**: "Play" starts immediately with your last settings, "Customize" opens the new-game dialog, plus "Two players locally". Clicking the logo goes home.
- **Hints** (first click selects a piece, second click shows the move arrow) and a **coach**: every move you make is rated (brilliant … blunder) with accuracy, and explained in Czech: why it is good or bad (hanging piece, fork, mate, lost or missed material, opening principles) and what was better. A concrete reason is only given when both the board and the engine line support it; otherwise the coach just names the better move.
- **Coach demonstrations**: "Ukaž problém" draws the punishing reply, "Lepší tah" shows the better move; the engine and the clocks wait meanwhile. "Zkusit znovu" takes a bad move back.
- **Threat arrows** (Settings, off by default): red arrows on your pieces Stockfish could profitably take.
- **Rating animations**: every verdict lands with its own short animation in the side panel and the move list. **Brilliant** and **great** moves also have their own sounds, a wash over the coach and an effect on the board.
- **Opening names**: the Game panel and the result dialog name the opening in Czech (about 160 positions, transpositions included).
- **Mistake training** ("Trénink chyb" on the start screen, "Procvičit chyby" in the result dialog): your mistakes, blunders and missed wins are saved as puzzles. Find a better move; Stockfish accepts any move about as good as its own. Up to 100 puzzles are kept in this browser (imported games are not added).
- **Read aloud** (off by default): the coach speaks its comments if the browser has a Czech voice (on Windows it may need to be installed in the language settings).
- **Evaluation bar** and **evaluation graph** in the Game panel (live) and in the result dialog; clicking the graph jumps to that move, coloured marks show blunders, mistakes and brilliant moves.
- **Game review**: clicking a move in the list shows that position read-only (←/→, Home/End, "Back to game"). The best move arrow and the move rating are shown for the viewed position, and the coach comments on the viewed move.
- **Post-game analysis**: accuracy and the count of every rating (brilliant, great, best … blunder) for both sides, a list of the brilliant and great moves, a "Next mistake" button and up to three **key moments** with the coach's explanation. Unanalysed positions are completed in the background after the game (also in local games), with a progress indicator.
- **Play from here** ("Hrát odsud"): while reviewing, or after a game that ended on a playable position, start a new game from the shown position. A dialog picks the opponent, level, colour and clock; "Odveta" and a level change replay the same position.
- **Import** ("Importovat partii" on the start screen, "Import" under the move list): paste a **PGN** to open it in review with the coach, accuracies and the graph, or a **FEN** to play from that position. From a PGN only the main line of the first game is read; chess variants are refused, as are illegal positions.
- **Premoves**: while Stockfish thinks you can queue your next move (blue highlight and arrow); it plays itself once it is your turn and the move is still legal. Right click or Esc cancels it.
- **Arrows and marks**: right-drag draws arrows, right-click draws circles; Shift = red, Ctrl = orange, Alt = blue. They disappear on the next move or left click.
- Clocks (none, 3+2, 5+0, 10+0, 15+10), resign, draw by agreement, rematch, undo/redo, board flip, PGN and FEN to clipboard.
- **Calm green glass look** with a dark and a light appearance (Settings → Vzhled: system / light / dark) and a "reduce transparency" switch for opaque surfaces.
- 6 board themes (Emerald, Walnut, Midnight, Blush, Slate, Frost) and 3 piece sets (Chessnut by default, Ivory & Onyx, Terracotta), switchable in the "Sada" tab or in Settings.
- The "Partie" tab holds the coach, both accuracies with the evaluation graph and the move list.
- Sounds, animations (can be turned off; `prefers-reduced-motion` is respected), responsive layout down to 320 px.
- Settings and training puzzles are stored in `localStorage` (keys `gambit.*`), so each browser has its own; a game in progress is intentionally not saved, so reloading the page shows the start screen.

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
| `Esc` | cancel selection, premove, coach demonstration or review |
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
