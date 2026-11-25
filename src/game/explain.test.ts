import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { explanationText, pieceList, speakableText } from './coachText'
import { explainMove, threatsAgainst } from './explain'
import type { MoveRating, RatedMove } from './moveRating'
import { evalToWhite, formatEval, rateMove, scoreToCp, terminalAnalysis, winProbability } from './moveRating'
import { buildEvalSeries, keyMoments } from './review'
import type { EngineAnalysis, EngineScore } from './uciEngine'

type Line = { score: EngineScore; pv: string[] }

function analysis(fen: string, lines: Line[]): EngineAnalysis {
  return {
    fen,
    depth: 12,
    bestMove: lines[0]?.pv[0] ?? null,
    lines: lines.map((line, index) => ({ multipv: index + 1, depth: 12, ...line })),
  }
}

/** Rates and explains `san` played from `fen` with the given engine lines. */
function explain(fen: string, san: string, before: Line[], after: Line[], ply = 30, rating?: MoveRating) {
  const move = new Chess(fen).move(san)
  const beforeAnalysis = analysis(fen, before)
  const afterAnalysis = analysis(move.after, after)
  const rated = rateMove({
    move,
    ply,
    historySans: [san],
    before: beforeAnalysis,
    after: afterAnalysis,
    allowBook: false,
  })!
  const explanation = explainMove({
    move,
    ply,
    rated: rating ? { ...rated, rating } : rated,
    before: beforeAnalysis,
    after: afterAnalysis,
  })
  return { explanation, text: explanationText(explanation), rated }
}

describe('explainMove – bad moves', () => {
  it('names a piece moved to an undefended square', () => {
    const { explanation, text } = explain(
      '3qk3/8/8/8/8/5N2/8/4K3 w - - 0 1',
      'Ng5',
      [{ score: { cp: -500 }, pv: ['e1e2', 'e8e7'] }],
      [{ score: { cp: 900 }, pv: ['d8g5', 'e1e2', 'e8e7', 'e2d3'] }],
    )
    expect(explanation.problem).toMatchObject({ kind: 'hangs', moved: true, piece: { type: 'n', square: 'g5' } })
    expect(explanation.problemDemo).toEqual({ arrows: [{ from: 'd8', to: 'g5' }], marks: ['g5'] })
    // Nobody has answered yet, so the capture is only possible.
    expect(text).toContain('Tah nechává jezdce na g5 bez ochrany, soupeř ho může sebrat (Qxg5).')
    expect(text).toContain('Lepší bylo Ke2.')
  })

  it('claims a capture only when the opponent made it', () => {
    const fen = '3qk3/8/8/8/8/5N2/8/4K3 w - - 0 1'
    const move = new Chess(fen).move('Ng5')
    const before = analysis(fen, [{ score: { cp: -500 }, pv: ['e1e2', 'e8e7'] }])
    const after = analysis(move.after, [{ score: { cp: 900 }, pv: ['d8g5', 'e1e2', 'e8e7', 'e2d3'] }])
    const rated = rateMove({ move, ply: 30, historySans: ['Ng5'], before, after, allowBook: false })!
    const say = (reply: string) => {
      const nextMove = new Chess(move.after).move(reply)
      return explanationText(explainMove({ move, ply: 30, rated, before, after, nextMove }))
    }
    expect(say('Qxg5')).toContain('soupeř ho bere (Qxg5).')
    expect(say('Ke7')).toContain('soupeř ho mohl sebrat (Qxg5).')
  })

  it('says a threat was ignored', () => {
    const { explanation, text } = explain(
      '3rk3/8/8/8/8/8/7P/3N2K1 w - - 0 1',
      'h3',
      [{ score: { cp: -200 }, pv: ['d1c3', 'e8e7'] }],
      [{ score: { cp: 700 }, pv: ['d8d1', 'g1g2', 'e8e7', 'h3h4'] }],
    )
    expect(explanation.problem).toMatchObject({ kind: 'hangs', moved: false, ignored: true })
    expect(text).toContain('Jezdec na d1 je pořád v ohrožení')
    expect(explanation.better?.reason).toMatchObject({ kind: 'rescues' })
    expect(text).toContain('Lepší bylo Nc3: zachrání jezdce na d1.')
  })

  it('detects a fork the move allows', () => {
    const { explanation, text } = explain(
      '4k3/8/8/8/1n6/8/8/R3K3 w - - 0 1',
      'Rb1',
      [{ score: { cp: 200 }, pv: ['a1a4', 'b4d5'] }],
      [{ score: { cp: 300 }, pv: ['b4c2', 'e1d2', 'e8e7', 'd2c3'] }],
      30,
      'mistake',
    )
    // The knight on c2 forks nothing of value here (king and an unattacked square),
    // so no fork may be claimed.
    expect(explanation.problem?.kind).not.toBe('allows-fork')
    expect(text).not.toContain('vidličku')
  })

  it('reports a real knight fork', () => {
    const { explanation, text } = explain(
      '4k3/8/8/8/1n6/8/8/R3K1N1 w - - 0 1',
      'Nf3',
      [{ score: { cp: 400 }, pv: ['e1d2', 'e8e7'] }],
      [{ score: { cp: 100 }, pv: ['b4c2', 'e1d2', 'c2a1', 'd2c3', 'e8e7', 'c3b2'] }],
      30,
      'blunder',
    )
    expect(explanation.problem).toMatchObject({ kind: 'allows-fork', reply: 'Nc2+' })
    expect(text).toContain('Soupeř dostane vidličku: Nc2+ napadne najednou krále a věž.')
  })

  it('warns about walking into mate', () => {
    const start = new Chess()
    start.move('f3')
    start.move('e5')
    const { explanation, text } = explain(
      start.fen(),
      'g4',
      [{ score: { cp: -80 }, pv: ['e2e4'] }],
      [{ score: { mate: 1 }, pv: ['d8h4'] }],
      2,
    )
    expect(explanation.problem).toMatchObject({ kind: 'allows-mate', inMoves: 1, reply: 'Qh4#' })
    expect(text).toContain('Tah dovolí soupeři dát mat jedním tahem (Qh4#).')
  })

  it('points out a missed mate without repeating it', () => {
    const { explanation, text } = explain(
      '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
      'h3',
      [{ score: { mate: 1 }, pv: ['a1a8'] }],
      [{ score: { cp: -50 }, pv: ['h7h6', 'g1h2'] }],
    )
    expect(explanation.problem).toMatchObject({ kind: 'missed-mate', move: 'Ra8#' })
    expect(explanation.better?.reason).toBeNull()
    expect(text).toBe('Šel dát mat jedním tahem: Ra8#.')
  })

  it('points out material that could have been won', () => {
    const { explanation, text } = explain(
      '4k3/8/8/3n4/8/8/7P/3RK3 w - - 0 1',
      'h3',
      [{ score: { cp: 600 }, pv: ['d1d5', 'e8e7', 'e1e2', 'e7e6'] }],
      [{ score: { cp: -150 }, pv: ['d5b4', 'e1e2', 'e8e7'] }],
      30,
      'miss',
    )
    expect(explanation.problem).toMatchObject({ kind: 'missed-material', captured: 'n', clean: true, move: 'Rxd5' })
    expect(text).toContain('Šlo získat jezdce tahem Rxd5.')
  })

  it('does not invent a reason for a positional slip', () => {
    const { explanation, text } = explain(
      '4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1',
      'a3',
      [{ score: { cp: 120 }, pv: ['e1e2', 'e8e7'] }],
      [{ score: { cp: 20 }, pv: ['e8e7', 'e1e2'] }],
      40,
      'inaccuracy',
    )
    expect(explanation.problem).toBeNull()
    expect(explanation.problemDemo).toBeNull()
    expect(text).toBe('Konkrétní taktickou chybu tu nevidím. Stockfish dává přednost Ke2.')
  })

  it('does not blame the move for a loss the best move cannot avoid', () => {
    // The d1 knight is lost either way.
    const { explanation } = explain(
      '3rk3/8/8/8/8/8/2PP3P/3N2K1 w - - 0 1',
      'h3',
      [{ score: { cp: -400 }, pv: ['h2h4', 'd8d2', 'g1g2', 'd2d1'] }],
      [{ score: { cp: 520 }, pv: ['d8d2', 'g1g2', 'd2d1', 'g2f3'] }],
      40,
      'inaccuracy',
    )
    expect(explanation.problem).toBeNull()
  })

  it('names a stalemate that throws away the win', () => {
    const { explanation, text } = explain(
      '7k/8/5K2/6Q1/8/8/8/8 w - - 0 1',
      'Qg6',
      [{ score: { mate: 1 }, pv: ['g5g7'] }],
      [{ score: { cp: 0 }, pv: [] }],
    )
    expect(explanation.problem).toEqual({ kind: 'stalemate', wasted: true })
    expect(text).toContain('Pat! Vyhraná pozice končí jen remízou.')
  })
})

describe('explainMove – good moves', () => {
  it('praises development and mentions the better move for a merely good one', () => {
    const start = new Chess().fen()
    const { explanation, text } = explain(
      start,
      'Nc3',
      [{ score: { cp: 50 }, pv: ['e2e4', 'e7e5'] }],
      [{ score: { cp: 0 }, pv: ['d7d5', 'd2d4'] }],
      0,
      'good',
    )
    expect(explanation.verdict).toBe('ok')
    expect(text).toBe('V pohodě. Vývin: jezdec jde do hry. Ještě o něco lepší bylo e4: víc bojuje o střed.')
  })

  it('does not credit the better move with material the played one wins too', () => {
    const { text } = explain(
      '4k3/8/8/3n4/2P1P3/8/8/4K3 w - - 0 1',
      'exd5',
      [{ score: { cp: 500 }, pv: ['c4d5', 'e8e7', 'e1e2', 'e7e6'] }],
      [{ score: { cp: -350 }, pv: ['e8e7', 'e1e2', 'e7e6'] }],
      40,
      'inaccuracy',
    )
    expect(text).toBe('Konkrétní taktickou chybu tu nevidím. Stockfish dává přednost cxd5.')
  })

  it('praises winning a free piece', () => {
    const { text } = explain(
      '4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1',
      'Rxd5',
      [{ score: { cp: 700 }, pv: ['d1d5', 'e8e7', 'e1e2'] }],
      [{ score: { cp: -700 }, pv: ['e8e7', 'e1e2', 'e7e6'] }],
    )
    expect(text).toBe('Získává jezdce.')
  })

  it('names only the piece the move really takes', () => {
    // Bxd5 takes a knight, the bishop is recaptured and a pawn falls: the net
    // gain is a pawn, but the move did not take one.
    const { text } = explain(
      '3rk3/1p6/8/3n4/8/5B2/8/1R2K3 w - - 0 1',
      'Bxd5',
      [{ score: { cp: 200 }, pv: ['f3d5', 'd8d5', 'b1b7', 'e8f8'] }],
      [{ score: { cp: -200 }, pv: ['d8d5', 'b1b7', 'e8f8', 'e1e2', 'f8g8'] }],
    )
    expect(text).toBe('Bere jezdce a z výměn vychází s materiálem navíc.')
    expect(text).not.toContain('Získává pěšce')
  })

  it('celebrates mate', () => {
    const { text, rated } = explain(
      '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
      'Ra8#',
      [{ score: { mate: 1 }, pv: ['a1a8'] }],
      [{ score: { mate: 0 }, pv: [] }],
    )
    expect(rated.rating).toBe('best')
    expect(rated.accuracy).toBe(100)
    expect(text).toBe('Mat! Partie rozhodnutá.')
  })
})

describe('finished positions', () => {
  const MATED = 'R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1'
  const STALEMATE = '7k/8/5KQ1/8/8/8/8/8 b - - 0 1'

  it('evaluates positions the engine reports no line for', () => {
    expect(terminalAnalysis(new Chess().fen())).toBeNull()
    expect(terminalAnalysis(STALEMATE)?.lines[0].score).toEqual({ cp: 0 })
    const mated = terminalAnalysis(MATED)!
    // From White's point of view the mate is a White win.
    const white = evalToWhite(mated, 'b')!
    expect(formatEval(white)).toBe('#')
    expect(winProbability(scoreToCp(white))).toBeGreaterThan(0.9)
    expect(buildEvalSeries([MATED], new Map([[MATED, mated]]))).toEqual([1])
  })

  it('rates and praises the mating move', () => {
    const move = new Chess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1').move('Ra8#')
    const before = analysis(move.before, [{ score: { mate: 1 }, pv: ['a1a8'] }])
    const after = terminalAnalysis(move.after)!
    const rated = rateMove({ move, ply: 40, historySans: ['Ra8#'], before, after, allowBook: false })!
    expect(rated.rating).toBe('best')
    expect(rated.accuracy).toBe(100)
    expect(explanationText(explainMove({ move, ply: 40, rated, before, after }))).toBe('Mat! Partie rozhodnutá.')
  })
})

describe('threatsAgainst', () => {
  it('draws an arrow from the attacker to the loose piece', () => {
    expect(threatsAgainst('3rk3/8/8/8/8/8/8/3N2K1 w - - 0 1', 'w')).toEqual([{ from: 'd8', to: 'd1' }])
  })
})

describe('keyMoments', () => {
  it('picks the costliest mistakes of one side in game order', () => {
    const chess = new Chess()
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'd6', 'c3', 'Nf6']) chess.move(san)
    const history = chess.history({ verbose: true })
    const rate = (index: number, rating: MoveRating, loss: number) =>
      [history[index].after, { ply: index, rating, loss } as RatedMove] as const
    const ratings = Object.fromEntries([
      rate(0, 'mistake', 20),
      rate(1, 'blunder', 90),
      rate(2, 'blunder', 50),
      rate(4, 'good', 5),
      rate(6, 'miss', 30),
      rate(8, 'mistake', 16),
    ])
    expect(keyMoments(history, ratings, 'w')).toEqual([0, 2, 6])
    expect(keyMoments(history, ratings, null, 2)).toEqual([1, 2])
  })
})

describe('Czech wording', () => {
  it('declines piece lists', () => {
    expect(pieceList(['q'])).toBe('dámu')
    expect(pieceList(['r', 'p', 'p'])).toBe('věž a dva pěšce')
    expect(pieceList(['r', 'r', 'n'])).toBe('dvě věže a jezdce')
    expect(pieceList(['p', 'p', 'p', 'p', 'p'])).toBe('5 pěšců')
  })

  it('reads notation aloud', () => {
    expect(speakableText('Lepší bylo Qxg5+.')).toBe('Lepší bylo dáma bere g5, šach.')
    expect(speakableText('Lepší bylo O-O: jezdec na g5.')).toBe('Lepší bylo malá rošáda: jezdec na g5.')
    expect(speakableText('(exd5) a e8=Q#')).toBe('(pěšec bere d5) a e8 a mění se na figuru dáma, mat')
  })
})
