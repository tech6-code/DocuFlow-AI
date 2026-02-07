-- OPTION 1: Fresh Installation (No Existing Data)
-- Run this if you have no important data and want to start fresh

-- Drop all existing tables
DROP TABLE IF EXISTS ct_filing_step_data CASCADE;
DROP TABLE IF EXISTS ct_filing_transactions CASCADE;
DROP TABLE IF EXISTS ct_filing_step_balances CASCADE;
DROP TABLE IF EXISTS ct_filing_typetwo CASCADE;

-- Now run the main schema file: ctfillingtype_schema.sql
