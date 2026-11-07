import { useEffect, useState } from 'preact/hooks'
import { useAuth } from '@/lib/auth'
import { query, supabase } from '@/lib/supabase'
import { fmtRange } from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Field,
  Input,
  Loading,
  Notice,
  StatusPill,
  site,
  useAction,
  useAsync,
} from '@/lib/ui'

interface Companion {
  name: string
  age?: string
  relationship?: string
}

/** A guest's optional profile: saved details, people they often bring, and their requests. */
export function Profile() {
  const auth = useAuth()
  if (auth.loading) return <Loading />
  if (!auth.session) {
    return (
      <Notice title="Make a profile to save time">
        <p>
          A profile saves your details and the people you often bring.{' '}
          <a href={`${site('signin/')}?next=/profile/`}>
            Sign in with your email
          </a>{' '}
          to start.
        </p>
      </Notice>
    )
  }
  if (auth.family) {
    return (
      <Notice title={`You’re signed in as ${auth.family.display_name}`}>
        <p>
          Head to the <a href={site('family/')}>family dashboard</a>.
        </p>
      </Notice>
    )
  }
  return <ProfileForm email={auth.session.user.email ?? ''} />
}

function ProfileForm({ email }: { email: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [exists, setExists] = useState(false)
  const save = useAction()

  const loaded = useAsync(async () => {
    const p = (await query(
      supabase.from('profiles').select('name, phone, companions').maybeSingle(),
    )) as {
      name: string
      phone: string | null
      companions: Companion[] | null
    } | null
    if (p) {
      setExists(true)
      setName(p.name ?? '')
      setPhone(p.phone ?? '')
      setCompanions(p.companions ?? [])
    }
    return p
  })

  const bookings = useAsync(() =>
    query(
      supabase
        .from('bookings')
        .select('id, token, status, starts_at, ends_at, booking_types(name)')
        .order('starts_at', { ascending: false })
        .limit(50),
    ),
  )

  useEffect(() => {
    if (loaded.data === null) setName(n => n || '')
  }, [loaded.data])

  const update = (i: number, k: keyof Companion, v: string) =>
    setCompanions(cs => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)))

  async function submit(e: Event) {
    e.preventDefault()
    const row = {
      name: name.trim(),
      phone: phone.trim() || null,
      companions: companions.filter(c => c.name.trim()),
    }
    await save.run(async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? ''
      if (exists)
        await query(supabase.from('profiles').update(row).eq('user_id', uid))
      else await query(supabase.from('profiles').insert(row))
      setExists(true)
    }, 'Profile saved')
  }

  if (loaded.loading) return <Loading />

  return (
    <div class="stack">
      <form class="card stack" onSubmit={submit}>
        <h2 class="h3">Your details</h2>
        <p class="muted small">
          Signed in as {email}. Your name and email together are how the family
          knows you.
        </p>
        <Field label="Full name">
          <Input
            required
            value={name}
            onInput={e => setName(e.currentTarget.value)}
          />
        </Field>
        <Field label="Mobile phone" optional>
          <Input
            type="tel"
            value={phone}
            onInput={e => setPhone(e.currentTarget.value)}
          />
        </Field>
        <fieldset class="stack" style="border:0;padding:0;margin:0">
          <legend class="ff-label">People you often bring</legend>
          {companions.map((c, i) => (
            <div class="row" key={i}>
              <Input
                placeholder="Full name"
                value={c.name}
                onInput={e => update(i, 'name', e.currentTarget.value)}
                style="flex:2 1 160px"
              />
              <Input
                placeholder="Age (kids)"
                value={c.age ?? ''}
                onInput={e => update(i, 'age', e.currentTarget.value)}
                style="flex:0 1 90px"
              />
              <Input
                placeholder="Relationship"
                value={c.relationship ?? ''}
                onInput={e => update(i, 'relationship', e.currentTarget.value)}
                style="flex:1 1 140px"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setCompanions(cs => cs.filter((_, j) => j !== i))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button
              size="sm"
              onClick={() => setCompanions(cs => [...cs, { name: '' }])}
            >
              Add a person
            </Button>
          </div>
        </fieldset>
        <ErrorText error={save.error} />
        <div class="actions">
          <Button type="submit" variant="primary" busy={save.busy}>
            Save profile
          </Button>
        </div>
      </form>

      <section class="card stack">
        <h2 class="h3">Your requests</h2>
        {bookings.loading ? (
          <Loading />
        ) : !bookings.data?.length ? (
          <Empty>
            No requests yet. <a href={site('visits/')}>Book a visit</a>
          </Empty>
        ) : (
          <ul class="stack" style="list-style:none;padding:0;margin:0">
            {bookings.data.map(b => (
              <li key={b.id} class="spread">
                <span>
                  <a href={`${site('visits/request/')}?t=${b.token}`}>
                    {(b.booking_types as unknown as { name: string })?.name}
                  </a>
                  <span class="meta">
                    {' '}
                    · {fmtRange(b.starts_at, b.ends_at)}
                  </span>
                </span>
                <StatusPill status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
