-- Migration script to rename ct_filing_session_id to ct_filing_typetwo_id
-- Run this BEFORE applying the new schema if tables already exist

-- Step 1: Drop existing foreign key constraints
ALTER TABLE ct_filing_step_balances DROP CONSTRAINT IF EXISTS ct_filing_step_balances_ct_filing_session_id_fkey;
ALTER TABLE ct_filing_transactions DROP CONSTRAINT IF EXISTS ct_filing_transactions_ct_filing_session_id_fkey;
ALTER TABLE ct_filing_step_data DROP CONSTRAINT IF EXISTS ct_filing_step_data_ct_filing_session_id_fkey;

-- Step 2: Rename the main table
ALTER TABLE IF EXISTS ct_filing_sessions RENAME TO ct_filing_typetwo;

-- Step 3: Rename columns in related tables
ALTER TABLE IF EXISTS ct_filing_step_balances RENAME COLUMN ct_filing_session_id TO ct_filing_typetwo_id;
ALTER TABLE IF EXISTS ct_filing_transactions RENAME COLUMN ct_filing_session_id TO ct_filing_typetwo_id;
ALTER TABLE IF EXISTS ct_filing_step_data RENAME COLUMN ct_filing_session_id TO ct_filing_typetwo_id;

-- Step 4: Re-add foreign key constraints with new names
ALTER TABLE ct_filing_step_balances 
  ADD CONSTRAINT ct_filing_step_balances_ct_filing_typetwo_id_fkey 
  FOREIGN KEY (ct_filing_typetwo_id) REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE;

ALTER TABLE ct_filing_transactions 
  ADD CONSTRAINT ct_filing_transactions_ct_filing_typetwo_id_fkey 
  FOREIGN KEY (ct_filing_typetwo_id) REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE;

ALTER TABLE ct_filing_step_data 
  ADD CONSTRAINT ct_filing_step_data_ct_filing_typetwo_id_fkey 
  FOREIGN KEY (ct_filing_typetwo_id) REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE;

-- Step 5: Drop old indexes
DROP INDEX IF EXISTS idx_ct_filing_sessions_company;
DROP INDEX IF EXISTS idx_ct_filing_sessions_customer;
DROP INDEX IF EXISTS idx_ct_filing_sessions_period;
DROP INDEX IF EXISTS idx_ct_filing_sessions_type;
DROP INDEX IF EXISTS idx_ct_filing_balances_session;
DROP INDEX IF EXISTS idx_ct_filing_transactions_session;
DROP INDEX IF EXISTS idx_ct_filing_step_data_session;

-- Step 6: Create new indexes
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_company ON ct_filing_typetwo(company_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_customer ON ct_filing_typetwo(customer_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_period ON ct_filing_typetwo(filing_period_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_type ON ct_filing_typetwo(ct_type_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_balances_typetwo ON ct_filing_step_balances(ct_filing_typetwo_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_transactions_typetwo ON ct_filing_transactions(ct_filing_typetwo_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_step_data_typetwo ON ct_filing_step_data(ct_filing_typetwo_id);

-- Step 7: Drop and recreate unique constraints
ALTER TABLE ct_filing_step_balances DROP CONSTRAINT IF EXISTS ct_filing_step_balances_ct_filing_session_id_step_number_key;
ALTER TABLE ct_filing_step_balances ADD CONSTRAINT ct_filing_step_balances_ct_filing_typetwo_id_step_number_key 
  UNIQUE (ct_filing_typetwo_id, step_number);

ALTER TABLE ct_filing_step_data DROP CONSTRAINT IF EXISTS ct_filing_step_data_ct_filing_session_id_step_number_key;
ALTER TABLE ct_filing_step_data ADD CONSTRAINT ct_filing_step_data_ct_filing_typetwo_id_step_number_key 
  UNIQUE (ct_filing_typetwo_id, step_number);

-- Step 8: Update triggers
DROP TRIGGER IF EXISTS update_ct_filing_sessions_updated_at ON ct_filing_typetwo;
CREATE TRIGGER update_ct_filing_typetwo_updated_at
  BEFORE UPDATE ON ct_filing_typetwo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update table comment
COMMENT ON TABLE ct_filing_typetwo IS 'Stores CT Filing Type 2 workflow data linked to companies, customers, and filing periods';
