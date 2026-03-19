-- Migration: Change qr_code from UUID to student_id format
-- This updates existing database to use student_id as qr_code

-- Step 1: Update existing records to use student_id as qr_code
UPDATE attendants SET qr_code = student_id::text;

-- Step 2: Alter column type from UUID to VARCHAR
ALTER TABLE attendants ALTER COLUMN qr_code TYPE VARCHAR(100);

-- Verification query (optional - run to check)
-- SELECT id, name, student_id, qr_code FROM attendants;
