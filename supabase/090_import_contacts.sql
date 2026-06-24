-- ============================================================
-- 090_import_contacts.sql
-- Import senarai kontak (CSV) ke wa_contacts + tag sumber.
-- Upsert ikut wa_id: contact baru dicipta; sedia ada → MERGE tag (tak tindih),
-- kekal nama asal kalau ada. Atomik + pantas (satu panggilan per batch).
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

create or replace function public.import_wa_contacts(p_rows jsonb, p_tag text)
returns integer language plpgsql as $$
declare
  v_count integer := 0;
begin
  insert into public.wa_contacts (wa_id, name, tags)
  select
    r->>'wa_id',
    nullif(r->>'name', ''),
    case when coalesce(p_tag, '') <> '' then array[p_tag] else '{}'::text[] end
  from jsonb_array_elements(p_rows) as r
  where coalesce(r->>'wa_id', '') <> ''
  on conflict (wa_id) do update
    set name = coalesce(public.wa_contacts.name, excluded.name),
        tags = (select array(select distinct unnest(public.wa_contacts.tags || excluded.tags))),
        updated_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
