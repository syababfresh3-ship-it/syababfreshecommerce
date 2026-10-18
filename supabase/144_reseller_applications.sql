-- 144: Permohonan borong dari LP /kurma/borong → resellers (status 'pending').
-- Additive & idempotent. Jalankan di Supabase SQL Editor. Kod toleran jika belum dijalankan:
-- ringkasan permohonan ditulis ke agreement_notes (fallback MISSING_COLUMN).
alter table public.resellers add column if not exists application jsonb;
alter table public.resellers add column if not exists source text;
comment on column public.resellers.application is 'Permohonan borong dari LP: {ref, business_name, business_type, name, phone, email, state, est_qty, est_unit, varieties[], notes, source_utm, submitted_at, history[]}';
comment on column public.resellers.source is 'lp-borong | admin | null (legasi)';
create index if not exists resellers_status_idx on public.resellers (status);
