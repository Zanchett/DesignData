-- Migration 009: Weekly hour snapshots table
-- Stores incremental weekly billable hours per client, populated via manual sync.
-- Replaces the auto-calculated get_weekly_billable_all RPC for hour tracker display.

CREATE TABLE IF NOT EXISTS weekly_hour_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 48),
    hours NUMERIC NOT NULL DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (client_id, year, week_number)
);

CREATE INDEX idx_weekly_snapshots_client_year
    ON weekly_hour_snapshots(client_id, year);

ALTER TABLE weekly_hour_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read weekly_hour_snapshots"
    ON weekly_hour_snapshots FOR SELECT USING (true);
