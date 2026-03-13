"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function buildUrl(base: string, params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}

export function useOverview(startDate?: string, endDate?: string, metric?: string) {
  const url = buildUrl("/api/analytics/overview", { startDate, endDate, metric });
  return useSWR(url, fetcher, { refreshInterval: 300000 });
}

export function useDesignerMetrics(startDate?: string, endDate?: string, metric?: string) {
  const url = buildUrl("/api/analytics/designers", { startDate, endDate, metric });
  return useSWR(url, fetcher, { refreshInterval: 300000 });
}

export function useClientMetrics(startDate?: string, endDate?: string, metric?: string) {
  const url = buildUrl("/api/analytics/clients", { startDate, endDate, metric });
  return useSWR(url, fetcher, { refreshInterval: 300000 });
}

export function useTimeTrends(
  startDate?: string,
  endDate?: string,
  granularity: string = "week",
  metric?: string
) {
  const url = buildUrl("/api/analytics/time-trends", {
    startDate,
    endDate,
    granularity,
    metric,
  });
  const shouldFetch = !!startDate && !!endDate;
  return useSWR(shouldFetch ? url : null, fetcher, { refreshInterval: 300000 });
}

export function useDesignerClientDetail(
  designerId?: number,
  clientId?: number,
  startDate?: string,
  endDate?: string
) {
  const url =
    designerId && clientId
      ? buildUrl("/api/analytics/designer-client-detail", {
          designerId: String(designerId),
          clientId: String(clientId),
          startDate,
          endDate,
        })
      : null;
  return useSWR(url, fetcher);
}

export function useDesignerTasks(
  designerId?: number,
  startDate?: string,
  endDate?: string
) {
  const url =
    designerId
      ? buildUrl("/api/analytics/designer-tasks", {
          designerId: String(designerId),
          startDate,
          endDate,
        })
      : null;
  return useSWR(url, fetcher);
}

export function useHourTracker() {
  return useSWR("/api/hour-tracker", fetcher, { refreshInterval: 300000 });
}

export function useWeeklyBillable(year?: number) {
  const url = buildUrl("/api/hour-tracker/weekly", { year: year?.toString() });
  return useSWR(url, fetcher, { refreshInterval: 300000 });
}

export function useSyncStatus() {
  return useSWR("/api/sync/status", fetcher, { refreshInterval: 10000 });
}
