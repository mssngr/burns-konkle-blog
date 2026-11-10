#!/usr/bin/env bash
# Pushes ONLY the sign-in email templates (subject + HTML) from supabase/config.toml
# and supabase/templates/ to the hosted project, then reads them back to verify.
#
# Why not `supabase config push`? It also pushes site_url, otp_length, redirect URLs
# and other auth settings, and the local values (e.g. site_url = localhost) differ
# from production's.
#
# Usage: SUPABASE_ACCESS_TOKEN=sbp_… scripts/push-auth-templates.sh [--dry-run]
#   Create the token at https://supabase.com/dashboard/account/tokens.
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_REF="${SUPABASE_PROJECT_REF:-qtqbieoqddytzptofoil}"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Reads `subject` from the [auth.email.template.<name>] section of config.toml.
subject_of() {
  awk -v section="[auth.email.template.$1]" '
    $0 == section { in_section = 1; next }
    /^\[/ { in_section = 0 }
    in_section && /^subject *=/ { gsub(/^subject *= *"|"$/, ""); print; exit }
  ' supabase/config.toml
}

magic_subject="$(subject_of magic_link)"
confirmation_subject="$(subject_of confirmation)"
[[ -n "$magic_subject" && -n "$confirmation_subject" ]] || {
  echo "Could not read template subjects from supabase/config.toml" >&2
  exit 1
}

payload="$(jq -n \
  --arg magic_subject "$magic_subject" \
  --rawfile magic_content supabase/templates/magic_link.html \
  --arg confirmation_subject "$confirmation_subject" \
  --rawfile confirmation_content supabase/templates/confirmation.html \
  '{
    mailer_subjects_magic_link: $magic_subject,
    mailer_templates_magic_link_content: $magic_content,
    mailer_subjects_confirmation: $confirmation_subject,
    mailer_templates_confirmation_content: $confirmation_content
  }')"

if $DRY_RUN; then
  echo "$payload"
  exit 0
fi

: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN (see the header of this script)}"

curl -fsS -X PATCH "$API" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload" > /dev/null

# Verify: the hosted values must equal what we sent.
live="$(curl -fsS "$API" -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")"
if diff <(echo "$payload" | jq -S .) \
  <(echo "$live" | jq -S '{mailer_subjects_magic_link, mailer_templates_magic_link_content, mailer_subjects_confirmation, mailer_templates_confirmation_content}'); then
  echo "Hosted sign-in email templates match the repo."
else
  echo "Hosted templates differ from the repo after push." >&2
  exit 1
fi
