import {
  type Basket,
  type Claim,
  isActive,
  request,
  type Thanks,
} from '@/scripts/pantry'

interface Label {
  item: string
  option: string
  kind: string
}
interface Gift {
  id: string
  key: string
  claim: Claim
  label: Label
}
interface Guest {
  id: string
  name: string
  anon: boolean
  gifts: Gift[]
}

const POLL_MS = 90_000
const SAVE_DELAY_MS = 1_200

const labels: Record<string, Label> = JSON.parse(
  document.getElementById('labels')?.textContent ?? '{}',
)

const $ = <T extends Element = HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string) => [
  ...document.querySelectorAll<T>(sel),
]

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  )

/** Same person on two devices still groups together, as long as they typed the same name. */
function guestId(name: string) {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || `n-${encodeURIComponent(name.toLowerCase().trim())}`
}

const date = (at: number) =>
  new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' })

// ---------- State ----------

let basket: Basket = {}
/** Checkmarks not yet confirmed by Pantry. */
let patch: Required<Thanks> = { gifts: {}, guests: {} }
let saving = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastSync = 0
let syncState: 'loading' | 'ok' | 'busy' | 'error' | 'saving' = 'loading'
let show: 'all' | 'todo' = 'all'

const arrived = (giftId: string) =>
  patch.gifts[giftId] ?? basket.thanks?.gifts?.[giftId] ?? false
const thanked = (id: string) =>
  patch.guests[id] ?? basket.thanks?.guests?.[id] ?? false

/** A claim on something since taken off the registry: best-effort name from its key. */
function removedLabel(key: string): Label {
  const [item, option = ''] = key.split(/[/:]/).map(s => s.replace(/-/g, ' '))
  const name = /^help$/.test(item) ? option : item
  return {
    item: name.charAt(0).toUpperCase() + name.slice(1),
    option: name === item ? option : '',
    kind: 'No longer on the registry',
  }
}

function guests(): Guest[] {
  const byId = new Map<string, Guest>()
  const all = Object.entries(basket.claims ?? {}).flatMap(([key, byToken]) =>
    Object.values(byToken ?? {})
      .filter(isActive)
      .map(claim => ({ key, claim })),
  )
  all.sort((a, b) => a.claim.at - b.claim.at)
  for (const { key, claim } of all) {
    const name = claim.by?.trim() || 'A guest'
    const id = guestId(name)
    let g = byId.get(id)
    if (!g) {
      g = { id, name, anon: false, gifts: [] }
      byId.set(id, g)
    }
    if (claim.anon) g.anon = true
    g.gifts.push({
      id: `${key}|${claim.t}`,
      key,
      claim,
      label: labels[key] ?? removedLabel(key),
    })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ---------- Rendering ----------

function giftHtml(g: Gift) {
  const option =
    g.label.option && g.label.option !== g.label.item
      ? ` <span class="gift-option">${esc(g.label.option)}</span>`
      : ''
  return `<li class="gift">
    <label class="gift-check">
      <input type="checkbox" data-gift="${esc(g.id)}" ${arrived(g.id) ? 'checked' : ''} />
      <span class="sr-only">Arrived:</span>
      <span class="gift-text"><strong>${esc(g.label.item)}</strong>${option}</span>
    </label>
    <span class="gift-meta">${esc(g.label.kind)} · ${date(g.claim.at)}</span>
  </li>`
}

function guestHtml(g: Guest) {
  const done = thanked(g.id)
  const count = g.gifts.length
  return `<li class="guest" data-done="${done ? '1' : ''}">
    <header class="guest-head">
      <h2>${esc(g.name)}</h2>
      ${g.anon ? '<span class="guest-anon">Shown to guests as “Someone”</span>' : ''}
      <span class="guest-count">${count} ${count === 1 ? 'gift' : 'gifts'}</span>
    </header>
    <p class="gift-legend" aria-hidden="true">Arrived</p>
    <ul class="gifts">${g.gifts.map(giftHtml).join('')}</ul>
    <label class="thanked">
      <input type="checkbox" data-guest="${esc(g.id)}" ${done ? 'checked' : ''} />
      <span>Thank-you sent</span>
    </label>
  </li>`
}

function render() {
  const list = guests()
  const host = $('[data-guests]')
  const focused = document.activeElement as HTMLInputElement | null
  const focusSel = focused?.dataset.gift
    ? `[data-gift="${CSS.escape(focused.dataset.gift)}"]`
    : focused?.dataset.guest
      ? `[data-guest="${CSS.escape(focused.dataset.guest)}"]`
      : ''

  const visible = list.filter(g => show === 'all' || !thanked(g.id))
  if (host) host.innerHTML = visible.map(guestHtml).join('')
  if (focusSel) $<HTMLInputElement>(focusSel)?.focus()

  const gifts = list.flatMap(g => g.gifts)
  const summary = $('[data-summary]')
  if (summary && syncState !== 'loading') {
    summary.textContent = list.length
      ? `${list.length} ${list.length === 1 ? 'person' : 'people'} · ${gifts.length} ${gifts.length === 1 ? 'gift' : 'gifts'} · ${gifts.filter(g => arrived(g.id)).length} arrived · ${list.filter(g => thanked(g.id)).length} of ${list.length} thanked`
      : 'No gifts claimed yet.'
  }

  const empty = $('[data-empty]')
  if (empty) {
    empty.hidden = syncState === 'loading' || visible.length > 0
    empty.textContent = list.length
      ? 'Everyone’s been thanked. 🎉'
      : 'Nobody has claimed a gift yet. Names show up here as soon as they do.'
  }
  renderSync()
}

function renderSync() {
  const el = $('[data-sync]')
  if (!el) return
  const time = lastSync
    ? new Date(lastSync).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''
  el.dataset.tone = syncState === 'ok' || syncState === 'saving' ? '' : 'warn'
  el.textContent = {
    ok: `Live · updated ${time}`,
    saving: 'Saving…',
    busy: 'The registry is busy, retrying in a moment…',
    error: `Can’t reach the registry right now${time ? ` (last updated ${time})` : ''}. We’ll keep trying.`,
    loading: 'Loading claims…',
  }[syncState]
}

// ---------- Sync ----------

function accept(next: Basket) {
  basket = next
  lastSync = Date.now()
  syncState =
    Object.keys(patch.gifts).length + Object.keys(patch.guests).length
      ? 'saving'
      : 'ok'
  render()
}

const onBusy = () => {
  syncState = 'busy'
  renderSync()
}

async function refresh() {
  if (saving || saveTimer) return
  try {
    accept(await request('GET', undefined, onBusy))
  } catch {
    syncState = 'error'
    renderSync()
  }
}

async function save() {
  saveTimer = undefined
  const sending = patch
  patch = { gifts: {}, guests: {} }
  saving++
  try {
    const next = await request('PUT', { thanks: sending }, onBusy)
    saving--
    accept(next)
  } catch {
    saving--
    // Keep the unsaved checkmarks (newer clicks win) and try again shortly.
    patch = {
      gifts: { ...sending.gifts, ...patch.gifts },
      guests: { ...sending.guests, ...patch.guests },
    }
    syncState = 'error'
    renderSync()
    queueSave(15_000)
  }
}

function queueSave(delay = SAVE_DELAY_MS) {
  clearTimeout(saveTimer)
  syncState = 'saving'
  renderSync()
  saveTimer = setTimeout(() => {
    if (saving) queueSave()
    else save()
  }, delay)
}

// ---------- Events ----------

document.addEventListener('change', e => {
  const input = e.target as HTMLInputElement
  if (input.dataset.gift) patch.gifts[input.dataset.gift] = input.checked
  else if (input.dataset.guest)
    patch.guests[input.dataset.guest] = input.checked
  else return
  queueSave()
  render()
})

for (const b of $$('[data-show]')) {
  b.addEventListener('click', () => {
    show = b.dataset.show === 'todo' ? 'todo' : 'all'
    for (const x of $$('[data-show]'))
      x.setAttribute('aria-checked', String(x === b))
    render()
  })
}

$('[data-print]')?.addEventListener('click', () => window.print())

$('[data-csv]')?.addEventListener('click', () => {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = [
    [
      'Name',
      'Shown to guests as Someone',
      'Gift',
      'Option',
      'Section',
      'Claimed',
      'Arrived',
      'Thank-you sent',
    ],
    ...guests().flatMap(g =>
      g.gifts.map(gift => [
        g.name,
        g.anon ? 'yes' : '',
        gift.label.item,
        gift.label.option,
        gift.label.kind,
        new Date(gift.claim.at).toLocaleDateString(),
        arrived(gift.id) ? 'yes' : '',
        thanked(g.id) ? 'yes' : '',
      ]),
    ),
  ]
  const csv = rows.map(r => r.map(cell).join(',')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'baby-burns-konkle-thank-yous.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1_000)
})

window.addEventListener('beforeunload', e => {
  if (saving || saveTimer) e.preventDefault()
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastSync > 60_000)
    refresh()
})

function schedulePoll() {
  setTimeout(
    () => {
      if (document.visibilityState === 'visible') refresh()
      schedulePoll()
    },
    POLL_MS + Math.random() * 15_000,
  )
}

render()
refresh()
schedulePoll()
