"use client";

import { use } from "react";
import { usePublicReport } from "@/hooks/use-analytics";
import { ReportView } from "@/components/reports/report-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data, isLoading, error } = usePublicReport(token);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/25">
            <svg
              className="h-4 w-4 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 4-6" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">
              Design Force
            </h1>
            <p className="text-[10px] font-medium text-primary/70">
              Client Report
            </p>
          </div>
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Report Not Available
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {data?.error ||
            "This report link may have expired or been deactivated. Please contact your account manager for a new link."}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return <ReportView data={data} showBrandHeader />;
}
