"use client";

import type { ReportSummaryData } from "@/lib/report-utils";

interface ReportSummaryProps {
  summary: ReportSummaryData;
  month: string;
  year: number;
}

/** Parse "March 2026" → next month label */
function getNextMonthLabel(month: string, year: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const idx = months.findIndex(
    (m) => m.toLowerCase() === month.trim().split(/\s+/)[0]?.toLowerCase()
  );
  if (idx === -1) return "Next Month";
  if (idx === 11) return `January ${year + 1}`;
  return `${months[idx + 1]} ${year}`;
}

export function ReportSummary({ summary, month, year }: ReportSummaryProps) {
  const nextMonthLabel = getNextMonthLabel(month, year);
  const monthLabel = month.split(/\s+/)[0] || month;

  const rows = [
    { label: "Hours PURCHASED", value: summary.hoursPurchased, bold: true },
    { label: `Total Hours for ${monthLabel}`, value: summary.totalHoursForMonth, bold: false },
    { label: "Total Hours Used", value: summary.totalHoursUsed, bold: false },
    { label: "Rollover Hours", value: summary.rolloverHours, bold: true },
    { label: `Total Hours for ${nextMonthLabel.split(" ")[0]}`, value: summary.totalHoursNextMonth, bold: false },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={`border-b border-border/50 ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}
            >
              <td
                className={`px-4 py-3 ${row.bold ? "font-bold text-foreground" : "text-muted-foreground"}`}
              >
                {row.label}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`font-mono ${row.bold ? "font-bold text-primary" : "font-medium text-foreground"}`}
                >
                  {row.value}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
