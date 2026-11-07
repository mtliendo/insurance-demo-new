# Hero Shield Insurance

A conference-demo app: superhero car insurance. File a claim by **talking to
an AI agent**, write the appointment on **Google Calendar** via Auth0 Token
Vault, then **cancel the claim** only after CIBA email approval.

Built on Next.js 16 + Auth0 + Neon Postgres + the Vercel AI SDK (AI Gateway,
Anthropic default). It is a port of an earlier AWS/Vite version of the same
demo — same Marvel script on stage, a different grant.

**Setup lives in [SETUP.md](SETUP.md).** Human + agent onboarding
(Neon, Auth0, Vercel AI SDK, CIBA dashboard, MCPs):
**[CONTRIBUTING.md](CONTRIBUTING.md)**.

![Hero Shield landing page](docs/images/landing.jpg)

---

## Auth0 features in this demo

This is an Auth0 product demo. The app uses these Auth0 capabilities
on purpose — they are the point of the talk:

| Feature | Where it shows up |
| ------- | ----------------- |
| **Universal Login** | Every login (`/auth/login`) — audience QR, admin console, filer chat |
| **Regular Web Application** + server session cookie | `@auth0/nextjs-auth0` v4 in [proxy.ts](proxy.ts) / [lib/auth0.ts](lib/auth0.ts). Not a SPA. Needs a client secret. |
| **Email verification** | Unverified joiners watch `/join`; they cannot sit on the CIBA board |
| **Custom ID token claims** | Optional post-login Action sets `https://claims.interview-demo.com/policyId` |
| **CIBA (Client-Initiated Backchannel Authentication)** | `cancel_claim` emails the **signed-in user** (`login_hint` iss_sub, `iss=https://${AUTH0_DOMAIN}/`, `requested_expiry=301` so it goes by **email** not Guardian and lasts ~5 minutes). Manifest shows pending / approved / denied. Approval sets status `cancelled`. Requires **Essentials (or Professional) + Auth0 for AI Agents add-on**. The seated-board grant is still in the repo behind `NEXT_PUBLIC_DEMO_BOARD_ENABLED=1` (default **off**). |
| **CIBA email / Asynchronous Approval template** | Branding → Email Templates → Asynchronous Approval. `login_hint` is `iss_sub`. |
| **Token Vault** | Host-only Google Calendar connect on `/settings` (`/auth/connect`). Audience never sees Google consent. |
| **First-party confidential client** | Required for the CIBA grant (`oidc_conformant`, not `token_endpoint_auth_method: none`) |

![Auth0 Universal Login for Insurance Demo Oktane](docs/images/auth0-login.jpg)

CIBA setup, plan requirements, and Token Vault steps:
[CONTRIBUTING.md](CONTRIBUTING.md#auth0-ciba-dashboard).

---

## What the demo does (Iowa Code Camp)

Board seating, QR, and `/join` are **off** unless you set
`NEXT_PUBLIC_DEMO_BOARD_ENABLED=1`. The talk is Token Vault + cancel CIBA.

1. **Admin signs in** (`admin@focusotter.com` or `@okta.com`) and opens
   `/settings`. **Connect Google Calendar** — Auth0 Token Vault, host-only.
2. **File the Hulk-smashed Honda Pilot** on `/file-claim`. Confirm submit.
   The agent writes one event on that Google Calendar (no seated board).
3. **Type `cancel my claim`.** CIBA emails the signed-in user
   (`login_hint` iss_sub of **this session**, `requested_expiry=301`).
   Chat/manifest show **pending**. Accept → claim **cancelled**. Decline or
   Auth0 expiry (~5 minutes) → unchanged, status **denied**.

Admin calendar writes match **email**, not a stored Auth0 `sub` from an old
tenant.

![Audience join — Auth0 login required to sit on the CIBA board](docs/images/join.jpg)

---

## How it works

```
browser ──▶ proxy.ts ──────────────▶ Route Handler ──▶ lib/agent/run.ts ──▶ Vercel AI Gateway
            (Auth0 session gate)      auth0.getSession()      │  tool loop          (Anthropic default)
                                                              ▼
                                                        lib/claims.ts ──▶ Neon Postgres
                                                              │
submit ──▶ lib/ciba.ts /bc-authorize (× seated) ──▶ poll /oauth/token
                                                              │
threshold yeses ──▶ Token Vault Google token ──▶ Calendar event (host only)
```

**Auth.** [proxy.ts](proxy.ts) — Next.js 16 renamed Middleware to Proxy — mounts
the Auth0 v4 routes (`/auth/login`, `/auth/callback`, `/auth/connect`) and
gates the protected pages. API routes check the session themselves so a
`fetch()` gets `401` JSON instead of an HTML login page.

**CIBA.** [lib/ciba.ts](lib/ciba.ts) copies the working loop from
[mtliendo/ciba-email](https://github.com/mtliendo/ciba-email). This app does
**not** use `@auth0/ai`. `requested_expiry` above 300 selects the email channel
(board uses 600; `cancel_claim` uses 301).

**Token Vault.** [lib/auth0.ts](lib/auth0.ts) sets
`enableConnectAccountEndpoint: true`. Audience login is `openid profile email`
only — no calendar scope, no `offline_access`. Only an admin hits
`/settings` → `/auth/connect` for Google Calendar.

**The agent.** [lib/agent/](lib/agent/) is a Vercel AI SDK `generateText`
loop. Same conversation, four tools. Calls go through the AI Gateway
(`anthropic/claude-opus-5` by default). `publish_claim_submission` flips
the claim to `awaiting_approval` and calls `startCibaForSubmittedClaim`
(admin session only). A non-admin filer gets `not_host`; `GET /api/board`
on the open `/host` console starts the same grant. `cancel_claim` emails
the policyholder (not the board), stores the Auth0 `auth_req_id`, and
returns pending. `GET /api/claims/[id]` polls until Accept, Decline, or
Auth0 expiry, then sets `cancelled` or leaves the claim unchanged.

**State and realtime.** There is no websocket. `/file-claim` and `/host`
refresh UI every 2s. Auth0 `/oauth/token` is only hit when a pending
`auth_req_id` is due (board poll, or cancel-claim CIBA on the claim
owner's snapshot poll).

### Routes

| Route | Auth | Purpose |
| ----- | ---- | ------- |
| `/` | public | Marketing landing page |
| `/join` | login | QR landing — join the room, see board seat |
| `/host` | admin (`@okta.com` or `admin@focusotter.com`) | QR, demo host, board rules, pick, projector CIBA board |
| `/settings` | admin | Connect Google Calendar (Token Vault) |
| `/file-claim` | protected | Chat with the claims agent; live board sidebar |
| `/profile` | protected | Auth0 profile and the `policyId` custom claim |
| `POST /api/claims` | protected | Starts or resumes the caller's claim |
| `POST /api/claims/reset` | admin | Wipe projector claim + chat / CIBA + seated board |
| `GET /api/claims/[id]` | protected | Claim snapshot; owner ticks cancel CIBA; admin ticks due board CIBA ids |
| `POST /api/claims/[id]/chat` | protected | One agent turn (AI Gateway) |
| `GET \| POST /api/join` | login | Upsert joiner; seat / CIBA status for this phone |
| `GET /api/board` | admin | Joiners + live board + CIBA snapshot; auto-starts CIBA |
| `POST /api/board/pick` | admin | Randomly seat the saved board size (pins first) |
| `POST /api/board/settings` | admin | Save board size and CIBA yes threshold |
| `POST /api/board/host` | admin | Save demo host email + Auth0 sub |
| `GET \| POST /api/ciba` | admin | Board status; fallback start if auto-start failed |
| `POST /api/ciba/poll` | admin | Tick due `/oauth/token` per `auth_req_id` |
| `GET /api/connection-status` | admin | Token Vault Google connected? |

---

## Running it

The app will not start a useful claims chat without these in `.env.local`:

| Key | Why |
| --- | --- |
| Auth0 (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`) | Universal Login + session cookie |
| `DATABASE_URL` | Neon |
| **`AI_GATEWAY_API_KEY`** | Vercel AI Gateway. Required for `/file-claim`. There is no Anthropic key — do not set `ANTHROPIC_API_KEY`. |

Mint the gateway key at
[Vercel AI Gateway API keys](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys).
On a linked Vercel project you can use `vercel env pull` (`VERCEL_OIDC_TOKEN`)
instead. Restart `pnpm dev` after editing `.env.local`.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # typecheck + production build
pnpm lint
```

Full environment and database setup: **[SETUP.md](SETUP.md)**.
CIBA plan + dashboard: **[CONTRIBUTING.md](CONTRIBUTING.md#auth0-ciba-dashboard)**.

## Rehearsal defaults (1 / 1)

Code, seed, and UI default to **pick 1 / 1 yes**. The presenter sets the
live values on **`/host` → Board rules** (board size and CIBA yes
threshold). Those persist in Neon `demo_settings`. Raise to **6 / 3** on
`/host` for the real talk.

## Running the demo on stage

1. Sign in with `admin@focusotter.com` or an `@okta.com` email.
2. `/settings` → **Connect Google Calendar** (Token Vault).
3. `/file-claim` → Hulk smashed a white 2006 Honda Pilot → confirm submit.
   Calendar event lands if Google is connected.
4. Type **`cancel my claim`**. Approve the email (`Cancel-claim-#<id>`).
5. Manifest: Cancel CIBA **Approved**, status **Cancelled**.

Between runs, tap **Start over** on `/file-claim` or `/host` (admin only).

The seated-board / QR path is still in the repo. Turn it on with
`NEXT_PUBLIC_DEMO_BOARD_ENABLED=1` (and a rebuild). Default is off.

## Cancel a claim (CIBA)

Same Auth0 app and CIBA email grant as the board — no new secrets. This
CIBA goes to the **person in the chat** (policyholder `sub`), not the
seated board. Google Calendar / Token Vault is not required.

**Auth0 dashboard (already needed for the board demo):**

1. Application → **Grant Types** → enable **Client Initiated Backchannel Authentication (CIBA)**.
2. Same app → CIBA section → enable **email**.
3. **Branding → Email Templates → Asynchronous Approval** enabled.
4. The filer must have a **verified** email.

**Demo script:**

1. On `/file-claim`, file a claim as usual (or stop after details are saved).
2. Type: **`cancel my claim`** (or name it, e.g. the 8-char ID on the manifest).
3. Chat tells you to check your email. Manifest **Cancel CIBA** stays **Pending**.
4. Open the Asynchronous Approval email. Request code looks like `Cancel-claim-#<id>` (no spaces; matches the manifest ID).
5. **Accept** → chat says the claim is cancelled; manifest badge **Cancelled**.
6. **Decline** (or wait ~5 minutes for Auth0 expiry) → claim is unchanged; chat says so. Type `cancel my claim` again if you still want it gone.
