import { useCallback, useEffect, useMemo, useRef } from 'react'
import { soundEngine } from '../game/soundEngine'
import type { SoundName } from '../game/soundEngine'
import { isBoolean, isFiniteInRange, useStoredState } from '../lib/storage'

const isVolume = isFiniteInRange(0, 1)

export function useSound() {
  const [enabled, setEnabled] = useStoredState('gambit.sound.enabled', true, isBoolean)
  const [volume, setVolume] = useStoredState('gambit.sound.volume', 0.62, isVolume)
  /** Last applied value; a confirmation sound only plays on a real change (not on StrictMode re-mount). */
  const appliedEnabled = useRef(enabled)

  useEffect(() => {
    soundEngine.setVolume(volume)
  }, [volume])

  useEffect(() => {
    soundEngine.setEnabled(enabled)
    if (appliedEnabled.current === enabled) return
    appliedEnabled.current = enabled
    if (enabled) soundEngine.play('ui')
  }, [enabled])

  const play = useCallback((name: SoundName) => {
    soundEngine.play(name)
  }, [])

  const unlock = useCallback(() => {
    soundEngine.unlock()
  }, [])

  const toggle = useCallback(() => {
    setEnabled((value) => !value)
  }, [setEnabled])

  const changeVolume = useCallback(
    (next: number) => {
      if (Number.isFinite(next)) setVolume(Math.max(0, Math.min(1, next)))
    },
    [setVolume],
  )

  return useMemo(
    () => ({ play, unlock, enabled, toggle, volume, setVolume: changeVolume }),
    [play, unlock, enabled, toggle, volume, changeVolume],
  )
}
