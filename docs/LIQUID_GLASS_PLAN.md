# Gambit Glass — plán redesignu

Větev: `redesign/liquid-glass` (z `main` @ 9607069). Cíl: odklonit se od plochého „chess.com“ vzhledu k modernímu, Apple-like **liquid glass** stylu s plnohodnotným tmavým i světlým režimem. Funkce, rozložení a chování zůstávají; mění se materiál, barvy, tvary a pohyb.

---

## 1. Koncept „Gambit Glass“

**Šachovnice je pevný předmět, všechno kolem ní je sklo, které nad ní plave.**

- **Pozadí (ambient).** Pod celou aplikací leží měkké, rozmazané barevné skvrny („aurora“) — v tmavém režimu hluboká modrozelená / indigo / fialová na téměř černé, ve světlém perleťová / broskvová / blankytná na teple bílé. Statické (nic se nepohybuje ve smyčce); na ně se sklo „láme“.
- **Sklo ve třech tloušťkách** (tokeny, ne jednorázové hodnoty):
  - `thin` — toolbar, čipy, hráčské pásky, toasty (`blur 16px`, víc průhlednosti),
  - `regular` — postranní panel, hlavička, karta úvodní obrazovky (`blur 24px saturate 180 %`),
  - `thick` — dialogy, popovery, výběr promoce (`blur 40px`, nejméně průhledné).
- **Anatomie skla:** poloprůhledná výplň + `backdrop-filter` + 1px světelná hrana (gradient border, nahoře světlejší) + vnitřní horní odlesk (`inset 0 1px 0`) + měkký, široký stín. Žádné tvrdé linky mezi sekcemi — oddělení mezerou a jemným tónem.
- **„Liquid“ efekt** (progressive enhancement, jen Chromium): SVG `feDisplacementMap` refrakce na okrajích u 2–3 hlavních prvků (plovoucí toolbar, segmentované přepínače, primární tlačítko). Jinde (Safari/Firefox) čisté sklo bez refrakce. Při stisku tlačítka se sklo krátce „zmáčkne“ (scale 0.97 + zesílení odlesku).
- **Šachovnice** zůstává neprůhledná (čitelnost!), dostane velké zaoblení (`--radius-board` ~ 14px), skleněný rámeček (bezel) a hlubší stín, takže „leží“ na pozadí. Board témata zůstávají; přidáme jedno nové téma laděné ke sklu („Frost“ — studená šedomodrá).
- **Tvary:** pilulky pro tlačítka a přepínače, radius 12 / 18 / 28 px pro karty a dialogy (místo 4 / 6 / 10).
- **Typografie:** `-apple-system, 'SF Pro Text'` na Apple zařízeních, jinak Inter (beze změny bundlu). Čísla hodin a hodnocení `tabular-nums`, větší display váha.
- **Akcent:** odklon od chess.com zelené. Doporučuji **jeden systémový akcent** — sytá modrá (`#0a84ff` tmavý / `#007aff` světlý) pro primární akce, výběr, přepínače a progres. Zelená zůstává jen tam, kde nese šachový význam (nejlepší tah, šipky, hodnocení tahů). Akcent je jediný token, takže jde snadno vyměnit (alternativa: mint / teal).

## 2. Světlý a tmavý režim

- Nové nastavení **Vzhled: Systém / Světlý / Tmavý** (`gambit.appearance`, výchozí `system`) přes `useStoredState`.
- Aplikuje se jako `html[data-appearance="light|dark"]`; `system` sleduje `matchMedia('(prefers-color-scheme: dark)')`.
- Malý inline skript v `index.html` nastaví atribut ještě před vykreslením (žádné probliknutí). `color-scheme` a `<meta name="theme-color">` se přepínají spolu s režimem.
- Přepínač v Nastavení jako iOS segmentovaný ovladač; volitelně rychlá ikona v hlavičce.
- Druhý přepínač **„Omezit průhlednost“** (`gambit.reduce-transparency`) + respektování `prefers-reduced-transparency` a `prefers-contrast: more` → sklo se změní na plné, neprůhledné plochy.

## 3. Architektura tokenů (`tokens.css`)

Dnes je vše v jedné tmavé sadě. Rozdělíme na:

1. **Primitiva** — paleta (neutrály, akcenty, tóny tahů), radiusy, mezery, pohyb, layout (beze změny výpočtu `--board-size`).
2. **Sémantické tokeny pro režim** — `:root` / `[data-appearance='dark']` a `[data-appearance='light']`:
   `--bg`, `--ambient-1..3`, `--text*`, `--muted`, `--faint`, `--line`, `--accent*`, `--overlay`, `--hover-wash`, `--press-wash`, `--shadow-*`, `--shell-piece-backdrop`.
3. **Materiály** — `--glass-thin|regular|thick-bg`, `--glass-blur-*`, `--glass-edge` (gradient hrany), `--glass-highlight`, `--glass-shadow`; plus fallback `--surface*` pro neprůhledný režim.
4. Legacy aliasy (`--surface`, `--border`, `--primary`…) zůstanou namapované, aby nic nespadlo během přechodu; na konci je projdeme a odstraníme nepoužívané.

Board témata (`[data-theme]`) zůstávají nezávislá na režimu; jen upravíme `--board-last/selected`, pokud budou ve světlém režimu působit mdle.

## 4. Fáze implementace

Každá fáze končí `npx tsc -b`, `npm test` a screenshoty obou režimů v náhledu.

### Fáze 0 — příprava
- Baseline screenshoty: úvod, partie (desktop, tablet, mobil), rozbor, trénink, dialogy.
- Inventura natvrdo zapsaných barev mimo tokeny: `board.css` (25), `panels.css` (5), `dialogs.css` (3), `pieces.css` (1); inline barvy v TSX (EvalGraph, Confetti, arrows) → převést na tokeny.

### Fáze 1 — tokeny a vzhled
- Přepsat `tokens.css` podle bodu 3 (tmavá + světlá sada, materiály).
- `useAppearance` hook (`src/lib/useAppearance.ts`): stored volba + systémová preference → atribut na `<html>`, meta theme-color.
- Inline anti-flash skript v `index.html`, `color-scheme: light dark`.
- Ovládání v `SettingsDialog` (Vzhled + Omezit průhlednost).

### Fáze 2 — materiál a pozadí (`styles/glass.css`, nový, mezi `tokens` a `base`)
- Utility třídy `.glass`, `.glass--thin|thick`, `.glass-edge` (pseudo-element s gradient hranou přes `mask`), `.glass-press`.
- Ambientní pozadí jako `.app::before` (fixed, radial-gradienty + blur), bez animace.
- SVG filtr refrakce (jeden skrytý `<svg>` v `App`/`main.tsx`), aktivovaný jen přes `@supports` + třídu `.liquid`.
- `@supports not (backdrop-filter: blur(1px))` a „omezit průhlednost“ → neprůhledné fallbacky.

### Fáze 3 — shell a layout
- **Hlavička:** plovoucí skleněná lišta odsazená od okrajů (zaoblená, sticky), značka vlevo, akce vpravo.
- **Hráčské pásky:** skleněné čipy; hodiny jako pilulka, aktivní hodiny zvýrazněné akcentem (tónem, ne září), nízký čas červeně.
- **Eval bar:** zaoblená pilulka se skleněným okrajem.
- **Toolbar pod deskou:** plovoucí skleněná „kapsle“ (liquid), ikony v kruhových tlačítkách.
- **Postranní panel:** jedna skleněná karta `regular`; záložky jako iOS segmentovaný ovladač s klouzajícím „palcem“; seznam tahů bez linek, aktuální tah jako pilulka.
- `CoachCard`, `AnalysisCard`, `ReviewBar`: sekce uvnitř panelu (žádné sklo ve skle — jen jemný tón).
- Výpočty `--board-size` a rozvržení (`layout.css`, `responsive.css`) zachovat; upravit jen mezery kvůli plovoucí hlavičce.

### Fáze 4 — ovládací prvky (`base.css`, `IconButton`, `Switch`, `EloSlider`, `LevelPicker`)
- Tlačítka: primární = plný akcent v pilulce s odleskem; sekundární = skleněná pilulka; text/ghost.
- iOS přepínač (`Switch`), posuvník Elo se skleněným jezdcem, segmentované ovladače, inputy/textarea (import) se skleněným polem a akcentním focus ringem.
- Focus ring: 2px akcent + 2px mezera, viditelný na skle i desce.

### Fáze 5 — vrstvy nad obsahem
- **Modal:** `thick` sklo, vstup scale 0.96 → 1 + fade (200 ms), pozadí stránky ztmavené a lehce rozmazané; výstup 160 ms (beze změny logiky `data-state="closing"`).
- `NewGameDialog`, `SettingsDialog`, `ImportDialog`, `GameOverDialog`, `ConfirmDialog`, `MoveClassificationDialog`: projít obsah (karty voleb → skleněné dlaždice s akcentem při výběru).
- **Toast:** skleněná kapsle nahoře uprostřed.
- **Výběr promoce:** skleněný popover nad deskou.
- **Úvodní obrazovka:** náhled desky „plave“ na ambientním pozadí, karta s akcemi = sklo `regular`, velký nadpis.
- **Trénink (`TrainingScreen`)**: stejné prvky jako partie.

### Fáze 6 — deska a překryvy
- Rámeček desky (bezel), zaoblení, stín; souřadnice beze změny.
- Zkontrolovat čitelnost šipek, teček tahů, šachu, premove a odznaků hodnocení v obou režimech.
- Nové téma „Frost“ v `BOARD_THEMES` (`game/constants.ts`) + swatche v galerii.
- Černé figury mimo desku: `--shell-piece-backdrop` pro světlý režim.

### Fáze 7 — animace a hodnocení
- `ratings.css`: přebarvit vlny/kroužky na tokeny, ověřit na světlém pozadí; brilantní/skvělý tah může krátce „rozvlnit“ sklo coach karty (pod 1,1 s, jednorázově).
- Pohybové konstanty zachovat; `prefers-reduced-motion` a `html[data-motion='off']` dál vše zkracují na nulu.

### Fáze 8 — výkon, přístupnost, responsivita
- Omezit počet současně rozmazaných vrstev (cíl ≤ 6 na obrazovce); žádný `backdrop-filter` na řádcích seznamu tahů ani na prvcích, které se animují při tahu.
- Měřit v náhledu: plynulost animace tahu s otevřeným panelem; na slabých zařízeních (≤ 760 px) menší blur.
- Kontrast textu na skle ≥ 4.5:1 v obou režimech (sklo má vlastní tónovou výplň, ne čistou průhlednost).
- Prohlížeče: Chromium (plný efekt), Safari (`-webkit-backdrop-filter`, bez refrakce), Firefox (blur, bez refrakce).
- Telefon / tablet / desktop v obou režimech.

### Fáze 9 — dokumentace
- Přepsat `DESIGN.md` (nové principy: sklo, režimy, akcent, materiály — dnešní pravidlo „no glows, no blur“ přestává platit).
- Aktualizovat sekci *Styling* v `CLAUDE.md` (pořadí CSS, `glass.css`, `data-appearance`, nové klíče `gambit.*`) a zmínku v `README.md`.

## 5. Dotčené soubory (přehled)

| Oblast | Soubory |
| --- | --- |
| Tokeny, materiál | `src/styles/tokens.css`, nový `src/styles/glass.css`, `src/main.tsx` (pořadí importů) |
| Režim | nový `src/lib/useAppearance.ts`, `src/App.tsx`, `index.html`, `src/components/SettingsDialog.tsx` |
| Shell | `layout.css`, `panels.css`, `responsive.css`, `Header.tsx`, `SidePanel.tsx`, `PlayerStrip.tsx`, `BoardToolbar.tsx`, `EvalBar.tsx` |
| Prvky | `base.css`, `IconButton.tsx`, `Switch.tsx`, `EloSlider.tsx`, `LevelPicker.tsx` |
| Vrstvy | `dialogs.css`, `Modal.tsx`, `Toast.tsx`, `PromotionPicker.tsx`, `StartScreen.tsx`, `TrainingScreen.tsx` |
| Deska | `board.css`, `pieces.css`, `game/constants.ts`, `EvalGraph.tsx`, `Confetti.tsx` |
| Animace | `ratings.css` |
| Dokumentace | `DESIGN.md`, `CLAUDE.md`, `README.md` |

Herní logika (`src/game/*` kromě `constants.ts`) se nemění; testy by měly projít beze změny.

## 6. Rozhodnutí k potvrzení

1. **Akcent:** systémová modrá (doporučeno) vs. mint/teal vs. ponechat zelenou.
2. **Refrakce (liquid) přes SVG filtr:** ano jako progressive enhancement na 2–3 prvcích (doporučeno) vs. jen čisté rozmazané sklo všude.
3. **Ambientní pozadí:** statické (doporučeno, šetří baterii) vs. velmi pomalý drift barev.
4. **Nové board téma „Frost“:** přidat (doporučeno) vs. jen stávající.

## 7. Ověření hotového stavu

- `npx tsc -b` a `npm test` zelené.
- Screenshoty z náhledu: úvod, partie, rozbor, trénink, dialogy — tmavý i světlý režim, desktop + mobil.
- Přepnutí Systém/Světlý/Tmavý funguje za běhu i po reloadu bez probliknutí; „Omezit průhlednost“ dává neprůhledné plochy.
- Animace tahu plynulé s otevřeným panelem; reduced motion respektován.
