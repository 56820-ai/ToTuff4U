-- Store a keyed IP hash separately from public leaderboard rows.
-- The raw IP is processed only in the Edge Function and is not written to this table.
create table if not exists public.score_ip_records (
  score_id text primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.score_ip_records enable row level security;
revoke all on table public.score_ip_records from anon, authenticated;
grant all on table public.score_ip_records to service_role;
