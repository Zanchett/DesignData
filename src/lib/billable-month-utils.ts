/**
 * Utilities for matching billable_month strings (e.g., "March 2026")
 * against date ranges.
 */

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Parse a billable_month string like "March 2026" into { year, month }.
 */
export function parseBillableMonth(bm: string): { year: number; month: number } | null {
  if (!bm) return null;
  const parts = bm.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const monthName = parts[0].toLowerCase();
  const year = parseInt(parts[1], 10);
  const month = MONTH_NAMES[monthName];
  if (!month || isNaN(year)) return null;
  return { year, month };
}

/**
 * Check if a billable_month string (e.g., "March 2026") falls within
 * a date range defined by startDate and endDate ISO strings.
 *
 * Comparison is month-level: "March 2026" matches any range that
 * includes March 2026.
 */
export function isMonthInRange(
  billableMonth: string,
  startDate: string | null,
  endDate: string | null
): boolean {
  const parsed = parseBillableMonth(billableMonth);
  if (!parsed) return false;

  // Convert the billable month to a comparable number: year*100 + month
  const bmVal = parsed.year * 100 + parsed.month;

  if (startDate) {
    const d = new Date(startDate);
    const startVal = d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
    if (bmVal < startVal) return false;
  }

  if (endDate) {
    const d = new Date(endDate);
    const endVal = d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
    if (bmVal > endVal) return false;
  }

  return true;
}
