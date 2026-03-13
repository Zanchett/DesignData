-- Migration 008: Fix billable hours double-counting caused by task_assignees JOIN
-- When a task has multiple assignees, the LEFT JOIN task_assignees creates duplicate
-- rows, inflating SUM(billable_time). Fix: use a correlated subquery for hours.

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
            -- Use subquery to avoid double-counting from task_assignees join
            ROUND(COALESCE((
                SELECT SUM(bt.billable_time)
                FROM tasks bt
                WHERE bt.folder_id = c.id
                  AND bt.parent_task_id IS NULL
                  AND bt.billable_time IS NOT NULL
                  AND bt.billable_month IS NOT NULL
                  AND (
                      p_start_date IS NULL
                      OR make_date(
                          parse_billable_year(bt.billable_month),
                          parse_billable_month_num(bt.billable_month),
                          1
                      ) >= date_trunc('month', p_start_date)::date
                  )
                  AND (
                      p_end_date IS NULL
                      OR make_date(
                          parse_billable_year(bt.billable_month),
                          parse_billable_month_num(bt.billable_month),
                          1
                      ) <= date_trunc('month', p_end_date)::date
                  )
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
        ORDER BY ROUND(COALESCE((
            SELECT SUM(bt2.billable_time)
            FROM tasks bt2
            WHERE bt2.folder_id = c.id
              AND bt2.parent_task_id IS NULL
              AND bt2.billable_time IS NOT NULL
              AND bt2.billable_month IS NOT NULL
              AND (
                  p_start_date IS NULL
                  OR make_date(
                      parse_billable_year(bt2.billable_month),
                      parse_billable_month_num(bt2.billable_month),
                      1
                  ) >= date_trunc('month', p_start_date)::date
              )
              AND (
                  p_end_date IS NULL
                  OR make_date(
                      parse_billable_year(bt2.billable_month),
                      parse_billable_month_num(bt2.billable_month),
                      1
                  ) <= date_trunc('month', p_end_date)::date
              )
        ), 0), 1) DESC;
    ELSE
        -- Tracked: unchanged
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


-- Fix designer metrics: same double-counting issue with SUM(DISTINCT)
-- SUM(DISTINCT) fails when two different tasks have identical billable_time values.
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
            -- Use subquery to avoid double-counting
            ROUND(COALESCE((
                SELECT SUM(bt.billable_time)
                FROM tasks bt
                JOIN task_assignees bta ON bt.id = bta.task_id
                WHERE bta.designer_id = d.id
                  AND bt.parent_task_id IS NULL
                  AND bt.billable_time IS NOT NULL
                  AND bt.billable_month IS NOT NULL
                  AND (
                      p_start_date IS NULL
                      OR make_date(
                          parse_billable_year(bt.billable_month),
                          parse_billable_month_num(bt.billable_month),
                          1
                      ) >= date_trunc('month', p_start_date)::date
                  )
                  AND (
                      p_end_date IS NULL
                      OR make_date(
                          parse_billable_year(bt.billable_month),
                          parse_billable_month_num(bt.billable_month),
                          1
                      ) <= date_trunc('month', p_end_date)::date
                  )
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
        ORDER BY ROUND(COALESCE((
            SELECT SUM(bt2.billable_time)
            FROM tasks bt2
            JOIN task_assignees bta2 ON bt2.id = bta2.task_id
            WHERE bta2.designer_id = d.id
              AND bt2.parent_task_id IS NULL
              AND bt2.billable_time IS NOT NULL
              AND bt2.billable_month IS NOT NULL
              AND (
                  p_start_date IS NULL
                  OR make_date(
                      parse_billable_year(bt2.billable_month),
                      parse_billable_month_num(bt2.billable_month),
                      1
                  ) >= date_trunc('month', p_start_date)::date
              )
              AND (
                  p_end_date IS NULL
                  OR make_date(
                      parse_billable_year(bt2.billable_month),
                      parse_billable_month_num(bt2.billable_month),
                      1
                  ) <= date_trunc('month', p_end_date)::date
              )
        ), 0), 1) DESC;
    ELSE
        -- Tracked: unchanged
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
