# Hero Shield Insurance

A conference-demo app: superhero car insurance, where you file a claim by
**talking to an AI agent**, a **logged-in CIBA board of six** approves it over
email, and the host's **Google Calendar** gets the event via Auth0 Token Vault.

Built on Next.js 16 + Auth0 + Neon Postgres + the Anthropic API. It is a port of
an earlier AWS/Vite version of the same demo — same Marvel script on stage, a
different grant.

**Setup lives in [SETUP.md](SETUP.md)** — Auth0 (including CIBA email and Token
Vault), the Neon database (via the Neon MCP server), and the Anthropic key.
Read that first; nothing here runs without those.

---

## What the demo does

1. **The room scans one QR.** `/join` sends everyone through Auth0 Universal
   Login so we have `sub`, email, and name. An unverified email can watch the
   room; it cannot sit on the CIBA board.
2. **Focus picks the board.** The host console (`/host`) randomly seats six
   verified joiners. Their phones flip to "you're on the board" — app UI, not
   mail yet. Pick again, or pin planted friends first so they are always
   included.
3. **The host files the claim in chat.** `/file-claim` is the same Anthropic
   claims agent as before (white 2006 Honda Pilot, Hulk-smashed car). Confirm
   submission flips the row to `awaiting_approval`.
4. **CIBA email goes to the six, not the room.** If the host has not connected
   Google Calendar, we refuse to send — a yes would be hollow. Otherwise we
   `POST /bc-authorize` per seated member (`login_hint` `iss_sub`,
   `requested_expiry=600` so Auth0 uses **email**, never Guardian push) and
   store `{authReqId, sub, email, name, status}`. The projector ticks as they
   Accept or Decline. We know who is who because **we minted the `auth_req_id`**.
5. **Three CIBA yeses release the claim.** Then we write one event on the
   **host** Google Calendar with Token Vault
   (`getAccessTokenForConnection({ connection: 'google-oauth2' })`). The six
   board members never connect Google.

`/approve` is still there as a public **likes ticker**. It does not authorize
anything. The CIBA board is the grant.

The interesting part is that **every one of those steps is a row in Postgres**.
Refresh mid-claim and you resume exactly where you were; the board and CIBA
polls are durable.

---

## How it works

```
browser ──▶ proxy.ts ──────────────▶ Route Handler ──▶ lib/agent/run.ts ──▶ Anthropic API
            (Auth0 session gate)      auth0.getSession()      │  tool loop
                                                              ▼
                                                        lib/claims.ts ──▶ Neon Postgres
                                                              │
submit ──▶ lib/ciba.ts /bc-authorize (×6) ──▶ poll /oauth/token
                                                              │
3 yeses ──▶ Token Vault Google token ──▶ Calendar event (host only)
```

**Auth.** [proxy.ts](proxy.ts) — Next.js 16 renamed Middleware to Proxy — mounts
the Auth0 v4 routes (`/auth/login`, `/auth/callback`, `/auth/connect`) and
gates the protected pages. API routes check the session themselves so a
`fetch()` gets `401` JSON instead of an HTML login page.

**CIBA.** [lib/ciba.ts](lib/ciba.ts) copies the working loop from
[mtliendo/ciba-email](https://github.com/mtliendo/ciba-email). This app does
**not** use `@auth0/ai`. `requested_expiry=600` selects the email channel.

**Token Vault.** [lib/auth0.ts](lib/auth0.ts) sets
`enableConnectAccountEndpoint: true`. Audience login is `openid profile email`
only — no calendar scope, no `offline_access`. Only the host hits
`/settings` → `/auth/connect` for Google Calendar, matching
[mtliendo/auth0-calendar-workshop](https://github.com/mtliendo/auth0-calendar-workshop).

**The agent.** [lib/agent/](lib/agent/) is unchanged in conversation: same
system prompt, same three tools. `publish_claim_submission` now also starts
CIBA for the seated six.

**State and realtime.** There is no websocket. `/file-claim` and `/host` refresh
UI every 2s. Auth0 `/oauth/token` is only hit when a pending `auth_req_id` is
due: stored `interval_sec`, floor 5s, `slow_down` sticky. [lib/claims.ts](lib/claims.ts)
plus [lib/board.ts](lib/board.ts) and [lib/ciba-store.ts](lib/ciba-store.ts)
are the SQL surface.

### Routes

| Route | Auth | Purpose |
| ----- | ---- | ------- |
| `/` | public | Marketing landing page |
| `/join` | login | QR landing — join the room, see board seat |
| `/host` | host | QR, pick board (`BOARD_SIZE`, default 6), projector CIBA board |
| `/settings` | host | Connect Google Calendar (Token Vault) |
| `/file-claim` | protected | Chat with the claims agent; live board sidebar |
| `/profile` | protected | Auth0 profile and the `policyId` custom claim |
| `/approve` | public | Likes ticker — not the authorization path |
| `POST /api/claims` | protected | Starts or resumes the caller's claim |
| `GET /api/claims/[id]` | protected | Claim snapshot; host ticks due CIBA ids |
| `POST /api/claims/[id]/chat` | protected | One agent turn |
| `GET \| POST /api/join` | login | Upsert joiner; seat / CIBA status for this phone |
| `GET /api/board` | host | Joiners + live board + CIBA snapshot |
| `POST /api/board/pick` | host | Randomly seat `BOARD_SIZE` (pins first; default 6) |
| `GET \| POST /api/ciba` | host | Board status; manual start if Google/board lagged |
| `POST /api/ciba/poll` | host | Tick due `/oauth/token` per `auth_req_id` |
| `GET /api/connection-status` | host | Token Vault Google connected? |
| `GET \| POST /api/approvals` | public | Likes ticker |

### Layout

```
app/            pages + route handlers
components/     client components (chat, join, host, board) + shadcn/ui
lib/agent/      system prompt, tool definitions, the tool loop
lib/ciba.ts     /bc-authorize + CIBA token poll (not @auth0/ai)
lib/board.ts    joiners + pick (`BOARD_SIZE`)
lib/board-config.ts  BOARD_SIZE / CIBA_YES_THRESHOLD (defaults 6 / 3)
lib/claims.ts   claim SQL
lib/auth0.ts    Auth0 client, Token Vault connect-account
db/schema.sql   claims / messages / likes / joiners / board / ciba
proxy.ts        Auth0 route mounting + page protection
```

---

## What replaced what

The original demo ran on API Gateway, Lambda, DynamoDB, AppSync Events, and
Bedrock. This one is a Next.js app, a Neon database, and an API key.

| Interview demo (AWS + Vite SPA) | This app |
| ------------------------------- | -------- |
| `@auth0/auth0-react` SPA + PKCE | `@auth0/nextjs-auth0` v4, server-side session cookie |
| API Gateway HTTP API + `HttpJwtAuthorizer` | Route Handlers + `auth0.getSession()` in `proxy.ts` |
| `POST /ai-agent` Lambda (Strands + Bedrock) | `POST /api/claims/[id]/chat` (Anthropic SDK loop) |
| DynamoDB `claims` / `messages` (declared, unused) | Neon Postgres, actually written to |
| AppSync Events `interviewDemo/attendee` channel | `ciba_authorizations` + `demo_joiners` + polling |
| Anonymous 3-of-4 on `/approve` | CIBA email grant from 6 seated members; `/approve` is likes |
| — | Host Google Calendar via Auth0 Token Vault |

Claim state used to live in React and get round-tripped to the Lambda on every
message. Now it lives in Neon, which is what makes resume-on-refresh and durable
board votes fall out for free.

---

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # typecheck + production build
pnpm lint
```

Full environment and database setup: **[SETUP.md](SETUP.md)**.

## Rehearsal mode (no six Auth0 accounts)

Stage defaults stay **pick 6 / 3 yeses**. To run the Oktane CIBA board with two
verified joiners — both must Accept — set these in `.env.local` and restart
`pnpm dev`:

```dotenv
BOARD_SIZE=2
CIBA_YES_THRESHOLD=2
```

Do not change the stage demo to 2. The host console shows `N/{BOARD_SIZE}` and
Pick stays disabled until verified (non-host) joiners reach that size. CIBA
start refuses a seated board that is not exactly `BOARD_SIZE`. The host Token
Vault calendar write and `claim.status = approved` fire only after yeses reach
`CIBA_YES_THRESHOLD`.

## Running the demo on stage

1. Host signs in, opens `/settings`, connects Google Calendar once.
2. Projector on `/host`. Audience scans the QR → Auth0 login → `/join`.
3. **Pick board.** Six phones show "you're on the board." Pin friends and pick
   again if you need a ringer in the six.
4. Host files the Hulk-smashed-car claim on `/file-claim`. Confirm submission.
5. Six CIBA emails go out (`requested_expiry=600`). The projector ticks
   pending → approved / denied.
6. Three yeses approve the claim, confetti fires, and a calendar event lands
   on the host Google account.

Between runs, reset with `truncate claims, demo_joiners, board_picks cascade;`
(see the end of [SETUP.md](SETUP.md)).
