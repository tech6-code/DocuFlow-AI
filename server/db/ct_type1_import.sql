-- CT Filing Type 1 import persistence
-- Run in Supabase SQL editor or migrations pipeline

create table if not exists ct_type1_import_batches (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  filing_type text not null default 'type1',
  step int not null default 1,
  status text not null default 'processing',
  created_by uuid,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_ct_type1_batches_project_step on ct_type1_import_batches (project_id, filing_type, step);
create index if not exists idx_ct_type1_batches_active on ct_type1_import_batches (project_id, is_active, created_at desc);

create table if not exists ct_type1_import_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references ct_type1_import_batches(id) on delete cascade,
  filename text not null,
  storage_path text,
  pages int,
  password_used boolean,
  summary_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ct_type1_files_batch on ct_type1_import_files (batch_id);

create table if not exists ct_type1_import_summary (
  batch_id uuid primary key references ct_type1_import_batches(id) on delete cascade,
  opening_balance numeric,
  closing_balance numeric,
  total_count int,
  uncategorized_count int,
  currency text,
  summary_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ct_type1_import_transactions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references ct_type1_import_batches(id) on delete cascade,
  project_id text not null,
  file_id uuid references ct_type1_import_files(id) on delete set null,
  row_index int not null,
  txn_date text,
  description text,
  debit numeric,
  credit numeric,
  currency text,
  category_id text,
  is_uncategorized boolean not null default false,
  raw_json jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_ct_type1_rows on ct_type1_import_transactions (batch_id, file_id, row_index);
create index if not exists idx_ct_type1_tx_batch on ct_type1_import_transactions (batch_id);
create index if not exists idx_ct_type1_tx_project on ct_type1_import_transactions (project_id);
create index if not exists idx_ct_type1_tx_category on ct_type1_import_transactions (category_id);
create index if not exists idx_ct_type1_tx_description on ct_type1_import_transactions (description);
