-- Categorization Rules: Learned patterns from user corrections
-- This table stores description-to-category mappings that are learned
-- when users correct AI-categorized bank statement transactions.

CREATE TABLE IF NOT EXISTS categorization_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID,                    -- NULL = user-global, or scoped to a customer
  description TEXT,                    -- original transaction description (for high-confidence matching)
  pattern TEXT NOT NULL,               -- normalized description pattern (for fuzzy token-overlap matching)
  pattern_type TEXT NOT NULL DEFAULT 'contains',  -- 'exact' | 'contains' | 'prefix'
  category TEXT NOT NULL,              -- full category path e.g. "Expenses|OtherExpenses|Rent Expense"
  direction TEXT,                      -- 'debit' | 'credit' | NULL (any)
  times_applied INT DEFAULT 1,         -- how many times this rule was confirmed
  source TEXT DEFAULT 'user_correction', -- 'user_correction' | 'bulk_assign' | 'find_replace'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add description column if table already exists (migration safe)
DO $$ BEGIN
  ALTER TABLE categorization_rules ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Prevent duplicate rules for same user+customer+pattern+direction
CREATE UNIQUE INDEX IF NOT EXISTS idx_cat_rules_unique
  ON categorization_rules(user_id, COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid), pattern, COALESCE(direction, '__any__'));

CREATE INDEX IF NOT EXISTS idx_cat_rules_user_active
  ON categorization_rules(user_id, active);

CREATE INDEX IF NOT EXISTS idx_cat_rules_customer
  ON categorization_rules(customer_id, active);
