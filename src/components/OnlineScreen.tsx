import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Copy, Globe, Lock, LogIn, Pencil, Play, Plus, Users, X, Zap } from 'lucide-react'
import { getTimeControl } from '../game/constants'
import type { BoardThemeId } from '../game/constants'
import type { ImportedGame } from '../game/importGame'
import type { SoundName } from '../game/soundEngine'
import { copyText } from '../lib/clipboard'
import { cx } from '../lib/cx'
import { NICK_MAX, ONLINE_TIME_CONTROL_IDS, ROOM_CODE_LENGTH, normalizeRoomCode } from '../online/protocol'
import type { LobbyRoom, OnlineTimeControlId, RoomView, Visibility } from '../online/protocol'
import type { Online } from '../online/useOnline'
import { OnlineGame } from './OnlineGame'

interface OnlineScreenProps {
  online: Online
  /** Room code from an invite link, joined once connected. */
  inviteCode: string | null
  onInviteUsed: () => void
  boardTheme: BoardThemeId
  showCoordinates: boolean
  animations: boolean
  onSound: (name: SoundName) => void
  onToast: (message: string, tone?: 'default' | 'error') => void
  /** Opens the finished game in the regular review (coach, accuracy, graph). */
  onAnalyze: (record: ImportedGame, color: 'w' | 'b') => void
  onExit: () => void
}

const TEMPO_KEY = 'gambit.online-tempo'

function storedTempo(): OnlineTimeControlId {
  try {
    const value = window.localStorage.getItem(TEMPO_KEY)
    if (value && (ONLINE_TIME_CONTROL_IDS as readonly string[]).includes(value)) return value as OnlineTimeControlId
  } catch {
    // ignore
  }
  return '10+0'
}

export function inviteLink(code: string): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin)
  url.searchParams.set('room', code)
  return url.toString()
}

/** "Online": nickname, lobby with rooms, waiting room, and the game itself. */
export function OnlineScreen(props: OnlineScreenProps) {
  const { online, inviteCode, onInviteUsed, onToast } = props
  const { status, room, error, send } = online

  useEffect(() => {
    if (error) onToast(error.message, 'error')
  }, [error, onToast])

  // An invite link joins its room as soon as the server knows us.
  useEffect(() => {
    if (!inviteCode || status !== 'online') return
    if (!room || room.code !== inviteCode) send({ type: 'join', code: inviteCode })
    onInviteUsed()
  }, [inviteCode, onInviteUsed, room, send, status])

  if (!online.nick) return <NickCard online={online} title="Hrát online" onExit={props.onExit} />

  if (room && room.status !== 'waiting') return <OnlineGame {...props} room={room} />

  return (
    <main className="app-main app-main--home">
      {room ? <WaitingRoom online={online} room={room} onToast={onToast} /> : <Lobby online={online} />}
    </main>
  )
}

function ConnectionNote({ status }: { status: Online['status'] }) {
  if (status === 'online') return null
  return (
    <p className="online-connection" role="status">
      <span className="thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {status === 'offline' ? 'Spojení se přerušilo, zkouším to znovu…' : 'Připojuji se k serveru…'}
    </p>
  )
}

function NickCard({ online, title, onExit, onDone }: { online: Online; title: string; onExit?: () => void; onDone?: () => void }) {
  const [value, setValue] = useState(online.nick ?? '')
  const [invalid, setInvalid] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (online.setNick(value)) onDone?.()
    else setInvalid(true)
  }
  const form = (
    <form className="nick-form" onSubmit={submit}>
      <label className="field-label" htmlFor="online-nick">
        Přezdívka
      </label>
      <input
        id="online-nick"
        className={cx('text-field', invalid && 'is-invalid')}
        value={value}
        maxLength={NICK_MAX}
        autoComplete="nickname"
        placeholder="Např. Kuba"
        autoFocus
        onChange={(event) => {
          setValue(event.target.value)
          setInvalid(false)
        }}
      />
      <p className={cx('nick-hint', invalid && 'is-invalid')}>
        {invalid ? 'Přezdívka musí mít 2–20 znaků.' : 'Uvidí ji soupeř a ostatní v lobby. Účet není potřeba.'}
      </p>
      <div className="nick-actions">
        {onExit || onDone ? (
          <button type="button" className="button button--ghost" onClick={onDone ?? onExit}>
            {onDone ? 'Zrušit' : 'Zpět'}
          </button>
        ) : null}
        <button type="submit" className="button button--primary">
          {onDone ? 'Uložit' : 'Pokračovat'}
        </button>
      </div>
    </form>
  )
  if (onDone) return form
  return (
    <main className="app-main app-main--home">
      <section className="start-card online-card online-card--narrow" aria-labelledby="nick-title">
        <h1 id="nick-title" className="start-title">
          {title}
        </h1>
        <p className="start-summary">Jak ti máme říkat?</p>
        {form}
      </section>
    </main>
  )
}

function TempoPicker({ value, onChange }: { value: OnlineTimeControlId; onChange: (id: OnlineTimeControlId) => void }) {
  return (
    <div className="tempo-grid online-tempo" role="radiogroup" aria-label="Tempo">
      {ONLINE_TIME_CONTROL_IDS.map((id) => {
        const control = getTimeControl(id)
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className={cx('tempo-option', value === id && 'is-selected')}
            onClick={() => onChange(id)}
          >
            <span className="tempo-option-copy">
              <strong>{control.label}</strong>
              <span>{control.caption}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function useServerClock(serverNow: () => number, active: boolean, step = 1000) {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    if (!active) return
    setNow(serverNow())
    const timer = window.setInterval(() => setNow(serverNow()), step)
    return () => window.clearInterval(timer)
  }, [active, serverNow, step])
  return now
}

function waitedLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min`
}

function Lobby({ online }: { online: Online }) {
  const { status, lobby, send, nick, serverNow } = online
  const [tempo, setTempoState] = useState<OnlineTimeControlId>(storedTempo)
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [code, setCode] = useState('')
  const [editingNick, setEditingNick] = useState(false)
  const now = useServerClock(serverNow, lobby.length > 0)
  const connected = status === 'online'

  const setTempo = (id: OnlineTimeControlId) => {
    setTempoState(id)
    try {
      window.localStorage.setItem(TEMPO_KEY, id)
    } catch {
      // ignore
    }
  }

  const join = (event: FormEvent) => {
    event.preventDefault()
    const clean = normalizeRoomCode(code)
    if (clean.length === ROOM_CODE_LENGTH) send({ type: 'join', code: clean })
  }

  const waiting = lobby.filter((room) => room.status === 'waiting')
  const playing = lobby.filter((room) => room.status === 'playing')

  return (
    <section className="online-screen" aria-labelledby="online-title">
      <div className="start-card online-card">
        <header className="online-head">
          <h1 id="online-title" className="start-title">
            Hrát online
          </h1>
          <span className="online-count" title="Hráčů online">
            <span className={cx('presence-dot', connected && 'is-on')} aria-hidden="true" />
            {connected ? `${online.online} online` : 'offline'}
          </span>
        </header>

        {editingNick ? (
          <NickCard online={online} title="" onDone={() => setEditingNick(false)} />
        ) : (
          <p className="start-summary online-me">
            Hraješ jako <strong>{nick}</strong>
            <button type="button" className="text-action" onClick={() => setEditingNick(true)}>
              <Pencil size={13} />
              Změnit
            </button>
          </p>
        )}

        <ConnectionNote status={status} />

        <fieldset className="tempo-fieldset">
          <legend>Tempo</legend>
          <TempoPicker value={tempo} onChange={setTempo} />
        </fieldset>

        <div className="start-actions online-actions">
          <button
            type="button"
            className="button button--primary start-primary"
            disabled={!connected}
            onClick={() => send({ type: 'quick', timeControlId: tempo })}
          >
            <Zap size={18} />
            Rychlá hra
          </button>
          <p className="online-help">Spáruje tě s někým, kdo čeká na stejné tempo, nebo ti založí místnost.</p>

          <div className="online-create">
            <div
              className="mode-toggle"
              role="radiogroup"
              aria-label="Viditelnost místnosti"
              style={{ '--i': visibility === 'public' ? 0 : 1 } as CSSProperties}
            >
              <button
                type="button"
                role="radio"
                aria-checked={visibility === 'public'}
                className={cx('mode-toggle-btn', visibility === 'public' && 'is-selected')}
                onClick={() => setVisibility('public')}
              >
                <Globe size={15} />
                <span>Veřejná</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={visibility === 'private'}
                className={cx('mode-toggle-btn', visibility === 'private' && 'is-selected')}
                onClick={() => setVisibility('private')}
              >
                <Lock size={15} />
                <span>Soukromá</span>
              </button>
            </div>
            <button
              type="button"
              className="button button--ghost"
              disabled={!connected}
              onClick={() => send({ type: 'create', timeControlId: tempo, visibility })}
            >
              <Plus size={16} />
              Vytvořit místnost
            </button>
          </div>

          <form className="online-join" onSubmit={join}>
            <input
              className="text-field online-code-input"
              value={code}
              onChange={(event) => setCode(normalizeRoomCode(event.target.value).slice(0, ROOM_CODE_LENGTH))}
              placeholder="Kód místnosti"
              aria-label="Kód místnosti"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button
              type="submit"
              className="button button--ghost"
              disabled={!connected || normalizeRoomCode(code).length !== ROOM_CODE_LENGTH}
            >
              <LogIn size={16} />
              Připojit
            </button>
          </form>
        </div>
      </div>

      <div className="start-card online-card online-rooms" aria-labelledby="rooms-title">
        <h2 id="rooms-title" className="online-section-title">
          Místnosti
        </h2>
        {waiting.length === 0 ? (
          <p className="online-empty">
            Zatím nikdo nečeká. Založ místnost nebo dej Rychlou hru, a až někdo přijde, uvidí tě tady.
          </p>
        ) : (
          <ul className="settings-group room-list">
            {waiting.map((room) => (
              <RoomRow key={room.id} room={room} now={now} disabled={!connected} onJoin={() => send({ type: 'join', code: room.code })} />
            ))}
          </ul>
        )}
        {playing.length > 0 ? (
          <>
            <h3 className="field-label online-subtitle">Právě se hraje</h3>
            <ul className="settings-group room-list room-list--muted">
              {playing.map((room) => (
                <li key={room.id} className="room-row">
                  <Users size={16} className="room-icon" aria-hidden="true" />
                  <span className="room-main">
                    <strong>{room.players.join(' – ')}</strong>
                    <span>{getTimeControl(room.timeControlId).label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  )
}

function RoomRow({ room, now, disabled, onJoin }: { room: LobbyRoom; now: number; disabled: boolean; onJoin: () => void }) {
  const control = getTimeControl(room.timeControlId)
  return (
    <li className="room-row">
      <span className="room-avatar" aria-hidden="true">
        {room.hostNick.slice(0, 1).toUpperCase()}
      </span>
      <span className="room-main">
        <strong>{room.hostNick}</strong>
        <span>
          {control.caption} · {control.label} · čeká {waitedLabel(now - room.createdAt)}
        </span>
      </span>
      <button type="button" className="button button--primary room-join" disabled={disabled} onClick={onJoin}>
        Hrát
      </button>
    </li>
  )
}

function WaitingRoom({ online, room, onToast }: { online: Online; room: RoomView; onToast: OnlineScreenProps['onToast'] }) {
  const { playerId, send, status } = online
  const isHost = room.hostId === playerId
  const control = getTimeControl(room.timeControlId)
  const opponent = room.players.find((player) => player.id !== playerId) ?? null
  const searching = !opponent
  const isQuick = room.quick

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text)
    onToast(ok ? `${label} zkopírován` : 'Kopírování se nepovedlo', ok ? 'default' : 'error')
  }

  return (
    <section className="start-card online-card online-card--narrow" aria-labelledby="room-title">
      <header className="online-head">
        <h1 id="room-title" className="start-title">
          {searching ? 'Čeká se na soupeře' : 'Soupeř je tady'}
        </h1>
        <span className="online-badge">
          {room.visibility === 'private' ? <Lock size={13} /> : <Globe size={13} />}
          {control.label}
        </span>
      </header>
      <p className="start-summary">
        {searching
          ? isQuick
            ? 'Jakmile někdo dá Rychlou hru se stejným tempem nebo klikne na tvou místnost, hra začne.'
            : 'Pošli kamarádovi odkaz nebo kód. Barvy se rozhodnou náhodně při startu.'
          : isHost
            ? 'Spusť hru, až budete oba připravení. Barvy se rozhodnou náhodně.'
            : 'Čeká se, až zakladatel místnosti spustí hru.'}
      </p>

      <ConnectionNote status={status} />

      <ul className="settings-group room-list">
        {room.players.map((player) => (
          <li key={player.id} className="room-row">
            <span className="room-avatar" aria-hidden="true">
              {player.nick.slice(0, 1).toUpperCase()}
            </span>
            <span className="room-main">
              <strong>
                {player.nick}
                {player.id === playerId ? ' (ty)' : ''}
              </strong>
              <span>{player.id === room.hostId ? 'Zakladatel' : 'Soupeř'}</span>
            </span>
            <span className={cx('presence-dot', player.connected && 'is-on')} title={player.connected ? 'Připojen' : 'Odpojen'} />
          </li>
        ))}
        {searching ? (
          <li className="room-row room-row--empty">
            <span className="room-avatar room-avatar--empty" aria-hidden="true" />
            <span className="room-main">
              <strong className="thinking-dots" aria-label="Čeká se">
                <span />
                <span />
                <span />
              </strong>
              <span>Volné místo</span>
            </span>
          </li>
        ) : null}
      </ul>

      <div className="room-share">
        <span className="room-code" aria-label={`Kód místnosti ${room.code}`}>
          {room.code}
        </span>
        <button type="button" className="text-action" onClick={() => void copy(room.code, 'Kód')}>
          <Copy size={14} />
          Kód
        </button>
        <button type="button" className="text-action" onClick={() => void copy(inviteLink(room.code), 'Odkaz')}>
          <Copy size={14} />
          Odkaz
        </button>
      </div>

      <div className="start-actions">
        {isHost && !searching ? (
          <button type="button" className="button button--primary start-primary" onClick={() => send({ type: 'start' })} autoFocus>
            <Play size={18} />
            Start
          </button>
        ) : null}
        <button type="button" className="button button--ghost" onClick={() => send({ type: 'leave' })}>
          <X size={16} />
          {searching ? 'Zrušit' : 'Opustit místnost'}
        </button>
      </div>
    </section>
  )
}
