const $ = (id) => document.getElementById(id)
const show = (el, visible) => el.classList.toggle('hidden', !visible)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** An error whose message is safe and useful to show as-is. */
class UserError extends Error {}

const form = $('controls')
const radius = $('radius')
const place = $('place')
const nearStatus = $('near-status')
let position = null

// ---------- near: anywhere / my location / a place ----------

const nearMode = () => form.querySelector('input[name="near"]:checked')?.value ?? 'off'

function setNearStatus(message) {
  nearStatus.textContent = message ?? ''
  show(nearStatus, Boolean(message))
}

function locate() {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000 }),
  )
}

form.querySelectorAll('input[name="near"]').forEach((radio) =>
  radio.addEventListener('change', async () => {
    const mode = nearMode()
    radius.disabled = mode === 'off'
    // Distance already narrows the area, and a state filter could rule out every nearby outlet.
    if (mode !== 'off') $('state').value = ''
    show(place, mode === 'place')
    setNearStatus(null)
    if (mode === 'place') place.focus()
    if (mode !== 'me') return
    if (position) return setNearStatus('Using your current location.')
    setNearStatus('Getting your location…')
    try {
      position = await locate()
      if (nearMode() === 'me') setNearStatus('Using your current location.')
    } catch {
      if (nearMode() === 'me') setNearStatus("Couldn't get your location. Check browser permissions, or type a place instead.")
    }
  }),
)

// ---------- sound ----------

const soundButton = $('sound')
let soundOn = localStorage.getItem('zus-sound') !== 'off'
let audio = null

function renderSoundButton() {
  soundButton.textContent = soundOn ? 'Sound on' : 'Sound off'
  soundButton.setAttribute('aria-pressed', String(soundOn))
}
renderSoundButton()

soundButton.addEventListener('click', () => {
  soundOn = !soundOn
  localStorage.setItem('zus-sound', soundOn ? 'on' : 'off')
  renderSoundButton()
})

// The AudioContext has to be created inside a user gesture, so this runs on Spin.
function unlockAudio() {
  if (!soundOn) return
  audio ??= new (window.AudioContext || window.webkitAudioContext)()
  if (audio.state === 'suspended') audio.resume()
}

function tone(freq, start, duration, { type = 'sine', gain = 0.2 } = {}) {
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  amp.gain.setValueAtTime(gain, start)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp).connect(audio.destination)
  osc.start(start)
  osc.stop(start + duration)
}

function playTick() {
  if (!soundOn || !audio) return
  tone(1400, audio.currentTime, 0.03, { type: 'square', gain: 0.04 })
}

function playWin() {
  if (!soundOn || !audio) return
  const t = audio.currentTime
  // C5 E5 G5 C6, then a held major chord.
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.09, 0.25, { type: 'triangle', gain: 0.16 }))
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, t + 0.38, 0.9, { type: 'sine', gain: 0.07 }))
}

// ---------- confetti ----------

function celebrate() {
  if (typeof window.confetti !== 'function') return
  const colors = ['#ffffff', '#adc3ea', '#2a5bb8', '#f5c542']
  const base = { colors, disableForReducedMotion: true, zIndex: 50 }
  window.confetti({ ...base, particleCount: 120, spread: 80, startVelocity: 45, origin: { y: 0.35 } })
  setTimeout(() => {
    window.confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } })
    window.confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } })
  }, 180)
}

// ---------- spin ----------

function showError(message) {
  show($('placeholder'), false)
  show($('reel'), false)
  show($('picked'), false)
  $('error').textContent = message
  show($('error'), true)
}

async function spinReel(names) {
  const reel = $('reel')
  show($('placeholder'), false)
  show($('picked'), false)
  show($('error'), false)
  show(reel, true)
  const last = names.length - 1
  for (let i = 0; i <= last; i++) {
    reel.textContent = names[i]
    // Names are blurred while the reel is fast and sharpen as it slows, landing crisp on the pick.
    reel.style.filter = `blur(${(6 * (1 - i / last) ** 1.5).toFixed(2)}px)`
    playTick()
    // Ease out: each name lingers a little longer than the last.
    await sleep(45 + i * i * 1.6)
  }
  await sleep(250)
  reel.style.filter = ''
  show(reel, false)
}

function render({ outlet, distanceKm, origin }) {
  $('picked-name').textContent = outlet.name
  $('picked-address').textContent = outlet.address
  $('picked-state').textContent = outlet.city && outlet.city !== outlet.state ? `${outlet.city}, ${outlet.state}` : outlet.state
  const distance = $('picked-distance')
  show(distance, distanceKm != null)
  if (distanceKm != null) {
    distance.textContent = origin ? `${distanceKm.toFixed(1)} km from ${origin}` : `${distanceKm.toFixed(1)} km away`
  }

  const hasCoords = outlet.lat != null && outlet.lng != null
  const query = hasCoords ? `${outlet.lat},${outlet.lng}` : `${outlet.name}, ${outlet.address}`
  $('link-gmaps').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
  $('link-waze').href = hasCoords
    ? `https://waze.com/ul?ll=${outlet.lat},${outlet.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(`${outlet.name} ${outlet.address}`)}&navigate=yes`

  const picked = $('picked')
  show(picked, true)
  picked.classList.remove('animate-pop')
  void picked.offsetWidth
  picked.classList.add('animate-pop')
}

async function buildParams() {
  const params = new URLSearchParams()
  const state = $('state').value
  if (state) params.set('state', state)
  const mode = nearMode()
  if (mode === 'off') return params

  if (mode === 'place') {
    const text = place.value.trim()
    if (!text) throw new UserError('Type a place first, like "Bangsar" or "Sunway Pyramid".')
    params.set('place', text)
  } else {
    if (!position) {
      try {
        position = await locate()
      } catch {
        throw new UserError("Couldn't get your location. Check browser permissions, or type a place instead.")
      }
    }
    params.set('lat', position.coords.latitude)
    params.set('lng', position.coords.longitude)
  }
  params.set('radius', radius.value)
  return params
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  unlockAudio()
  const spin = $('spin')
  spin.disabled = true
  spin.textContent = 'Spinning…'
  try {
    const params = await buildParams()
    const res = await fetch(`/api/random?${params}`)
    const data = await res.json()
    if (!res.ok) return showError(data.error ?? 'Something went wrong.')
    await spinReel(data.reel)
    render(data)
    playWin()
    celebrate()
  } catch (error) {
    showError(error instanceof UserError ? error.message : 'Network error. Try again.')
  } finally {
    spin.disabled = false
    spin.textContent = 'Spin again'
  }
})
