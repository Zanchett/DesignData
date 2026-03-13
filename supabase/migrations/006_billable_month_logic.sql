-- Migration 006: Update billable hours to use Month🟪 label for month attribution
-- Instead of using date_updated year, we parse the month/year from billable_month field
-- Weekly breakdown: each month has 4 weeks (W1-W4 = Jan, W5-W8 = Feb, etc.)

-- Helper: parse month number from billable_month string like "January 2026"
CREATE OR REPLACE FUNCTION parse_billable_month_num(p_billable_month TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE
        WHEN p_billable_month ILIKE 'january%' THEN 1
        WHEN p_billable_month ILIKE 'february%' THEN 2
        WHEN p_billable_month ILIKE 'march%' THEN 3
        WHEN p_billable_month ILIKE 'april%' THEN 4
        WHEN p_billable_month ILIKE 'may%' THEN 5
        WHEN p_billable_month ILIKE 'june%' THEN 6
        WHEN p_billable_month ILIKE 'july%' THEN 7
        WHEN p_billable_month ILIKE 'august%' THEN 8
        WHEN p_billable_month ILIKE 'september%' THEN 9
        WHEN p_billable_month ILIKE 'october%' THEN 10
        WHEN p_billable_month ILIKE 'november%' THEN 11
        WHEN p_billable_month ILIKE 'december%' THEN 12
        ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper: parse year from billable_month string like "January 2026"
CREATE OR REPLACE FUNCTION parse_billable_year(p_billable_month TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN regexp_replace(p_billable_month, '^[A-Za-z]+ ', '')::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Updated: Weekly billable breakdown using billable_month for month attribution
-- Weeks are fixed: W1-W4 = January, W5-W8 = February, ..., W45-W48 = December
-- Within each month, the week is determined by date_updated day (1-7=W1, 8-14=W2, 15-21=W3, 22+=W4)
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
    WITH parsed AS (
        SELECT
            t.folder_id AS cid,
            t.billable_time,
            t.date_updated,
            parse_billable_month_num(t.billable_month) AS month_num,
            parse_billable_year(t.billable_month) AS bill_year
        FROM tasks t
        WHERE t.parent_task_id IS NULL
          AND t.billable_time IS NOT NULL
          AND t.billable_time > 0
          AND t.billable_month IS NOT NULL
    ),
    weekly AS (
        SELECT
            p.cid,
            (
                (p.month_num - 1) * 4
                + LEAST(CEIL(EXTRACT(DAY FROM p.date_updated) / 7.0), 4)
            )::INTEGER AS wk,
            p.billable_time
        FROM parsed p
        WHERE p.bill_year = p_year
          AND p.month_num IS NOT NULL
    )
    SELECT
        w.cid,
        w.wk,
        ROUND(SUM(w.billable_time), 1)
    FROM weekly w
    GROUP BY w.cid, w.wk
    ORDER BY w.cid, w.wk;
END;
$$ LANGUAGE plpgsql;


-- Updated: client metrics billable branch to use billable_month
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
                CASE WHEN t.parent_task_id IS NULL AND t.billable_time IS NOT NULL
                     AND t.billable_month IS NOT NULL
                THEN t.billable_time ELSE 0 END
            ), 0), 1)
        FROM clients c
        LEFT JOIN tasks t ON c.id = t.folder_id
            AND (p_start_date IS NULL OR t.date_created >= p_start_date)
            AND (p_end_date IS NULL OR t.date_created <= p_end_date)
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        GROUP BY c.id, c.name
        ORDER BY ROUND(COALESCE(SUM(
            CASE WHEN t.parent_task_id IS NULL AND t.billable_time IS NOT NULL
                 AND t.billable_month IS NOT NULL
            THEN t.billable_time ELSE 0 END
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


-- Updated: designer metrics billable branch to use billable_month
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
                     AND t.billable_month IS NOT NULL
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
                 AND t.billable_month IS NOT NULL
                 AND (p_start_date IS NULL OR t.date_created >= p_start_date)
                 AND (p_end_date IS NULL OR t.date_created <= p_end_date)
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
