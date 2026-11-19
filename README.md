# Pokedex

Augusto's pocket assistant. An installable iPhone PWA for the physical side of the work: the lesson to film, the week's shot list, owner-only to-dos, study notes (including Reels rules), and decisions waiting on him.

BALTHA posts content. Augusto reads it on his phone, ticks physical to-dos, and answers decisions. The phone cannot edit briefs. There is no analytics, no third-party push service, and no font or script loaded from a CDN at runtime.

Designed first for an iPhone SE (2nd generation): 375×667 CSS pixels, home button, Touch ID. Safe-area insets are still honored for notched phones. Sign-in is a passkey. The copy says Touch ID, which is the sensor on that phone.

## Stack

SvelteKit (Node adapter), SQLite via `better-sqlite3`, WebAuthn via SimpleWebAuthn, Web Push via `web-push` with self-hosted VAPID keys, Zod for the ingest schema. One container. The database file lives on a `/data` volume.

## Run locally

```bash
cp .env.example .env
# fill INGEST_TOKEN, SESSION_SECRET, and the VAPID keys from:
npm run vapid
npm install
npm run build
npm start
```

`npm start` loads `.env` when the file exists (Node `--env-file-if-exists`). For a quick UI pass, set `SEED_DEMO=1` and the sample brief is loaded the first time the database is empty.

Open the origin from `.env` (use `http://localhost:3000` and `WEBAUTHN_RP_ID=localhost` on your machine). The server prints one line:

```text
POKEDEX_SETUP_CODE=ABCD-EFGH
```

That code is stored only as a scrypt hash, expires in 24 hours, and works once. Enter it, create a passkey with Touch ID, then add Pokedex to the Home Screen. Notifications on iOS work only from the Home Screen app, on iOS 16.4 or newer.

If the code scrolls off the logs, set `SETUP_CODE` and restart while no passkey exists, or run:

```bash
DATABASE_PATH=/data/pokedex.db npm run issue-setup-code
```

Inside the container that is `node scripts/issue-setup-code.mjs`. This is the only recovery path. There is no email reset.

## Docker

```bash
docker build -t pokedex .
docker run --rm -p 3000:3000 \
  -v pokedex-data:/data \
  -e ORIGIN=https://pokedex.folderr.co \
  -e DATABASE_PATH=/data/pokedex.db \
  -e INGEST_TOKEN=... \
  -e SESSION_SECRET=... \
  -e VAPID_PUBLIC_KEY=... \
  -e VAPID_PRIVATE_KEY=... \
  -e VAPID_SUBJECT=mailto:augusto@folderr.co \
  -e WEBAUTHN_RP_ID=pokedex.folderr.co \
  -e TZ=America/Sao_Paulo \
  pokedex
```

The process listens on `PORT` (default 3000). `GET /api/health` returns `{ "ok": true, "version": "1.0.0" }` with no auth. The image drops to a non-root user after making `/data` writable.

Coolify, when you are ready to create the application (this repo does not create it):

- Project Agency OS, production, destination agency-core on folderrVPS
- Dockerfile build, port 3000, domain `https://pokedex.folderr.co`
- Persistent volume mounted at `/data`
- Health check `GET /api/health`
- The env vars from `.env.example`

DNS, added by hand in Cloudflare, DNS only (grey cloud) so Traefik can issue the certificate:

| Type | Name | Value |
| --- | --- | --- |
| A | `pokedex` | `72.62.62.14` |

Do not proxy the record. An optional AAAA to `2a02:4780:41:2e97::1`, also DNS only, is fine.

## Environment

| Name | Required | Purpose |
| --- | --- | --- |
| `ORIGIN` | yes | `https://pokedex.folderr.co`. WebAuthn origin and cookie security |
| `DATABASE_PATH` | yes | `/data/pokedex.db` |
| `INGEST_TOKEN` | yes | Bearer token for BALTHA. 32+ random bytes. Also the default webhook HMAC key |
| `VAPID_PUBLIC_KEY` | yes | Web Push public key |
| `VAPID_PRIVATE_KEY` | yes | Web Push private key |
| `VAPID_SUBJECT` | yes | `mailto:` or `https://` contact |
| `WEBAUTHN_RP_ID` | yes | `pokedex.folderr.co` |
| `WEBAUTHN_RP_NAME` | no | Default `Pokedex` |
| `SESSION_SECRET` | yes | Signs the session cookie. 32+ random bytes |
| `SETUP_CODE` | no | Operator override for the first passkey. Remove after enrollment |
| `DECISIONS_WEBHOOK_URL` | no | Optional receiver for decision answers. `DECISION_WEBHOOK_URL` is an alias |
| `DECISIONS_WEBHOOK_SECRET` | no | HMAC key. Defaults to `INGEST_TOKEN` |
| `TZ` | no | `America/Sao_Paulo` |
| `PORT` | no | Default `3000` |
| `SEED_DEMO` | no | `1` loads the sample brief when the database has none |
| `USER_DISPLAY_NAME` | no | Default `Augusto` |

`PROTOCOL_HEADER`, `HOST_HEADER`, and `ADDRESS_HEADER` are set in the image so Traefik's forwarded headers are trusted.

## Ingest

`POST /api/v1/ingest` with `Authorization: Bearer $INGEST_TOKEN`. The same route is mounted at `POST /api/ingest`.

Daily briefs use `"type": "daily"` (weekdays 08:00, America/Sao_Paulo). The Friday plan uses `"type": "weekly"` (Friday 16:00). Anything else is `"type": "ad_hoc"`. The clock lives in BALTHA, not in this app. Every accepted post sends a Web Push.

Omitted sections stay as they are. To-do ticks are not overwritten unless that item sends `force_status: true`. An answered decision is not rewritten. Post a new id for a follow-up.

The full schema, merge rules, and the answers API are in [docs/INGEST.md](docs/INGEST.md). The sample body is [docs/example-payload.json](docs/example-payload.json).

```bash
ORIGIN=http://localhost:3000 INGEST_TOKEN=... npm run seed
```

Answers:

```http
GET /api/v1/decisions/answers?since=2026-11-20T00:00:00-03:00
Authorization: Bearer $INGEST_TOKEN
```

Also available at `/api/decisions/answers`. If the webhook URL is set, each answer is POSTed as one JSON object with `X-Pokedex-Signature: sha256=<hmac of the raw body>`. The poll stays the source of truth.

## Data

SQLite in WAL mode. Every content row has `user_id`. The env ingest token is stored as a scrypt hash on `api_token` with scopes `ingest:write` and `decisions:read`, so a later public version can mint per-user tokens and wrap `/api/v1` with an MCP server. v1 ships one user and does not build that.

Settings can export all JSON (`GET /api/v1/me/export`) or delete everything. The delete phrase is `DELETE MY POKEDEX DATA`. Export includes credential ids only. It does not include the ingest token, session secrets, or the VAPID private key.

Passkeys use discoverable credentials and `userVerification: required`, so iOS can ask for Touch ID. The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS (`__Host-pokedex`). It slides for about 30 days.

## Scripts

```bash
npm run build
npm run test:flow      # ingest, screens, answer, answers, webhook HMAC, delete
npm run screenshots    # 375×667 PNGs in docs/screenshots
npm run vapid
npm run issue-setup-code
```

## Design

Monochrome ink on warm paper (`#FBF7F3`), self-hosted Instrument Sans and Bricolage Grotesque, hairline-to-ink outlined cards, black pill actions, a floating five-tab bar, and a few hand-drawn line illustrations. The direction follows the unslop pass (quiet chrome, one paper signature: an ink underline and a folded corner on the hook) and the Pawstar, nutrition-onboarding, and podcast references: big friendly titles, generous space, one step per onboarding screen. On the SE, page titles stay at 32px and the welcome wordmark at 44px so the passkey step, the tab bar, and the last card all fit in 667px. The tab bar clears `64 + 8 + 16` pixels plus `safe-area-inset-bottom`. The top padding uses `safe-area-inset-top`.
