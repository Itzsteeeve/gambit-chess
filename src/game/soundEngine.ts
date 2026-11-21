export type SoundName =
  | 'select'
  | 'move'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'end-win'
  | 'end-draw'
  | 'illegal'
  | 'ui'

class SoundEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private enabled = true
  private volume = 0.62

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (this.master && this.context) {
      const now = this.context.currentTime
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setTargetAtTime(enabled ? this.volume : 0, now, 0.03)
    }
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume))
    if (this.master && this.context && this.enabled) {
      this.master.gain.setTargetAtTime(this.volume * 0.5, this.context.currentTime, 0.03)
    }
  }

  unlock() {
    if (!this.enabled) return
    this.ensure()
  }

  play(name: SoundName) {
    if (!this.enabled) return
    if (name === 'select' || name === 'ui' || name === 'illegal') {
      // These are intentionally tiny; avoid creating an audio graph just for a UI tick.
      if (!this.context) return
    }
    const ctx = this.ensure()
    if (!ctx) return

    switch (name) {
      case 'select':
        this.tone(880, 0.028, { gain: 0.018, type: 'sine', endFreq: 1040 })
        break
      case 'ui':
        this.tone(520, 0.035, { gain: 0.012, type: 'sine', endFreq: 470 })
        break
      case 'illegal':
        this.tone(105, 0.09, { gain: 0.035, type: 'sine', endFreq: 78 })
        break
      case 'move':
        this.woodTap(0, 0.1, 0.075)
        break
      case 'capture':
        this.woodTap(0, 0.085, 0.11)
        this.noiseBurst(0.055, 0.045, 760, 0.7)
        this.tone(92, 0.17, { gain: 0.09, type: 'sine', endFreq: 62 })
        break
      case 'castle':
        this.woodTap(0, 0.08, 0.065)
        this.woodTap(0.085, 0.11, 0.07)
        break
      case 'check':
        this.tone(1046.5, 0.34, { gain: 0.028, type: 'sine', attack: 0.012 })
        this.tone(1318.5, 0.42, { gain: 0.022, type: 'sine', delay: 0.085, attack: 0.012 })
        break
      case 'promote':
        ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          this.tone(frequency, 0.28, {
            gain: 0.025,
            type: 'triangle',
            delay: index * 0.06,
            attack: 0.01,
          })
        })
        break
      case 'end-win':
        ;[261.63, 329.63, 392, 523.25].forEach((frequency, index) => {
          this.tone(frequency, 1.15, {
            gain: 0.022,
            type: 'sine',
            delay: index * 0.07,
            attack: 0.06,
          })
        })
        this.tone(783.99, 1.4, { gain: 0.009, type: 'sine', delay: 0.28, attack: 0.1 })
        break
      case 'end-draw':
        ;[392, 329.63].forEach((frequency, index) => {
          this.tone(frequency, 0.8, {
            gain: 0.024,
            type: 'sine',
            delay: index * 0.11,
            attack: 0.05,
          })
        })
        break
    }
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.context) {
      const AudioContextClass = window.AudioContext
      if (!AudioContextClass) return null
      this.context = new AudioContextClass()
      this.master = this.context.createGain()
      this.master.gain.value = this.enabled ? this.volume * 0.5 : 0
      this.master.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') {
      void this.context.resume()
    }
    return this.context
  }

  private woodTap(delay: number, gain: number, pitch: number) {
    this.tone(pitch * 2100, 0.045, {
      gain: gain * 0.5,
      type: 'triangle',
      endFreq: pitch * 1400,
      delay,
      attack: 0.002,
    })
    this.noiseBurst(0.035, gain * 0.48, pitch * 8800, 1.1, delay)
    this.tone(150, 0.1, {
      gain: gain * 0.55,
      type: 'sine',
      endFreq: 95,
      delay,
      attack: 0.002,
    })
  }

  private tone(
    frequency: number,
    duration: number,
    options: {
      gain: number
      type?: OscillatorType
      endFreq?: number
      delay?: number
      attack?: number
    },
  ) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const start = ctx.currentTime + (options.delay ?? 0)
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const attack = options.attack ?? 0.004

    oscillator.type = options.type ?? 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    if (options.endFreq) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFreq), start + duration)
    }

    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain), start + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    oscillator.connect(gain)
    gain.connect(this.master)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  private noiseBurst(
    duration: number,
    gainValue: number,
    filterFrequency: number,
    q: number,
    delay = 0,
  ) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const start = ctx.currentTime + delay
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frames)
    }

    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.buffer = buffer
    filter.type = 'bandpass'
    filter.frequency.value = filterFrequency
    filter.Q.value = q
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(start)
    source.stop(start + duration + 0.01)
  }
}

export const soundEngine = new SoundEngine()
