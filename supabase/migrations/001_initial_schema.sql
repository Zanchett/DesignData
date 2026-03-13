-- DesignData: ClickUp Analytics Dashboard Schema

-- App settings (stores ClickUp token, team ID — protected by RLS)
CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only service_role can access app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- No RLS policies = anon key cannot read/write

-- Sync log tracks each sync run
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    current_step TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB
);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read sync_log" ON sync_log FOR SELECT USING (true);

-- Designers (ClickUp team members)
CREATE TABLE designers (
    id BIGINT PRIMARY KEY,
    username TEXT,
    email TEXT,
    color TEXT,
    profile_picture TEXT,
    is_active BOOLEAN DEFAULT true,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE designers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read designers" ON designers FOR SELECT USING (true);

-- Clients (from ClickUp folders)
CREATE TABLE clients (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    space_id BIGINT NOT NULL,
    hidden BOOLEAN DEFAULT false,
    task_count INTEGER DEFAULT 0,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read clients" ON clients FOR SELECT USING (true);

-- Lists within client folders
CREATE TABLE lists (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    folder_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    list_type TEXT,
    task_count INTEGER DEFAULT 0,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read lists" ON lists FOR SELECT USING (true);

-- Tasks
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    status_type TEXT,
    list_id BIGINT REFERENCES lists(id) ON DELETE CASCADE,
    folder_id BIGINT REFERENCES clients(id),
    date_created TIMESTAMPTZ,
    date_updated TIMESTAMPTZ,
    date_closed TIMESTAMPTZ,
    date_done TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    time_estimate BIGINT,
    time_spent BIGINT,
    priority INTEGER,
    tags JSONB,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read tasks" ON tasks FOR SELECT USING (true);

-- Task assignees (many-to-many)
CREATE TABLE task_assignees (
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    designer_id BIGINT REFERENCES designers(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, designer_id)
);

ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read task_assignees" ON task_assignees FOR SELECT USING (true);

-- Time entries
CREATE TABLE time_entries (
    id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    designer_id BIGINT REFERENCES designers(id) ON DELETE SET NULL,
    duration BIGINT NOT NULL,
    start_timestamp TIMESTAMPTZ NOT NULL,
    end_timestamp TIMESTAMPTZ NOT NULL,
    description TEXT,
    tags JSONB,
    billable BOOLEAN DEFAULT false,
    folder_id BIGINT REFERENCES clients(id),
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read time_entries" ON time_entries FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_status_type ON tasks(status_type);
CREATE INDEX idx_tasks_folder_id ON tasks(folder_id);
CREATE INDEX idx_tasks_date_created ON tasks(date_created);
CREATE INDEX idx_tasks_date_updated ON tasks(date_updated);
CREATE INDEX idx_task_assignees_designer ON task_assignees(designer_id);
CREATE INDEX idx_time_entries_designer ON time_entries(designer_id);
CREATE INDEX idx_time_entries_start ON time_entries(start_timestamp);
CREATE INDEX idx_time_entries_folder ON time_entries(folder_id);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);
