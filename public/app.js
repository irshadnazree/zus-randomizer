const $ = (id) => document.getElementById(id)
const show = (el, visible) => el.classList.toggle('hidden', !visible)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const form = $('controls')
const near = $('near')
const radius = $('radius')
let position = null

near?.addEventListener('change', async () => {
  radius.disabled = !near.checked
  if (!near.checked || position) return
  try {
    position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000 }),
    )
  } catch {
    near.checked = false
    radius.disabled = true
    showError('Could not get your location. Check your browser permissions.')
  }
})

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
  for (let i = 0; i < names.length; i++) {
    reel.textContent = names[i]
    // Ease out: each name lingers a little longer than the last.
    await sleep(45 + i * i * 1.6)
  }
  show(reel, false)
}

function render({ outlet, distanceKm }) {
  $('picked-name').textContent = outlet.name
  $('picked-address').textContent = outlet.address
  $('picked-state').textContent = outlet.city ? `${outlet.city}, ${outlet.state}` : outlet.state
  const distance = $('picked-distance')
  show(distance, distanceKm != null)
  if (distanceKm != null) distance.textContent = `${distanceKm.toFixed(1)} km away`

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

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const spin = $('spin')
  spin.disabled = true
  spin.textContent = 'Spinning…'
  try {
    const params = new URLSearchParams()
    const state = $('state').value
    if (state) params.set('state', state)
    if (near?.checked && position) {
      params.set('lat', position.coords.latitude)
      params.set('lng', position.coords.longitude)
      params.set('radius', radius.value)
    }
    const res = await fetch(`/api/random?${params}`)
    const data = await res.json()
    if (!res.ok) return showError(data.error ?? 'Something went wrong.')
    await spinReel(data.reel)
    render(data)
  } catch {
    showError('Network error. Try again.')
  } finally {
    spin.disabled = false
    spin.textContent = 'Spin again'
  }
})
