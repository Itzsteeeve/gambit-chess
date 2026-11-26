import { useState } from 'react'
import { Import } from 'lucide-react'
import { parseImport } from '../game/importGame'
import type { ImportResult } from '../game/importGame'
import { Modal } from './Modal'
import type { ModalCloseFn } from './Modal'

export type ImportedContent = Exclude<ImportResult, { kind: 'error' }>

interface ImportDialogProps {
  /** A game is under way and would be replaced. */
  hasProgress: boolean
  onImport: (content: ImportedContent) => void
  onClose: () => void
}

export function ImportDialog({ hasProgress, onImport, onClose }: ImportDialogProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  /** `close` animates the dialog out first; without it the import is immediate. */
  const submit = (close?: ModalCloseFn) => {
    const result = parseImport(text)
    if (result.kind === 'error') {
      setError(result.message)
      return
    }
    if (close) close(() => onImport(result))
    else onImport(result)
  }

  return (
    <Modal
      title="Importovat partii"
      description="Vlož zápis partie v PGN (třeba z Lichess nebo Chess.com) a trenér ji rozebere. Z pozice ve FEN můžeš hrát dál."
      icon={<Import size={20} />}
      onClose={onClose}
      size="md"
      footer={(close) => (
        <>
          <button type="button" className="button button--ghost" onClick={() => close()}>
            Zrušit
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={!text.trim()}
            onClick={() => submit(close)}
          >
            Importovat
          </button>
        </>
      )}
    >
      <div className="import-field">
        <label htmlFor="import-text" className="field-label">
          PGN nebo FEN
        </label>
        <textarea
          id="import-text"
          className="import-text"
          value={text}
          rows={9}
          spellCheck={false}
          autoComplete="off"
          placeholder={'1. e4 e5 2. Nf3 Nc6 …\n\nnebo\n\nr1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'import-error' : undefined}
          data-autofocus
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
            event.preventDefault()
            submit()
          }}
        />
        {error ? (
          <p id="import-error" className="import-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {hasProgress ? <p className="dialog-warning">Rozehraná partie bude nahrazena. Tuto akci nelze vrátit.</p> : null}
    </Modal>
  )
}
