-- 163: Laporan harian → grup WhatsApp (Hijau, gateway sendiri) melalui wa_outbox.
--
-- Tugasan berjadual Claude ("Laporan Harian CEO", 7:28 pagi) hanya ada connector Supabase (SQL) — tiada alat HTTP.
-- Jadi ia panggil SATU fungsi ini dengan teks laporan; fungsi masukkan baris ke wa_outbox dengan penerima = JID grup
-- yang ditetapkan admin (app_settings 'wa_report_group_jid'). Drainer wa_outbox (cron-job.org ~5 min) hantar via gateway.
-- Tugasan itu TIDAK perlu tahu JID dan TIDAK boleh hantar ke penerima lain — penerima dikunci di sini.
--
-- Guna (dari tugasan Claude / SQL):  select public.queue_wa_report('*SYABAB — Sabtu 21 Nov*' || E'\n' || '...');
-- Set grup sekali:                   insert into app_settings(key,value) values ('wa_report_group_jid','1203630xxxxxxxxx@g.us')
--                                    on conflict (key) do update set value = excluded.value;

create or replace function public.queue_wa_report(p_message text, p_source text default 'report')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jid text;
  v_id  uuid;
begin
  if p_message is null or length(btrim(p_message)) < 10 then
    raise exception 'queue_wa_report: mesej kosong / terlalu pendek';
  end if;
  if length(p_message) > 20000 then
    raise exception 'queue_wa_report: mesej melebihi 20000 aksara';
  end if;

  select value into v_jid from public.app_settings where key = 'wa_report_group_jid';
  if v_jid is null or v_jid !~ '^[0-9-]+@g\.us$' then
    raise exception 'queue_wa_report: app_settings.wa_report_group_jid belum diset (format 1234567890@g.us)';
  end if;

  -- Elak pendua: laporan sama (sumber sama) dalam 20 minit terakhir tidak dimasukkan dua kali
  select id into v_id from public.wa_outbox
   where source = coalesce(p_source, 'report') and phone = v_jid and message = p_message
     and created_at > now() - interval '20 minutes'
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.wa_outbox (phone, message, source, scheduled_at)
  values (v_jid, p_message, coalesce(p_source, 'report'), now())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.queue_wa_report(text, text) from public, anon;
grant execute on function public.queue_wa_report(text, text) to authenticated, service_role;

comment on function public.queue_wa_report(text, text) is
  'Beratur laporan ke grup WhatsApp (JID dari app_settings.wa_report_group_jid) melalui wa_outbox. Dipanggil tugasan berjadual Claude.';
