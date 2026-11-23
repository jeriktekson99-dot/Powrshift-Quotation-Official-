-- =============================================================================
-- PowerShift Solar Calculator & Quotation System - Supabase PostgreSQL Schema
-- =============================================================================
-- Run this SQL file inside your Supabase Dashboard -> SQL Editor.
-- Defines two core tables matching the application's two Supabase types:
--   1. public.calculator_quotations : Full calculator inputs, tariff & usage,
--      active hardware configuration (Standard & Advanced), daily power
--      balance, solar generation, and battery storage performance.
--   2. public.saved_records : Saved quotation records list (name, reference
--      number, address, phone number, email, battery storage, package) linked
--      to calculator_quotations.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger function
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- TYPE 1 TABLE: public.calculator_quotations
-- =============================================================================
create table if not exists public.calculator_quotations (
  id uuid primary key default gen_random_uuid(),

  -- 1. Client Information
  client_full_name text not null,
  contact_phone text not null default '',
  email_address text not null default '',
  proposal_date text not null,
  site_location_address text not null default '',
  quote_reference text not null,
  engineer_name text not null default 'Engr. M. Ramos (Lead Systems Architect)',

  -- 2. Tariff & Usage Configuration
  electricity_rate numeric(10, 2) not null default 12.00,
  monthly_electricity_usage numeric(12, 2) not null default 940.00,
  monthly_bill numeric(14, 2) not null default 11280.00,
  bill_mode text not null default 'KWH' check (bill_mode in ('KWH', 'BILL')),

  -- 3. Active Hardware Configuration (Standard dropdown & Advanced numeric)
  config_mode text not null default 'STANDARD' check (config_mode in ('STANDARD', 'ADVANCED')),
  solar_package_id text not null default 'pkg-10kw',
  solar_package_name text not null default '10kW Package',
  installed_solar_kwp numeric(10, 2) not null default 10.00,
  battery_capacity_kwh numeric(10, 2) not null default 27.00,
  daytime_load_percent numeric(5, 2) not null default 40.00,
  nighttime_load_percent numeric(5, 2) not null default 60.00,

  -- Advanced Hardware Engineering Multipliers
  peak_sun_hours numeric(5, 2) not null default 5.00,
  dod_percent numeric(5, 2) not null default 80.00,
  system_loss_buffer_percent numeric(5, 2) not null default 20.00,
  derate_factor_percent numeric(5, 2) not null default 15.00,
  cost_per_kwp numeric(12, 2) not null default 52000.00,
  cost_per_battery_kwh numeric(12, 2) not null default 18500.00,

  -- 4A. System Self-Sufficiency & Performance: Daily Power Balance
  monthly_usage_kwh numeric(12, 2) not null default 940.00,
  average_daily_load_kwh numeric(10, 2) not null default 31.33,
  daytime_load_kwh numeric(10, 2) not null default 12.53,
  nighttime_load_kwh numeric(10, 2) not null default 18.80,
  recommended_size_after_loss_kwp numeric(10, 2) not null default 12.00,
  est_daily_solar_generation_kwh numeric(10, 2) not null default 42.50,
  est_monthly_solar_generation_kwh numeric(12, 2) not null default 1275.00,

  -- 4B. System Self-Sufficiency & Performance: Battery Storage Performance
  installed_capacity_kwh numeric(10, 2) not null default 27.00,
  usable_battery_kwh numeric(10, 2) not null default 21.60,
  reserve_capacity_kwh numeric(10, 2) not null default 5.40,
  nighttime_energy_needed_kwh numeric(10, 2) not null default 18.80,
  grid_import_required_kwh numeric(10, 2) not null default 0.00,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calculator_quotations_quote_ref
  on public.calculator_quotations (quote_reference);

create index if not exists idx_calculator_quotations_client_name
  on public.calculator_quotations (client_full_name);

create index if not exists idx_calculator_quotations_created_at
  on public.calculator_quotations (created_at desc);

drop trigger if exists trg_calculator_quotations_updated_at on public.calculator_quotations;
create trigger trg_calculator_quotations_updated_at
  before update on public.calculator_quotations
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- TYPE 2 TABLE: public.saved_records
-- =============================================================================
create table if not exists public.saved_records (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.calculator_quotations (id) on delete cascade,

  -- Saved Record Summary Fields
  name text not null,
  reference_number text not null,
  address text not null default '',
  phone_number text not null default '',
  email text not null default '',
  battery_storage numeric(10, 2) not null default 0.00,
  dod_percent numeric(5, 2) not null default 80.00,
  package text not null,
  installed_solar_kwp numeric(10, 2) not null default 0.00,

  -- Timestamps
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_records_quotation_id
  on public.saved_records (quotation_id);

create index if not exists idx_saved_records_reference_number
  on public.saved_records (reference_number);

create index if not exists idx_saved_records_name
  on public.saved_records (name);

create index if not exists idx_saved_records_saved_at
  on public.saved_records (saved_at desc);

drop trigger if exists trg_saved_records_updated_at on public.saved_records;
create trigger trg_saved_records_updated_at
  before update on public.saved_records
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
alter table public.calculator_quotations enable row level security;
alter table public.saved_records enable row level security;

-- NOTE: If you require Supabase Auth, change `to anon, authenticated` to
-- `to authenticated` (and scope by auth.uid() if adding a user_id column).
-- The policies below allow the client app using the anon key to read/write
-- quotations and saved records cleanly out of the box.

drop policy if exists "Allow full access to calculator_quotations" on public.calculator_quotations;
create policy "Allow full access to calculator_quotations"
  on public.calculator_quotations
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow full access to saved_records" on public.saved_records;
create policy "Allow full access to saved_records"
  on public.saved_records
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Explicit table privileges for Supabase API roles
grant usage on schema public to anon, authenticated, service_role;
grant all on table public.calculator_quotations to anon, authenticated, service_role;
grant all on table public.saved_records to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
