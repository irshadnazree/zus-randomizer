import { useEffect, useRef, useState, type FormEvent } from 'react'
import confetti from 'canvas-confetti'
import { directions } from './directions'
import type { Outlet, PublicTransport } from './outlets'
import { Footer } from './seo'
import { useSound } from './use-sound'

export type RandomizerProps = {
  states: { name: string; count: number }[]
  total: number
  hasCoordinates: boolean
  selectedState?: string
}

type NearMode = 'off' | 'me' | 'place'
type PickResult = { outlet: Outlet; distanceKm: number | null; origin: string | null; reel: string[] }
class UserError extends Error {}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const locationError = "Couldn't get your location. Check browser permissions, or type a place instead."

function locate() {
  return new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000 }),
  )
}

function transitLabel(stop: PublicTransport) {
  const kind = stop.type === 'rail' ? 'Train station' : 'Bus stop'
  return `${stop.name === kind ? kind : `${kind}: ${stop.name}`} · ${Math.round(stop.distanceKm * 1000)} m away (straight line)`
}

export function Randomizer({ states, total, hasCoordinates, selectedState }: RandomizerProps) {
  const [state, setState] = useState(selectedState ?? '')
  const [near, setNear] = useState<NearMode>('off')
  const [place, setPlace] = useState('')
  const [radius, setRadius] = useState('5')
  const [transit, setTransit] = useState(false)
  const [nearStatus, setNearStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState('')
  const [reel, setReel] = useState<{ name: string; blur: number } | null>(null)
  const [result, setResult] = useState<PickResult | null>(null)
  const [resultId, setResultId] = useState(0)
  const position = useRef<GeolocationPosition | null>(null)
  const pendingLocation = useRef<Promise<GeolocationPosition> | null>(null)
  const placeInput = useRef<HTMLInputElement>(null)
  const active = useRef(true)
  const spinning = useRef(false)
  const request = useRef<AbortController | null>(null)
  const { soundOn, toggleSound, unlockAudio, playTick, playWin } = useSound()

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      request.current?.abort()
      confetti.reset()
    }
  }, [])

  async function getPosition() {
    if (position.current) return position.current
    pendingLocation.current ??= locate()
      .then((value) => (position.current = value))
      .finally(() => {
        pendingLocation.current = null
      })
    return pendingLocation.current
  }

  useEffect(() => {
    let cancelled = false
    setNearStatus('')
    if (near !== 'off') setState('')
    if (near === 'place') placeInput.current?.focus()
    if (near === 'me') {
      setNearStatus(position.current ? 'Using your current location.' : 'Getting your location…')
      void getPosition().then(
        () => {
          if (!cancelled) setNearStatus('Using your current location.')
        },
        () => {
          if (!cancelled) setNearStatus(locationError)
        },
      )
    }
    return () => {
      cancelled = true
    }
  }, [near])

  async function buildParams() {
    const params = new URLSearchParams()
    if (state) params.set('state', state)
    if (transit) params.set('transit', 'true')
    if (near === 'off') return params
    if (near === 'place') {
      if (!place.trim()) throw new UserError('Type a place first, like "Bangsar" or "Sunway Pyramid".')
      params.set('place', place.trim())
    } else {
      let current: GeolocationPosition
      try {
        current = await getPosition()
      } catch {
        throw new UserError(locationError)
      }
      params.set('lat', String(current.coords.latitude))
      params.set('lng', String(current.coords.longitude))
    }
    params.set('radius', radius)
    return params
  }

  async function spin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (spinning.current) return
    spinning.current = true
    setBusy(true)
    unlockAudio()
    try {
      const params = await buildParams()
      if (!active.current) return
      request.current = new AbortController()
      const response = await fetch(`/api/random?${params}`, { signal: request.current.signal })
      const data = (await response.json()) as PickResult & { error?: string }
      if (!response.ok) throw new UserError(data.error ?? 'Something went wrong.')
      if (!active.current) return
      setError('')
      setResult(null)
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const last = data.reel.length - 1
        for (let i = 0; i <= last; i++) {
          if (!active.current) return
          const progress = last === 0 ? 1 : i / last
          setReel({ name: data.reel[i], blur: 6 * (1 - progress) ** 1.5 })
          playTick()
          await sleep(45 + i * i * 1.6)
        }
        await sleep(250)
      }
      if (!active.current) return
      setReel(null)
      setResult(data)
      setResultId((id) => id + 1)
      playWin()
      const base = { colors: ['#ffffff', '#adc3ea', '#2a5bb8', '#f5c542'], disableForReducedMotion: true, zIndex: 50 }
      void confetti({ ...base, particleCount: 120, spread: 80, startVelocity: 45, origin: { y: 0.35 } })
      await sleep(180)
      if (active.current) {
        void confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } })
        void confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } })
      }
    } catch (cause) {
      if (active.current) {
        setReel(null)
        setError(cause instanceof UserError ? cause.message : 'Network error. Try again.')
      }
    } finally {
      spinning.current = false
      if (active.current) {
        setBusy(false)
        setAttempted(true)
      }
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 sm:py-14">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zus-200">ZUS Roulette</p>
          <button
            id="sound"
            type="button"
            aria-pressed={soundOn}
            onClick={toggleSound}
            className="rounded-full px-3 py-1 text-xs font-medium text-zus-200 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
          >
            Sound {soundOn ? 'on' : 'off'}
          </button>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Pick a random ZUS Coffee</h1>
        <p className="mt-2 text-zus-200">
          Which ZUS today? Spin to choose from <span className="font-semibold text-white">{total}</span> listed outlets across Malaysia.
        </p>
      </header>

      <main id="main" className="flex flex-1 flex-col gap-5">
        <section
          id="result"
          aria-busy={busy}
          aria-live="polite"
          className="relative flex min-h-64 flex-col justify-center overflow-hidden rounded-3xl bg-white p-6 text-zus-950 shadow-2xl shadow-black/40"
        >
          <div id="placeholder" className={result || error || reel ? 'hidden' : 'text-center'}>
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-zus-50 text-2xl">☕</div>
            <p className="font-medium text-zus-800">Press spin and let fate decide.</p>
            <p className="mt-1 text-sm text-zus-500">Filter by state, your location, or any place.</p>
          </div>

          <p
            id="reel"
            aria-hidden="true"
            className={`${reel ? '' : 'hidden'} text-center text-2xl font-bold text-zus-700 select-none sm:text-3xl`}
            style={{ filter: reel ? `blur(${reel.blur}px)` : undefined }}
          >
            {reel?.name}
          </p>

          {result && !reel && !error && (
            <div id="picked" key={resultId} className="animate-pop">
              <p className="text-xs font-semibold uppercase tracking-widest text-zus-500">Your ZUS is</p>
              <h2 id="picked-name" className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">
                {result.outlet.name}
              </h2>
              <p id="picked-address" className="mt-3 text-sm leading-relaxed text-zus-800">
                {result.outlet.address}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                <span id="picked-state" className="rounded-full bg-zus-50 px-3 py-1 text-zus-700">
                  {result.outlet.city && result.outlet.city !== result.outlet.state
                    ? `${result.outlet.city}, ${result.outlet.state}`
                    : result.outlet.state}
                </span>
                {result.distanceKm != null && (
                  <span id="picked-distance" className="rounded-full bg-zus-50 px-3 py-1 text-zus-700">
                    {result.distanceKm.toFixed(1)} km {result.origin ? `from ${result.origin}` : 'away'}
                  </span>
                )}
              </div>
              {result.outlet.publicTransport && (
                <p id="picked-transit" className="mt-3 text-sm text-zus-700">
                  {transitLabel(result.outlet.publicTransport)}
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <a
                  id="link-gmaps"
                  href={directions(result.outlet).maps}
                  target="_blank"
                  rel="noopener"
                  className="rounded-xl bg-zus-800 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-zus-700"
                >
                  Google Maps
                </a>
                <a
                  id="link-waze"
                  href={directions(result.outlet).waze}
                  target="_blank"
                  rel="noopener"
                  className="rounded-xl border border-zus-200 px-4 py-3 text-center text-sm font-semibold text-zus-800 transition hover:bg-zus-50"
                >
                  Waze
                </a>
              </div>
            </div>
          )}

          {error && (
            <p id="error" role="alert" className="text-center font-medium text-red-600">
              {error}
            </p>
          )}
        </section>

        <form onSubmit={spin} id="controls" className="grid gap-3 rounded-3xl bg-zus-900 p-5 ring-1 ring-white/10">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-zus-100">State</span>
            <select
              value={state}
              onChange={(event) => setState(event.target.value)}
              id="state"
              name="state"
              className="w-full rounded-xl border-0 bg-zus-800 px-3 py-2.5 text-white ring-1 ring-white/10 focus:ring-2 focus:ring-zus-200 focus:outline-none"
            >
              <option value="">Anywhere in Malaysia</option>
              {states.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.count})
                </option>
              ))}
            </select>
          </label>

          {hasCoordinates && (
            <fieldset className="grid gap-1.5 text-sm">
              <legend className="mb-1.5 font-medium text-zus-100">Near</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-zus-800 p-1 ring-1 ring-white/10">
                {[
                  ['off', 'Anywhere'],
                  ['me', 'My location'],
                  ['place', 'A place'],
                ].map(([value, label]) => (
                  <label key={value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="near"
                      value={value}
                      checked={near === value}
                      onChange={() => setNear(value as NearMode)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-lg px-2 py-2 text-center font-medium text-zus-200 transition peer-checked:bg-white peer-checked:text-zus-900 peer-focus-visible:ring-2 peer-focus-visible:ring-zus-200">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              <input
                ref={placeInput}
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                id="place"
                name="place"
                type="text"
                aria-label="Town, mall, or landmark in Malaysia"
                placeholder="e.g. Bangsar, Sunway Pyramid, Ipoh"
                autoComplete="off"
                enterKeyHint="go"
                className={`${near === 'place' ? '' : 'hidden'} w-full rounded-xl border-0 bg-zus-800 px-3 py-2.5 text-white ring-1 ring-white/10 placeholder:text-zus-200/50 focus:ring-2 focus:ring-zus-200 focus:outline-none`}
              />
              {nearStatus && (
                <p id="near-status" role="status" className="text-xs text-zus-200">
                  {nearStatus}
                </p>
              )}
              <select
                value={radius}
                onChange={(event) => setRadius(event.target.value)}
                id="radius"
                name="radius"
                disabled={near === 'off'}
                aria-label="Distance"
                className="w-full rounded-xl border-0 bg-zus-800 px-3 py-2.5 text-white ring-1 ring-white/10 focus:ring-2 focus:ring-zus-200 focus:outline-none disabled:opacity-40"
              >
                <option value="2">Within 2 km</option>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="25">Within 25 km</option>
              </select>
            </fieldset>
          )}

          <div className="grid gap-1.5 text-sm">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-zus-800 px-3 py-3 ring-1 ring-white/10">
              <input
                checked={transit}
                onChange={(event) => setTransit(event.target.checked)}
                id="transit"
                name="transit"
                type="checkbox"
                aria-describedby="transit-help"
                className="size-4 shrink-0 accent-zus-200"
              />
              <span className="font-medium text-zus-100">Near public transport</span>
            </label>
            <p id="transit-help" className="text-xs leading-relaxed text-zus-200">
              Within 500 m of a train station or bus stop. Straight-line distance; walking routes may be longer.{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline hover:text-white">
                © OpenStreetMap contributors
              </a>
              .
            </p>
          </div>

          <button
            disabled={busy}
            id="spin"
            type="submit"
            className="mt-2 rounded-2xl bg-white px-6 py-4 text-lg font-bold text-zus-900 shadow-lg transition hover:bg-zus-50 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? 'Spinning…' : attempted ? 'Spin again' : 'Spin'}
          </button>
        </form>
        <noscript>
          <p className="rounded-xl bg-zus-900 p-4 text-sm text-zus-100">
            Enable JavaScript to spin the randomizer, or{' '}
            <a href="/outlets" className="underline">
              browse ZUS Coffee outlet addresses and directions
            </a>
            .
          </p>
        </noscript>
      </main>
      <Footer />
    </div>
  )
}
