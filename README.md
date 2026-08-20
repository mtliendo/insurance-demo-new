# Hero Shield Insurance

A conference-demo app: superhero car insurance, where you file a claim by
**talking to an AI agent**, and the **audience in the room approves it live**.

Built on Next.js 16 + Auth0 + Neon Postgres + the Anthropic API. It is a port of
an earlier AWS/Vite version of the same demo — same script on stage, a fraction
of the infrastructure.

**Setup lives in [SETUP.md](SETUP.md)** — Auth0 secrets, the Neon database (via
the Neon MCP server), and the Anthropic key. Read that first; nothing here runs
without those three.

---

## What the demo does

1. **You sign in.** Auth0 Universal Login, server-side session cookie. An
   optional post-login Action attaches a `policyId` custom claim to the token.
2. **You file a claim by chatting.** `/file-claim` puts you in front of a claims
   agent that already knows your car (a white 2006 Honda Pilot) and asks one
   question at a time: what happened, where, how bad. Behind the scenes it is a
   tool-using Claude loop — as it collects the three facts it calls
   `save_claim_details`, and the sidebar next to the chat fills in live because
   the page is polling the row the tool just wrote.
3. **It quietly flags fraud.** Tell it something implausible and it calls
   `notify_fraud`, which writes `fraud_flagged = true` to Neon and says *nothing*
   to you. That silence is the point of the demo beat.
4. **You confirm submission.** `publish_claim_submission` flips the claim to
   `awaiting_approval`.
5. **The room approves it.** Everyone opens `/approve` on their phone — no login,
   one vote per browser. Three of four approvals promotes the claim to
   `approved`, the claim page picks it up on its next poll, and confetti fires.

The interesting part is that **every one of those steps is a row in Postgres**.
Refresh mid-claim and you resume exactly where you were; the audience's votes are
durable.

---

## How it works

```
browser ──▶ proxy.ts ──────────────▶ Route Handler ──▶ lib/agent/run.ts ──▶ Anthropic API
            (Auth0 session gate)      auth0.getSession()      │  tool loop
                                                              ▼
                                                        lib/claims.ts ──▶ Neon Postgres
                                                                              │
browser ◀── poll GET /api/claims/[id] ◀───────────────────────────────────────┘
```

**Auth.** [proxy.ts](proxy.ts) — Next.js 16 renamed Middleware to Proxy — mounts
the Auth0 v4 routes and gates the protected pages. API routes are deliberately
let through the proxy and check the session themselves, so a `fetch()` gets a
`401` JSON body instead of being redirected into an HTML login page.

**The agent.** [lib/agent/](lib/agent/) is a direct port of a Strands agent: same
system prompt, same three tools. The tool loop in
[lib/agent/run.ts](lib/agent/run.ts) is written out by hand rather than handed to
the SDK's tool runner, so the "re-read the claim from the database after each
tool call" step is visible on screen. Model is `claude-opus-5` at
`effort: 'low'`, which keeps chat latency low enough for a live demo.

**State and realtime.** There is no websocket. Both live surfaces poll:
`/file-claim` every 2s, `/approve` every 3s. [lib/claims.ts](lib/claims.ts) is the
only module that touches SQL, and every agent tool bottoms out there.

### Routes

| Route | Auth | Purpose |
| ----- | ---- | ------- |
| `/` | public | Marketing landing page |
| `/file-claim` | protected | Chat with the claims agent; live claim-details sidebar |
| `/profile` | protected | Auth0 profile and the `policyId` custom claim |
| `/approve` | public | Audience approver screen — 3 of 4 approvals releases a claim |
| `POST /api/claims` | protected | Starts or resumes the caller's claim |
| `GET /api/claims/[id]` | protected | Claim snapshot — the polling endpoint |
| `POST /api/claims/[id]/chat` | protected | One agent turn |
| `GET \| POST /api/approvals` | public | Approver queue; records one approval |

### Layout

```
app/            pages + route handlers
components/     client components (chat, approver screen, nav) + shadcn/ui
lib/agent/      system prompt, tool definitions, the tool loop
lib/claims.ts   every SQL query in the app
lib/auth0.ts    Auth0 client + the policyId custom claim
db/schema.sql   claims / messages / claim_approvals
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
| AppSync Events `interviewDemo/attendee` channel | `claim_approvals` rows + client polling |
| `CLAIM_SUBMITTED` event | `claims.status = 'awaiting_approval'` |
| `CLAIM_APPROVAL` events from the audience | `POST /api/approvals` from the `/approve` page |
| Hardcoded AppSync endpoint + API key in the JSX | Nothing client-side but `fetch` to same-origin |

Claim state used to live in React and get round-tripped to the Lambda on every
message. Now it lives in Neon, which is what makes resume-on-refresh and durable
audience votes fall out for free.

---

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # typecheck + production build
pnpm lint
```

Full environment and database setup: **[SETUP.md](SETUP.md)**.

## Running the demo on stage

1. Sign in and open `/file-claim`. Describe an incident — the sidebar fills in as
   the agent calls `save_claim_details`.
2. Confirm submission. The claim flips to `awaiting_approval` and the page polls.
3. Send the audience to `/approve`. Three approvals releases the claim, and the
   claim page picks it up on its next poll — confetti and all.

Between runs, reset with `truncate claims cascade;` (see the end of
[SETUP.md](SETUP.md)).
