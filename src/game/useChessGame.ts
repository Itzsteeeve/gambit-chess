import { useCallback, useRef, useState } from 'react'
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import { GameModel } from './gameModel'
import type { GameRecord, GameSetup, GameState, MoveResult } from './gameModel'
import type { GameOutcome } from './notation'

export type { GameSetup, GameState, MoveResult } from './gameModel'

interface Snapshot {
  state: GameState
  canUndo: boolean
  canRedo: boolean
}

function snapshotOf(model: GameModel): Snapshot {
  return { state: model.state, canUndo: model.canUndo, canRedo: model.canRedo }
}

/** React binding around `GameModel`. All callbacks have stable identities. */
export function useChessGame() {
  const modelRef = useRef<GameModel | null>(null)
  if (modelRef.current === null) modelRef.current = new GameModel()
  const model = modelRef.current

  const [gameNumber, setGameNumber] = useState(1)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snapshotOf(model))

  const sync = useCallback(() => {
    setSnapshot(snapshotOf(model))
  }, [model])

  const move = useCallback(
    (from: Square, to: Square, promotion?: PieceSymbol): MoveResult => {
      const result = model.move(from, to, promotion)
      if (result.ok) sync()
      return result
    },
    [model, sync],
  )

  const undo = useCallback((): boolean => {
    const ok = model.undo()
    if (ok) sync()
    return ok
  }, [model, sync])

  const redo = useCallback((): boolean => {
    const ok = model.redo()
    sync()
    return ok
  }, [model, sync])

  const reset = useCallback((setup?: GameSetup) => {
    model.reset(setup)
    sync()
    setGameNumber((value) => value + 1)
  }, [model, sync])

  const load = useCallback((record: GameRecord) => {
    model.load(record)
    sync()
    setGameNumber((value) => value + 1)
  }, [model, sync])

  const finish = useCallback(
    (outcome: GameOutcome) => {
      if (model.finish(outcome)) sync()
    },
    [model, sync],
  )

  const resign = useCallback(
    (color: Color) => {
      if (model.resign(color)) sync()
    },
    [model, sync],
  )

  const agreeDraw = useCallback(() => {
    if (model.agreeDraw()) sync()
  }, [model, sync])

  const timeout = useCallback(
    (loser: Color) => {
      if (model.timeout(loser)) sync()
    },
    [model, sync],
  )

  const getLegalMoves = useCallback((square: Square): Move[] => model.getLegalMoves(square), [model])
  const getPgn = useCallback(() => model.getPgn(), [model])
  const getFen = useCallback(() => model.getFen(), [model])
  const positionAt = useCallback((ply: number) => model.positionAt(ply), [model])

  const { state } = snapshot

  return {
    ...state,
    gameNumber,
    canUndo: snapshot.canUndo,
    canRedo: snapshot.canRedo,
    started: state.history.length > 0,
    startFen: state.history[0]?.before ?? model.startingFen,
    moveCount: state.history.length,
    move,
    undo,
    redo,
    reset,
    load,
    resign,
    agreeDraw,
    timeout,
    finish,
    getLegalMoves,
    getPgn,
    getFen,
    positionAt,
  }
}

export type ChessGame = ReturnType<typeof useChessGame>
