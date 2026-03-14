import { SupabaseClient } from "@supabase/supabase-js";
import { BILLABLE_TIME_FIELD_ID } from "@/lib/constants";

const MONTH_COLUMN_MAP: Record<number, string> = {
  1: "hours_jan", 2: "hours_feb", 3: "hours_mar", 4: "hours_apr",
  5: "hours_may", 6: "hours_jun", 7: "hours_jul", 8: "hours_aug",
  9: "hours_sep", 10: "hours_oct", 11: "hours_nov", 12: "hours_dec",
};

const MONTH_NAMES_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const MONTH_LABELS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CustomFieldRaw {
  id?: string;
  name?: string;
  type?: string;
  value?: unknown;
  type_config?: {
    options?: Array<{ orderindex: number; name: string; id?: string }>;
  };
}

export interface ReportTask {
  id: string;
  name: string;
  status: string;
  billable_time: number | null;
  custom_fields: Record<string, string>;
}

export interface ReportSummaryData {
  hoursPurchased: number;
  totalHoursForMonth: number;
  totalHoursUsed: number;
  rolloverHours: number;
  totalHoursNextMonth: number;
}

export interface ReportData {
  client: { id: number; name: string };
  month: string;
  year: number;
  tasks: ReportTask[];
  totalBillable: number;
  summary: ReportSummaryData;
  customFieldColumns: string[];
}

/**
 * Resolve a ClickUp custom field value to a display string.
 */
export function resolveCustomFieldValue(field: CustomFieldRaw): string {
  if (field.value === null || field.value === undefined || field.value === "") {
    return "";
  }

  const type = field.type || "";

  switch (type) {
    case "drop_down": {
      const orderIndex = Number(field.value);
      if (isNaN(orderIndex) || !field.type_config?.options) return String(field.value);
      const option = field.type_config.options.find((o) => o.orderindex === orderIndex);
      return option?.name || String(field.value);
    }
    case "labels": {
      const indices = Array.isArray(field.value) ? field.value : [field.value];
      if (!field.type_config?.options) return "";
      const resolved = indices
        .map((idx) => {
          const opt = field.type_config!.options!.find(
            (o) => o.id === String(idx) || o.orderindex === Number(idx)
          );
          return opt?.name || null;
        })
        .filter(Boolean);
      return resolved.join(", ");
    }
    case "list_relationship":
      return ""; // skip relationship fields
    case "users": {
      // value is an array of user objects with username
      const users = Array.isArray(field.value) ? field.value : [field.value];
      return users
        .map((u: unknown) => {
          if (typeof u === "object" && u !== null) {
            const user = u as Record<string, unknown>;
            return user.username || user.email || "";
          }
          return "";
        })
        .filter(Boolean)
        .join(", ");
    }
    case "number":
    case "currency":
      return String(field.value);
    case "date": {
      const ts = Number(field.value);
      if (isNaN(ts)) return String(field.value);
      return new Date(ts).toLocaleDateString();
    }
    case "text":
    case "short_text":
    case "email":
    case "url":
    case "phone":
      return String(field.value);
    default: {
      // Handle objects gracefully
      if (typeof field.value === "object") {
        if (Array.isArray(field.value)) {
          const items = field.value.map((v: unknown) => {
            if (typeof v === "object" && v !== null) {
              const obj = v as Record<string, unknown>;
              return obj.username || obj.name || obj.email || "";
            }
            return String(v);
          }).filter(Boolean);
          return items.join(", ");
        }
        const obj = field.value as Record<string, unknown>;
        return String(obj.username || obj.name || obj.email || "");
      }
      return String(field.value);
    }
  }
}

/**
 * Parse a billable_month string like "March 2026" into month number.
 */
function parseMonthIndex(monthStr: string): number | null {
  const parts = monthStr.trim().split(/\s+/);
  if (parts.length < 1) return null;
  const monthNum = MONTH_NAMES_MAP[parts[0].toLowerCase()];
  return monthNum || null;
}

/**
 * Extract useful custom fields from raw ClickUp custom_fields array,
 * excluding billable time and month fields.
 */
// UUID pattern to detect unresolved IDs
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keywords that identify team/client selector custom fields
const TEAM_CLIENT_KEYWORDS = ["client", "team", "brand", "department", "company", "account", "division", "group", "requested by"];

function extractDisplayFields(rawFields: CustomFieldRaw[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const f of rawFields) {
    // Skip billable time and month fields
    if (f.id === BILLABLE_TIME_FIELD_ID) continue;
    if (f.name?.toLowerCase().includes("month")) continue;
    // Only include dropdown and labels fields
    if (f.type !== "drop_down" && f.type !== "labels") continue;
    // Only include fields whose name matches team/client selector keywords
    const nameLower = f.name?.toLowerCase() || "";
    if (!TEAM_CLIENT_KEYWORDS.some((kw) => nameLower.includes(kw))) continue;
    // Skip fields with no value
    if (f.value === null || f.value === undefined || f.value === "") continue;
    const resolved = resolveCustomFieldValue(f);
    if (!resolved) continue;
    if (f.name) {
      result[f.name] = resolved;
    }
  }
  return result;
}

/**
 * Compute full report data for a client in a given month.
 */
export async function computeReportData(
  supabase: SupabaseClient,
  clientId: number,
  month: string,   // e.g. "March 2026"
  year: number
): Promise<ReportData> {
  // 1. Get client info
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  if (!client) throw new Error("Client not found");

  // 2. Get tasks for this client + month
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, name, status, billable_time, raw_data")
    .eq("folder_id", clientId)
    .eq("billable_month", month)
    .is("parent_task_id", null)
    .order("billable_time", { ascending: false, nullsFirst: false });

  // 3. Process tasks - extract custom fields from raw_data
  const customFieldColumnsSet = new Set<string>();
  const processedTasks: ReportTask[] = (tasks || []).map((t) => {
    const rawFields: CustomFieldRaw[] = t.raw_data?.custom_fields || [];
    const displayFields = extractDisplayFields(rawFields);

    // Track which columns exist
    Object.keys(displayFields).forEach((k) => customFieldColumnsSet.add(k));

    return {
      id: t.id,
      name: t.name,
      status: t.status,
      billable_time: t.billable_time,
      custom_fields: displayFields,
    };
  });

  const customFieldColumns = Array.from(customFieldColumnsSet).sort();

  // 4. Get contract data
  const { data: contract } = await supabase
    .from("client_contracts")
    .select("*")
    .eq("client_id", clientId)
    .single();

  const monthIndex = parseMonthIndex(month);
  const monthCol = monthIndex ? MONTH_COLUMN_MAP[monthIndex] : null;
  const hoursPurchased = monthCol && contract ? Number(contract[monthCol]) || 0 : 0;

  // 5. Get weekly snapshots for this month's weeks
  const weekStart = monthIndex ? (monthIndex - 1) * 4 + 1 : 1;
  const weekEnd = monthIndex ? monthIndex * 4 : 4;

  const { data: snapshots } = await supabase
    .from("weekly_hour_snapshots")
    .select("hours")
    .eq("client_id", clientId)
    .eq("year", year)
    .gte("week_number", weekStart)
    .lte("week_number", weekEnd);

  const totalHoursUsed = (snapshots || []).reduce(
    (sum, s) => sum + (Number(s.hours) || 0),
    0
  );

  // 6. Calculate total billable from tasks
  const totalBillable = processedTasks.reduce(
    (sum, t) => sum + (t.billable_time || 0),
    0
  );

  // Use the larger of snapshot-based or task-based total
  const effectiveUsed = Math.max(totalHoursUsed, totalBillable);

  // 7. Calculate rollover
  let rolloverHours = 0;
  if (monthIndex && contract) {
    // For January, use rollover_2025 directly
    if (monthIndex === 1) {
      rolloverHours = Number(contract.rollover_2025) || 0;
    } else {
      // Sum up (purchased - used) for all previous months
      let carryover = Number(contract.rollover_2025) || 0;
      for (let m = 1; m < monthIndex; m++) {
        const col = MONTH_COLUMN_MAP[m];
        const purchased = Number(contract[col]) || 0;
        // Get weekly snapshots for that month
        const prevWeekStart = (m - 1) * 4 + 1;
        const prevWeekEnd = m * 4;
        const { data: prevSnapshots } = await supabase
          .from("weekly_hour_snapshots")
          .select("hours")
          .eq("client_id", clientId)
          .eq("year", year)
          .gte("week_number", prevWeekStart)
          .lte("week_number", prevWeekEnd);

        const prevUsed = (prevSnapshots || []).reduce(
          (s, snap) => s + (Number(snap.hours) || 0),
          0
        );
        carryover = carryover + purchased - prevUsed;
      }
      rolloverHours = Math.max(0, carryover);
    }
  }

  // 8. Total hours for month = purchased + rollover
  const totalHoursForMonth = hoursPurchased + rolloverHours;

  // 9. Next month's purchased hours
  const nextMonthIndex = monthIndex && monthIndex < 12 ? monthIndex + 1 : null;
  const nextMonthCol = nextMonthIndex ? MONTH_COLUMN_MAP[nextMonthIndex] : null;
  const nextMonthPurchased = nextMonthCol && contract ? Number(contract[nextMonthCol]) || 0 : 0;

  // Rollover into next month = total available this month - used this month
  const rolloverToNext = Math.max(0, totalHoursForMonth - effectiveUsed);
  const totalHoursNextMonth = nextMonthPurchased + rolloverToNext;

  return {
    client: { id: client.id, name: client.name },
    month,
    year,
    tasks: processedTasks,
    totalBillable,
    summary: {
      hoursPurchased,
      totalHoursForMonth,
      totalHoursUsed: effectiveUsed,
      rolloverHours,
      totalHoursNextMonth,
    },
    customFieldColumns,
  };
}

/**
 * Get a human-readable month label from index.
 */
export function getMonthLabel(monthIndex: number): string {
  return MONTH_LABELS[monthIndex] || "";
}

/**
 * Get all month options for a year.
 */
export function getMonthOptions(): Array<{ value: string; label: string }> {
  return MONTH_LABELS.slice(1).map((label, i) => ({
    value: `${label}`,
    label,
  }));
}
