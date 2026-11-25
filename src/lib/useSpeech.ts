import { useCallback, useEffect, useState } from 'react'

const synthesis = () => (typeof window === 'undefined' ? undefined : window.speechSynthesis)

/**
 * The browser's Czech voice, if there is one. Local voices are preferred, so
 * the coach keeps working offline.
 */
export function useSpeech(lang = 'cs') {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    const synth = synthesis()
    if (!synth) return
    const pick = () => {
      const matching = synth.getVoices().filter((item) => item.lang.toLowerCase().startsWith(lang))
      setVoice(matching.find((item) => item.localService) ?? matching[0] ?? null)
    }
    pick()
    // Voices often arrive after the page has loaded.
    synth.addEventListener('voiceschanged', pick)
    return () => synth.removeEventListener('voiceschanged', pick)
  }, [lang])

  const cancel = useCallback(() => synthesis()?.cancel(), [])

  const speak = useCallback(
    (text: string) => {
      const synth = synthesis()
      if (!synth || !voice) return
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = voice.lang
      synth.speak(utterance)
    },
    [voice],
  )

  return { available: voice !== null, speak, cancel }
}
