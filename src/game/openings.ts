import { Chess } from 'chess.js'
import type { Move } from 'chess.js'

/**
 * Czech opening names. Each entry is the shortest usual move order (SAN) that
 * reaches the position the name belongs to. A game is named after the deepest
 * listed position it has passed through, so transpositions are recognised.
 */
export const OPENING_LINES: ReadonlyArray<readonly [name: string, moves: string]> = [
  // ------------------------------------------------------------- 1. e4
  ['Hra královským pěšcem', 'e4'],
  ['Otevřená hra', 'e4 e5'],
  ['Královská jezdcová hra', 'e4 e5 Nf3'],
  ['Hra střelcem', 'e4 e5 Bc4'],
  ['Středová hra', 'e4 e5 d4 exd4 Qxd4'],
  ['Dánský gambit', 'e4 e5 d4 exd4 c3'],
  ['Napoleonův útok', 'e4 e5 Qf3'],
  ['Parhamův útok', 'e4 e5 Qh5'],

  ['Vídeňská hra', 'e4 e5 Nc3'],
  ['Vídeňský gambit', 'e4 e5 Nc3 Nf6 f4'],

  ['Královský gambit', 'e4 e5 f4'],
  ['Královský gambit: přijatý', 'e4 e5 f4 exf4'],
  ['Královský gambit: jezdcový', 'e4 e5 f4 exf4 Nf3'],
  ['Královský gambit: střelcový', 'e4 e5 f4 exf4 Bc4'],
  ['Královský gambit: odmítnutý', 'e4 e5 f4 Bc5'],
  ['Falkbeerův protigambit', 'e4 e5 f4 d5'],

  ['Philidorova obrana', 'e4 e5 Nf3 d6'],
  ['Ruská hra', 'e4 e5 Nf3 Nf6'],
  ['Ruská hra: klasické pokračování', 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4'],
  ['Damianova obrana', 'e4 e5 Nf3 f6'],
  ['Lotyšský gambit', 'e4 e5 Nf3 f5'],
  ['Sloní gambit', 'e4 e5 Nf3 d5'],
  ['Ponzianiho zahájení', 'e4 e5 Nf3 Nc6 c3'],

  ['Skotská hra', 'e4 e5 Nf3 Nc6 d4'],
  ['Skotská hra: hlavní linie', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4'],
  ['Skotský gambit', 'e4 e5 Nf3 Nc6 d4 exd4 Bc4'],

  ['Hra tří jezdců', 'e4 e5 Nf3 Nc6 Nc3'],
  ['Hra čtyř jezdců', 'e4 e5 Nf3 Nc6 Nc3 Nf6'],
  ['Hra čtyř jezdců: španělská varianta', 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5'],

  ['Italská hra', 'e4 e5 Nf3 Nc6 Bc4'],
  ['Italská hra: Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5'],
  ['Italská hra: Giuoco Pianissimo', 'e4 e5 Nf3 Nc6 Bc4 Bc5 d3'],
  ['Italská hra: hlavní linie s c3', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3'],
  ['Evansův gambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4'],
  ['Maďarská obrana', 'e4 e5 Nf3 Nc6 Bc4 Be7'],
  ['Hra dvou jezdců', 'e4 e5 Nf3 Nc6 Bc4 Nf6'],
  ['Hra dvou jezdců: útok jezdcem na g5', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'],
  ['Hra dvou jezdců: Fegatello', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7'],
  ['Traxlerův protiútok', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5'],
  ['Italská hra: Blackburnův-Schillingův gambit', 'e4 e5 Nf3 Nc6 Bc4 Nd4'],

  ['Španělská hra', 'e4 e5 Nf3 Nc6 Bb5'],
  ['Španělská hra: Morphyho obrana', 'e4 e5 Nf3 Nc6 Bb5 a6'],
  ['Španělská hra: výměnná varianta', 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6'],
  ['Španělská hra: uzavřená varianta', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'],
  ['Španělská hra: otevřená varianta', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4'],
  ['Španělská hra: Marshallův útok', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5'],
  ['Španělská hra: berlínská obrana', 'e4 e5 Nf3 Nc6 Bb5 Nf6'],
  ['Španělská hra: klasická obrana', 'e4 e5 Nf3 Nc6 Bb5 Bc5'],
  ['Španělská hra: Steinitzova obrana', 'e4 e5 Nf3 Nc6 Bb5 d6'],
  ['Španělská hra: Schliemannova obrana', 'e4 e5 Nf3 Nc6 Bb5 f5'],

  ['Sicilská obrana', 'e4 c5'],
  ['Sicilská obrana: Alapinova varianta', 'e4 c5 c3'],
  ['Sicilská obrana: uzavřená varianta', 'e4 c5 Nc3'],
  ['Sicilská obrana: útok Grand Prix', 'e4 c5 Nc3 Nc6 f4'],
  ['Sicilská obrana: Smithův-Morrův gambit', 'e4 c5 d4 cxd4 c3'],
  ['Sicilská obrana: Bowdlerův útok', 'e4 c5 Bc4'],
  ['Sicilská obrana: otevřená varianta', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4'],
  ['Sicilská obrana: moskevská varianta', 'e4 c5 Nf3 d6 Bb5+'],
  ['Sicilská obrana: Rossolimova varianta', 'e4 c5 Nf3 Nc6 Bb5'],
  ['Sicilská obrana: Najdorfova varianta', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
  ['Sicilská obrana: dračí varianta', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'],
  ['Sicilská obrana: klasická varianta', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6'],
  ['Sicilská obrana: Scheveningenská varianta', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6'],
  ['Sicilská obrana: Svešnikovova varianta', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5'],
  ['Sicilská obrana: zrychlený drak', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6'],
  ['Sicilská obrana: Tajmanovova varianta', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6'],
  ['Sicilská obrana: Kanova varianta', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6'],

  ['Francouzská obrana', 'e4 e6'],
  ['Francouzská obrana: výměnná varianta', 'e4 e6 d4 d5 exd5'],
  ['Francouzská obrana: zavřená varianta s e5', 'e4 e6 d4 d5 e5'],
  ['Francouzská obrana: Tarraschova varianta', 'e4 e6 d4 d5 Nd2'],
  ['Francouzská obrana: hlavní linie', 'e4 e6 d4 d5 Nc3'],
  ['Francouzská obrana: Winawerova varianta', 'e4 e6 d4 d5 Nc3 Bb4'],
  ['Francouzská obrana: klasická varianta', 'e4 e6 d4 d5 Nc3 Nf6'],
  ['Francouzská obrana: Rubinsteinova varianta', 'e4 e6 d4 d5 Nc3 dxe4'],

  ['Caro-Kann', 'e4 c6'],
  ['Caro-Kann: výměnná varianta', 'e4 c6 d4 d5 exd5 cxd5'],
  ['Caro-Kann: Panovův útok', 'e4 c6 d4 d5 exd5 cxd5 c4'],
  ['Caro-Kann: zavřená varianta s e5', 'e4 c6 d4 d5 e5'],
  ['Caro-Kann: klasická varianta', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5'],
  ['Caro-Kann: Karpovova varianta', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7'],
  ['Caro-Kann: hra dvou jezdců', 'e4 c6 Nc3 d5 Nf3'],

  ['Skandinávská obrana', 'e4 d5'],
  ['Skandinávská obrana: dáma bere na d5', 'e4 d5 exd5 Qxd5'],
  ['Skandinávská obrana: moderní varianta', 'e4 d5 exd5 Nf6'],

  ['Pircova obrana', 'e4 d6 d4 Nf6 Nc3 g6'],
  ['Pircova obrana: rakouský útok', 'e4 d6 d4 Nf6 Nc3 g6 f4'],
  ['Moderní obrana', 'e4 g6'],
  ['Aljechinova obrana', 'e4 Nf6'],
  ['Aljechinova obrana: moderní varianta', 'e4 Nf6 e5 Nd5 d4 d6 Nf3'],
  ['Aljechinova obrana: útok čtyř pěšců', 'e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 f4'],
  ['Nimcovičova obrana', 'e4 Nc6'],
  ['Owenova obrana', 'e4 b6'],
  ['St. Georgeova obrana', 'e4 a6'],

  // ------------------------------------------------------------- 1. d4
  ['Hra dámským pěšcem', 'd4'],
  ['Zavřená hra', 'd4 d5'],
  ['Londýnský systém', 'd4 d5 Bf4'],
  ['Londýnský systém', 'd4 d5 Nf3 Nf6 Bf4'],
  ['Londýnský systém', 'd4 Nf6 Bf4'],
  ['Londýnský systém', 'd4 Nf6 Nf3 e6 Bf4'],
  ['Londýnský systém', 'd4 Nf6 Nf3 g6 Bf4'],
  ['Colleho systém', 'd4 d5 Nf3 Nf6 e3'],
  ['Blackmarův-Diemerův gambit', 'd4 d5 e4 dxe4 Nc3'],
  ['Veresovův útok', 'd4 d5 Nc3 Nf6 Bg5'],
  ['Torreho útok', 'd4 Nf6 Nf3 e6 Bg5'],
  ['Trompowského útok', 'd4 Nf6 Bg5'],

  ['Dámský gambit', 'd4 d5 c4'],
  ['Dámský gambit: přijatý', 'd4 d5 c4 dxc4'],
  ['Dámský gambit: odmítnutý', 'd4 d5 c4 e6'],
  ['Dámský gambit: výměnná varianta', 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5'],
  ['Dámský gambit: ortodoxní obrana', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7'],
  ['Tarraschova obrana', 'd4 d5 c4 e6 Nc3 c5'],
  ['Poloslovanská obrana', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6'],
  ['Slovanská obrana', 'd4 d5 c4 c6'],
  ['Slovanská obrana: výměnná varianta', 'd4 d5 c4 c6 cxd5'],
  ['Čigorinova obrana', 'd4 d5 c4 Nc6'],
  ['Albinův protigambit', 'd4 d5 c4 e5'],
  ['Baltská obrana', 'd4 d5 c4 Bf5'],

  ['Indická hra', 'd4 Nf6'],
  ['Indická hra', 'd4 Nf6 c4'],
  ['Královská indická obrana', 'd4 Nf6 c4 g6 Nc3 Bg7'],
  ['Královská indická: klasická varianta', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5'],
  ['Královská indická: Sämischova varianta', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3'],
  ['Královská indická: útok čtyř pěšců', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4'],
  ['Královská indická: fianchetto', 'd4 Nf6 c4 g6 Nf3 Bg7 g3'],
  ['Grünfeldova obrana', 'd4 Nf6 c4 g6 Nc3 d5'],
  ['Grünfeldova obrana: výměnná varianta', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4'],
  ['Nimcovičova indická obrana', 'd4 Nf6 c4 e6 Nc3 Bb4'],
  ['Nimcovičova indická: Rubinsteinova varianta', 'd4 Nf6 c4 e6 Nc3 Bb4 e3'],
  ['Nimcovičova indická: klasická varianta', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2'],
  ['Dámská indická obrana', 'd4 Nf6 c4 e6 Nf3 b6'],
  ['Bogoljubovova indická obrana', 'd4 Nf6 c4 e6 Nf3 Bb4+'],
  ['Katalánské zahájení', 'd4 Nf6 c4 e6 g3'],
  ['Benoni', 'd4 Nf6 c4 c5'],
  ['Moderní Benoni', 'd4 Nf6 c4 c5 d5 e6'],
  ['Volžský gambit', 'd4 Nf6 c4 c5 d5 b5'],
  ['Staroindická obrana', 'd4 Nf6 c4 d6'],
  ['Budapešťský gambit', 'd4 Nf6 c4 e5'],

  ['Holandská obrana', 'd4 f5'],
  ['Holandská obrana: Stauntonův gambit', 'd4 f5 e4'],
  ['Holandská obrana: leningradská varianta', 'd4 f5 g3 Nf6 Bg2 g6'],
  ['Holandská obrana: stonewall', 'd4 f5 c4 Nf6 g3 e6 Bg2 d5'],
  ['Benoni: stará varianta', 'd4 c5'],
  ['Anglická obrana', 'd4 e6 c4 b6'],
  ['Englundův gambit', 'd4 e5'],

  // ------------------------------------------------------- ostatní tahy
  ['Anglická hra', 'c4'],
  ['Anglická hra: obrácená sicilská', 'c4 e5'],
  ['Anglická hra: symetrická varianta', 'c4 c5'],
  ['Anglická hra: indická obrana', 'c4 Nf6'],
  ['Rétiho zahájení', 'Nf3 d5 c4'],
  ['Zukertortovo zahájení', 'Nf3'],
  ['Královský indický útok', 'Nf3 d5 g3'],
  ['Birdovo zahájení', 'f4'],
  ['Fromův gambit', 'f4 e5'],
  ['Larsenovo zahájení', 'b3'],
  ['Sokolského zahájení', 'b4'],
  ['Benkőovo zahájení', 'g3'],
  ['Van Geetovo zahájení', 'Nc3'],
  ['Grobův útok', 'g4'],
  ['Mizesovo zahájení', 'd3'],
  ['Van’t Kruijsovo zahájení', 'e3'],
  ['Andersseovo zahájení', 'a3'],
  ['Saragossské zahájení', 'c3'],
  ['Barnesovo zahájení', 'f3'],
]

/** Names are not looked for past this ply; no listed position lies deeper. */
const MAX_PLY = 30

/** Pieces, side to move and castling rights: equal for transpositions. */
function positionKey(fen: string): string {
  return fen.split(' ', 3).join(' ')
}

let index: Map<string, string> | null = null

/** Built on first use: replaying every line takes a moment. */
function openingIndex(): Map<string, string> {
  if (index) return index
  index = new Map()
  for (const [name, moves] of OPENING_LINES) {
    const chess = new Chess()
    for (const san of moves.split(' ')) chess.move(san)
    index.set(positionKey(chess.fen()), name)
  }
  return index
}

/**
 * Name of the opening after the first `ply` moves of a game that began in the
 * standard position; null before the first recognised position.
 */
export function openingName(history: Move[], ply: number = history.length): string | null {
  const names = openingIndex()
  for (let i = Math.min(ply, history.length, MAX_PLY) - 1; i >= 0; i -= 1) {
    const name = names.get(positionKey(history[i].after))
    if (name) return name
  }
  return null
}
