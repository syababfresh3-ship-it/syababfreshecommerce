# Pelan: Ciri Inbox CRM (gaya Murpati) + Perkemas UI

> **Status: DIRANGKA, ditangguh.** Off-by-default untuk bahagian berisiko, selebihnya additive.
> Cetusan: inbox Murpati (internal notes, follow-up reminder, "need reply", lead status).
> Inbox kita sendiri (Cloud API) — semua boleh tambah tanpa pihak ketiga.

## Yang ko DAH ADA (tak perlu buat semula)
Filter nombor + "Sembang Saya", search conversations, tag/label dropdown, unread filter,
realtime, assign, notif bunyi, hantar gambar, Sales Pipeline (`crm_leads`).

## Prinsip
- **Additive** — guna semula `wa_contacts` / `wa_conversations` / `wa_messages` + panel contact sedia ada.
- **Selamat dulu** — nudge dalaman OK; auto-hantar WA ke customer = **off-by-default** (risiko ban, lihat polisi WA).
- **Reuse pipeline** — lead status sambung ke `crm_leads` sedia ada, bukan sistem baru.

---

## Ciri 1 — 📝 Internal notes (team-only)

**DB:**
```sql
-- Notes-log (penulis + masa) — lebih berguna dari satu medan
create table if not exists public.wa_notes (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references public.wa_contacts(id) on delete cascade,
  author uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
```
(MVP ringkas: boleh mula dengan `wa_contacts.notes text` sahaja, naik taraf ke jadual kemudian.)

**UI:** kotak nota dalam panel contact (kanan inbox). Senarai nota + author + masa. Admin sahaja.
**API:** `POST/GET /api/whatsapp/contacts/[id]/notes`.

## Ciri 2 — ⏰ Follow-up reminder (nudge dalaman)

**DB:**
```sql
create table if not exists public.wa_followups (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references public.wa_contacts(id) on delete cascade,
  conversation_id uuid references public.wa_conversations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null, -- siapa kena follow up
  remind_at timestamptz not null,
  note text,
  status text not null default 'pending',     -- pending | done | cancelled
  auto_send boolean not null default false,    -- OFF default (risiko ban)
  template_name text,                          -- hanya kalau auto_send (template rasmi)
  created_at timestamptz not null default now()
);
```

**Cron:** `/api/cron/followups` (cron-job.org, macam blast-drain) — cari reminder `remind_at <= now() & pending`:
- ✅ **Nudge dalaman** (default): tanda due → papar di senarai "Follow-up" + badge; optional email/WA ke **staf** (bukan customer).
- ⚠️ **auto_send=true** (opt-in): hantar template rasmi ke customer. **Off-by-default.**

**UI:** dalam panel contact — butang pantas **Esok / 3 hari / Minggu depan** + date-time + nota
(macam Murpati). Tambah view/filter **"Follow-up due (N)"** di inbox.

## Ciri 3 — 🔴 "Need reply" filter

**DB:** `alter table wa_conversations add column needs_reply boolean not null default false;`
- Webhook (mesej masuk) → `needs_reply = true`
- Send route (admin balas) → `needs_reply = false`
(Backfill sekali: set true di mana mesej terakhir = inbound.)

**UI:** pil **"Perlu balas (N)"** (merah, gaya Murpati) sebelah filter unread. Filter senarai +
count. Jimat masa, elak lead tertinggal.

## Ciri 4 — 🏷️ Lead status

**DB:** `alter table wa_contacts add column lead_status text;` (cth: New/Hot/Warm/Cold/Won/Lost)
- **Sambung pipeline:** sync dengan `crm_leads` (kalau contact ada lead, status ikut stage pipeline).
  Elak dua sumber kebenaran — inbox jadi shortcut ubah stage.

**UI:** dropdown status dalam panel contact (gaya Murpati "Set a status").

---

## Perkemas UI (panel contact kanan)
Susun semula panel contact ikut keutamaan (gaya Murpati):
1. Info contact (nama, no, total spend)
2. **Lead status** (dropdown)
3. **Tags** (sedia ada)
4. **Internal notes** (baru)
5. **Follow-up** (baru)
6. Tindakan: Buat Order / Pay Link (sedia ada)

Konsisten teks (tiada besar-kecil tak sekata), kemas mobile.

## Fasa cadangan
| Fasa | Skop | Risiko |
|---|---|---|
| **1** | "Need reply" filter + Internal notes (single field) | Rendah — terus ship |
| **2** | Follow-up reminder (nudge dalaman sahaja) + cron + view due | Rendah |
| **3** | Lead status (sync pipeline) + perkemas panel UI | Sederhana |
| **4** | Notes-log (jadual) + auto-send reminder (opt-in, template) | Auto-send = berisiko, off default |

## Yang TIDAK berubah
- Cloud API, webhook, multi-number, blast — tak tersentuh.
- Murpati / reply.la — tak terlibat.
- Pipeline `crm_leads` — diguna semula, bukan diganti.

## Kos
RM0 (Supabase + cron-job.org sedia ada). Tiada pihak ketiga.
