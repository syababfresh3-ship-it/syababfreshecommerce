---
name: murpati-whatsapp
description: Use this skill when the user wants to interact with their Murpati WhatsApp account via the Murpati REST API. Tasks include extracting conversation history from individual chats or groups, sending messages or media to phone numbers or groups, listing WhatsApp sessions, connecting a new WhatsApp device programmatically by generating a QR code, resolving a group by its human-readable name, and building scheduled WhatsApp automations (daily summaries, weekly reports, after-hours autoresponders). Requires a Murpati Pro or Max tier account with an API key issued from the Settings > API Keys tab at https://murpati.com/settings.
---

# Murpati WhatsApp API

## When to invoke this skill

Invoke when the user asks you to:
- Read, pull, extract, or summarize WhatsApp messages from their account
- Send a message, report, or media file to a WhatsApp contact or group
- Build a scheduled task that reads from or writes to WhatsApp (daily digest, weekly report, reminder blasts)
- Answer questions like *"what did my team say in the Marketing group today?"* or *"send Friday's summary to my Sales Q4 group"*
- Set up a cron or scheduled agent that operates on WhatsApp data

Also invoke if the user mentions **Murpati**, references their **Murpati session or device**, or pastes a Murpati API key (format `sk_` followed by 64 hex characters) or session ID (format `sess_` followed by 32 hex characters).

## Prerequisites (collect before first call)

Before making any API request, confirm the user has:

1. **Murpati Pro or Max subscription.** Free and Basic tiers cannot access the API. Any request will be rejected with `403 API access requires Pro or Max subscription`. Direct the user to https://murpati.com/subscription if they need to upgrade.
2. **A valid API key.** Format: `sk_` followed by 64 hexadecimal characters (67 chars total). The user creates one at https://murpati.com/settings under the "API Keys" tab. The key is displayed exactly once at creation. If they have lost it, they need to generate a new one.
3. **A connected WhatsApp session.** The `session_id` is a string like `sess_08f47f6e1b8b089fd831403bf3e01bd3`, visible on the Devices page at https://murpati.com/devices. The WhatsApp phone must be in "connected" status. If the user has no session yet, you can create one programmatically with `POST /v1/sessions` (see below) — they will still need to scan the returned QR code with WhatsApp on their phone within 30 seconds.

Never proceed without all three. Ask the user directly; don't guess or invent values.

## Per-endpoint permissions

API keys carry granular permissions. The dashboard issues new keys with every permission enabled by default, but older keys may be missing newer scopes:

| Endpoint | Permission |
|----------|-----------|
| `POST /v1/sessions` | `sessions:create` |
| `GET /v1/sessions`, `GET /v1/sessions/{id}/status` | `sessions:read` |
| `POST /v1/sessions/{id}/reconnect` | `sessions:reconnect` |
| `POST /v1/messages/send` | `messages:send` |
| `POST /v1/messages/send-media` | `messages:send-media` |
| `GET /v1/messages`, `GET /v1/chats` | `messages:read` |

A `403 API key lacks permission: <name>` response means the key was issued before that scope existed. Tell the user to re-issue the key in the dashboard; existing keys cannot be retroactively upgraded.

## Base URL

```
https://api.murpati.com
```

All endpoints live under `/v1`.

## Authentication

Every request must include the API key as a header. Never put it in the URL.

```
X-API-Key: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

**Security rules:**
- Treat the API key as a password. Never log it, echo it back to the user in full, or paste it into third-party tools. If the user shares it with you in chat, confirm they have received your response and suggest they rotate it.
- If the user asks you to hardcode the key into a script, write the script to read it from an environment variable instead (`MURPATI_API_KEY`).

## Endpoint reference

### `GET /v1/sessions`
List the user's connected WhatsApp sessions.

**Response** (truncated):
```json
{
  "success": true,
  "sessions": [
    {
      "session_id": "sess_08f47f6e1b8b089fd831403bf3e01bd3",
      "phone_number": "60123456789",
      "device_name": "CEO Phone",
      "status": "connected",
      "is_business": false,
      "push_name": "Ahmad"
    }
  ]
}
```

Use this endpoint if the user doesn't know their session ID, or if you need to verify a session is still connected before reading or writing.

---

### `POST /v1/sessions`
Connect a new WhatsApp device programmatically. Returns a QR code that the user must scan with WhatsApp on their phone within 30 seconds.

**Body:**
```json
{ "device_name": "Sales Phone" }
```

`device_name` is a friendly label, max 100 chars. Not unique — pick whatever the user will recognise in the dashboard.

**Response:**
```json
{
  "success": true,
  "session_id": "sess_08f47f6e1b8b089fd831403bf3e01bd3",
  "device_name": "Sales Phone",
  "status": "pending",
  "qr_code_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_code_text": "2@AbCdEf...,Q2hAhP1...,bF2vJg==",
  "expires_at": "2026-05-12T15:00:30Z"
}
```

**How to present the QR to the user:**
- Save `qr_code_base64` to a PNG file and tell the user the path. Decode with `base64 -d` (CLI) or `base64.b64decode()` (Python).
- Or, if your runtime can render images directly (some terminal agents can), display it inline.
- Or, take `qr_code_text` and feed it into a QR encoder of your choice for a custom render.

**After the QR is shown, poll `/v1/sessions/{session_id}/status` every 2 seconds.** Stop when `status` becomes `connected` (success), `expired` (QR timed out, call `POST /v1/sessions` again), or after 30 seconds have elapsed.

**Device limits apply:** Pro accounts can have up to 3 connected devices total, Max accounts up to 10. Hitting the limit returns `403 Device limit reached (X/Y)`. The user can purchase device add-ons in the dashboard.

**Requires the `sessions:create` permission.** API keys issued before May 2026 do not have it — the user must re-issue their key.

---

### `GET /v1/sessions/{session_id}/status`
Check the state of a specific session.

Works for both pending sessions (just created, awaiting QR scan) and fully-paired ones. The response shape depends on the state.

**While pending** (status field plus expires_at):
```json
{ "success": true, "session_id": "sess_xxx", "status": "pending", "expires_at": "2026-05-12T15:00:30Z" }
```

**Once connected** (full device record):
```json
{
  "success": true,
  "session_id": "sess_xxx",
  "phone_number": "60123456789",
  "device_name": "Sales Phone",
  "status": "connected",
  "is_business": false,
  "push_name": "Ahmad"
}
```

Possible status values: `pending` (waiting for scan), `connected` (paired and online), `expired` (QR timed out — create a new session), `disconnected` (was connected but lost the socket; usually auto-reconnects within a minute).

Useful before scheduled jobs. Abort early if `status != "connected"`.

---

### `POST /v1/sessions/{session_id}/reconnect`
Kick a previously-paired session back online after it has dropped. Use this when `GET /v1/sessions/{id}/status` returned `disconnected` and you want to recover immediately instead of waiting for auto-reconnect.

**No request body.**

**Response:**
```json
{ "success": true, "session_id": "sess_xxx", "status": "reconnecting" }
```

`status` is one of:
- `reconnecting` — the WhatsApp socket has been re-established. Follow up with `GET /v1/sessions/{id}/status` a few seconds later to confirm `connected`.
- `already_connected` — session was already online. Nothing to do; safe to treat as success.

**The call is idempotent.** Calling it on an already-connected session does not return an error — that's the `already_connected` status. You can safely call it before any send-message operation as a "warm-up" without first checking status.

**This call can block for up to 30 seconds** while the WhatsApp socket re-handshakes. Set your HTTP client timeout to **35 seconds or more** — anything shorter risks aborting a successful reconnect mid-flight.

**Only works for paired sessions.** If the device was never paired (or the user revoked it from WhatsApp on their phone), reconnect will fail. Use `POST /v1/sessions` for that case to get a fresh QR.

**Requires the `sessions:reconnect` permission.** API keys issued before May 2026 do not have it — the user must re-issue their key.

---

### `GET /v1/chats`
List chats (DMs and groups) available in a session, with human-readable names.

**Query params:**
- `session_id` (required)
- `type`: `dm` | `group` | `all` (default `all`)
- `limit`: default 100, max 1000
- `offset`: default 0

**Response:**
```json
{
  "success": true,
  "chats": [
    {
      "chat_jid": "60123456789@s.whatsapp.net",
      "chat_type": "dm",
      "name": "Ahmad Rahman",
      "phone_number": "60123456789",
      "last_message_at": "2026-04-23T14:22:10Z",
      "message_count": 87
    },
    {
      "chat_jid": "199458365145171@lid",
      "chat_type": "dm",
      "name": "Faiz",
      "phone_number": "60126457517",
      "last_message_at": "2026-04-23T06:13:40Z",
      "message_count": 13
    },
    {
      "chat_jid": "12345678-1234567890@g.us",
      "chat_type": "group",
      "name": "Marketing Team Q2",
      "phone_number": null,
      "last_message_at": "2026-04-23T15:01:03Z",
      "message_count": 412
    }
  ],
  "total_count": 264,
  "has_more": true
}
```

**Field notes:**
- `chat_jid`: always use this value to call `/v1/messages`. Don't substitute it with the phone number; the messages are indexed by the raw JID (which may be `@lid`, not `@s.whatsapp.net`).
- `phone_number`: human-readable E.164-ish digits (e.g. `60126457517`). `null` for groups, occasionally `null` for very new `@lid` contacts whose mapping hasn't synced yet.
- `name`: best-effort display name. Tries (in order): chat name from WhatsApp → saved contact name (first_name / full_name / push_name / business_name) → phone number → raw JID. When reporting to the user, always refer to chats by `name`, never by `chat_jid`.

**Critical workflow pattern:** users know their chats by name ("Marketing Team Q2"), not by JID. Always call `/v1/chats` first to resolve `name` → `chat_jid`, then use the JID in subsequent calls. Cache this mapping in memory during the session; don't re-fetch on every call.

**`last_message_at` may be `null`** when the chat exists (user is a member) but no messages have arrived yet. For example, a group the user was just added to. The chat is still returned so the user can see they are a member. Sort null-valued chats to the bottom of any chronological list.

---

### `GET /v1/messages`
Read messages from a specific chat, optionally filtered by date range.

**Query params:**
- `session_id` (required)
- `chat_jid` (required): full JID string from `/v1/chats`
- `from`: inclusive lower bound. RFC3339 (`2026-04-23T00:00:00Z`) or Unix epoch **seconds**. Never send milliseconds; they will be rejected.
- `to`: exclusive upper bound, same formats
- `limit`: default 100, max 1000
- `offset`: default 0

**Response** (one DM, one media message):
```json
{
  "success": true,
  "session_id": "sess_xxx",
  "chat_jid": "60123@s.whatsapp.net",
  "messages": [
    {
      "message_id": "ABC123",
      "timestamp": "2026-04-23T18:05:12Z",
      "sender_jid": "60123@s.whatsapp.net",
      "is_from_me": false,
      "message_type": "text",
      "content": "Hi, nak order"
    },
    {
      "message_id": "DEF456",
      "timestamp": "2026-04-23T18:07:03Z",
      "is_from_me": true,
      "message_type": "image",
      "content": "caption here",
      "media_url": "https://api.murpati.com/api/media/sess_xxx/DEF456?expires=1745432400&sig=...",
      "media_expires_at": "2026-04-23T19:00:00Z"
    }
  ],
  "count": 2,
  "has_more": false
}
```

Messages are returned in **chronological order** (oldest first), which is the natural order for summarization or LLM context.

**`is_from_me: true`** means the user's own account sent the message. This is crucial context when summarizing. Don't attribute the user's outgoing replies to their contacts.

**Media URLs expire after 1 hour.** If you need to re-access the media later, re-call `/v1/messages` to get a fresh signed URL.

---

### `POST /v1/messages/send`
Send a text message to a DM or group.

**Body:**
```json
{
  "session_id": "sess_xxx",
  "to": "12345678-1234567890@g.us",
  "message": "Weekly report attached below."
}
```

The `to` field accepts any of:
- Plain phone number: `"60123456789"`. Auto-routes to `@s.whatsapp.net`.
- DM JID: `"60123456789@s.whatsapp.net"`.
- Group JID: `"12345678-1234567890@g.us"`. The user's account must already be a member of the group.

**Response:**
```json
{ "success": true, "message_id": "3EB0A1B2C3D4E5F6", "timestamp": "2026-04-23T12:30:00Z" }
```

---

### `POST /v1/messages/send-media`
Send an image, video, document, or audio file.

**Body (one of `media_url` or `media_base64` is required):**
```json
{
  "session_id": "sess_xxx",
  "to": "12345678-1234567890@g.us",
  "media_url": "https://example.com/report.pdf",
  "caption": "Q4 summary attached"
}
```

**Supported media types:** JPEG, PNG, GIF, WebP (images); MP4, 3GP (video); OGG Opus, MP3, M4A (audio); PDF, DOCX, XLSX (documents). Only HTTPS URLs are accepted. Max 16 MB.

## Rate limits

Per API key:
- **Pro**: 500 requests per hour
- **Max**: 5,000 requests per hour

All endpoints share a single bucket. A `429 Rate limit exceeded` response means the user has burned their hourly quota. Advise them to space out requests (for example with scheduled batching) or upgrade to Max.

## Error codes

| Status | Meaning | What to do |
|--------|---------|-----------|
| 400 | Bad request (malformed params) | Read the error body; fix the offending param |
| 401 | Missing or invalid API key | Confirm the user's key, or help them issue a new one |
| 403 | Wrong tier, missing permission, or session not owned by this user | Check subscription tier, or confirm they own the session_id |
| 404 | Session or resource not found | Verify IDs |
| 429 | Rate limit hit | Back off, retry next hour, or upgrade to Max |
| 500+ | Server error | Retry with exponential backoff (start 2s, cap 30s) |

All error responses are JSON of the shape `{"success": false, "error": "human-readable reason"}`.

## Do's and don'ts

**DO**
- Resolve group names → JIDs via `/v1/chats` once per session, then cache.
- Time-bound `/v1/messages` queries with `from` and `to`. Unbounded queries over huge chats are slow and wasteful of your rate quota.
- Remind the LLM to respect chronological order when summarizing. Messages already arrive oldest-first, but explicit instruction helps.
- For scheduled jobs, log `session_id`, call count, and elapsed time so the user can audit their usage against the hourly limit.
- Treat `media_url` as a short-lived secret. Don't persist it past its `media_expires_at`.
- Gracefully handle `status != "connected"` by aborting the job and notifying the user.

**DON'T**
- Hardcode JIDs in code. They're stable but look ugly and break when a user switches WhatsApp accounts. Always look them up by `name`.
- Assume a group named "Marketing" is unique. If `/v1/chats` returns multiple groups matching a partial name, ask the user to confirm which one.
- Spam the API. A scheduled job hitting `/v1/messages` every second is going to hit 429 in minutes on Pro tier.
- Log or echo the full API key. Strip to first 12 chars + `...` if you need to reference it in output.
- Try to send media via raw binary POST body. Use `media_url` (HTTPS) or `media_base64` in the JSON body.
- Use `/v1/messages` as a search engine. It filters by chat and date range, not by content. For "find all messages mentioning X", fetch a bounded range and let the LLM filter.

## Common workflow recipes

### Recipe 1: Daily 6pm extractor ("what happened in the Marketing group today?")

1. Resolve `chat_jid` for the group by name:
   ```
   GET /v1/chats?session_id=sess_xxx&type=group
   ```
   Find the chat whose `name` matches (case-insensitive substring is a reasonable heuristic; confirm with the user if ambiguous).

2. Fetch today's messages:
   ```
   GET /v1/messages?session_id=sess_xxx&chat_jid=<from step 1>&from=<today 00:00:00 UTC>&to=<tomorrow 00:00:00 UTC>
   ```

3. Feed the `messages[]` array to the LLM with a summarization prompt. Mark `is_from_me: true` as "the user said" and `is_from_me: false` as "<sender_jid> said".

### Recipe 2: Friday 5pm weekly-report push

1. Gather: for each relevant chat, call `/v1/messages` with `from = last_monday_00:00:00Z`, `to = this_friday_17:00:00Z`.
2. Summarize all messages into a report (plain text, under 3,000 chars for best WhatsApp rendering).
3. Resolve the target report group's JID via `/v1/chats`.
4. Send:
   ```
   POST /v1/messages/send
   { "session_id": "sess_xxx", "to": "<group JID>", "message": "<report>" }
   ```

### Recipe 3: Connect a new WhatsApp device programmatically

1. Call `POST /v1/sessions` with a friendly `device_name`:
   ```
   POST /v1/sessions
   { "device_name": "Sales Phone" }
   ```

2. Save `qr_code_base64` to a file the user can open (or render `qr_code_text` directly if your environment supports it):
   ```python
   import base64
   with open('pairing.png', 'wb') as f:
       f.write(base64.b64decode(res['qr_code_base64']))
   ```
   Tell the user to open the file and scan it with **WhatsApp → Settings → Linked Devices → Link a Device** on their phone, **within 30 seconds**.

3. Poll status every 2 seconds until `connected`, `expired`, or 30 seconds elapse:
   ```
   GET /v1/sessions/{session_id}/status
   ```

4. On `connected`: the response now includes `phone_number` and the session is ready for any other endpoint.
   On `expired`: tell the user the QR timed out and offer to retry by calling `POST /v1/sessions` again.

### Recipe 4: Session health check before a scheduled job

```
GET /v1/sessions/{session_id}/status
```
If `status != "connected"`, abort, log, and notify the user via a fallback channel (email, Slack). Don't queue up a backlog. The user likely needs to re-scan QR.

## Useful context when responding

- Phone numbers are typically Malaysian (country code 60) since Murpati is Malaysia-focused, but the API supports any country.
- Group JIDs contain a `-` and end in `@g.us`. DM JIDs end in either `@s.whatsapp.net` (legacy) or `@lid` (WhatsApp's Hidden User format, common for newer contacts). Both are valid for `chat_jid`. Don't try to parse the numeric parts; they are opaque WhatsApp identifiers.
- Timestamps in responses are RFC3339 UTC. Convert to the user's local timezone for display.
- The API is stateless. There is no conversation context, cursor, or session cookie. Every call is independent.

## When something goes wrong

If a request fails unexpectedly, the triage order is:
1. Is the session still connected? (`GET /v1/sessions/{id}/status`)
2. Is the API key still valid and on a paid tier?
3. Was a rate limit hit? (Check for 429; wait and retry.)
4. Is WhatsApp itself down? (Rare but possible. Check https://downdetector.com/status/whatsapp.)
5. Escalate to Murpati support: support@murpati.com with the session ID and the timestamp of the failure.
