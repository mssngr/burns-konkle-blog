import { BASKET, PANTRY_ID } from '@/config'

// ---------- Types & storage ----------

interface Claim {
  by: string
  anon?: boolean
  /** Random per-browser token, so the claimer (and only them) sees "Undo". */
  t: string
  at: number
  released?: boolean
}

/**
 * claim key → claimer token → claim. Each guest only ever writes under their own token,
 * and Pantry's PUT deep-merges, so simultaneous writes never clobber each other.
 * The earliest active claim on a key wins.
 */
type Claims = Record<string, Record<string, Claim>>

const ENDPOINT = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET}`
const POLL_MS = 75_000
/** Pantry allows ~2 requests before a ~10s lockout, so space ours out. */
const REQUEST_GAP_MS = 3_000
const RETRY_DELAYS_MS = [4_000, 8_000, 12_000, 16_000, 24_000, 30_000]
const KEYS = {
  token: 'bk.token',
  name: 'bk.name',
  anon: 'bk.anon',
  cache: `bk.cache.v2.${BASKET}`,
}

const local = {
  get(k: string) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v)
    } catch {}
  },
}

const token =
  local.get(KEYS.token) ??
  (() => {
    const t = crypto.randomUUID()
    local.set(KEYS.token, t)
    return t
  })()

const familyView = new URLSearchParams(location.search).has('family')

let claims: Claims = {}
let lastSync = 0
let syncState: 'loading' | 'ok' | 'busy' | 'error' = 'loading'

try {
  claims = JSON.parse(local.get(KEYS.cache) ?? '{}')
} catch {}

const isActive = (c?: Claim): c is Claim =>
  !!c && typeof c === 'object' && !!c.t && !c.released

/** Active claims on a key, earliest first. */
function holders(key: string): Claim[] {
  return Object.values(claims[key] ?? {})
    .filter(isActive)
    .sort((a, b) => a.at - b.at)
}

const holder = (key: string) => holders(key)[0]
const myClaim = (key: string) => {
  const c = claims[key]?.[token]
  return isActive(c) ? c : undefined
}

// ---------- Pantry API ----------

class FatalError extends Error {}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

let nextSlot = 0
let chain: Promise<unknown> = Promise.resolve()

/** Run requests one at a time, at least REQUEST_GAP_MS apart. */
function schedule<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = nextSlot - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      return await job()
    } finally {
      nextSlot = Date.now() + REQUEST_GAP_MS
    }
  })
  chain = run.catch(() => {})
  return run
}

async function once(method: 'GET' | 'PUT', body?: unknown): Promise<Claims> {
  const res = await fetch(ENDPOINT, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.ok) {
    const data = (await res.json()) as { claims?: Claims }
    return data.claims ?? {}
  }
  if (res.status !== 429 && res.status < 500)
    throw new FatalError(`Registry error ${res.status}`)
  throw new Error(`Registry busy (${res.status})`)
}

/**
 * Pantry answers rate-limited requests with a 429 that has no CORS headers, so the browser
 * reports it as a network error. Retry those with backoff.
 */
async function request(method: 'GET' | 'PUT', body?: unknown): Promise<Claims> {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await schedule(() => once(method, body))
      return result
    } catch (e) {
      if (e instanceof FatalError || attempt >= RETRY_DELAYS_MS.length) throw e
      syncState = 'busy'
      renderSync()
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
}

function accept(next: Claims) {
  claims = next
  lastSync = Date.now()
  syncState = 'ok'
  local.set(KEYS.cache, JSON.stringify(claims))
  render()
}

let refreshing = false
let writes = 0
async function refresh() {
  if (refreshing || writes > 0) return
  refreshing = true
  try {
    accept(await request('GET'))
  } catch {
    syncState = 'error'
    renderSync()
  } finally {
    refreshing = false
  }
}

async function write(key: string, record: Claim) {
  writes++
  try {
    accept(await request('PUT', { claims: { [key]: { [token]: record } } }))
  } finally {
    writes--
  }
}

// ---------- DOM helpers ----------

const $ = <T extends Element = HTMLElement>(
  sel: string,
  root: ParentNode = document,
) => root.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(
  sel: string,
  root: ParentNode = document,
) => [...root.querySelectorAll<T>(sel)]

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

function displayName(c: Claim) {
  if (c.anon && !familyView) return 'Someone'
  return c.anon ? `${c.by} (hidden from guests)` : c.by
}

const pending = new Set<string>()

function toast(message: string, tone: 'ok' | 'warn' = 'ok') {
  const host = $('[data-toasts]')
  if (!host) return
  const el = document.createElement('div')
  el.className = `toast toast-${tone}`
  el.textContent = message
  host.append(el)
  setTimeout(() => el.classList.add('out'), 4200)
  setTimeout(() => el.remove(), 4700)
}

// ---------- Name dialog ----------

const dialog = $<HTMLDialogElement>('[data-name-dialog]')
const form = $<HTMLFormElement>('[data-name-form]')

function askName(force = false): Promise<boolean> {
  if (!force && local.get(KEYS.name)) return Promise.resolve(true)
  if (!dialog || !form) return Promise.resolve(false)
  const nameInput = form.elements.namedItem('name') as HTMLInputElement
  const anonInput = form.elements.namedItem('anon') as HTMLInputElement
  nameInput.value = local.get(KEYS.name) ?? ''
  anonInput.checked = local.get(KEYS.anon) === '1'
  dialog.returnValue = ''
  dialog.showModal()
  return new Promise(resolve => {
    const cancelBtn = $('[data-dialog-cancel]', dialog)
    const done = (ok: boolean) => {
      form.removeEventListener('submit', onSubmit)
      dialog.removeEventListener('close', onClose)
      cancelBtn?.removeEventListener('click', onCancel)
      resolve(ok)
    }
    const onSubmit = () => {
      const name = nameInput.value.trim()
      if (!name) return
      local.set(KEYS.name, name)
      local.set(KEYS.anon, anonInput.checked ? '1' : '0')
      renderWho()
      done(true)
    }
    const onClose = () =>
      done(dialog.returnValue !== 'cancel' && !!local.get(KEYS.name))
    const onCancel = () => dialog.close('cancel')
    form.addEventListener('submit', onSubmit)
    dialog.addEventListener('close', onClose)
    cancelBtn?.addEventListener('click', onCancel)
  })
}

function newRecord(): Claim {
  return {
    by: local.get(KEYS.name) ?? 'A guest',
    anon: local.get(KEYS.anon) === '1',
    t: token,
    at: Date.now(),
    released: false,
  }
}

// ---------- Claim / release ----------

const optionKeysFor = (item: string) =>
  $$(`.opt[data-item="${item}"]`).map(o => o.dataset.key ?? '')
const isOneItem = (item?: string) =>
  !!item && !!$(`.item[data-item="${item}"]`)?.hasAttribute('data-one')

/** For single-gift items, the earliest claim across all options wins. */
function itemWinner(item: string) {
  return optionKeysFor(item)
    .flatMap(k => holders(k).map(c => ({ key: k, c })))
    .sort((a, b) => a.c.at - b.c.at)[0]
}

async function claim(key: string, label: string, item?: string) {
  const isHelp = key.startsWith('help:')
  if (!isHelp) {
    const h = holder(key)
    if (h && h.t !== token)
      return toast(`${displayName(h)} already has that one.`, 'warn')
    if (isOneItem(item) && item && itemWinner(item))
      return toast('That’s already covered. We only need one.', 'warn')
  }
  if (!(await askName())) return
  pending.add(key)
  render()
  try {
    await write(key, newRecord())
    const lost = isHelp
      ? false
      : holder(key)?.t !== token ||
        (isOneItem(item) && item ? itemWinner(item)?.c.t !== token : false)
    if (lost) {
      // Someone claimed it a moment before us: quietly withdraw ours.
      const mine = myClaim(key)
      if (mine) await write(key, { ...mine, released: true })
      toast('Someone claimed that a moment before you. Pick another?', 'warn')
    } else {
      toast(
        isHelp
          ? 'Thank you for signing up!'
          : `Thank you! “${label}” is marked as yours.`,
      )
    }
  } catch {
    toast('The registry is busy. Please try again in a minute.', 'warn')
  } finally {
    pending.delete(key)
    render()
  }
}

async function release(key: string) {
  const mine = myClaim(key)
  if (!mine) return
  pending.add(key)
  render()
  try {
    await write(key, { ...mine, released: true })
    toast('Removed. It’s open for someone else now.')
  } catch {
    toast('The registry is busy. Please try again in a minute.', 'warn')
  } finally {
    pending.delete(key)
    render()
  }
}

// ---------- Rendering ----------

const itemEls = $$('.item[data-item]')
const helpEls = $$('.item[data-help]')
const totalItems = itemEls.length

const BUTTON_PENDING = '<button class="btn btn-claim" disabled>Saving…</button>'
const undo = '<button type="button" class="linklike" data-undo>Undo</button>'

function actionHtml(state: string, c?: Claim) {
  switch (state) {
    case 'pending':
      return BUTTON_PENDING
    case 'mine':
      return `<span class="tag tag-mine">✓ You’re getting this</span>${undo}`
    case 'taken':
      return `<span class="tag tag-taken">✓ ${esc(c ? displayName(c) : 'Someone')} has this</span>`
    case 'covered':
      return '<span class="tag tag-covered">Covered</span>'
    default:
      return '<button type="button" class="btn btn-claim" data-claim>I’ll get this</button>'
  }
}

function setSlot(slot: HTMLElement | null, sig: string, html: () => string) {
  if (!slot || slot.dataset.sig === sig) return
  slot.dataset.sig = sig
  slot.innerHTML = html()
}

function render() {
  let covered = 0
  let mine = 0

  for (const itemEl of itemEls) {
    const opts = $$('.opt', itemEl)
    const one = itemEl.hasAttribute('data-one')
    const winner = one ? itemWinner(itemEl.dataset.item ?? '') : undefined
    let activeCount = 0
    let itemMine = false
    for (const opt of opts) {
      const key = opt.dataset.key ?? ''
      let h = holder(key)
      if (one && h && winner && winner.key !== key) h = undefined
      const state = pending.has(key)
        ? 'pending'
        : h
          ? h.t === token
            ? 'mine'
            : 'taken'
          : one && winner
            ? 'covered'
            : 'open'
      opt.dataset.state = state
      setSlot(
        $('[data-action-slot]', opt),
        `${state}|${h?.by ?? ''}|${h?.anon ?? ''}`,
        () => actionHtml(state, h),
      )
      if (h) activeCount++
      if (state === 'mine') {
        mine++
        itemMine = true
      }
    }
    const full = activeCount > 0 && (one || activeCount === opts.length)
    itemEl.dataset.state = full ? 'full' : activeCount ? 'some' : 'open'
    itemEl.dataset.mine = itemMine ? '1' : ''
    const status = $('[data-status]', itemEl)
    if (status) {
      status.hidden = activeCount === 0
      status.textContent = full ? 'Covered' : `${activeCount} on the way`
    }
    if (activeCount) covered++
  }

  for (const helpEl of helpEls) {
    const key = `help:${helpEl.dataset.help}`
    helpEl.dataset.key = key
    const pledges = holders(key)
    const iAmIn = !!myClaim(key)
    if (iAmIn) mine++
    helpEl.dataset.mine = iAmIn ? '1' : ''
    const list = $('[data-pledgers]', helpEl)
    if (list) {
      const names = pledges.map(c => (c.t === token ? 'you' : displayName(c)))
      list.textContent = names.length
        ? `${names.length} signed up: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ` and ${names.length - 6} more` : ''}`
        : 'Be the first to sign up.'
    }
    const state = pending.has(key) ? 'pending' : iAmIn ? 'mine' : 'open'
    setSlot($('[data-help-action]', helpEl), `help|${state}`, () =>
      state === 'pending'
        ? BUTTON_PENDING
        : state === 'mine'
          ? `<span class="tag tag-mine">✓ You’re in</span>${undo}`
          : '<button type="button" class="btn btn-claim" data-claim>Count me in</button>',
    )
  }

  const count = $('[data-progress-count]')
  if (count) count.textContent = String(covered)
  const fill = $('[data-progress-fill]')
  if (fill)
    fill.style.width = `${totalItems ? (covered / totalItems) * 100 : 0}%`
  const mineCount = $('[data-mine-count]')
  if (mineCount) {
    mineCount.hidden = mine === 0
    mineCount.textContent = String(mine)
  }

  renderSync()
  applyFilters()
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
  el.dataset.tone = syncState === 'ok' ? '' : 'warn'
  el.textContent =
    syncState === 'ok'
      ? `Live · updated ${time}${familyView ? ' · family view' : ''}`
      : syncState === 'busy'
        ? 'The registry is busy, retrying in a moment…'
        : syncState === 'error'
          ? `Can’t reach the registry right now${time ? ` (last updated ${time})` : ''}. We’ll keep trying.`
          : 'Loading claims…'
}

function renderWho() {
  const who = $('[data-whoami]')
  if (who) who.textContent = local.get(KEYS.name) ?? 'a guest'
}

// ---------- Tabs, search, filters ----------

const stageEls = $$('[data-stage]')
let tab = stageEls[0]?.dataset.stage ?? 'newborn'
let filter: 'all' | 'open' | 'mine' = 'all'
let query = ''

function applyFilters() {
  const global = query.length > 0 || filter === 'mine'
  let anyVisible = false
  for (const stage of stageEls) {
    const items = $$<HTMLElement>('.item', stage)
    for (const item of items) {
      const isHelp = item.hasAttribute('data-help')
      const matches = !query || (item.dataset.search ?? '').includes(query)
      const passes =
        filter === 'all' ||
        (filter === 'mine' && item.dataset.mine === '1') ||
        (filter === 'open' && (isHelp || item.dataset.state !== 'full'))
      item.hidden = !(matches && passes)
    }
    for (const cat of $$('[data-category]', stage)) {
      cat.hidden = !$$('.item', cat).some(i => !i.hidden)
    }
    const stageVisible = items.some(i => !i.hidden)
    stage.hidden = !stageVisible || (!global && stage.dataset.stage !== tab)
    if (!stage.hidden) anyVisible = true
  }
  const empty = $('[data-empty]')
  if (empty) {
    empty.hidden = anyVisible
    empty.textContent =
      filter === 'mine' && !query
        ? 'You haven’t picked anything yet. Tap “I’ll get this” on any option.'
        : 'Nothing matches. Try another word, or switch back to “All.”'
  }
  $('[data-toolbar]')?.classList.toggle('is-global', global)
  for (const a of $$('[data-tab]')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'true')
    else a.removeAttribute('aria-current')
  }
}

function stageFor(hash: string) {
  const target = hash ? document.getElementById(hash) : null
  return target?.closest<HTMLElement>('[data-stage]')?.dataset.stage
}

function syncFilterButtons() {
  for (const b of $$('[data-filter]'))
    b.setAttribute('aria-checked', String(b.dataset.filter === filter))
}

function setTab(next: string) {
  tab = next
  applyFilters()
  history.replaceState(null, '', `#${next}`)
  const toolbar = $('[data-toolbar]')
  const top = (toolbar?.getBoundingClientRect().top ?? 0) + window.scrollY
  if (window.scrollY > top) window.scrollTo({ top })
}

for (const a of $$('[data-tab]')) {
  a.addEventListener('click', e => {
    e.preventDefault()
    if (query || filter === 'mine') {
      query = ''
      filter = 'all'
      const input = $<HTMLInputElement>('[data-search-input]')
      if (input) input.value = ''
      syncFilterButtons()
    }
    setTab(a.dataset.tab ?? tab)
  })
}

for (const b of $$('[data-filter]')) {
  b.addEventListener('click', () => {
    filter = (b.dataset.filter as typeof filter) ?? 'all'
    syncFilterButtons()
    applyFilters()
  })
}

$<HTMLInputElement>('[data-search-input]')?.addEventListener('input', e => {
  query = (e.target as HTMLInputElement).value.trim().toLowerCase()
  applyFilters()
})

window.addEventListener('hashchange', () => {
  const hash = location.hash.slice(1)
  const s = stageFor(hash)
  if (s && s !== tab) {
    tab = s
    applyFilters()
    document.getElementById(hash)?.scrollIntoView()
  }
})

// ---------- Events ----------

document.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(
    '[data-claim], [data-undo]',
  )
  if (!btn) return
  const opt = btn.closest<HTMLElement>('.opt')
  const help = btn.closest<HTMLElement>('[data-help]')
  const key = opt?.dataset.key ?? help?.dataset.key
  if (!key) return
  if (btn.hasAttribute('data-undo')) {
    release(key)
  } else {
    const label =
      opt?.dataset.label ??
      $('.item-name', help ?? document)?.textContent ??
      'This'
    claim(key, label, opt?.dataset.item)
  }
})

$('[data-change-name]')?.addEventListener('click', () => askName(true))

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

// ---------- Boot ----------

const initial = stageFor(location.hash.slice(1))
if (initial) tab = initial
renderWho()
render()
refresh().then(() => {
  const hash = location.hash.slice(1)
  if (hash && hash !== tab) document.getElementById(hash)?.scrollIntoView()
})
schedulePoll()
