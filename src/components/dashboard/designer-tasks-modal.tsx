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
import { useDesignerTasks } from "@/hooks/use-analytics";

interface DesignerTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designerId: number | null;
  designerName: string;
  startDate?: string;
  endDate?: string;
}

interface TaskRow {
  task_id: string;
  task_name: string;
  status: string;
  client_name: string;
  tracked_hours: number;
  billable_hours: number | null;
}

export function DesignerTasksModal({
  open,
  onOpenChange,
  designerId,
  designerName,
  startDate,
  endDate,
}: DesignerTasksModalProps) {
  const { data, isLoading } = useDesignerTasks(
    designerId ?? undefined,
    startDate,
    endDate
  );

  const tasks: TaskRow[] = data?.tasks || [];
  const totalTracked: number = data?.totalTracked || 0;
  const totalBillable: number = data?.totalBillable || 0;
  const taskCount: number = data?.taskCount || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {designerName} &mdash; Task Breakdown
          </DialogTitle>
          <div className="flex items-center gap-4 pt-1">
            <span className="text-xs text-muted-foreground">
              {taskCount} tasks
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Tracked: <span className="text-foreground font-medium">{totalTracked}h</span>
            </span>
            {totalBillable > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                Billable: <span className="text-foreground font-medium">{totalBillable}h</span>
              </span>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tasks with tracked time found for this designer in the selected period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Task</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tracked</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.task_id}>
                    <TableCell className="max-w-[280px] truncate text-sm" title={t.task_name}>
                      {t.task_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.client_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {t.tracked_hours > 0 ? `${t.tracked_hours}h` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {t.billable_hours != null ? `${t.billable_hours}h` : "—"}
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
