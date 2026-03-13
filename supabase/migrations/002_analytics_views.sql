-- Materialized view: designer performance (refreshed after each sync)
CREATE MATERIALIZED VIEW designer_performance AS
SELECT
    d.id AS designer_id,
    d.username,
    d.profile_picture,
    COUNT(DISTINCT ta.task_id) AS total_tasks_assigned,
    COUNT(DISTINCT ta.task_id) FILTER (
        WHERE LOWER(t.status) IN ('for client review', 'closed')
    ) AS tasks_completed,
    ROUND(
        COUNT(DISTINCT ta.task_id) FILTER (
            WHERE LOWER(t.status) IN ('for client review', 'closed')
        )::NUMERIC /
        NULLIF(COUNT(DISTINCT ta.task_id), 0) * 100, 1
    ) AS completion_rate,
    COALESCE(SUM(te.duration), 0) AS total_time_tracked_ms,
    ROUND(COALESCE(SUM(te.duration), 0) / 3600000.0, 1) AS total_hours
FROM designers d
LEFT JOIN task_assignees ta ON d.id = ta.designer_id
LEFT JOIN tasks t ON ta.task_id = t.id
LEFT JOIN time_entries te ON d.id = te.designer_id
WHERE d.is_active = true
GROUP BY d.id, d.username, d.profile_picture;

CREATE UNIQUE INDEX ON designer_performance(designer_id);

-- Materialized view: client resource summary
CREATE MATERIALIZED VIEW client_summary AS
SELECT
    c.id AS client_id,
    c.name AS client_name,
    COUNT(DISTINCT t.id) AS total_tasks,
    COUNT(DISTINCT t.id) FILTER (
        WHERE LOWER(t.status) IN ('for client review', 'closed')
    ) AS completed_tasks,
    COUNT(DISTINCT ta.designer_id) AS designers_involved,
    COALESCE(SUM(te.duration), 0) AS total_time_ms,
    ROUND(COALESCE(SUM(te.duration), 0) / 3600000.0, 1) AS total_hours
FROM clients c
LEFT JOIN tasks t ON c.id = t.folder_id
LEFT JOIN task_assignees ta ON t.id = ta.task_id
LEFT JOIN time_entries te ON te.folder_id = c.id
GROUP BY c.id, c.name;

CREATE UNIQUE INDEX ON client_summary(client_id);
