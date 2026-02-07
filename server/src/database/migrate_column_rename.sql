-- Migration: Rename ct_filing_typetwo_id to ct_type_id
-- This simplifies the foreign key column naming

-- Step 1: Drop existing foreign key constraints
ALTER TABLE ct_filing_step_balances DROP CONSTRAINT IF EXISTS ct_filing_step_balances_ct_filing_typetwo_id_fkey;
ALTER TABLE ct_filing_transactions DROP CONSTRAINT IF EXISTS ct_filing_transactions_ct_filing_typetwo_id_fkey;
ALTER TABLE ct_filing_step_data DROP CONSTRAINT IF EXISTS ct_filing_step_data_ct_filing_typetwo_id_fkey;

-- Step 2: Rename columns
ALTER TABLE ct_filing_step_balances RENAME COLUMN ct_filing_typetwo_id TO ct_type_id;
ALTER TABLE ct_filing_transactions RENAME COLUMN ct_filing_typetwo_id TO ct_type_id;
ALTER TABLE ct_filing_step_data RENAME COLUMN ct_filing_typetwo_id TO ct_type_id;

-- Step 3: Re-add foreign key constraints with new column name
ALTER TABLE ct_filing_step_balances 
  ADD CONSTRAINT ct_filing_step_balances_ct_type_id_fkey 
  FOREIGN KEY (ct_type_id) REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE;

ALTER TABLE ct_filing_transactions 
  ADD CONSTRAINT ct_filing_transactions_ct_type_id_fkey 
  FOREIGN KEY (ct_type_id) REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE;

ALTER TABLE ct_filing_step_data 
  ADD CONSTRAINT ct_filing_step_data_ct_type_id_fkey 
  FOREIGN KEY (ct_type_id) REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE;

-- Step 4: Drop old indexes
DROP INDEX IF EXISTS idx_ct_filing_balances_typetwo;
DROP INDEX IF EXISTS idx_ct_filing_transactions_typetwo;
DROP INDEX IF EXISTS idx_ct_filing_transactions_typetwo_date;
DROP INDEX IF EXISTS idx_ct_filing_step_data_typetwo;

-- Step 5: Create new indexes with updated column name
CREATE INDEX IF NOT EXISTS idx_ct_filing_balances_type ON ct_filing_step_balances(ct_type_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_transactions_type ON ct_filing_transactions(ct_type_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_transactions_type_date ON ct_filing_transactions(ct_type_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_ct_filing_step_data_type ON ct_filing_step_data(ct_type_id);

-- Step 6: Update unique constraints
ALTER TABLE ct_filing_step_balances DROP CONSTRAINT IF EXISTS ct_filing_step_balances_ct_filing_typetwo_id_step_number_key;
ALTER TABLE ct_filing_step_balances ADD CONSTRAINT ct_filing_step_balances_ct_type_id_step_number_key 
  UNIQUE (ct_type_id, step_number);

ALTER TABLE ct_filing_step_data DROP CONSTRAINT IF EXISTS ct_filing_step_data_ct_filing_typetwo_id_step_number_key;
ALTER TABLE ct_filing_step_data ADD CONSTRAINT ct_filing_step_data_ct_type_id_step_number_key 
  UNIQUE (ct_type_id, step_number);

-- Verification query
SELECT 
  'ct_filing_step_balances' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'ct_filing_step_balances' AND column_name = 'ct_type_id'
UNION ALL
SELECT 
  'ct_filing_transactions',
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'ct_filing_transactions' AND column_name = 'ct_type_id'
UNION ALL  
SELECT 
  'ct_filing_step_data',
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'ct_filing_step_data' AND column_name = 'ct_type_id';
