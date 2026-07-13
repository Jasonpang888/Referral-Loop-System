-- Bijak Partner Growth Platform baseline schema for Supabase Postgres.
-- Drizzle remains the application schema source; this file is the deployable SQL baseline.

do $$ begin
  create type user_role as enum (
    'super_admin',
    'brand_admin',
    'outlet_staff',
    'finance',
    'partner_admin',
    'partner_staff',
    'brand_staff',
    'partner',
    'admin',
    'zhengji_staff',
    'kiri_partner'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type partner_type as enum (
    'bar',
    'gym',
    'yoga_studio',
    'golf_club',
    'salon',
    'corporate_hr',
    'agent',
    'retailer',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type commission_type as enum ('flat_rm30', 'package_percent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_stage as enum (
    'new_lead',
    'contacted',
    'appointment_booked',
    'arrived',
    'free_consultation_only',
    'first_paid_treatment',
    'package_purchased',
    'repeat_customer',
    'invalid',
    'cancelled',
    'invalid_cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type commission_status as enum (
    'pending',
    'approved',
    'paid',
    'disputed',
    'rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_batch_status as enum (
    'draft',
    'paid',
    'disputed',
    'void'
  );
exception when duplicate_object then null; end $$;

create table if not exists brands (
  id serial primary key,
  name text not null,
  name_zh text,
  description text,
  logo_url text,
  primary_color text not null default '#10b981',
  accent_color text not null default '#6ee7b7',
  industry text,
  website text,
  is_active boolean not null default true,
  settings json not null default '{}'::json,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id serial primary key,
  username text not null unique,
  password_hash text not null,
  role user_role not null default 'partner',
  display_name text not null,
  brand_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists partners (
  id serial primary key,
  user_id integer not null,
  brand_id integer,
  display_name text not null,
  business_name text,
  partner_type partner_type not null default 'other',
  referral_code text not null unique,
  kiri_membership_id text,
  phone text,
  email text,
  is_active boolean not null default true,
  total_leads integer not null default 0,
  total_conversions integer not null default 0,
  total_commission_earned numeric(10,2) not null default '0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id serial primary key,
  brand_id integer,
  name text not null,
  name_zh text,
  description text,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  flat_reward_amount numeric(10,2) not null default '30',
  package_commission_min numeric(5,2) not null default '8',
  package_commission_max numeric(5,2) not null default '10',
  default_commission_type commission_type not null default 'flat_rm30',
  tier_bonuses json not null default '[]'::json,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id serial primary key,
  brand_id integer,
  name text not null,
  name_zh text,
  mobile text not null,
  whatsapp text,
  kiri_membership_id text,
  referral_code text not null,
  partner_id integer not null,
  campaign_id integer,
  stage lead_stage not null default 'new_lead',
  selected_offer text not null default 'Free Consultation + 10% Discount',
  appointment_intent text,
  appointment_date date,
  net_sale_amount numeric(10,2),
  proof_url text,
  consent_given boolean not null default false,
  notes text,
  lang text not null default 'en',
  commission_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists leads_mobile_unique_idx on leads (mobile);
create unique index if not exists leads_membership_unique_idx on leads (kiri_membership_id) where kiri_membership_id is not null;

create table if not exists commissions (
  id serial primary key,
  brand_id integer,
  lead_id integer not null,
  partner_id integer not null,
  campaign_id integer,
  amount numeric(10,2) not null,
  commission_type text not null default 'flat_rm30',
  commission_rate numeric(5,2),
  net_sale_amount numeric(10,2),
  status commission_status not null default 'pending',
  payout_reference text,
  proof_url text,
  audit_note text,
  approved_by text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists commissions_lead_unique_idx on commissions (lead_id);

create table if not exists audit_log (
  id serial primary key,
  brand_id integer,
  entity_type text not null,
  entity_id integer not null,
  action text not null,
  previous_value text,
  new_value text,
  previous_amount numeric(10,2),
  new_amount numeric(10,2),
  audit_note text,
  performed_by text not null,
  ip_address text,
  user_agent text,
  session_id text,
  created_at timestamptz not null default now()
);

create table if not exists payout_batches (
  id serial primary key,
  brand_id integer,
  partner_id integer,
  commission_ids json not null default '[]'::json,
  total_amount numeric(10,2) not null,
  bank_reference text not null,
  proof_url text,
  status payout_batch_status not null default 'paid',
  audit_note text,
  created_by text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table brands enable row level security;
alter table users enable row level security;
alter table partners enable row level security;
alter table campaigns enable row level security;
alter table audit_log enable row level security;
alter table leads enable row level security;
alter table commissions enable row level security;
alter table payout_batches enable row level security;

drop policy if exists brands_service_only on brands;
create policy brands_service_only on brands for all to service_role using (true) with check (true);

drop policy if exists users_service_only on users;
create policy users_service_only on users for all to service_role using (true) with check (true);

drop policy if exists partners_service_only on partners;
create policy partners_service_only on partners for all to service_role using (true) with check (true);

drop policy if exists campaigns_service_only on campaigns;
create policy campaigns_service_only on campaigns for all to service_role using (true) with check (true);

drop policy if exists audit_log_service_only on audit_log;
create policy audit_log_service_only on audit_log for all to service_role using (true) with check (true);

drop policy if exists leads_authenticated_read on leads;
create policy leads_authenticated_read on leads for select to authenticated, service_role using (true);

drop policy if exists commissions_authenticated_read on commissions;
create policy commissions_authenticated_read on commissions for select to authenticated, service_role using (true);

drop policy if exists payout_batches_service_only on payout_batches;
create policy payout_batches_service_only on payout_batches for all to service_role using (true) with check (true);
