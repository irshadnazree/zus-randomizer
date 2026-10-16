import { useEffect, useRef, useState } from 'react'

export function useSound() {
  const [soundOn, setSoundOn] = useState(true)
  const enabled = useRef(true)
  const audio = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      enabled.current = localStorage.getItem('zus-sound') !== 'off'
      setSoundOn(enabled.current)
    } catch {
      /* Sound also works when browser storage is unavailable. */
    }
    return () => {
      void audio.current?.close()
    }
  }, [])

  function toggleSound() {
    enabled.current = !enabled.current
    setSoundOn(enabled.current)
    try {
      localStorage.setItem('zus-sound', enabled.current ? 'on' : 'off')
    } catch {
      /* Optional preference. */
    }
  }

  function unlockAudio() {
    if (!enabled.current) return
    try {
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Audio) return
      audio.current ??= new Audio()
      if (audio.current.state === 'suspended') void audio.current.resume().catch(() => {})
    } catch {
      /* Audio support must not prevent a spin. */
    }
  }

  function tone(frequency: number, start: number, duration: number, type: OscillatorType, gain: number) {
    const context = audio.current
    if (!context) return
    const osc = context.createOscillator()
    const amp = context.createGain()
    osc.type = type
    osc.frequency.value = frequency
    amp.gain.setValueAtTime(gain, start)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(amp).connect(context.destination)
    osc.start(start)
    osc.stop(start + duration)
  }

  function playTick() {
    if (enabled.current && audio.current) tone(1400, audio.current.currentTime, 0.03, 'square', 0.04)
  }

  function playWin() {
    if (!enabled.current || !audio.current) return
    const time = audio.current.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((note, i) => tone(note, time + i * 0.09, 0.25, 'triangle', 0.16))
    notes.forEach((note) => tone(note, time + 0.38, 0.9, 'sine', 0.07))
  }

  return { soundOn, toggleSound, unlockAudio, playTick, playWin }
}
