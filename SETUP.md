# Setup

Everything this app needs to run locally: **three sets of secrets** (Auth0, Neon,
Anthropic), **one schema migration**, and two Auth0 add-ons the stage demo
depends on — **CIBA email** (`requested_expiry=600`) and **Token Vault** for
the host's Google Calendar. Nothing else — no second app, no build step beyond
`pnpm dev`.

This document is written for a coding agent working with a human who has the
accounts. An agent can do most of this end-to-end; the two things it cannot do
alone are read secrets out of the Auth0 dashboard and mint an Anthropic API key.
Ask for those, don't guess.

> **Never print a filled-in `.env.local` back into the chat, a commit, or a PR
> description.** `.gitignore` already excludes `.env*` except `.env.example`.
> Write values into the file, then confirm which keys are set — not what they are.

---

## 0. Prerequisites

| Tool | Version | Notes |
| ---- | ------- | ----- |
| Node | 22+ | |
| pnpm | 11+ | `packageManager` in `package.json` pins 11.5.0 |
| Neon MCP server | — | how the agent provisions the database (step 2) |
| Auth0 CLI | optional | `brew install auth0/auth0-cli/auth0` — makes step 1 scriptable |
| `psql` | optional | only needed for the non-MCP fallback in step 2 |

```bash
pnpm install
cp .env.example .env.local
```

`.env.local` is where every value below lands. It is read by `next dev` — restart
the dev server after editing it.

---

## 1. Auth0

The app uses `@auth0/nextjs-auth0` v4 with a **server-side session cookie**, so it
needs a **Regular Web Application** — *not* a Single Page Application. A SPA has
no client secret and this app will fail to start without one.

### Option A — Auth0 CLI (agent-runnable)

```bash
auth0 login                                    # opens a browser; the human does this once
auth0 apps create \
  --name "Hero Shield Insurance (local)" \
  --type regular \
  --callbacks "http://localhost:3000/auth/callback" \
  --logout-urls "http://localhost:3000" \
  --reveal-secrets
```

The output carries `CLIENT ID` and `CLIENT SECRET`. Get the tenant domain with
`auth0 tenants list` — use the bare host, e.g. `dev-2zis9k18.us.auth0.com`, with
**no `https://`** prefix.

### Option B — dashboard (ask the human)

Applications → Create Application → **Regular Web Application** → Settings:

- **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
- **Allowed Logout URLs**: `http://localhost:3000`
- **Allowed Web Origins**: `http://localhost:3000`

Then ask the human for Domain, Client ID, and Client Secret from that Settings tab.

### Fill in

```dotenv
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_SECRET=            # generate: openssl rand -hex 32
```

`AUTH0_SECRET` encrypts the session cookie. It is generated locally, not fetched
from Auth0 — an agent can and should just run `openssl rand -hex 32` itself.

### Optional: the `policyId` custom claim

The demo reads a namespaced claim off the session:

```
https://claims.interview-demo.com/policyId
```

Add a post-login Action to set it if you want a stable policy number per user:

```js
exports.onExecutePostLogin = async (event, api) => {
  api.idToken.setCustomClaim(
    'https://claims.interview-demo.com/policyId',
    'POL-2026-12345',
  )
}
```

Without the Action nothing breaks — [lib/auth0.ts](lib/auth0.ts) falls back to
`generatePolicyId()` and makes one up per claim.

`AUTH0_AUDIENCE` in `.env.example` stays commented out. It is only needed if you
want an access token for a *separate* API; this app has none.

`DEMO_HOST_EMAIL` or `DEMO_HOST_SUB` is **required**. The host gate fails
closed if both are empty — nobody can pick the board, start CIBA, or connect
Google. Set Focus's email (and `sub` once you have it) so audience logins
cannot operate the console. Token Vault calendar writes additionally require
the current session `sub` to match `DEMO_HOST_SUB` when that env is set.

### CIBA email grant

CIBA is not on the Free plan. Enable **Client Initiated Backchannel
Authentication** on this Regular Web App and select the **email** channel
(not Guardian). The loop lives in [lib/ciba.ts](lib/ciba.ts), copied from
[mtliendo/ciba-email](https://github.com/mtliendo/ciba-email) — we do **not**
use `@auth0/ai`.

Auth0 picks the channel from `requested_expiry`:

- **300 seconds or less:** Guardian push
- **301 to 259200 seconds:** email

This demo always sends `requested_expiry=600`. `login_hint` is `iss_sub` (that
board member's Auth0 `sub`), never a raw email. `binding_message` is at most
64 characters, charset `A-Za-z0-9+-_.,:#`, no spaces
(`Hulk-smash-claim-<id>`). The authorizing user must have a **verified**
email or they cannot sit on the board.

### Token Vault — host Google Calendar only

The six board members do **not** connect Google. Only the host (Focus) does,
once, on `/settings`.

Follow the pattern in
[mtliendo/auth0-calendar-workshop](https://github.com/mtliendo/auth0-calendar-workshop):

1. Enable Token Vault on the tenant and add a **Google OAuth 2.0** connection
   with Calendar scope.
2. Enable that connection on this application.
3. [lib/auth0.ts](lib/auth0.ts) sets `enableConnectAccountEndpoint: true`.
   Login scope is `openid profile email offline_access` only — **no Google
   calendar scope** on audience Universal Login.
4. Host clicks **Connect Google Calendar** → `/auth/connect` (proxy-gated to
   the host) with `scopes=https://www.googleapis.com/auth/calendar`.
5. After three CIBA yeses the **host session** calls
   `auth0.getAccessTokenForConnection({ connection: 'google-oauth2' })` and
   writes Calendar REST ([lib/google-calendar.ts](lib/google-calendar.ts)).
   A non-host poller does not write. There is no public `POST /api/calendar`.

If the host has not connected Google, **CIBA is not sent**. The host console
says so. A board yes with nowhere to write the calendar event is a hollow
approval.

---

## 2. Neon database (use the Neon MCP server)

The agent should drive this with the **Neon MCP server** rather than asking the
human to click through the console. The full sequence:

1. **`list_projects`** — reuse an existing project if one obviously fits;
   otherwise create.
2. **`create_project`** with name `insurance-demo`. Note the returned project ID.
3. **`run_sql_transaction`** against that project's `main` branch, passing the
   statements from [db/schema.sql](db/schema.sql). Read the file and pass each
   `create table` / `create index` as a separate statement in the array — the
   file is idempotent (`if not exists` throughout), so re-running is safe.
4. **`get_connection_string`** for the project's `main` branch and database
   `neondb`. Write the result into `.env.local` as `DATABASE_URL`.
5. **`get_database_tables`** to verify. Expect `claims`, `messages`,
   `claim_approvals`, `demo_joiners`, `board_picks`, `board_members`,
   `ciba_authorizations`.

```dotenv
DATABASE_URL=postgresql://...@ep-....neon.tech/neondb?sslmode=require
```

The connection string **must** keep `?sslmode=require` — `@neondatabase/serverless`
talks to Neon's pooled HTTP endpoint and the driver expects it.

### Fallback without MCP

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

### What the schema is for

| Table | Replaces | Role |
| ----- | -------- | ---- |
| `claims` | DynamoDB `claims` | One row per claim; `status` drives the whole demo |
| `messages` | DynamoDB `messages` | Chat transcript, so a refresh resumes the claim |
| `claim_approvals` | AppSync `CLAIM_APPROVAL` events | Public likes ticker — not the grant |
| `demo_joiners` | — | QR joiners (`sub`, email, name, verified, pinned) |
| `board_picks` / `board_members` | — | Latest pick of 6 |
| `ciba_authorizations` | anonymous 3-of-4 | `{authReqId, sub, email, name, status}` per seat |

---

## 3. Anthropic API key

Drives the claims agent in [lib/agent/](lib/agent/). Ask the human for a key from
[console.anthropic.com](https://console.anthropic.com/settings/keys) — an agent
cannot mint one.

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
```

The agent calls `claude-opus-5` at `effort: 'low'` ([lib/agent/run.ts](lib/agent/run.ts)).
The key must belong to a workspace with credit; a `401`/`400` from the chat route
shows up in the UI as *"Sorry, I encountered an error."* and in the server log as
`Agent error:`.

---

## 4. Verify

```bash
pnpm build    # typechecks + builds; catches missing config that isn't env-dependent
pnpm dev
```

Then walk the happy path:

1. `http://localhost:3000` → **Login** → Auth0 Universal Login. A redirect loop
   or a callback error here is almost always a mismatched Allowed Callback URL.
2. `/settings` → **Connect Google Calendar** (host only). Without this, CIBA
   emails are withheld.
3. `/host` → QR is on screen. A second browser opens `/join`, logs in with a
   **verified** email, and waits.
4. **Pick board.** The joiner phone shows "you're on the board."
5. `/file-claim` → describe the Hulk incident. Confirm submission. Six CIBA
   emails go out (`requested_expiry=600`). The projector ticks as they Accept.
6. Three yeses → claim `approved`, confetti, calendar event on the host Google
   account. `/approve` likes do **not** release the claim.

### Troubleshooting

| Symptom | Cause |
| ------- | ----- |
| `DATABASE_URL is not set. Copy .env.example to .env.local.` | `.env.local` missing or dev server not restarted after editing it |
| Redirect loop at `/auth/login` | `APP_BASE_URL` doesn't match the URL you're browsing, or `AUTH0_SECRET` is missing/short |
| `Callback URL mismatch` from Auth0 | Allowed Callback URL must be exactly `http://localhost:3000/auth/callback` |
| Sign-in works but every page 401s | App created as a SPA — recreate it as a Regular Web Application |
| Agent replies "Sorry, I encountered an error" | Bad or unfunded `ANTHROPIC_API_KEY`; check the server log for `Agent error:` |
| `relation "claims" does not exist` | Step 2's migration never ran against the branch this `DATABASE_URL` points at |
| Approvals never release the claim | `/approve` likes are not the grant — need 3 CIBA yeses from the seated six |
| Host console 503 / nobody is host | `DEMO_HOST_EMAIL` and `DEMO_HOST_SUB` are both empty — the gate fails closed |
| CIBA emails never send | Host has not connected Google, no board picked, or `requested_expiry` is ≤300 (Guardian) |
| Auth0 `slow_down` on stage | Polls must honor stored `interval_sec` (floor 5). Do not reset after `authorization_pending`. |
| Board member missing from pick | Email not verified on the Auth0 user, or they are the configured host |
| Calendar event missing after 3 yeses | Token Vault Google connection dropped; reconnect on `/settings` |

---

## Reset between demos

Wipe the claim, the room, and the board via Neon MCP `run_sql`, or:

```sql
truncate claims, demo_joiners, board_picks cascade;
```

`ciba_authorizations`, `messages`, `claim_approvals`, and `board_members`
cascade from those.
