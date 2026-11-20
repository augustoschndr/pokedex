# Pokedex ingest contract

Hand this to BALTHA. The app is single-user. Content is read-only in the UI except to-do ticks and decision answers. All copy the phone shows is English.

Base URL in production: `https://pokedex.folderr.co`

Send `Authorization: Bearer <INGEST_TOKEN>` and `Content-Type: application/json`. The token is compared in constant time and is never logged. A bad token is `401`. A body that fails validation is `400` with `issues[]` of `{ path, message }`. More than 10 ingest calls in 10 minutes from one IP is `429`.

Canonical paths are versioned so a later MCP server can wrap them without a second data model:

- `POST /api/v1/ingest`
- `GET /api/v1/decisions/answers?since=<ISO-8601>`

The same handlers also live at `/api/ingest` and `/api/decisions/answers`.

## When to post

| Kind | `type` | When |
| --- | --- | --- |
| Daily brief | `daily` | Weekdays 08:00 America/Sao_Paulo |
| Weekly plan | `weekly` | Friday 16:00 America/Sao_Paulo |
| Anything else | `ad_hoc` | Whenever |

The app does not run that clock. BALTHA does, and posts the result. Each successful post sends a Web Push to Augusto's phones. The response is `{ "ok": true, "brief_id": "<id>", "pushed": <n> }`.

## Idempotency

`id` is the stable brief id. Posting the same id again updates that brief.

Omitted sections are left as they are. Sending a section replaces that section.

- `today` inserts a new current lesson and keeps the previous one as history.
- `week.items` replaces the current shot list. An empty array clears it. `week.intro` replaces the intro.
- `todos.items` upserts by `id`. Text and meta update. `done` is kept unless `force_status: true` is sent with a boolean `done`. An item included in the list is active again. `archived: true` hides one item. An empty `items` array archives every current to-do.
- `study` replaces only the study blocks. `reels_rules` replaces only the Reels rules blocks. They do not clear each other. An empty `blocks` array clears that group.
- `decisions` create or, while still `pending`, update title and detail. An answered decision is left untouched. Post a new `id` for a follow-up. Decisions are never deleted by ingest.

Ids are strings of letters, numbers, and `.` `_` `:` `-`, up to 200 characters.

## Schema

```json
{
  "id": "brief-2026-11-23",
  "type": "daily",
  "timezone": "America/Sao_Paulo",
  "for_date": "2026-11-23",
  "title": "Monday brief",
  "push": { "title": "Today's lesson is ready", "body": "Short notification body." },
  "today": {
    "date_label": "Monday, Nov 23, 2026",
    "for_date": "2026-11-23",
    "lesson": "What to film",
    "where_it_goes": "Where it publishes",
    "pillar": "Which pillar",
    "body": "Longer notes",
    "hook": "The first line",
    "talking_points": ["Point"],
    "whiteboard": {
      "caption": "Optional",
      "nodes": [{ "id": "a", "label": "Label", "detail": "Optional", "kind": "box" }],
      "edges": [{ "from": "a", "to": "b", "label": "Optional" }]
    },
    "cta": "One close"
  },
  "week": {
    "intro": "Optional",
    "items": [{
      "id": "2026-11-23-origin",
      "lead": "Mon 23",
      "title": "Shot",
      "detail": "Optional",
      "meta": "Optional",
      "status": { "label": "Film", "tone": "warning" }
    }]
  },
  "todos": {
    "intro": "Optional",
    "items": [{ "id": "cf-cal", "text": "Do the thing", "meta": "Optional", "done": false, "force_status": false, "archived": false }]
  },
  "study": { "intro": "Optional", "blocks": [] },
  "reels_rules": { "intro": "Optional", "blocks": [] },
  "decisions": [{ "id": "dec-us-pricing-2026-11", "title": "Decide", "detail": "Optional" }]
}
```

`timezone` defaults to `America/Sao_Paulo`. `type` is `daily`, `weekly`, or `ad_hoc`. `for_date` is `YYYY-MM-DD` when present. Status `tone` is `default`, `warning`, `success`, or `info`.

The phone does not treat `date_label` as the current day. It uses the real date in the server timezone. When `for_date` is still in the future, Today is a prep day and counts down to that date. Week rows are grouped by the `YYYY-MM-DD` prefix on each item id. Days with no item stay empty. No new ingest fields are required.

Study blocks:

| `kind` | Fields |
| --- | --- |
| `text` | `heading`, `text`, optional `lead` |
| `callout` | same |
| `equation` | `equation`, optional `text` |
| `steps` | `steps[]` of `{ title, detail }` |
| `diagram` | `diagram` with the same `nodes` / `edges` shape as the whiteboard |
| `rows` | `rows[]` of `{ lead, title, detail }` |
| `list` | `items` of strings |

Node `kind` of `terminal` is drawn as a filled box. Anything else is an outline. Unknown JSON fields are ignored.

A full example lives in [example-payload.json](example-payload.json).

`push` is optional. If it is missing, the notification title falls back to `title` or `Pokedex`, and the body to `A new brief is ready`. The notification opens Decisions when the post includes decisions, otherwise Today, This week, Only you, or Study.

## Answers

Augusto answers on the phone. BALTHA reads them back:

```http
GET /api/v1/decisions/answers?since=2026-11-20T00:00:00-03:00
Authorization: Bearer <INGEST_TOKEN>
```

`since` is optional. Results are oldest first, up to `limit` (default 100, max 200).

```json
{
  "answers": [
    {
      "id": "dec-us-pricing-2026-11",
      "title": "Decide US website pricing",
      "action": "approved",
      "comment": "Keep US$5k–10k and sell Portal as founding-client early access.",
      "answered_at": "2026-11-20T10:15:00-03:00"
    }
  ]
}
```

`action` is `approved`, `rejected`, or `commented`. An answer stays in the list for any `since` before `answered_at`. The first time it is returned, `notified_back_at` is set. That does not hide it.

If `DECISIONS_WEBHOOK_URL` is set, each answer is also POSTed as that same object (not wrapped in `answers`). Header:

```http
X-Pokedex-Signature: sha256=<hex HMAC-SHA256 of the raw body>
```

The HMAC key is `DECISIONS_WEBHOOK_SECRET`, or `INGEST_TOKEN` when the secret is unset. Failures retry three times and never block the phone. The GET endpoint remains the source of truth. `DECISION_WEBHOOK_URL` is accepted as an alias of the URL.

## Phase 2

Every row is scoped by `user_id`. API tokens live in `api_token` as scrypt hashes, with a prefix and scopes `ingest:write` and `decisions:read`. The env token is the primary token for Augusto. A later public version can mint more users and tokens and wrap `/api/v1` with an MCP server. v1 does not expose that UI.
