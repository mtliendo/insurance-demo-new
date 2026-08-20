-- Hero Shield Insurance — schema
-- Replaces the DynamoDB `messages` / `claims` tables from the CDK backend.
-- Apply with the Neon MCP server (`run_sql_transaction`, one statement per entry)
-- or: psql "$DATABASE_URL" -f db/schema.sql. Idempotent either way. See SETUP.md.

create table if not exists claims (
  id                   uuid primary key default gen_random_uuid(),
  user_id              text        not null,
  policy_id            text        not null,
  incident_description text,
  incident_location    text,
  damage_extent        text,
  status               text        not null default 'pending'
                         check (status in ('pending','awaiting_approval','approved','denied')),
  fraud_flagged        boolean     not null default false,
  fraud_reason         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Mirrors the DynamoDB `byPolicyId` GSI.
create index if not exists claims_policy_id_created_at_idx on claims (policy_id, created_at desc);
create index if not exists claims_user_id_created_at_idx   on claims (user_id, created_at desc);
-- Drives the public approver queue.
create index if not exists claims_status_created_at_idx    on claims (status, created_at desc);

create table if not exists messages (
  id         bigserial   primary key,
  claim_id   uuid        not null references claims (id) on delete cascade,
  role       text        not null check (role in ('user','assistant')),
  content    text        not null,
  created_at timestamptz not null default now()
);

-- Mirrors the DynamoDB `claimIdIndex` GSI.
create index if not exists messages_claim_id_created_at_idx on messages (claim_id, created_at);

-- Replaces the AppSync CLAIM_APPROVAL events. One row per audience approver.
create table if not exists claim_approvals (
  id          bigserial   primary key,
  claim_id    uuid        not null references claims (id) on delete cascade,
  approver_id text        not null,
  created_at  timestamptz not null default now(),
  unique (claim_id, approver_id)
);

create index if not exists claim_approvals_claim_id_idx on claim_approvals (claim_id);
