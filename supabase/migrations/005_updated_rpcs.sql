-- DesignData: Updated RPC functions with metric toggle + new RPCs

-- Drop existing functions to recreate with new signatures
DROP FUNCTION IF EXISTS get_designer_metrics(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_client_metrics(TIMESTAMPTZ, TIMESTAMPTZ);

-- 1. Updated designer metrics with metric toggle and fixed double-counting
CREATE OR REPLACE FUNCTION get_designer_metrics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_metric TEXT DEFAULT 'tracked'
)
RETURNS TABLE (
    designer_id BIGINT,
    username TEXT,
    profile_picture TEXT,
    total_tasks BIGINT,
    tasks_completed BIGINT,
    completion_rate NUMERIC,
    total_hours NUMERIC,
    active_tasks BIGINT
) AS $$
BEGIN
    IF p_metric = 'billable' THEN
        -- Billable time: sum billable_time from parent tasks
        RETURN QUERY
        SELECT
            d.id,
            d.username,
            d.profile_picture,
            COUNT(DISTINCT ta.task_id)::BIGINT,
            COUNT(DISTINCT ta.task_id) FILTER (
                WHERE t.status_type = 'done'
            )::BIGINT,
            ROUND(
                COUNT(DISTINCT ta.task_id) FILTER (WHERE t.status_type = 'done')::NUMERIC /
                NULLIF(COUNT(DISTINCT ta.task_id), 0) * 100, 1
            ),
            ROUND(COALESCE(SUM(DISTINCT
                CASE WHEN t.parent_task_id IS NULL AND t.billable_time IS NOT NULL
                     AND (p_start_date IS NULL OR t.date_created >= p_start_date)
                     AND (p_end_date IS NULL OR t.date_created <= p_end_date)
                THEN t.billable_time ELSE 0 END
            ), 0), 1),
            COUNT(DISTINCT ta.task_id) FILTER (WHERE t.status_type = 'active')::BIGINT
        FROM designers d
        LEFT JOIN task_assignees ta ON d.id = ta.designer_id
        LEFT JOIN tasks t ON ta.task_id = t.id
            AND (p_start_date IS NULL OR t.date_created >= p_start_date)
            AND (p_end_date IS NULL OR t.date_created <= p_end_date)
        WHERE d.is_active = true
        GROUP BY d.id, d.username, d.profile_picture
        ORDER BY ROUND(COALESCE(SUM(DISTINCT
            CASE WHEN t.parent_task_id IS NULL AND t.billable_time IS NOT NULL
                 AND (p_start_date IS NULL OR t.date_created >= p_start_date)
                 AND (p_end_date IS NULL OR t.date_created <= p_end_date)
            THEN t.billable_time ELSE 0 END
        ), 0), 1) DESC;
    ELSE
        -- Tracked time: sum time_entries, excluding entries on parent tasks that have children
        RETURN QUERY
        SELECT
            d.id,
            d.username,
            d.profile_picture,
            COUNT(DISTINCT ta.task_id)::BIGINT,
            COUNT(DISTINCT ta.task_id) FILTER (
                WHERE t.status_type = 'done'
            )::BIGINT,
            ROUND(
                COUNT(DISTINCT ta.task_id) FILTER (WHERE t.status_type = 'done')::NUMERIC /
                NULLIF(COUNT(DISTINCT ta.task_id), 0) * 100, 1
            ),
            ROUND(COALESCE((
                SELECT SUM(te2.duration) / 3600000.0
                FROM time_entries te2
                WHERE te2.designer_id = d.id
                  AND (p_start_date IS NULL OR te2.start_timestamp >= p_start_date)
                  AND (p_end_date IS NULL OR te2.start_timestamp <= p_end_date)
                  AND NOT EXISTS (
                      SELECT 1 FROM tasks child
                      WHERE child.parent_task_id = te2.task_id
                  )
            ), 0), 1),
            COUNT(DISTINCT ta.task_id) FILTER (WHERE t.status_type = 'active')::BIGINT
        FROM designers d
        LEFT JOIN task_assignees ta ON d.id = ta.designer_id
        LEFT JOIN tasks t ON ta.task_id = t.id
            AND (p_start_date IS NULL OR t.date_created >= p_start_date)
            AND (p_end_date IS NULL OR t.date_created <= p_end_date)
        WHERE d.is_active = true
        GROUP BY d.id, d.username, d.profile_picture
        ORDER BY ROUND(COALESCE((
            SELECT SUM(te2.duration) / 3600000.0
            FROM time_entries te2
            WHERE te2.designer_id = d.id
              AND (p_start_date IS NULL OR te2.start_timestamp >= p_start_date)
              AND (p_end_date IS NULL OR te2.start_timestamp <= p_end_date)
              AND NOT EXISTS (
                  SELECT 1 FROM tasks child
                  WHERE child.parent_task_id = te2.task_id
              )
        ), 0), 1) DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Updated client metrics with metric toggle
CREATE OR REPLACE FUNCTION get_client_metrics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_metric TEXT DEFAULT 'tracked'
)
RETURNS TABLE (
    client_id BIGINT,
    client_name TEXT,
    total_tasks BIGINT,
    completed_tasks BIGINT,
    designers_involved BIGINT,
    total_hours NUMERIC
) AS $$
BEGIN
    IF p_metric = 'billable' THEN
        RETURN QUERY
        SELECT
            c.id,
            c.name,
            COUNT(DISTINCT t.id)::BIGINT,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status_type = 'done')::BIGINT,
            COUNT(DISTINCT ta.designer_id)::BIGINT,
            ROUND(COALESCE(SUM(
                CASE WHEN t.parent_task_id IS NULL THEN t.billable_time ELSE 0 END
            ), 0), 1)
        FROM clients c
        LEFT JOIN tasks t ON c.id = t.folder_id
            AND (p_start_date IS NULL OR t.date_created >= p_start_date)
            AND (p_end_date IS NULL OR t.date_created <= p_end_date)
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        GROUP BY c.id, c.name
        ORDER BY ROUND(COALESCE(SUM(
            CASE WHEN t.parent_task_id IS NULL THEN t.billable_time ELSE 0 END
        ), 0), 1) DESC;
    ELSE
        RETURN QUERY
        SELECT
            c.id,
            c.name,
            COUNT(DISTINCT t.id)::BIGINT,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status_type = 'done')::BIGINT,
            COUNT(DISTINCT ta.designer_id)::BIGINT,
            ROUND(COALESCE((
                SELECT SUM(te2.duration) / 3600000.0
                FROM time_entries te2
                WHERE te2.folder_id = c.id
                  AND (p_start_date IS NULL OR te2.start_timestamp >= p_start_date)
                  AND (p_end_date IS NULL OR te2.start_timestamp <= p_end_date)
                  AND NOT EXISTS (
                      SELECT 1 FROM tasks child
                      WHERE child.parent_task_id = te2.task_id
                  )
            ), 0), 1)
        FROM clients c
        LEFT JOIN tasks t ON c.id = t.folder_id
            AND (p_start_date IS NULL OR t.date_created >= p_start_date)
            AND (p_end_date IS NULL OR t.date_created <= p_end_date)
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        GROUP BY c.id, c.name
        ORDER BY ROUND(COALESCE((
            SELECT SUM(te2.duration) / 3600000.0
            FROM time_entries te2
            WHERE te2.folder_id = c.id
              AND (p_start_date IS NULL OR te2.start_timestamp >= p_start_date)
              AND (p_end_date IS NULL OR te2.start_timestamp <= p_end_date)
              AND NOT EXISTS (
                  SELECT 1 FROM tasks child
                  WHERE child.parent_task_id = te2.task_id
              )
        ), 0), 1) DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Designer-Client detail drill-down
CREATE OR REPLACE FUNCTION get_designer_client_detail(
    p_designer_id BIGINT,
    p_client_id BIGINT,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    task_id TEXT,
    task_name TEXT,
    status TEXT,
    status_type TEXT,
    is_parent BOOLEAN,
    tracked_hours NUMERIC,
    billable_time NUMERIC,
    date_updated TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.status,
        t.status_type,
        (t.parent_task_id IS NULL) AS is_parent,
        ROUND(COALESCE((
            SELECT SUM(te.duration) / 3600000.0
            FROM time_entries te
            WHERE te.task_id = t.id
              AND (p_start_date IS NULL OR te.start_timestamp >= p_start_date)
              AND (p_end_date IS NULL OR te.start_timestamp <= p_end_date)
        ), 0), 2),
        COALESCE(t.billable_time, 0),
        t.date_updated
    FROM tasks t
    INNER JOIN task_assignees ta ON t.id = ta.task_id AND ta.designer_id = p_designer_id
    WHERE t.folder_id = p_client_id
      AND (p_start_date IS NULL OR t.date_created >= p_start_date)
      AND (p_end_date IS NULL OR t.date_created <= p_end_date)
    ORDER BY t.date_updated DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- 4. Weekly billable breakdown for all clients (for Hour Tracker)
CREATE OR REPLACE FUNCTION get_weekly_billable_all(
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM now())::INTEGER
)
RETURNS TABLE (
    client_id BIGINT,
    week_number INTEGER,
    incremental_billable NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH weekly AS (
        SELECT
            t.folder_id AS cid,
            EXTRACT(WEEK FROM t.date_updated)::INTEGER AS wk,
            COALESCE(SUM(t.billable_time), 0) AS total_billable
        FROM tasks t
        WHERE t.parent_task_id IS NULL
          AND t.billable_time IS NOT NULL
          AND t.billable_time > 0
          AND EXTRACT(YEAR FROM t.date_updated) = p_year
        GROUP BY t.folder_id, EXTRACT(WEEK FROM t.date_updated)
    )
    SELECT
        w.cid,
        w.wk,
        w.total_billable
    FROM weekly w
    ORDER BY w.cid, w.wk;
END;
$$ LANGUAGE plpgsql;

-- 5. Refresh materialized views
DROP MATERIALIZED VIEW IF EXISTS designer_performance;
DROP MATERIALIZED VIEW IF EXISTS client_summary;

CREATE MATERIALIZED VIEW designer_performance AS
SELECT
    d.id AS designer_id,
    d.username,
    d.profile_picture,
    COUNT(DISTINCT ta.task_id) AS total_tasks_assigned,
    COUNT(DISTINCT ta.task_id) FILTER (
        WHERE t.status_type = 'done'
    ) AS tasks_completed,
    ROUND(
        COUNT(DISTINCT ta.task_id) FILTER (
            WHERE t.status_type = 'done'
        )::NUMERIC /
        NULLIF(COUNT(DISTINCT ta.task_id), 0) * 100, 1
    ) AS completion_rate,
    COALESCE((
        SELECT SUM(te2.duration)
        FROM time_entries te2
        WHERE te2.designer_id = d.id
          AND NOT EXISTS (
              SELECT 1 FROM tasks child WHERE child.parent_task_id = te2.task_id
          )
    ), 0) AS total_time_tracked_ms,
    ROUND(COALESCE((
        SELECT SUM(te2.duration) / 3600000.0
        FROM time_entries te2
        WHERE te2.designer_id = d.id
          AND NOT EXISTS (
              SELECT 1 FROM tasks child WHERE child.parent_task_id = te2.task_id
          )
    ), 0), 1) AS total_hours
FROM designers d
LEFT JOIN task_assignees ta ON d.id = ta.designer_id
LEFT JOIN tasks t ON ta.task_id = t.id
WHERE d.is_active = true
GROUP BY d.id, d.username, d.profile_picture;

CREATE UNIQUE INDEX ON designer_performance(designer_id);

CREATE MATERIALIZED VIEW client_summary AS
SELECT
    c.id AS client_id,
    c.name AS client_name,
    COUNT(DISTINCT t.id) AS total_tasks,
    COUNT(DISTINCT t.id) FILTER (
        WHERE t.status_type = 'done'
    ) AS completed_tasks,
    COUNT(DISTINCT ta.designer_id) AS designers_involved,
    COALESCE((
        SELECT SUM(te2.duration)
        FROM time_entries te2
        WHERE te2.folder_id = c.id
          AND NOT EXISTS (
              SELECT 1 FROM tasks child WHERE child.parent_task_id = te2.task_id
          )
    ), 0) AS total_time_ms,
    ROUND(COALESCE((
        SELECT SUM(te2.duration) / 3600000.0
        FROM time_entries te2
        WHERE te2.folder_id = c.id
          AND NOT EXISTS (
              SELECT 1 FROM tasks child WHERE child.parent_task_id = te2.task_id
          )
    ), 0), 1) AS total_hours
FROM clients c
LEFT JOIN tasks t ON c.id = t.folder_id
LEFT JOIN task_assignees ta ON t.id = ta.task_id
GROUP BY c.id, c.name;

CREATE UNIQUE INDEX ON client_summary(client_id);
