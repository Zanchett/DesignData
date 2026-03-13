"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDesignerClientDetail } from "@/hooks/use-analytics";

interface DesignerClientDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designerId: number | null;
  designerName: string;
  clientId: number | null;
  clientName: string;
  startDate?: string;
  endDate?: string;
}

interface TaskDetail {
  task_id: string;
  task_name: string;
  status: string;
  tracked_hours: number;
  billable_time: number | null;
}

export function DesignerClientDetailModal({
  open,
  onOpenChange,
  designerId,
  designerName,
  clientId,
  clientName,
  startDate,
  endDate,
}: DesignerClientDetailModalProps) {
  const { data, isLoading } = useDesignerClientDetail(
    designerId ?? undefined,
    clientId ?? undefined,
    startDate,
    endDate
  );

  const tasks: TaskDetail[] = data?.tasks || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {designerName} &mdash; {clientName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Task-level breakdown for this designer-client pair
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tasks found for this combination.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tracked</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.task_id}>
                    <TableCell className="max-w-[280px] truncate text-sm">
                      {t.task_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {t.tracked_hours}h
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {t.billable_time != null ? `${t.billable_time}h` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
