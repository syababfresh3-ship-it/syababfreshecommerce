# Pejabat AI — `/admin/pejabat`

Papan status staf AI SyababFresh: siapa tengah buat apa, siapa tidur, siapa menunggu OK. Laluan tersembunyi
(tiada butang sidebar), admin sahaja. Data dari `GET /api/admin/office`, segar setiap 15 saat.

## Staf (roster dalam `src/lib/office.ts`)

| Kunci | Nama | Peranan | Status datang dari |
|---|---|---|---|
| `hermes` | Hermes | Pembantu am (sesi Claude Code di akar folder Hermes) | hook Claude Code |
| `amaa-team` | Maya | Meta Ads | hook Claude Code (sesi dalam `Hermes/amaa-team`) |
| `waba-team` | Zara | WhatsApp blast | hook Claude Code |
| `lp-team` | Rayyan | Landing page | hook Claude Code |
| `tiktok-team` | Iman | Analisa video TikTok | hook Claude Code |
| `aina` | Aina | Sokongan pelanggan (chat bantuan web) | terbitan: `support_messages` |
| `nurul` | Nurul | Laporan & amaran (routine/cron) | cron `ops-alerts`, `hermes-stock-in`, `affiliate-credit` lapor sendiri; cron senyap → "Menunggu OK" |

Subagen yang dilancarkan sesebuah team muncul sebagai meja tambahan dengan kunci `<team>--<nama-agen>` (contoh
`waba-team--waba-auditor`) semasa ia berjalan.

## Hook Claude Code (folder `/Users/anas./Hermes`)

`Hermes/.claude/settings.json` memasang hook `SessionStart`, `UserPromptSubmit`, `Stop`, `SubagentStart`, `SubagentStop`,
`SessionEnd` → `alat/office-status.sh` → `alat/office-status.mjs` (node, latar, tanpa output). Team ditentukan dari `cwd` sesi
(folder pertama di bawah Hermes; akar = `hermes`). Arahan dipotong 160 aksara sebagai `task`; `Stop` hantar "Siap: …".
Token: `OFFICE_STATUS_TOKEN` dalam `Hermes/.env.local` (nilai sama dengan `CRON_SECRET`; boleh tukar ke `OFFICE_STATUS_KEY`
berasingan di Vercel). Sesi yang sudah terbuka perlu dimulakan semula (atau buka `/hooks`) untuk memuatkan hook.

## Lapor status dari luar

```
curl -s -X POST https://shop.syababfresh.my/api/office/status \
  -H "Authorization: Bearer $CRON_SECRET" -H 'content-type: application/json' \
  -d '{"agent":"mira","state":"working","task":"Eksport laporan ops"}'
```

- `state`: `working` · `idle` · `waiting` (perlu keputusan bos) · `offline`
- `task` ≤ 200 aksara. `name`/`role`/`meta` pilihan (`meta.where` dipapar sebagai lokasi).
- Laporan `working` yang tidak dikemas kini melebihi 30 minit dipapar sebagai tamat.
- Token: `CRON_SECRET` Vercel, atau `OFFICE_STATUS_KEY` jika mahu kunci berasingan untuk VPS.

Contoh pembungkus dalam skrip Hermes (`~/.hermes/tools/*.js`): panggil `working` di awal, `idle` di `finally`.

## Panel sisi

- Barisan pelanggan: `wa_conversations.needs_reply = true`.
- Menunggu kelulusan: COD pesanan pertama ahli, COD LP, pengeluaran & permohonan affiliate, refund belum selesai.
- Tugasan berjadual: `cron_heartbeats` (senyap = > 3× selang jangkaan).
- Talian WhatsApp: sesi gateway (`/v1/sessions`).

## Migration

`supabase/168_ai_agent_status.sql` — jadual `ai_agent_status`. Tanpa migration, page tetap buka (Aina & Nurul dari
data sedia ada); agen luar hanya boleh lapor selepas migration dijalankan.

## Belum ada (fasa seterusnya)

Mengarah agen dari page ini ("Hana agihkan kerja"), hook Claude Code untuk Ahmad, log sejarah tugasan.
