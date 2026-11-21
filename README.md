# Gambit

Šachy v prohlížeči. Hraješ proti Stockfishi 19 (od 250 Elo po plnou sílu) nebo ve dvou na jedné desce. Všechno běží lokálně v prohlížeči, bez serveru a bez účtu. Celé rozhraní je česky.

## Co aplikace umí

- **Hra proti Stockfishi**: 14 úrovní (250–2800 Elo a „Max“). Volba barvy (bílé / černé / náhodně); když hraješ černými, Stockfish táhne první a deska se otočí k tobě. Volitelný **náskok**: Stockfish začíná bez pěšce f, jezdce, věže nebo dámy (vlastní výchozí pozice, v PGN s hlavičkami `[SetUp]` a `[FEN]`).
- **Dva hráči lokálně** na jednom zařízení.
- **Úvodní obrazovka**: „Hrát“ začne hned s posledním nastavením, „Přizpůsobit“ otevře dialog nové partie, „Dva hráči lokálně“. Rozehranou partii lze „Pokračovat“. Klik na logo = domů.
- **Rady** (1. klik označí figuru, 2. klik ukáže šipku tahu) a **trenér**: každý tvůj tah se ohodnotí (brilantní … hrubka), s přesností a nejlepší alternativou.
- **Hodnoticí lišta** a **graf hodnocení** v panelu Partie (živě), po partii i v okně výsledku; klik do grafu skočí na tah, barevné značky ukazují hrubky, chyby a brilantní tahy.
- **Procházení partie**: klik na tah v seznamu zobrazí danou pozici jen pro čtení (šipky ←/→, Home/End, „Zpět do hry“). U prohlížené pozice se ukáže šipka nejlepšího tahu a hodnocení tahu.
- **Rozbor po partii**: přesnost a počty nejlepších/dobrých tahů, nepřesností, chyb a hrubek pro obě strany, tlačítko „Další chyba“. Nedohodnocené pozice se po skončení dopočítají na pozadí (i u lokální partie), s ukazatelem průběhu.
- **Předtahy**: zatímco Stockfish přemýšlí, můžeš zadat svůj další tah (modré zvýraznění a šipka); provede se sám, jakmile jsi na tahu a tah je pořád legální. Pravé tlačítko nebo Esc ho zruší.
- **Šipky a značky**: pravým tlačítkem kreslíš šipky (tažením) a kroužky (kliknutím); Shift = červená, Ctrl = oranžová, Alt = modrá. Mizí s dalším tahem nebo levým klikem.
- Hodiny (bez hodin, 3+2, 5+0, 10+0, 15+10), vzdání, remíza dohodou, odveta, undo/redo, otočení desky, PGN a FEN do schránky.
- 5 témat desky (Smaragd, Ořech, Půlnoc, Růženín, Břidlice) a 3 sady figur (Ivory & Onyx, Chessnut, Terracotta).
- Zvuky, animace (vypínatelné, respektuje `prefers-reduced-motion`), responzivní layout od 320 px.
- Nastavení se ukládá do `localStorage` (klíče `gambit.*`); rozehraná partie se záměrně neukládá, po načtení stránky se ukáže úvodní obrazovka.

## Ovládání

| Klávesa / akce | Funkce |
| --- | --- |
| klik nebo tažení | tah figurou (na tahu soupeře: předtah) |
| Enter / mezerník, šipky na desce | výběr pole a tah z klávesnice |
| `N` | nová partie |
| `F` | otočit desku |
| `M` | zvuk zap/vyp |
| `←` / `→` | tah zpět / vpřed; při prohlížení nebo po konci partie krok v historii |
| `Home` / `End` | začátek partie / zpět do hry |
| `Esc` | zrušit výběr, předtah nebo prohlížení |
| pravé tlačítko | značka na poli, tažením šipka |

## Příkazy

```bash
npm install          # postinstall zkopíruje Stockfish WASM do public/engine
npm run dev          # vývojový server na http://localhost:5173
npm run build        # tsc -b && vite build
npm run preview      # náhled produkčního buildu
npm test             # vitest (logika hry, enginu, hodnocení, rozboru)
npm run engine:copy  # znovu zkopírovat soubory Stockfishe
```

## Technologie

React 19, TypeScript, Vite, `chess.js` (pravidla), Stockfish 19 lite (WASM ve dvou Web Workerech: jeden hraje, druhý analyzuje), čisté CSS s tokeny (`src/styles/tokens.css`). Popis designu je v `DESIGN.md`, licence třetích stran v `THIRD_PARTY.md`.
