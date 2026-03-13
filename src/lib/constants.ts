export const DESIGNER_EMAIL_DOMAIN = "@500designs.com";

export const DEFAULT_SYNC_MONTHS = 3;

export const BILLABLE_TIME_FIELD_ID = "53ac0757-7e9e-4b81-ad9f-c5aa68d67f39";
export const MONTH_FIELD_NAME = "Month🟪";

export type MetricType = "tracked" | "billable";

export const INTERNAL_LIST_NAME = "Internal Communication";

export const COMPLETED_STATUSES = ["for client review", "closed"] as const;

export const ACTIVE_WORK_STATUSES = [
  "working on it",
  "needs revision",
  "new client updates",
  "for internal review",
] as const;

export const DONE_GROUP_STATUSES = [
  "ready for client",
  "for client review",
  "continued in next month",
  "closed",
] as const;

export const ALL_ACTIVE_STATUSES = [
  "open",
  "on hold",
  "to assign",
  "need info from client",
  "ready to start",
  "stuck",
  "working on it",
  "needs revision",
  "new client updates",
  "for internal review",
  "add hours used",
] as const;

export function isCompletedStatus(status: string): boolean {
  return COMPLETED_STATUSES.includes(
    status.toLowerCase() as (typeof COMPLETED_STATUSES)[number]
  );
}

export function isDoneGroupStatus(status: string): boolean {
  return DONE_GROUP_STATUSES.includes(
    status.toLowerCase() as (typeof DONE_GROUP_STATUSES)[number]
  );
}

export const SYNC_STEPS = [
  "members",
  "folders",
  "lists",
  "tasks",
  "time_entries",
  "finalize",
] as const;

export type SyncStep = (typeof SYNC_STEPS)[number];

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "This month", days: 0 },
  { label: "Last month", days: -1 },
  { label: "Last 3 months", days: 90 },
] as const;
