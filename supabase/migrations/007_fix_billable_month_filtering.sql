-- Migration 007: Fix billable mode to filter by billable_month instead of date_created
-- When metric = 'billable', tasks should be attributed to the month indicated by
-- the Month🟪 custom field, not by their creation date.

-- Updated client metrics: billable branch filters by billable_month
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
        -- Billable: filter by billable_month field, count only tasks with a billable_month
        RETURN QUERY
        SELECT
            c.id,
            c.name,
            COUNT(DISTINCT t.id)::BIGINT,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status_type = 'done')::BIGINT,
            COUNT(DISTINCT ta.designer_id)::BIGINT,
            ROUND(COALESCE(SUM(
                CASE WHEN t.parent_task_id IS NULL AND t.billable_time IS NOT NULL
                THEN t.billable_time ELSE 0 END
            ), 0), 1)
        FROM clients c
        LEFT JOIN tasks t ON c.id = t.folder_id
            AND t.billable_month IS NOT NULL
            AND (
                p_start_date IS NULL
                OR make_date(
                    parse_billable_year(t.billable_month),
                    parse_billable_month_num(t.billable_month),
                    1
                ) >= date_trunc('month', p_start_date)::date
            )
            AND (
                p_end_date IS NULL
                OR make_date(
                    parse_billable_year(t.billable_month),
                    parse_billable_month_num(t.billable_month),
                    1
                ) <= date_trunc('month', p_end_date)::date
            )
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        GROUP BY c.id, c.name
        ORDER BY ROUND(COALESCE(SUM(
            CASE WHEN t.parent_task_id IS NULL AND t.billable_time IS NOT NULL
            THEN t.billable_time ELSE 0 END
        ), 0), 1) DESC;
    ELSE
        -- Tracked: unchanged, filter by time_entries date
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


-- Updated designer metrics: billable branch filters by billable_month
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
                THEN t.billable_time ELSE 0 END
            ), 0), 1),
            COUNT(DISTINCT ta.task_id) FILTER (WHERE t.status_type = 'active')::BIGINT
        FROM designers d
        LEFT JOIN task_assignees ta ON d.id = ta.designer_id
        LEFT JOIN tasks t ON ta.task_id = t.id
            AND t.billable_month IS NOT NULL
            AND (
                p_start_date IS NULL
                OR make_date(
                    parse_billable_year(t.billable_month),
                    parse_billable_month_num(t.billable_month),
                    1
                ) >= date_trunc('month', p_start_date)::date
            )
            AND (
                p_end_date IS NULL
                OR make_date(
                    parse_billable_year(t.billable_month),
                    parse_billable_month_num(t.billable_month),
                    1
                ) <= date_trunc('month', p_end_date)::date
            )
        WHERE d.is_active = true
        GROUP BY d.id, d.username, d.profile_picture
        ORDER BY ROUND(COALESCE(SUM(DISTINCT
            CASE WHEN t.parent_task_id IS NULL AND t.billable_time IS NOT NULL
            THEN t.billable_time ELSE 0 END
        ), 0), 1) DESC;
    ELSE
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
