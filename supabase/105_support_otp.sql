-- 105: OTP pengesahan untuk endpoint Bantuan/Support.
-- Sebelum ni: masuk telefon je → dapat PII customer. Sekarang: kena sahkan OTP
-- (dihantar via WhatsApp ke nombor tu) dulu. Tutup lubang enumerasi + impersonation.
-- Akses: service-role sahaja (RLS deny-all).

create table if not exists support_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,              -- normalized 60xxxxxxxxx
  code_hash text not null,          -- HMAC-SHA256 kod 6-digit (terikat pada phone)
  expires_at timestamptz not null,  -- 5 minit dari jana
  attempts int not null default 0,  -- cubaan sahkan (max 5)
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_otps_phone_idx on support_otps (phone, created_at desc);

alter table support_otps enable row level security;
