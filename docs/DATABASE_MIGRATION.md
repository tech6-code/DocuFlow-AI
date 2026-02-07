# Database Migration Guide

## Problem
You're getting the error: `column "ct_filing_typetwo_id" does not exist` because the database still has the old schema with `ct_filing_session_id` columns.

## Solution - Choose ONE Option:

### Option 1: Migrate Existing Data (Recommended if you have data)
Run the migration script to rename existing tables and columns:

**File:** `server/src/database/migrate_to_typetwo.sql`

This will:
- Rename `ct_filing_sessions` table to `ct_filing_typetwo`
- Rename all `ct_filing_session_id` columns to `ct_filing_typetwo_id`
- Update constraints, indexes, and foreign keys
- **Preserves all existing data**

### Option 2: Fresh Install (If no important data)
Drop all old tables and create fresh with new schema:

```sql
-- Drop old tables (WARNING: This deletes all data!)
DROP TABLE IF EXISTS ct_filing_step_data CASCADE;
DROP TABLE IF EXISTS ct_filing_transactions CASCADE;
DROP TABLE IF EXISTS ct_filing_step_balances CASCADE;
DROP TABLE IF EXISTS ct_filing_sessions CASCADE;
```

Then run: `server/src/database/ctfillingtype_schema.sql`

## Steps to Apply

### For Option 1 (Migration):
1. Open Supabase SQL Editor
2. Run `server/src/database/migrate_to_typetwo.sql`
3. Restart your server
4. Done! All existing data is preserved

### For Option 2 (Fresh):
1. Open Supabase SQL Editor
2. Run the DROP commands above
3. Run `server/src/database/ctfillingtype_schema.sql`
4. Restart your server
5. Done! Fresh tables created

## Verify Migration
After running migration, verify with:

```sql
-- Check table exists
SELECT * FROM ct_filing_typetwo LIMIT 1;

-- Check column names
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'ct_filing_step_balances';
```

You should see `ct_filing_typetwo_id` in the column list.
