import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, Eye, MoreVertical, CheckCircle, Clock, CreditCard, CalendarCheck } from "lucide-react";

export interface PayrollRecord {
  id: string;
  employee: {
    name: string;
    email: string;
    avatar?: string;
  };
  month: string;
  basic: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "paid" | "pending" | "processing";
  paidAt?: string;
}

interface PayrollTableProps {
  records: PayrollRecord[];
  onView?: (record: PayrollRecord) => void;
  onDownload?: (record: PayrollRecord) => void;
  onMarkProcessed?: (record: PayrollRecord) => void;
  onMarkPaid?: (record: PayrollRecord) => void;
  onRevertToPending?: (record: PayrollRecord) => void;
}

const statusStyles = {
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  processing: "bg-primary/10 text-primary border-primary/20",
};

const statusIcons = {
  paid: <CheckCircle className="mr-1 h-3 w-3" />,
  pending: <Clock className="mr-1 h-3 w-3" />,
  processing: <CreditCard className="mr-1 h-3 w-3" />,
};

export function PayrollTable({ 
  records, 
  onView, 
  onDownload,
  onMarkProcessed,
  onMarkPaid,
  onRevertToPending,
}: PayrollTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Employee</TableHead>
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Basic</TableHead>
            <TableHead className="text-right">Allowances</TableHead>
            <TableHead className="text-right">Deductions</TableHead>
            <TableHead className="text-right">Net Salary</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={record.employee.avatar} />
                    <AvatarFallback>
                      {record.employee.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{record.employee.name}</p>
                    <p className="text-xs text-muted-foreground">{record.employee.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{record.month}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                ₹{record.basic.toLocaleString('en-IN')}
              </TableCell>
              <TableCell className="text-right text-emerald-600">
                +₹{record.allowances.toLocaleString('en-IN')}
              </TableCell>
              <TableCell className="text-right text-destructive">
                -₹{record.deductions.toLocaleString('en-IN')}
              </TableCell>
              <TableCell className="text-right font-semibold text-foreground">
                ₹{record.netSalary.toLocaleString('en-IN')}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className={`${statusStyles[record.status]} inline-flex items-center`}>
                    {statusIcons[record.status]}
                    {record.status}
                  </Badge>
                  {record.paidAt && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center text-xs text-muted-foreground cursor-help">
                          <CalendarCheck className="mr-1 h-3 w-3" />
                          {record.paidAt}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Paid on {record.paidAt}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onView?.(record)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onDownload?.(record)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {record.status === "pending" && (
                        <DropdownMenuItem onClick={() => onMarkProcessed?.(record)}>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Mark as Processed
                        </DropdownMenuItem>
                      )}
                      {(record.status === "pending" || record.status === "processing") && (
                        <DropdownMenuItem onClick={() => onMarkPaid?.(record)}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Mark as Paid
                        </DropdownMenuItem>
                      )}
                      {(record.status === "processing" || record.status === "paid") && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => onRevertToPending?.(record)}
                            className="text-amber-600"
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Revert to Pending
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
