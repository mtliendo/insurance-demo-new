# Hero Shield Insurance — Next.js + Auth0 + Neon

A port of the AWS/Vite Auth0 interview demo onto a single Next.js app.

Same demo, same script, far less infrastructure: the SPA needed API Gateway, an
HTTP JWT authorizer, Lambda, DynamoDB, AppSync Events, and Bedrock. This needs a
Next.js app, a Neon database, and an Anthropic API key.

## What replaced what

| Interview demo (AWS + Vite SPA)                | This app                                            |
| ---------------------------------------------- | --------------------------------------------------- |
| `@auth0/auth0-react` SPA + PKCE                 | `@auth0/nextjs-auth0` v4, server-side session cookie |
| API Gateway HTTP API + `HttpJwtAuthorizer`      | Route Handlers + `auth0.getSession()` in `proxy.ts`  |
| `POST /ai-agent` Lambda (Strands + Bedrock)     | `POST /api/claims/[id]/chat` (Anthropic SDK loop)    |
| DynamoDB `claims` / `messages` (declared, unused) | Neon Postgres, actually written to                 |
| AppSync Events `interviewDemo/attendee` channel | `claim_approvals` rows + client polling             |
| `CLAIM_SUBMITTED` event                         | `claims.status = 'awaiting_approval'`                |
| `CLAIM_APPROVAL` events from the audience       | `POST /api/approvals` from the `/approve` page       |
| Hardcoded AppSync endpoint + API key in the JSX | Nothing client-side but `fetch` calls to same-origin |

Claim state lived in React and was round-tripped to the Lambda on every message.
Here it lives in Neon and the client polls for it, so a refresh resumes the claim
and the audience's approvals are durable.

## Routes

| Route                        | Auth      | Purpose                                                      |
| ---------------------------- | --------- | ------------------------------------------------------------ |
| `/`                          | public    | Marketing landing page                                        |
| `/file-claim`                | protected | Chat with the claims agent; live claim-details sidebar        |
| `/profile`                   | protected | Auth0 profile + the `policyId` custom claim                   |
| `/approve`                   | public    | Audience approver screen — 3 of 4 approvals releases a claim   |
| `/api/claims`                | protected | `POST` starts or resumes the caller's claim                    |
| `/api/claims/[id]`           | protected | `GET` claim snapshot — the polling endpoint                    |
| `/api/claims/[id]/chat`      | protected | `POST` one agent turn                                          |
| `/api/approvals`             | public    | `GET` queue, `POST` records one approval                       |

## The agent

`lib/agent/` is a direct port of the Strands agent. Same system prompt, same
three tools — `save_claim_details`, `notify_fraud` (silent), and
`publish_claim_submission` — except each tool now writes to Neon instead of
mutating an in-memory object or publishing to AppSync.

The tool loop in `lib/agent/run.ts` is written out by hand rather than using the
SDK tool runner, so the "re-read the claim after each tool call" step is visible.
Model is `claude-opus-5` at `effort: 'low'`, which keeps chat latency low.

## Setup

1. **Auth0** — create a **Regular Web Application** (not a SPA; Next.js needs a
   client secret).
   - Allowed Callback URL: `http://localhost:3000/auth/callback`
   - Allowed Logout URL: `http://localhost:3000`
   - Optionally add a post-login Action setting the namespaced claim
     `https://claims.interview-demo.com/policyId`. Without it a policy number is
     generated per claim.

2. **Environment** — copy `.env.example` to `.env.local` and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   Generate the session secret with:

   ```bash
   openssl rand -hex 32
   ```

3. **Database** — apply the schema to your Neon branch:

   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```

4. **Run it**:

   ```bash
   pnpm dev
   ```

## Running the demo

1. Sign in and open `/file-claim`. Describe an incident — the sidebar fills in as
   the agent calls `save_claim_details`.
2. Confirm submission. The claim flips to `awaiting_approval` and the page starts
   polling.
3. Send the audience to `/approve`. Three approvals releases the claim, and the
   claim page picks it up on its next poll — confetti and all.

Try a deliberately implausible story to exercise `notify_fraud`: it flags
`fraud_flagged` in Neon and says nothing to the user, exactly as before.
