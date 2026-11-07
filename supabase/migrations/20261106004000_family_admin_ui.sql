-- Read-only helper for the family visit calendar (/family/visits/).

/**
 * Every block occurrence on a calendar between two instants, for the family.
 * Admins also get each block's private note; Elevated users see the times only.
 */
create function public.family_block_times(p_calendar text, p_from timestamptz, p_to timestamptz)
returns table (block_id uuid, calendar text, starts_at timestamptz, ends_at timestamptz, note text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_family();
  return query
    select i.block_id, b.calendar, i.starts_at, i.ends_at, case when private.is_admin() then b.note end
    from private.block_intervals(p_calendar, p_from, p_to) i
    join public.blocks b on b.id = i.block_id
    order by i.starts_at;
end $$;
