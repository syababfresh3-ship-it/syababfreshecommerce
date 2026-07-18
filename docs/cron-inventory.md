# Inventori Cron — semua automation berjadual

9 cron, semua Bearer `CRON_SECRET`. Hanya 2 dijadual Vercel (had Hobby);
7 lagi bergantung **cron-job.org** (akaun luar — TIADA dalam repo, senarai ini
satu-satunya rekod). Setiap cron stamp `cron_heartbeats` (109) bila siap;
dashboard admin papar **"CRON SENYAP"** bila stamp lewat > 3× selang jangkaan.

| Job | Endpoint | Fungsi | Jadual | Penjadual |
|---|---|---|---|---|
| abandoned-cart | `/api/cron/abandoned-cart` | Push reminder troli ditinggal 2j | 09:00 harian | **Vercel** |
| reconcile-payments | `/api/cron/reconcile-payments` | Safety net bayaran CHIP terlepas | 01:00 harian | **Vercel** |
| auto-followup | `/api/cron/auto-followup` | Nudge WA chat senyap belum beli | tiap 30 min | cron-job.org |
| blast-drain | `/api/cron/blast-drain` | Drain campaign WA Blast (ReplyLa) | tiap ~15 min | cron-job.org |
| wa-outbox-drain | `/api/cron/wa-outbox-drain` | Drain queue WA outbox (12/tick) | tiap ~15 min | cron-job.org |
| auto-deliver | `/api/cron/auto-deliver` | delivering→delivered lepas N hari + kredit loyalty/referral/affiliate | harian | cron-job.org |
| external-sync | `/api/cron/external-sync` | Sync pembeli TikTok dari ops app → contacts | harian (03:00) | cron-job.org |
| payment-reminder | `/api/cron/payment-reminder` | Email order FPX belum bayar 1-24j | tiap ~2 jam | cron-job.org |
| refresh-customers | `/api/cron/refresh-customers` | Kira semula agregat customer (spend/recency) | harian, lepas 01:00 | cron-job.org |

## Bila dashboard tunjuk "CRON SENYAP"

1. Log masuk **cron-job.org** → semak job tu: disabled? failing? (History)
2. Kalau 401 dalam history → `CRON_SECRET` di header tak padan dengan Vercel env.
3. Kalau job hilang → cipta semula: GET endpoint di atas + header `Authorization: Bearer <CRON_SECRET>`.
4. Log server: Vercel → project → Logs, tapis path `/api/cron/...`.

## Nota selang jangkaan

Selang jangkaan disimpan dalam `cron_heartbeats.expected_minutes` (seed di
migration 109). Kalau ubah jadual di cron-job.org, kemas kini nilai ni terus
di DB supaya alert tak salah bunyi:

```sql
update cron_heartbeats set expected_minutes = 60 where job = 'auto-followup';
```
