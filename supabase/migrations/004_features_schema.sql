-- DesignData: Feature Update Schema Changes
-- Adds parent tracking, billable time extraction, and client contracts table

-- 1. Add columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS billable_time NUMERIC;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS billable_month TEXT; -- stores month name like "January 2026"

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_parent ON tasks(parent_task_id) WHERE parent_task_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_billable ON tasks(billable_time) WHERE billable_time IS NOT NULL;

-- 2. Client contracts table for the Hour Tracker / Master Sheet
CREATE TABLE IF NOT EXISTS client_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
    project_manager TEXT,
    contract_sign_date DATE,
    plan TEXT,
    package TEXT,
    activity TEXT,
    rollover_2025 NUMERIC DEFAULT 0,
    hours_jan NUMERIC DEFAULT 0,
    hours_feb NUMERIC DEFAULT 0,
    hours_mar NUMERIC DEFAULT 0,
    hours_apr NUMERIC DEFAULT 0,
    hours_may NUMERIC DEFAULT 0,
    hours_jun NUMERIC DEFAULT 0,
    hours_jul NUMERIC DEFAULT 0,
    hours_aug NUMERIC DEFAULT 0,
    hours_sep NUMERIC DEFAULT 0,
    hours_oct NUMERIC DEFAULT 0,
    hours_nov NUMERIC DEFAULT 0,
    hours_dec NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read client_contracts" ON client_contracts FOR SELECT USING (true);

-- 3. Backfill parent_task_id from raw_data
UPDATE tasks
SET parent_task_id = raw_data->>'parent'
WHERE raw_data->>'parent' IS NOT NULL
  AND parent_task_id IS NULL;

-- 4. Backfill billable_time from custom fields
UPDATE tasks
SET billable_time = (
    SELECT (cf->>'value')::NUMERIC
    FROM jsonb_array_elements(raw_data->'custom_fields') AS cf
    WHERE cf->>'id' = '53ac0757-7e9e-4b81-ad9f-c5aa68d67f39'
      AND cf->>'value' IS NOT NULL
      AND cf->>'value' != ''
    LIMIT 1
)
WHERE parent_task_id IS NULL; -- Only parent tasks have billable time

-- 5. Backfill billable_month from Month dropdown custom field
-- The Month dropdown stores orderindex as value, and we need the option name
-- We extract the month name by matching value (orderindex) to the options array
UPDATE tasks
SET billable_month = (
    SELECT opt->>'name'
    FROM jsonb_array_elements(raw_data->'custom_fields') AS cf,
         jsonb_array_elements(cf->'type_config'->'options') AS opt
    WHERE cf->'type_config'->'options' IS NOT NULL
      AND cf->>'name' LIKE '%Month%'
      AND (opt->>'orderindex')::INTEGER = (cf->>'value')::INTEGER
    LIMIT 1
)
WHERE parent_task_id IS NULL
  AND raw_data IS NOT NULL;
