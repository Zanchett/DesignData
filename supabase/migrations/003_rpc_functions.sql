-- Refresh materialized views (called after sync)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY designer_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY client_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Designer metrics with date range filter
CREATE OR REPLACE FUNCTION get_designer_metrics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
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
    RETURN QUERY
    SELECT
        d.id,
        d.username,
        d.profile_picture,
        COUNT(DISTINCT ta.task_id)::BIGINT,
        COUNT(DISTINCT ta.task_id) FILTER (
            WHERE LOWER(t.status) IN ('for client review', 'closed')
        )::BIGINT,
        ROUND(
            COUNT(DISTINCT ta.task_id) FILTER (
                WHERE LOWER(t.status) IN ('for client review', 'closed')
            )::NUMERIC /
            NULLIF(COUNT(DISTINCT ta.task_id), 0) * 100, 1
        ),
        ROUND(COALESCE(SUM(DISTINCT te.duration) FILTER (
            WHERE (p_start_date IS NULL OR te.start_timestamp >= p_start_date)
              AND (p_end_date IS NULL OR te.start_timestamp <= p_end_date)
        ), 0) / 3600000.0, 1),
        COUNT(DISTINCT ta.task_id) FILTER (
            WHERE LOWER(t.status) NOT IN ('for client review', 'closed', 'ready for client', 'continued in next month')
        )::BIGINT
    FROM designers d
    LEFT JOIN task_assignees ta ON d.id = ta.designer_id
    LEFT JOIN tasks t ON ta.task_id = t.id
        AND (p_start_date IS NULL OR t.date_created >= p_start_date)
        AND (p_end_date IS NULL OR t.date_created <= p_end_date)
    LEFT JOIN time_entries te ON d.id = te.designer_id
    WHERE d.is_active = true
    GROUP BY d.id, d.username, d.profile_picture
    ORDER BY ROUND(COALESCE(SUM(DISTINCT te.duration) FILTER (
        WHERE (p_start_date IS NULL OR te.start_timestamp >= p_start_date)
          AND (p_end_date IS NULL OR te.start_timestamp <= p_end_date)
    ), 0) / 3600000.0, 1) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Client metrics with date range filter
CREATE OR REPLACE FUNCTION get_client_metrics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
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
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        COUNT(DISTINCT t.id)::BIGINT,
        COUNT(DISTINCT t.id) FILTER (
            WHERE LOWER(t.status) IN ('for client review', 'closed')
        )::BIGINT,
        COUNT(DISTINCT ta.designer_id)::BIGINT,
        ROUND(COALESCE(SUM(te.duration) FILTER (
            WHERE (p_start_date IS NULL OR te.start_timestamp >= p_start_date)
              AND (p_end_date IS NULL OR te.start_timestamp <= p_end_date)
        ), 0) / 3600000.0, 1)
    FROM clients c
    LEFT JOIN tasks t ON c.id = t.folder_id
        AND (p_start_date IS NULL OR t.date_created >= p_start_date)
        AND (p_end_date IS NULL OR t.date_created <= p_end_date)
    LEFT JOIN task_assignees ta ON t.id = ta.task_id
    LEFT JOIN time_entries te ON te.folder_id = c.id
    GROUP BY c.id, c.name
    ORDER BY ROUND(COALESCE(SUM(te.duration) FILTER (
        WHERE (p_start_date IS NULL OR te.start_timestamp >= p_start_date)
          AND (p_end_date IS NULL OR te.start_timestamp <= p_end_date)
    ), 0) / 3600000.0, 1) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Weekly/monthly time trends
CREATE OR REPLACE FUNCTION get_time_trends(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_granularity TEXT DEFAULT 'week'
)
RETURNS TABLE (
    period_start TIMESTAMPTZ,
    total_hours NUMERIC,
    tasks_completed BIGINT,
    active_designers BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc(p_granularity, te.start_timestamp) AS ps,
        ROUND(SUM(te.duration) / 3600000.0, 1),
        COUNT(DISTINCT t.id) FILTER (
            WHERE LOWER(t.status) IN ('for client review', 'closed')
        )::BIGINT,
        COUNT(DISTINCT te.designer_id)::BIGINT
    FROM time_entries te
    LEFT JOIN tasks t ON te.task_id = t.id
    WHERE te.start_timestamp >= p_start_date
      AND te.start_timestamp <= p_end_date
    GROUP BY ps
    ORDER BY ps;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Workload distribution: hours per designer over time
CREATE OR REPLACE FUNCTION get_workload_distribution(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_granularity TEXT DEFAULT 'week'
)
RETURNS TABLE (
    period_start TIMESTAMPTZ,
    designer_id BIGINT,
    username TEXT,
    hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc(p_granularity, te.start_timestamp) AS ps,
        d.id,
        d.username,
        ROUND(SUM(te.duration) / 3600000.0, 1)
    FROM time_entries te
    JOIN designers d ON te.designer_id = d.id
    WHERE te.start_timestamp >= p_start_date
      AND te.start_timestamp <= p_end_date
    GROUP BY ps, d.id, d.username
    ORDER BY ps, d.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
