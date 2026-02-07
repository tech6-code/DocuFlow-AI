-- CT Filing Type 2 Workflow Data Storage Schema - ENHANCED VERSION
-- This schema stores all data for CT Filing Type 2 workflow (Bank + Invoice)
-- Related to company_id, customer_id, workflow type, and filing_period_id

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: CT Filing Type Two
-- Stores the main CT filing Type 2 workflow information
CREATE TABLE IF NOT EXISTS ct_filing_typetwo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  filing_period_id UUID NOT NULL REFERENCES ct_filing_period(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 10,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT ct_filing_typetwo_status_check CHECK (status IN ('in_progress', 'completed', 'review', 'submitted', 'cancelled')),
  CONSTRAINT ct_filing_typetwo_steps_check CHECK (current_step >= 1 AND current_step <= total_steps)
);

-- Indexes for faster lookups and common queries
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_company ON ct_filing_typetwo(company_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_customer ON ct_filing_typetwo(customer_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_period ON ct_filing_typetwo(filing_period_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_status ON ct_filing_typetwo(status);
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_created ON ct_filing_typetwo(created_at DESC);

-- Composite index for common query pattern (company + status)
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_company_status ON ct_filing_typetwo(company_id, status);

-- Composite index for filtering by customer and period
CREATE INDEX IF NOT EXISTS idx_ct_filing_typetwo_customer_period ON ct_filing_typetwo(customer_id, filing_period_id);

-- Table 2: CT Filing Step Balances
-- Stores opening/closing balances and summary data for workflow steps
CREATE TABLE IF NOT EXISTS ct_filing_step_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ct_type_id UUID NOT NULL REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  uncategorized_count INTEGER NOT NULL DEFAULT 0,
  files_count INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ct_filing_balances_step_check CHECK (step_number >= 1 AND step_number <= 10),
  CONSTRAINT ct_filing_balances_count_check CHECK (total_count >= 0 AND uncategorized_count >= 0 AND uncategorized_count <= total_count),
  CONSTRAINT ct_filing_balances_currency_check CHECK (currency IN ('AED', 'USD', 'EUR', 'GBP', 'SAR')),
  UNIQUE(ct_type_id, step_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ct_filing_balances_type ON ct_filing_step_balances(ct_type_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_balances_step ON ct_filing_step_balances(step_number);

-- Table 3: CT Filing Transactions
-- Stores individual transaction records with categorization
CREATE TABLE IF NOT EXISTS ct_filing_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ct_type_id UUID NOT NULL REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  debit DECIMAL(15, 2) NOT NULL DEFAULT 0,
  credit DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  category TEXT,
  is_categorized BOOLEAN NOT NULL DEFAULT FALSE,
  original_category TEXT,
  user_modified BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ct_filing_transactions_amount_check CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT ct_filing_transactions_single_amount CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)),
  CONSTRAINT ct_filing_transactions_currency_check CHECK (currency IN ('AED', 'USD', 'EUR', 'GBP', 'SAR')),
  CONSTRAINT ct_filing_transactions_categorization_check CHECK (
    (is_categorized = TRUE AND category IS NOT NULL) OR 
    (is_categorized = FALSE)
  )
);

-- Indexes for faster lookups and common queries
CREATE INDEX IF NOT EXISTS idx_ct_filing_transactions_type ON ct_filing_transactions(ct_type_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_transactions_date ON ct_filing_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_ct_filing_transactions_category ON ct_filing_transactions(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ct_filing_transactions_uncategorized ON ct_filing_transactions(ct_type_id) WHERE is_categorized = FALSE;

-- Composite index for querying transactions by session and date range
CREATE INDEX IF NOT EXISTS idx_ct_filing_transactions_type_date ON ct_filing_transactions(ct_type_id, transaction_date);

-- Table 4: CT Filing Step Data
-- Generic table for storing JSON data for any step in the workflow
CREATE TABLE IF NOT EXISTS ct_filing_step_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ct_type_id UUID NOT NULL REFERENCES ct_filing_typetwo(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ct_filing_step_data_step_check CHECK (step_number >= 1 AND step_number <= 10),
  UNIQUE(ct_type_id, step_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ct_filing_step_data_type ON ct_filing_step_data(ct_type_id);
CREATE INDEX IF NOT EXISTS idx_ct_filing_step_data_step ON ct_filing_step_data(step_number);

-- GIN index for JSONB data queries (for searching within metadata)
CREATE INDEX IF NOT EXISTS idx_ct_filing_step_data_jsonb ON ct_filing_step_data USING GIN (data);

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables
DROP TRIGGER IF EXISTS update_ct_filing_typetwo_updated_at ON ct_filing_typetwo;
CREATE TRIGGER update_ct_filing_typetwo_updated_at
  BEFORE UPDATE ON ct_filing_typetwo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ct_filing_step_balances_updated_at ON ct_filing_step_balances;
CREATE TRIGGER update_ct_filing_step_balances_updated_at
  BEFORE UPDATE ON ct_filing_step_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ct_filing_transactions_updated_at ON ct_filing_transactions;
CREATE TRIGGER update_ct_filing_transactions_updated_at
  BEFORE UPDATE ON ct_filing_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ct_filing_step_data_updated_at ON ct_filing_step_data;
CREATE TRIGGER update_ct_filing_step_data_updated_at
  BEFORE UPDATE ON ct_filing_step_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update completed_at when status changes to 'completed'
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  IF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_completed_at ON ct_filing_typetwo;
CREATE TRIGGER trigger_set_completed_at
  BEFORE UPDATE ON ct_filing_typetwo
  FOR EACH ROW EXECUTE FUNCTION set_completed_at();

-- Comments for documentation
COMMENT ON TABLE ct_filing_typetwo IS 'Stores CT Filing Type 2 workflow data linked to companies, customers, and filing periods';
COMMENT ON TABLE ct_filing_step_balances IS 'Stores opening/closing balances and summary data for each workflow step';
COMMENT ON TABLE ct_filing_transactions IS 'Stores transaction details with categorization for CT Filing Type 2 workflow';
COMMENT ON TABLE ct_filing_step_data IS 'Generic storage for step-specific data in JSON format';

-- Column comments for better documentation
COMMENT ON COLUMN ct_filing_typetwo.status IS 'Workflow status: in_progress, completed, review, submitted, cancelled';
COMMENT ON COLUMN ct_filing_typetwo.current_step IS 'Current step number (1-10)';
COMMENT ON COLUMN ct_filing_typetwo.completed_at IS 'Timestamp when workflow was completed (auto-set when status = completed)';
COMMENT ON COLUMN ct_filing_transactions.is_categorized IS 'True if transaction has been categorized by user or AI';
COMMENT ON COLUMN ct_filing_transactions.user_modified IS 'True if user manually changed the category';
COMMENT ON COLUMN ct_filing_transactions.original_category IS 'Original AI-suggested category before user modification';
