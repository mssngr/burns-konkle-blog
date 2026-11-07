// Sends queued emails from public.outbox through Resend.
// Triggered every minute by pg_cron (private.kick_outbox) with a shared secret.
// Without RESEND_API_KEY, messages are marked "logged" so Admins can read them in the Outbox.
import { createClient } from 'npm:@supabase/supabase-js@2'

const BATCH = 25
const MAX_ATTEMPTS = 5

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const linkify = (s: string) =>
  escapeHtml(s).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, url => `<a href="${url}">${url}</a>`)

function html(body: string) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6efe4;font-family:Helvetica,Arial,sans-serif;color:#2a211c">
<div style="max-width:560px;margin:0 auto;background:#fffaf3;border:1px solid #e6d9c6;border-radius:16px;padding:24px;font-size:16px;line-height:1.55">
${body.split(/\n{2,}/).map(p => `<p style="margin:0 0 12px">${linkify(p).replace(/\n/g, '<br>')}</p>`).join('')}
</div>
<p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#6d6058">Sent by the Burns-Konkle family site. You're getting this because you asked to hear about your request.</p>
</body></html>`
}

Deno.serve(async req => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: ok } = await supabase.rpc('outbox_secret_ok', { p_secret: req.headers.get('x-cron-secret') ?? '' })
  if (!ok) return new Response('forbidden', { status: 403 })

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('MAIL_FROM') ?? 'Burns-Konkle Family <family@burns-konkle.com>'
  const replyTo = Deno.env.get('MAIL_REPLY_TO')

  const { data: rows, error } = await supabase
    .from('outbox')
    .select('id, to_email, to_name, subject, body, attempts')
    .eq('status', 'queued')
    .order('id')
    .limit(BATCH)
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const row of rows ?? []) {
    if (!apiKey) {
      await supabase.from('outbox').update({ status: 'logged', sent_at: new Date().toISOString() }).eq('id', row.id)
      continue
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `outbox-${row.id}`,
      },
      body: JSON.stringify({
        from,
        to: [row.to_name ? `${row.to_name.replace(/[<>"]/g, '')} <${row.to_email}>` : row.to_email],
        subject: row.subject,
        text: row.body,
        html: html(row.body),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (res.ok) {
      sent++
      await supabase.from('outbox').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', row.id)
    } else {
      const attempts = row.attempts + 1
      await supabase
        .from('outbox')
        .update({ attempts, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', error: (await res.text()).slice(0, 500) })
        .eq('id', row.id)
      // Resend rate limits at 2 requests/second on the free plan.
      if (res.status === 429) break
    }
    await new Promise(r => setTimeout(r, 550))
  }
  return Response.json({ processed: rows?.length ?? 0, sent })
})
