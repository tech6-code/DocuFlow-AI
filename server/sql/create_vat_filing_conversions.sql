-- Create table for VAT filing conversion drafts/runs linked to filing periods
-- Run in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.vat_filing_conversions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid null references public.users(id) on delete set null,
    customer_id uuid not null references public.customers(id) on delete cascade,
    period_id uuid not null references public.vat_filing_period(id) on delete cascade,
    conversion_name text not null default 'Conversion',
    status text not null default 'draft',
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint vat_filing_conversions_status_chk check (
        status in ('draft', 'completed', 'submitted')
    )
);

create index if not exists idx_vat_filing_conversions_period_id
    on public.vat_filing_conversions (period_id, created_at desc);

create index if not exists idx_vat_filing_conversions_customer_id
    on public.vat_filing_conversions (customer_id);

create index if not exists idx_vat_filing_conversions_user_id
    on public.vat_filing_conversions (user_id);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vat_filing_conversions_updated_at on public.vat_filing_conversions;

create trigger trg_vat_filing_conversions_updated_at
before update on public.vat_filing_conversions
for each row
execute function public.set_updated_at_timestamp();

-- RLS
alter table public.vat_filing_conversions enable row level security;

drop policy if exists "vat_filing_conversions_select_own" on public.vat_filing_conversions;
drop policy if exists "vat_filing_conversions_insert_own" on public.vat_filing_conversions;
drop policy if exists "vat_filing_conversions_update_own" on public.vat_filing_conversions;
drop policy if exists "vat_filing_conversions_delete_own" on public.vat_filing_conversions;

create policy "vat_filing_conversions_select_own"
on public.vat_filing_conversions
for select
to authenticated
using (user_id = auth.uid());

create policy "vat_filing_conversions_insert_own"
on public.vat_filing_conversions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "vat_filing_conversions_update_own"
on public.vat_filing_conversions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "vat_filing_conversions_delete_own"
on public.vat_filing_conversions
for delete
to authenticated
using (user_id = auth.uid());

