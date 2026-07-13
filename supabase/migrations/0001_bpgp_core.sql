-- Bijak Partner Growth Platform baseline constraints and RLS posture.
-- Drizzle remains the application schema source; this migration documents the Supabase deployment shape.

alter table if exists leads add constraint leads_mobile_unique unique (mobile);
create unique index if not exists leads_membership_unique_idx on leads (kiri_membership_id) where kiri_membership_id is not null;
alter table if exists commissions add constraint commissions_lead_unique unique (lead_id);

alter table if exists audit_log add column if not exists previous_amount numeric(10,2);
alter table if exists audit_log add column if not exists new_amount numeric(10,2);
alter table if exists audit_log add column if not exists ip_address text;
alter table if exists audit_log add column if not exists user_agent text;
alter table if exists audit_log add column if not exists session_id text;

create table if not exists payout_batches (
  id serial primary key,
  brand_id integer,
  partner_id integer,
  commission_ids json not null default '[]'::json,
  total_amount numeric(10,2) not null,
  bank_reference text not null,
  proof_url text,
  status text not null default 'paid',
  audit_note text,
  created_by text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists audit_log enable row level security;
alter table if exists leads enable row level security;
alter table if exists commissions enable row level security;
alter table if exists payout_batches enable row level security;

drop policy if exists audit_log_service_only on audit_log;
create policy audit_log_service_only on audit_log
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists leads_authenticated_read on leads;
create policy leads_authenticated_read on leads
  for select using (auth.role() in ('authenticated', 'service_role'));

drop policy if exists commissions_authenticated_read on commissions;
create policy commissions_authenticated_read on commissions
  for select using (auth.role() in ('authenticated', 'service_role'));
