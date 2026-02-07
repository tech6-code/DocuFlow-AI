-- Check if tables exist and how much data they contain
-- Run this BEFORE dropping/recreating tables to verify if you have data to preserve

-- Check if tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        ) THEN 'EXISTS'
        ELSE 'NOT FOUND'
    END as table_status
FROM (
    VALUES 
        ('ct_filing_typetwo'),
        ('ct_filing_step_balances'),
        ('ct_filing_transactions'),
        ('ct_filing_step_data')
) AS t(table_name);

-- Count records in each table (if they exist)
DO $$
BEGIN
    -- Check ct_filing_typetwo
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ct_filing_typetwo') THEN
        RAISE NOTICE 'ct_filing_typetwo records: %', (SELECT COUNT(*) FROM ct_filing_typetwo);
    ELSE
        RAISE NOTICE 'ct_filing_typetwo: Table does not exist';
    END IF;

    -- Check ct_filing_step_balances
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ct_filing_step_balances') THEN
        RAISE NOTICE 'ct_filing_step_balances records: %', (SELECT COUNT(*) FROM ct_filing_step_balances);
    ELSE
        RAISE NOTICE 'ct_filing_step_balances: Table does not exist';
    END IF;

    -- Check ct_filing_transactions
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ct_filing_transactions') THEN
        RAISE NOTICE 'ct_filing_transactions records: %', (SELECT COUNT(*) FROM ct_filing_transactions);
    ELSE
        RAISE NOTICE 'ct_filing_transactions: Table does not exist';
    END IF;

    -- Check ct_filing_step_data
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ct_filing_step_data') THEN
        RAISE NOTICE 'ct_filing_step_data records: %', (SELECT COUNT(*) FROM ct_filing_step_data);
    ELSE
        RAISE NOTICE 'ct_filing_step_data: Table does not exist';
    END IF;
END $$;

-- Alternative: Simple row count query (if tables exist)
-- Uncomment and run if the above doesn't work in your SQL editor

/*
SELECT 
    'ct_filing_typetwo' as table_name,
    COUNT(*) as record_count
FROM ct_filing_typetwo
UNION ALL
SELECT 
    'ct_filing_step_balances',
    COUNT(*)
FROM ct_filing_step_balances
UNION ALL
SELECT 
    'ct_filing_transactions',
    COUNT(*)
FROM ct_filing_transactions
UNION ALL
SELECT 
    'ct_filing_step_data',
    COUNT(*)
FROM ct_filing_step_data;
*/

-- View sample data (if exists)
/*
SELECT * FROM ct_filing_typetwo LIMIT 5;
SELECT * FROM ct_filing_step_balances LIMIT 5;
SELECT * FROM ct_filing_transactions LIMIT 5;
SELECT * FROM ct_filing_step_data LIMIT 5;
*/
