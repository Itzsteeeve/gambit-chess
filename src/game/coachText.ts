/**
 * Czech wording for the coach. Sentences are impersonal on purpose: they work
 * for any player, either colour and both game modes.
 */
import type { PieceSymbol } from 'chess.js'
import type { Explanation, Reason } from './explain'

interface PieceForms {
  nominative: string
  /** Also the genitive singular and the accusative plural of these pieces. */
  accusative: string
  pronoun: 'ho' | 'ji'
  feminine: boolean
  /** Genitive plural, used from five up. */
  many: string
}

export const PIECE_FORMS: Record<PieceSymbol, PieceForms> = {
  p: { nominative: 'pěšec', accusative: 'pěšce', pronoun: 'ho', feminine: false, many: 'pěšců' },
  n: { nominative: 'jezdec', accusative: 'jezdce', pronoun: 'ho', feminine: false, many: 'jezdců' },
  b: { nominative: 'střelec', accusative: 'střelce', pronoun: 'ho', feminine: false, many: 'střelců' },
  r: { nominative: 'věž', accusative: 'věž', pronoun: 'ji', feminine: true, many: 'věží' },
  q: { nominative: 'dáma', accusative: 'dámu', pronoun: 'ji', feminine: true, many: 'dam' },
  k: { nominative: 'král', accusative: 'krále', pronoun: 'ho', feminine: false, many: 'králů' },
}

/** Plural nominative/accusative used after 2–4. */
const FEW: Record<PieceSymbol, string> = {
  p: 'pěšce',
  n: 'jezdce',
  b: 'střelce',
  r: 'věže',
  q: 'dámy',
  k: 'krále',
}

function joinList(items: string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} a ${items[items.length - 1]}`
}

/** Accusative phrase for a set of pieces: "dámu a dva pěšce". */
export function pieceList(types: PieceSymbol[]): string {
  const counts = new Map<PieceSymbol, number>()
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1)
  return joinList(
    [...counts].map(([type, count]) => {
      const forms = PIECE_FORMS[type]
      if (count === 1) return forms.accusative
      if (count === 2) return `${forms.feminine ? 'dvě' : 'dva'} ${FEW[type]}`
      if (count <= 4) return `${count === 3 ? 'tři' : 'čtyři'} ${FEW[type]}`
      return `${count} ${forms.many}`
    }),
  )
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Full sentence(s) explaining what is wrong or right about the played move. */
export function reasonSentence(reason: Reason): string {
  switch (reason.kind) {
    case 'mate':
      return 'Mat! Partie rozhodnutá.'
    case 'stalemate':
      return reason.wasted ? 'Pat! Vyhraná pozice končí jen remízou.' : 'Pat, partie končí remízou.'
    case 'allows-mate':
      return reason.inMoves <= 1
        ? `Tah dovolí soupeři dát mat jedním tahem (${reason.reply}).`
        : `Po tomhle tahu má soupeř vynucený mat do ${reason.inMoves} tahů, začíná ${reason.reply}.`
    case 'missed-mate':
      return reason.inMoves <= 1
        ? `Šel dát mat jedním tahem: ${reason.move}.`
        : `Byl tu vynucený mat do ${reason.inMoves} tahů, začínal ${reason.move}.`
    case 'hangs': {
      const { piece, reply, chance } = reason
      const forms = PIECE_FORMS[piece.type]
      // Never claim a capture the opponent did not make.
      const verb = chance === 'taken' ? 'bere' : chance === 'missed' ? 'mohl sebrat' : 'může sebrat'
      if (reason.defended) {
        const gain = chance === 'taken' ? 'získá' : 'získat'
        return `Krytí nestačí: soupeř ${verb} ${forms.accusative} na ${piece.square} (${reply}) a ${gain} materiál.`
      }
      const take = `soupeř ${forms.pronoun} ${verb} (${reply}).`
      if (reason.moved) return `Tah nechává ${forms.accusative} na ${piece.square} bez ochrany, ${take}`
      if (reason.ignored) {
        return capitalize(`${forms.nominative} na ${piece.square} je pořád v ohrožení, ${take}`)
      }
      return `Po tomhle tahu zůstává ${forms.nominative} na ${piece.square} bez ochrany, ${take}`
    }
    case 'bad-trade':
      // With equal pieces traded off, only the surplus loss is left to name.
      return reason.gained.length > 0
        ? `Nevýhodná výměna po ${reason.reply}: stojí ${pieceList(reason.lost)} a přinese jen ${pieceList(reason.gained)}.`
        : `Výměna se nevyplatí: po ${reason.reply} stojí navíc ${pieceList(reason.lost)}.`
    case 'allows-fork':
      return `Soupeř dostane vidličku: ${reason.reply} napadne najednou ${joinList(
        reason.targets.map((target) => PIECE_FORMS[target.type].accusative),
      )}.`
    case 'loses-material': {
      const trade = reason.gained.length > 0 ? ` a přinese jen ${pieceList(reason.gained)}` : ''
      return `Tah stojí ${pieceList(reason.lost)}${trade} (varianta ${reason.line.join(' ')}).`
    }
    case 'missed-material': {
      const { captured, clean, move } = reason
      if (captured && clean) return `Šlo získat ${PIECE_FORMS[captured].accusative} tahem ${move}.`
      if (captured) {
        return `Šlo vzít ${PIECE_FORMS[captured].accusative} tahem ${move} a vyjít z výměn s materiálem navíc.`
      }
      return `Tahem ${move} šlo získat materiál.`
    }
    case 'missed-fork':
      return `Šla dát vidlička: ${reason.move} napadne najednou ${joinList(
        reason.targets.map((target) => PIECE_FORMS[target.type].accusative),
      )}.`
    case 'early-queen':
      return 'Dáma jde do hry brzy a soupeř ji může honit, zatímco vyvíjí figury.'
    case 'sacrifice':
      return 'Oběť, která se vyplácí.'
    case 'wins-material': {
      const { captured, clean } = reason
      if (!captured) return 'Získává materiál.'
      return clean
        ? `Získává ${PIECE_FORMS[captured].accusative}.`
        : `Bere ${PIECE_FORMS[captured].accusative} a z výměn vychází s materiálem navíc.`
    }
    case 'fork':
      return `Vidlička: najednou napadá ${joinList(
        reason.targets.map((target) => PIECE_FORMS[target.type].accusative),
      )}.`
    case 'only-move':
      return 'Jediný dobrý tah v téhle pozici.'
    case 'rescues':
      return `Zachraňuje ${PIECE_FORMS[reason.piece.type].accusative} z pole ${reason.piece.square} před sebráním.`
    case 'castles':
      return 'Rošáda: král je v bezpečí a věž se dostává do hry.'
    case 'develops':
      return `Vývin: ${PIECE_FORMS[reason.piece].nominative} jde do hry.`
    case 'center':
      return 'Pěšec bojuje o střed.'
    case 'book':
      return 'Tah z teorie zahájení.'
  }
}

/** Short "why" appended after the better move: "Lepší bylo O-O: …". */
function betterWhy(reason: Reason): string | null {
  switch (reason.kind) {
    case 'mate':
      return 'dává mat'
    case 'missed-mate':
      return reason.inMoves <= 1 ? 'dává mat' : `vede k matu do ${reason.inMoves} tahů`
    case 'wins-material':
      if (!reason.captured) return 'získá materiál'
      return reason.clean
        ? `získá ${PIECE_FORMS[reason.captured].accusative}`
        : `vezme ${PIECE_FORMS[reason.captured].accusative} a získá materiál`
    case 'fork':
      return `vidlička na ${joinList(reason.targets.map((target) => PIECE_FORMS[target.type].accusative))}`
    case 'rescues':
      return `zachrání ${PIECE_FORMS[reason.piece.type].accusative} na ${reason.piece.square}`
    case 'castles':
      return 'král se schová do bezpečí'
    case 'develops':
      return `vyvede ${PIECE_FORMS[reason.piece].accusative} do hry`
    case 'center':
      return 'víc bojuje o střed'
    default:
      return null
  }
}

/** The coach's comment: one or two sentences. */
export function explanationText({ verdict, problem, praise, better }: Explanation): string {
  const parts: string[] = []
  if (verdict === 'bad') {
    parts.push(problem ? reasonSentence(problem) : 'Konkrétní taktickou chybu tu nevidím.')
    // "Missed …" sentences already name the better move.
    if (better && !problem?.kind.startsWith('missed-')) {
      const why = better.reason ? betterWhy(better.reason) : null
      if (why) parts.push(`Lepší bylo ${better.san}: ${why}.`)
      else if (problem) parts.push(`Lepší bylo ${better.san}.`)
      else parts.push(`Stockfish dává přednost ${better.san}.`)
    }
  } else if (verdict === 'ok' && better) {
    parts.push(praise ? `V pohodě. ${reasonSentence(praise)}` : 'V pohodě.')
    // The same merit twice says nothing about why the other move is better.
    const why = better.reason && better.reason.kind !== praise?.kind ? betterWhy(better.reason) : null
    parts.push(`Ještě o něco lepší bylo ${better.san}${why ? `: ${why}` : ''}.`)
  } else {
    parts.push(praise ? reasonSentence(praise) : 'Silný tah, drží pozici v nejlepším stavu.')
  }
  return capitalize(parts.join(' '))
}

const SPOKEN_PIECES: Record<string, string> = {
  K: 'král',
  Q: 'dáma',
  R: 'věž',
  B: 'střelec',
  N: 'jezdec',
}

const SAN_PATTERN = /O-O(?:-O)?[+#]?|\b(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|(?:[a-h]x)?[a-h][1-8](?:=[QRBN])?)(?![a-z0-9])[+#]?/g

/** "Qxg5+" → "dáma bere g5, šach", so a voice can read it. */
export function spokenSan(san: string): string {
  const suffix = san.endsWith('#') ? ', mat' : san.endsWith('+') ? ', šach' : ''
  const body = san.replace(/[+#]$/, '')
  if (body === 'O-O') return `malá rošáda${suffix}`
  if (body === 'O-O-O') return `velká rošáda${suffix}`
  const promotion = /=([QRBN])$/.exec(body)
  const plain = body.replace(/=[QRBN]$/, '')
  const target = plain.slice(-2)
  const piece = SPOKEN_PIECES[plain[0]] ?? (plain.includes('x') ? 'pěšec' : '')
  const action = plain.includes('x') ? `bere ${target}` : target
  const promoted = promotion ? ` a mění se na figuru ${SPOKEN_PIECES[promotion[1]]}` : ''
  return `${piece ? `${piece} ` : ''}${action}${promoted}${suffix}`
}

/** Splits a sentence into plain text and chess notation (moves and squares), for highlighting. */
export function splitNotation(text: string): Array<{ text: string; notation: boolean }> {
  const parts: Array<{ text: string; notation: boolean }> = []
  let end = 0
  for (const match of text.matchAll(SAN_PATTERN)) {
    if (match.index > end) parts.push({ text: text.slice(end, match.index), notation: false })
    parts.push({ text: match[0], notation: true })
    end = match.index + match[0].length
  }
  if (end < text.length) parts.push({ text: text.slice(end), notation: false })
  return parts
}

/** Replaces chess notation in a sentence with words (bare squares stay as they are). */
export function speakableText(text: string): string {
  return text.replace(SAN_PATTERN, (san) => spokenSan(san))
}
