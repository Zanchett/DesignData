-- Migration 010: Report shares for client-facing report links
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS report_shares (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    share_token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    client_id bigint NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    month text NOT NULL,           -- e.g. "March 2026"
    year integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT NULL,  -- null = never expires
    is_active boolean DEFAULT true
);

CREATE INDEX idx_report_shares_token ON report_shares(share_token);
CREATE INDEX idx_report_shares_client ON report_shares(client_id);

-- RLS: allow anon to read (for public report pages) but only service_role can insert/delete
ALTER TABLE report_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read report shares" ON report_shares FOR SELECT USING (true);
