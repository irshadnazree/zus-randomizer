import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import confetti from 'canvas-confetti'
import { Randomizer, type RandomizerProps } from '../src/randomizer'

vi.mock('canvas-confetti', () => ({ default: Object.assign(vi.fn(), { reset: vi.fn() }) }))

const props: RandomizerProps = {
  states: [
    { name: 'Kuala Lumpur', count: 1 },
    { name: 'Selangor', count: 2 },
  ],
  total: 3,
  hasCoordinates: true,
  selectedState: 'Kuala Lumpur',
}
const pick = {
  outlet: {
    name: 'ZUS Test Branch',
    address: '123 Test Street',
    city: 'Kuala Lumpur',
    state: 'Kuala Lumpur',
    lat: 3.1,
    lng: 101.7,
    publicTransport: { name: 'Test Station', type: 'rail', distanceKm: 0.12 },
  },
  distanceKm: 1.2,
  origin: 'Bangsar',
  reel: ['ZUS Test Branch'],
}

let root: Root
let container: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>
const errors: unknown[] = []
const element = <T extends Element = HTMLElement>(selector: string) => container.querySelector<T>(selector)!
const submit = () =>
  act(async () => {
    element('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
const click = (selector: string) =>
  act(async () => {
    element<HTMLInputElement>(selector).click()
  })
async function change(selector: string, value: string) {
  await act(async () => {
    const input = element<HTMLInputElement>(selector)
    const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}

beforeEach(async () => {
  vi.useFakeTimers()
  errors.length = 0
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  localStorage.setItem('zus-sound', 'off')
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  )
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(pick)))
  vi.stubGlobal('fetch', fetchMock)
  container = document.createElement('div')
  document.body.append(container)
  container.innerHTML = renderToString(<Randomizer {...props} />)
  await act(async () => {
    root = hydrateRoot(container, <Randomizer {...props} />, { onRecoverableError: (error) => errors.push(error) })
  })
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  expect(errors).toEqual([])
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('React randomizer', () => {
  it('hydrates server markup and persists the sound preference', async () => {
    expect(element<HTMLSelectElement>('#state').value).toBe('Kuala Lumpur')
    expect(element('#sound').textContent).toContain('Sound off')
    await click('#sound')
    expect(element('#sound').getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem('zus-sound')).toBe('on')
  })

  it('submits combined filters and renders a single-outlet result with directions', async () => {
    await click('#transit')
    await submit()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/random?state=Kuala+Lumpur&transit=true')
    expect(element('#picked-name').textContent).toBe(pick.outlet.name)
    expect(element('#picked-distance').textContent).toBe('1.2 km from Bangsar')
    expect(element('#picked-transit').textContent).toContain('Test Station · 120 m')
    expect(element<HTMLAnchorElement>('#link-gmaps').href).toContain('3.1%2C101.7')
    expect(element<HTMLAnchorElement>('#link-waze').href).toContain('ll=3.1,101.7')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180)
    })
    expect(element<HTMLButtonElement>('#spin').disabled).toBe(false)
  })

  it('requires a place and submits the selected radius', async () => {
    await click('input[value="place"]')
    expect(element<HTMLSelectElement>('#state').value).toBe('')
    expect(document.activeElement).toBe(element('#place'))
    await submit()
    expect(element('[role="alert"]').textContent).toContain('Type a place first')
    expect(fetchMock).not.toHaveBeenCalled()
    await change('#place', 'Bangsar')
    await change('#radius', '10')
    await submit()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/random?place=Bangsar&radius=10')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180)
    })
  })

  it('uses browser coordinates and ignores stale location status after switching modes', async () => {
    let located: PositionCallback | undefined
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          located = success
        }),
      },
    })
    await click('input[value="me"]')
    expect(element('[role="status"]').textContent).toBe('Getting your location…')
    await click('input[value="place"]')
    await act(async () => {
      located!({ coords: { latitude: 3.1, longitude: 101.7 } } as GeolocationPosition)
    })
    expect(container.querySelector('[role="status"]')).toBeNull()
    await click('input[value="me"]')
    await submit()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/random?lat=3.1&lng=101.7&radius=5')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180)
    })
  })

  it('shows API and network errors and permits retrying', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'No outlets match.' }), { status: 404 }))
    await submit()
    expect(element('[role="alert"]').textContent).toBe('No outlets match.')
    expect(element<HTMLButtonElement>('#spin').disabled).toBe(false)
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await submit()
    expect(element('[role="alert"]').textContent).toBe('Network error. Try again.')
    await submit()
    expect(element('#picked-name').textContent).toBe(pick.outlet.name)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180)
    })
  })

  it('animates a single-outlet reel without an invalid blur or duplicate request', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    await submit()
    expect(element('#reel').style.filter).toBe('blur(0px)')
    await submit()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(element('#picked-name').textContent).toBe(pick.outlet.name)
    expect(element<HTMLButtonElement>('#spin').disabled).toBe(false)
    expect(confetti).toHaveBeenCalled()
  })
})
