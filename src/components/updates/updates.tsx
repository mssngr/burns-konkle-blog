import { useState } from 'preact/hooks'
import {
  Paragraphs,
  PhotoGrid,
  PhotoPicker,
  randomId,
  safeName,
} from '@/components/updates/photos'
import { type FamilyStatus, isFamily, personName, useAuth } from '@/lib/auth'
import {
  AppError,
  errorMessage,
  publicPhotoUrl,
  query,
  rpc,
  supabase,
} from '@/lib/supabase'
import { fmtDateTime, toDate } from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Field,
  Input,
  Loading,
  loadContact,
  Modal,
  TextArea,
  useAction,
  useAsync,
  useConfirm,
} from '@/lib/ui'

// ------------------------------------------------------------------ types

export type Kind = 'message' | 'photos' | 'poll' | 'guess'

export interface Game {
  question: string
  options?: string[]
  unit?: string | null
  answer?: string | null
}

export interface Post {
  id: string
  author: string
  kind: Kind
  title: string | null
  body: string | null
  photos: string[]
  game: Game | null
  created_at: string
  updated_at: string
}

interface Results {
  answered: boolean
  mine?: string | null
  counts?: Record<string, number>
  total?: number
  guesses?: { name: string; answer: string }[]
  answer?: string | null
}

const KINDS: { key: Kind; label: string }[] = [
  { key: 'message', label: 'Message' },
  { key: 'photos', label: 'Photos' },
  { key: 'poll', label: 'Poll' },
  { key: 'guess', label: 'Guessing game' },
]

const PAGE = 10
const BUCKET = 'updates'

// --------------------------------------------------------------- helpers

/** A random id for this browser, so guests can answer without signing in. */
let memoResponder: string | null = null
function responderId(): string {
  const KEY = 'bk.responder'
  try {
    let v = localStorage.getItem(KEY)
    if (!v || v.length < 16 || v.length > 80) {
      v = randomId()
      localStorage.setItem(KEY, v)
    }
    return v
  } catch {
    memoResponder ??= randomId()
    return memoResponder
  }
}

const canManage = (post: Post, family: FamilyStatus | null) =>
  !!family?.verified &&
  (post.author === family.person || family.role === 'admin')

const withUnit = (answer: string, unit?: string | null) =>
  unit && !answer.toLowerCase().includes(unit.toLowerCase())
    ? `${answer} ${unit}`
    : answer

async function fetchPosts(before?: string): Promise<Post[]> {
  let q = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(PAGE)
  if (before) q = q.lt('created_at', before)
  return (await query(q)) as Post[]
}

// ------------------------------------------------------------------ feed

export function Updates() {
  const auth = useAuth()
  const family = isFamily(auth.family) ? auth.family : null
  const [responder] = useState(responderId)
  const [posts, setPosts] = useState<Post[]>([])
  const [more, setMore] = useState(false)
  const [writing, setWriting] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const older = useAction()

  const feed = useAsync(async () => {
    const rows = await fetchPosts()
    setPosts(rows)
    setMore(rows.length === PAGE)
    return rows
  })

  async function loadOlder() {
    const rows = await older.run(() =>
      fetchPosts(posts[posts.length - 1]?.created_at),
    )
    if (!rows) return
    setPosts(p => [...p, ...rows])
    setMore(rows.length === PAGE)
  }

  const replace = (p: Post) =>
    setPosts(ps => ps.map(x => (x.id === p.id ? p : x)))

  return (
    <div class="stack updates">
      {family && (
        <section class="card stack composer-card">
          {writing ? (
            <>
              <div class="spread">
                <h2 class="h3">New update</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWriting(false)}
                >
                  Cancel
                </Button>
              </div>
              <Composer
                onSaved={p => {
                  setPosts(ps => [p, ...ps])
                  setWriting(false)
                }}
              />
            </>
          ) : (
            <div class="spread">
              <p class="muted" style="margin:0">
                Signed in as {family.display_name}. Posts go up right away.
              </p>
              <Button variant="primary" onClick={() => setWriting(true)}>
                Write an update
              </Button>
            </div>
          )}
        </section>
      )}

      {feed.loading && !posts.length ? (
        <Loading />
      ) : feed.error ? (
        <ErrorText error={feed.error} />
      ) : !posts.length ? (
        <Empty>No updates yet. Check back soon!</Empty>
      ) : (
        <>
          {posts.map(p => (
            <PostCard
              key={p.id}
              post={p}
              family={family}
              responder={responder}
              onEdit={() => setEditing(p)}
              onChanged={replace}
              onDeleted={() => setPosts(ps => ps.filter(x => x.id !== p.id))}
            />
          ))}
          <ErrorText error={older.error} />
          {more && (
            <div class="actions" style="justify-content:center">
              <Button busy={older.busy} onClick={loadOlder}>
                Show older updates
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit update"
        wide
      >
        {editing && (
          <Composer
            post={editing}
            onSaved={p => {
              replace(p)
              setEditing(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// ------------------------------------------------------------------ post

function PostCard({
  post,
  family,
  responder,
  onEdit,
  onChanged,
  onDeleted,
}: {
  post: Post
  family: FamilyStatus | null
  responder: string
  onEdit: () => void
  onChanged: (p: Post) => void
  onDeleted: () => void
}) {
  const del = useAction()
  const confirm = useConfirm('Delete it')
  const manage = canManage(post, family)
  const edited =
    toDate(post.updated_at).getTime() - toDate(post.created_at).getTime() >
    60_000
  const label =
    post.kind === 'poll'
      ? 'Poll'
      : post.kind === 'guess'
        ? 'Guessing game'
        : null

  async function remove() {
    if (!(await confirm.ask('Delete this post? This can’t be undone.'))) return
    const ok = await del.run(async () => {
      const rows = await query(
        supabase.from('posts').delete().eq('id', post.id).select('id'),
      )
      if (!rows?.length)
        throw new AppError('You can only delete your own posts.')
      if (post.photos.length)
        await supabase.storage.from(BUCKET).remove(post.photos)
      return true
    }, 'Post deleted')
    if (ok) onDeleted()
  }

  return (
    <article class="card stack post" id={`post-${post.id}`}>
      {confirm.dialog}
      <header class="post-head">
        <p class="meta">
          {label && <span class="post-kind">{label}</span>}
          {personName(post.author)} ·{' '}
          <time dateTime={post.created_at}>{fmtDateTime(post.created_at)}</time>
          {edited && ' · Edited'}
        </p>
        {post.title && <h2 class="post-title">{post.title}</h2>}
      </header>
      <Paragraphs text={post.body} />
      <PhotoGrid
        urls={post.photos.map(p => publicPhotoUrl(BUCKET, p))}
        alt={post.title || `Update from ${personName(post.author)}`}
      />
      {post.kind === 'poll' && post.game && (
        <Poll
          post={post}
          game={post.game}
          responder={responder}
          family={family}
        />
      )}
      {post.kind === 'guess' && post.game && (
        <Guess
          post={post}
          game={post.game}
          responder={responder}
          family={family}
          manage={manage}
          onChanged={onChanged}
        />
      )}
      {manage && (
        <footer class="actions post-actions">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant="danger" busy={del.busy} onClick={remove}>
            Delete
          </Button>
        </footer>
      )}
      <ErrorText error={del.error} />
    </article>
  )
}

// ------------------------------------------------------------------ poll

function Poll({
  post,
  game,
  responder,
  family,
}: {
  post: Post
  game: Game
  responder: string
  family: FamilyStatus | null
}) {
  const res = useAsync(
    () =>
      rpc<Results>('post_results', { p_post: post.id, p_responder: responder }),
    [post.id, post.updated_at],
  )
  const [choice, setChoice] = useState('')
  const vote = useAction()
  const options = game.options ?? []
  const r = res.data

  async function submit(e: Event) {
    e.preventDefault()
    if (!choice) return vote.setError(new AppError('Please pick an option.'))
    const out = await vote.run(() =>
      rpc<Results>('answer_post', {
        p_post: post.id,
        p_responder: responder,
        p_answer: choice,
      }),
    )
    if (out) res.setData(out)
  }

  return (
    <section class="game stack">
      <h3 class="game-q">{game.question}</h3>
      {res.loading && !r ? (
        <Loading />
      ) : res.error ? (
        <ErrorText error={res.error} />
      ) : r ? (
        <>
          {!r.answered && (
            <form class="stack" onSubmit={submit}>
              <fieldset class="choices">
                <legend class="sr-only">{game.question}</legend>
                {options.map(o => (
                  <label key={o} class={`choice${choice === o ? ' on' : ''}`}>
                    <input
                      type="radio"
                      name={`poll-${post.id}`}
                      value={o}
                      checked={choice === o}
                      onChange={() => setChoice(o)}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </fieldset>
              <ErrorText error={vote.error} />
              <div class="actions">
                <Button type="submit" variant="primary" busy={vote.busy}>
                  Vote
                </Button>
                <span class="meta">You’ll see the results after you vote.</span>
              </div>
            </form>
          )}
          {r.counts && (
            <div class="stack">
              {!r.answered && family && (
                <p class="meta">
                  You can see the results because you’re signed in as family.
                </p>
              )}
              <ul class="results" aria-label="Results">
                {options.map(o => {
                  const n = r.counts?.[o] ?? 0
                  const pct = r.total ? Math.round((n / r.total) * 100) : 0
                  return (
                    <li key={o} class={r.mine === o ? 'mine' : undefined}>
                      <div class="spread result-label">
                        <span>
                          {o}
                          {r.mine === o && (
                            <span class="meta"> · Your vote</span>
                          )}
                        </span>
                        <span class="meta">
                          {pct}% ({n})
                        </span>
                      </div>
                      <div class="bar" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p class="meta">
                {r.total ?? 0} {r.total === 1 ? 'vote' : 'votes'}
              </p>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}

// ----------------------------------------------------------------- guess

function Guess({
  post,
  game,
  responder,
  family,
  manage,
  onChanged,
}: {
  post: Post
  game: Game
  responder: string
  family: FamilyStatus | null
  manage: boolean
  onChanged: (p: Post) => void
}) {
  const res = useAsync(
    () =>
      rpc<Results>('post_results', { p_post: post.id, p_responder: responder }),
    [post.id, post.updated_at],
  )
  const [answer, setAnswer] = useState('')
  const [name, setName] = useState(() =>
    typeof localStorage === 'undefined' ? '' : loadContact().name,
  )
  const send = useAction()
  const r = res.data
  const revealed = game.answer ? withUnit(game.answer, game.unit) : null

  async function submit(e: Event) {
    e.preventDefault()
    if (!answer.trim())
      return send.setError(new AppError('Please enter your guess.'))
    const out = await send.run(() =>
      rpc<Results>('answer_post', {
        p_post: post.id,
        p_responder: responder,
        p_answer: answer.trim(),
        p_name: name.trim() || null,
      }),
    )
    if (out) res.setData(out)
  }

  return (
    <section class="game stack">
      <h3 class="game-q">{game.question}</h3>
      {revealed && (
        <p class="reveal">
          The answer: <strong>{revealed}</strong>
        </p>
      )}
      {res.loading && !r ? (
        <Loading />
      ) : res.error ? (
        <ErrorText error={res.error} />
      ) : r ? (
        <>
          {!r.answered && !revealed && (
            <form class="stack" onSubmit={submit}>
              <div class="guess-fields">
                <Field label="Your guess">
                  <div class="with-unit">
                    <Input
                      value={answer}
                      maxLength={200}
                      onInput={e => setAnswer(e.currentTarget.value)}
                    />
                    {game.unit && <span class="unit">{game.unit}</span>}
                  </div>
                </Field>
                <Field label="Your name" optional>
                  <Input
                    value={name}
                    maxLength={80}
                    autocomplete="name"
                    onInput={e => setName(e.currentTarget.value)}
                  />
                </Field>
              </div>
              <ErrorText error={send.error} />
              <div class="actions">
                <Button type="submit" variant="primary" busy={send.busy}>
                  Guess
                </Button>
                <span class="meta">
                  You’ll see everyone’s guesses after you guess.
                </span>
              </div>
            </form>
          )}
          {!r.answered && revealed && !family && (
            <p class="meta">Guessing is closed.</p>
          )}
          {r.guesses && (
            <div class="stack">
              {!r.answered && family && (
                <p class="meta">
                  You can see the guesses because you’re signed in as family.
                </p>
              )}
              {r.answered && r.mine && (
                <p class="meta">
                  Your guess: <strong>{withUnit(r.mine, game.unit)}</strong>
                </p>
              )}
              {r.guesses.length ? (
                <ul class="guesses" aria-label="Guesses">
                  {r.guesses.map((g, i) => (
                    <li key={i}>
                      <span class="guess-name">{g.name}</span>
                      <span>{withUnit(g.answer, game.unit)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="meta">No guesses yet.</p>
              )}
            </div>
          )}
        </>
      ) : null}
      {manage && <RevealAnswer post={post} game={game} onChanged={onChanged} />}
    </section>
  )
}

function RevealAnswer({
  post,
  game,
  onChanged,
}: {
  post: Post
  game: Game
  onChanged: (p: Post) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(game.answer ?? '')
  const save = useAction()

  async function submit(e: Event) {
    e.preventDefault()
    const answer = value.trim() || null
    const out = await save.run(
      async () => {
        const rows = await query(
          supabase
            .from('posts')
            .update({ game: { ...game, answer } })
            .eq('id', post.id)
            .select('*'),
        )
        if (!rows?.length)
          throw new AppError(
            'Only the author or an Admin can change this post.',
          )
        return rows[0] as Post
      },
      answer ? 'Answer revealed' : 'Answer hidden',
    )
    if (out) {
      onChanged(out)
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <div>
        <Button size="sm" onClick={() => setOpen(true)}>
          {game.answer ? 'Change the answer' : 'Reveal the answer'}
        </Button>
      </div>
    )
  }
  return (
    <form class="stack reveal-form" onSubmit={submit}>
      <Field
        label="The answer"
        hint="Everyone will see it right away. Clear it to hide the answer again."
      >
        <div class="with-unit">
          <Input
            autoFocus
            value={value}
            maxLength={200}
            onInput={e => setValue(e.currentTarget.value)}
          />
          {game.unit && <span class="unit">{game.unit}</span>}
        </div>
      </Field>
      <ErrorText error={save.error} />
      <div class="actions">
        <Button type="submit" variant="primary" size="sm" busy={save.busy}>
          Save answer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// -------------------------------------------------------------- composer

function Composer({
  post,
  onSaved,
}: {
  post?: Post
  onSaved: (p: Post) => void
}) {
  const [kind, setKind] = useState<Kind>(post?.kind ?? 'message')
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [kept, setKept] = useState<string[]>(post?.photos ?? [])
  const [files, setFiles] = useState<File[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [question, setQuestion] = useState(post?.game?.question ?? '')
  const [options, setOptions] = useState<string[]>(
    post?.game?.options?.length ? post.game.options : ['', ''],
  )
  const [unit, setUnit] = useState(post?.game?.unit ?? '')
  const save = useAction()

  function validate(): string | null {
    const opts = options.map(o => o.trim()).filter(Boolean)
    if (kind === 'message' && !body.trim() && !title.trim())
      return 'Please write a message.'
    if (kind === 'photos' && !kept.length && !files.length)
      return 'Please add at least one photo.'
    if ((kind === 'poll' || kind === 'guess') && !question.trim())
      return 'Please write the question.'
    if (kind === 'poll' && opts.length < 2)
      return 'A poll needs at least two options.'
    if (
      kind === 'poll' &&
      new Set(opts.map(o => o.toLowerCase())).size !== opts.length
    )
      return 'Each option should be different.'
    return null
  }

  function buildGame(): Game | null {
    if (kind === 'poll')
      return {
        question: question.trim(),
        options: options.map(o => o.trim()).filter(Boolean),
      }
    if (kind === 'guess')
      return {
        question: question.trim(),
        unit: unit.trim() || null,
        answer: post?.game?.answer ?? null,
      }
    return null
  }

  async function submit(e: Event) {
    e.preventDefault()
    const problem = validate()
    if (problem) return save.setError(new AppError(problem))
    const out = await save.run(
      async () => {
        const uploaded: string[] = []
        try {
          for (const f of files) {
            const path = `${randomId()}/${safeName(f.name)}`
            const { error } = await supabase.storage
              .from(BUCKET)
              .upload(path, f, { contentType: f.type, upsert: false })
            if (error)
              throw new AppError(
                `Couldn’t upload “${f.name}”: ${errorMessage(error)}`,
              )
            uploaded.push(path)
          }
          const row = {
            kind,
            title: title.trim() || null,
            body: body.trim() || null,
            photos: [...kept, ...uploaded],
            game: buildGame(),
          }
          let saved: Post
          if (post) {
            const rows = await query(
              supabase.from('posts').update(row).eq('id', post.id).select('*'),
            )
            if (!rows?.length)
              throw new AppError('You can only edit your own posts.')
            saved = rows[0] as Post
            const removed = post.photos.filter(p => !kept.includes(p))
            if (removed.length)
              await supabase.storage.from(BUCKET).remove(removed)
          } else {
            saved = (await query(
              supabase.from('posts').insert(row).select('*').single(),
            )) as Post
          }
          return saved
        } catch (err) {
          if (uploaded.length)
            await supabase.storage.from(BUCKET).remove(uploaded)
          throw err
        }
      },
      post ? 'Update saved' : 'Posted',
    )
    if (out) onSaved(out)
  }

  const setOption = (i: number, v: string) =>
    setOptions(os => os.map((o, j) => (j === i ? v : o)))

  return (
    <form class="stack composer" onSubmit={submit}>
      {post ? (
        <p class="meta">{KINDS.find(k => k.key === kind)?.label}</p>
      ) : (
        <fieldset class="kind-picker">
          <legend class="ff-label">What kind of post?</legend>
          {KINDS.map(k => (
            <label key={k.key} class={`kind-opt${kind === k.key ? ' on' : ''}`}>
              <input
                type="radio"
                name="kind"
                value={k.key}
                checked={kind === k.key}
                onChange={() => setKind(k.key)}
              />
              <span>{k.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      <Field label="Title" optional>
        <Input
          value={title}
          maxLength={140}
          onInput={e => setTitle(e.currentTarget.value)}
        />
      </Field>

      {(kind === 'poll' || kind === 'guess') && (
        <Field label="Question">
          <Input
            value={question}
            maxLength={200}
            placeholder={
              kind === 'guess'
                ? 'Guess the birth weight'
                : 'Which name do you like best?'
            }
            onInput={e => setQuestion(e.currentTarget.value)}
          />
        </Field>
      )}

      {kind === 'poll' && (
        <fieldset class="stack options-editor">
          <legend class="ff-label">Options</legend>
          {options.map((o, i) => (
            <div class="row option-row" key={i}>
              <Input
                value={o}
                maxLength={100}
                aria-label={`Option ${i + 1}`}
                placeholder={`Option ${i + 1}`}
                onInput={e => setOption(i, e.currentTarget.value)}
              />
              {options.length > 2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOptions(os => os.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <div class="row">
            {options.length < 10 && (
              <Button size="sm" onClick={() => setOptions(os => [...os, ''])}>
                Add an option
              </Button>
            )}
          </div>
          {post && (
            <p class="ff-hint">
              Votes stay with the option’s exact wording, so renaming an option
              after people vote clears its votes.
            </p>
          )}
        </fieldset>
      )}

      {kind === 'guess' && (
        <Field
          label="Unit"
          optional
          hint="Shown next to every guess, like lb, inches, or a date."
        >
          <Input
            value={unit}
            maxLength={20}
            onInput={e => setUnit(e.currentTarget.value)}
          />
        </Field>
      )}

      <Field
        label={kind === 'message' ? 'Message' : 'Words'}
        optional={kind !== 'message'}
      >
        <TextArea
          rows={kind === 'message' ? 5 : 3}
          value={body}
          maxLength={5000}
          onInput={e => setBody(e.currentTarget.value)}
        />
      </Field>

      <div class="ff">
        <span class="ff-label">
          Photos
          {kind !== 'photos' && <span class="ff-optional"> (optional)</span>}
        </span>
        <PhotoPicker
          files={files}
          onFiles={setFiles}
          max={20}
          existing={kept.map(p => ({ key: p, url: publicPhotoUrl(BUCKET, p) }))}
          onRemoveExisting={k => setKept(ks => ks.filter(x => x !== k))}
          onError={setPhotoError}
        />
        {photoError && <span class="ff-error">{photoError}</span>}
      </div>

      <ErrorText error={save.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={save.busy}>
          {post ? 'Save changes' : 'Post'}
        </Button>
        {save.busy && files.length > 0 && (
          <span class="meta">Uploading photos…</span>
        )}
      </div>
    </form>
  )
}
