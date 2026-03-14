"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportData, useReportsList } from "@/hooks/use-analytics";
import { ReportView } from "@/components/reports/report-view";
import {
  FileText,
  Link2,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Search,
  Loader2,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function ReportsPage() {
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    MONTHS[new Date().getMonth()]
  );
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [generateKey, setGenerateKey] = useState(0);
  const [shouldFetch, setShouldFetch] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const monthParam = `${selectedMonth} ${selectedYear}`;

  const { data: listData, mutate: mutateList } = useReportsList();
  const { data: reportData, isLoading: reportLoading } = useReportData(
    shouldFetch ? selectedClientId : undefined,
    shouldFetch ? monthParam : undefined,
    shouldFetch ? selectedYear : undefined
  );

  const clients = listData?.clients || [];
  const shares = listData?.shares || [];

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter((c: { name: string }) => c.name.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const selectedClientName = clients.find(
    (c: { id: number }) => c.id === selectedClientId
  )?.name;

  const handleGenerate = () => {
    if (!selectedClientId) return;
    setShouldFetch(true);
    setGenerateKey((k) => k + 1);
  };

  const handleCreateShareLink = async () => {
    if (!selectedClientId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          month: monthParam,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (data.shareToken) {
        const url = `${window.location.origin}/report/${data.shareToken}`;
        await navigator.clipboard.writeText(url);
        setCopiedId("new");
        setTimeout(() => setCopiedId(null), 2000);
        mutateList();
      }
    } catch (err) {
      console.error("Failed to create share link:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      await fetch(`/api/reports/shares/${shareId}`, { method: "DELETE" });
      mutateList();
    } catch (err) {
      console.error("Failed to delete share:", err);
    }
  };

  const handleCopyLink = async (token: string, id: string) => {
    const url = `${window.location.origin}/report/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Client Reports</h2>
        <p className="text-sm text-muted-foreground">
          Generate and share monthly reports for clients
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Generate Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {/* Client selector */}
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Client
              </label>
              <Select
                value={selectedClientId?.toString() || ""}
                onValueChange={(v) => {
                  setSelectedClientId(parseInt(v, 10));
                  setShouldFetch(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search clients..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="h-8 pl-7 text-xs"
                      />
                    </div>
                  </div>
                  {filteredClients.map((c: { id: number; name: string }) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month */}
            <div className="w-[150px]">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Month
              </label>
              <Select
                value={selectedMonth}
                onValueChange={(v) => {
                  setSelectedMonth(v);
                  setShouldFetch(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div className="w-[100px]">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Year
              </label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => {
                  setSelectedYear(parseInt(v, 10));
                  setShouldFetch(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generate */}
            <Button
              onClick={handleGenerate}
              disabled={!selectedClientId || reportLoading}
              className="h-9"
            >
              {reportLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate
            </Button>

            {/* Share Link */}
            {shouldFetch && reportData && (
              <Button
                variant="outline"
                onClick={handleCreateShareLink}
                disabled={creating}
                className="h-9"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : copiedId === "new" ? (
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                {copiedId === "new" ? "Link Copied!" : "Create Share Link"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Preview */}
      {shouldFetch && (
        <div>
          {reportLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : reportData?.error ? (
            <Card>
              <CardContent className="py-8 text-center text-destructive">
                {reportData.error}
              </CardContent>
            </Card>
          ) : reportData ? (
            <ReportView data={reportData} />
          ) : null}
        </div>
      )}

      {/* Shared Links */}
      {shares.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Active Share Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Client</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Period</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Created</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map(
                    (s: {
                      id: string;
                      share_token: string;
                      client_name: string;
                      month: string;
                      year: number;
                      created_at: string;
                    }) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-2.5 pr-4 text-foreground">{s.client_name}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {s.month} {s.year}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleCopyLink(s.share_token, s.id)}
                            >
                              {copiedId === s.id ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                window.open(`/report/${s.share_token}`, "_blank")
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteShare(s.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
