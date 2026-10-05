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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Download, Eye, MoreVertical, CheckCircle, Clock, CreditCard, CalendarCheck, Loader2, X, Pencil } from "lucide-react";
import { useState } from "react";
import { downloadPayslip } from "@/lib/payslipPdfGenerator";
import { fetchImageAsDataUrl } from "@/lib/pdfTheme";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employee: {
    name: string;
    email: string;
    avatar?: string;
  };
  month: string;
  monthNum: number;
  year: number;
  basic: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "paid" | "pending" | "processing";
  paidAt?: string;
  ltaAllowance: number;
  variablePay: number;
  pfEmployerContribution: number;
  healthInsurance: number;
  professionalTax: number;
  tds: number;
  advanceAmountAdjusted: number;
  lossOfPayDays: number;
}

interface PayrollTableProps {
  records: PayrollRecord[];
  onView?: (record: PayrollRecord) => void;
  onDownload?: (record: PayrollRecord) => void;
  onEditDetails?: (record: PayrollRecord) => void;
  onMarkProcessed?: (record: PayrollRecord) => void;
  onMarkPaid?: (record: PayrollRecord) => void;
  onRevertToPending?: (record: PayrollRecord) => void;
  onBulkMarkProcessed?: (ids: string[]) => void;
  onBulkMarkPaid?: (ids: string[]) => void;
  onBulkRevertToPending?: (ids: string[]) => void;
  isBulkUpdating?: boolean;
  /** Show status/edit actions and bulk selection (payroll:manage). */
  canManage?: boolean;
}

const statusIcons = {
  paid: <CheckCircle className="mr-1 h-3 w-3" aria-hidden="true" />,
  pending: <Clock className="mr-1 h-3 w-3" aria-hidden="true" />,
  processing: <CreditCard className="mr-1 h-3 w-3" aria-hidden="true" />,
};

export function PayrollTable({
  records,
  onView,
  onDownload,
  onEditDetails,
  onMarkProcessed,
  onMarkPaid,
  onRevertToPending,
  onBulkMarkProcessed,
  onBulkMarkPaid,
  onBulkRevertToPending,
  isBulkUpdating = false,
  canManage = true,
}: PayrollTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: branding } = useCompanyBranding();

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedRecords = records.filter((r) => selectedIds.has(r.id));
  const canMarkProcessed = selectedRecords.some((r) => r.status === "pending");
  const canMarkPaid = selectedRecords.some((r) => r.status === "pending" || r.status === "processing");
  const canRevert = selectedRecords.some((r) => r.status === "processing" || r.status === "paid");

  const handleBulkProcessed = () => {
    const eligibleIds = selectedRecords.filter((r) => r.status === "pending").map((r) => r.id);
    if (eligibleIds.length > 0) {
      onBulkMarkProcessed?.(eligibleIds);
      clearSelection();
    }
  };

  const handleBulkPaid = () => {
    const eligibleIds = selectedRecords.filter((r) => r.status === "pending" || r.status === "processing").map((r) => r.id);
    if (eligibleIds.length > 0) {
      onBulkMarkPaid?.(eligibleIds);
      clearSelection();
    }
  };

  const handleBulkRevert = () => {
    const eligibleIds = selectedRecords.filter((r) => r.status === "processing" || r.status === "paid").map((r) => r.id);
    if (eligibleIds.length > 0) {
      onBulkRevertToPending?.(eligibleIds);
      clearSelection();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const downloadPayslipPDF = async (record: PayrollRecord) => {
    setDownloadingId(record.id);
    
    try {
      // Fetch salary structure for detailed breakdown
      const { data: salaryStructure } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("employee_id", record.employeeId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: employeeInfo } = await supabase
        .from("employees")
        .select("hire_date, designation, department:departments!employees_department_id_fkey(name)")
        .eq("id", record.employeeId)
        .maybeSingle();

      const { data: bankDetails } = await supabase
        .from("employee_bank_details")
        .select("bank_name, bank_account_number")
        .eq("employee_id", record.employeeId)
        .maybeSingle();

      const periodStart = startOfMonth(new Date(record.year, record.monthNum - 1));
      const periodEnd = endOfMonth(periodStart);
      const { count: workedDays } = await supabase
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", record.employeeId)
        .eq("status", "present")
        .gte("date", format(periodStart, "yyyy-MM-dd"))
        .lte("date", format(periodEnd, "yyyy-MM-dd"));

      const monthName = MONTH_NAMES[record.monthNum - 1] || "";
      const logoDataUrl = await fetchImageAsDataUrl(branding?.iconUrl);
      const daysInMonth = endOfMonth(new Date(record.year, record.monthNum - 1)).getDate();

      downloadPayslip({
        employeeName: record.employee.name,
        employeeCode: record.employeeCode,
        employeeEmail: record.employee.email,
        monthName,
        year: record.year,
        status: record.status,
        paidAt: record.paidAt,
        basicSalary: record.basic,
        companyName: branding?.companyName || undefined,
        companyAddress: branding?.companyAddress || undefined,
        logoDataUrl,
        dateOfJoining: employeeInfo?.hire_date ? format(new Date(employeeInfo.hire_date), "yyyy-MM-dd") : undefined,
        designation: employeeInfo?.designation ?? undefined,
        department: employeeInfo?.department?.name ?? undefined,
        workedDays: workedDays ?? undefined,
        bankName: bankDetails?.bank_name ?? undefined,
        bankAccountNumber: bankDetails?.bank_account_number ?? undefined,
        daysInMonth,
        lossOfPayDays: record.lossOfPayDays,
        salaryBreakdown: salaryStructure ? {
          hra: salaryStructure.hra ?? undefined,
          transport_allowance: salaryStructure.transport_allowance ?? undefined,
          medical_allowance: salaryStructure.medical_allowance ?? undefined,
          other_allowances: salaryStructure.other_allowances ?? undefined,
          pf_deduction: salaryStructure.pf_deduction ?? undefined,
          lta_allowance: record.ltaAllowance,
          variable_pay: record.variablePay,
          pf_employer_contribution: record.pfEmployerContribution,
          health_insurance: record.healthInsurance,
          professional_tax: record.professionalTax,
          tds: record.tds,
          advance_amount_adjusted: record.advanceAmountAdjusted,
        } : undefined,
      }, `Payslip_${record.employeeCode}_${monthName}_${record.year}.pdf`);
      
      toast({
        title: "Payslip Downloaded",
        description: `PDF generated for ${record.employee.name}`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not generate payslip PDF",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };
  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("");

  const renderStatus = (record: PayrollRecord) => (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="outline" className={`${statusBadgeClass(record.status)} inline-flex items-center whitespace-nowrap`}>
        {statusIcons[record.status]}
        {formatStatus(record.status)}
      </Badge>
      {record.paidAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center whitespace-nowrap text-xs text-muted-foreground" tabIndex={0}>
              <CalendarCheck className="mr-1 h-3 w-3" aria-hidden="true" />
              {record.paidAt}
            </span>
          </TooltipTrigger>
          <TooltipContent>Paid on {record.paidAt}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const renderActions = (record: PayrollRecord) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 sm:h-8 sm:w-8"
        onClick={() => onView?.(record)}
        aria-label={`View payslip for ${record.employee.name}, ${record.month}`}
        title="View payslip"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 sm:h-8 sm:w-8"
        onClick={() => downloadPayslipPDF(record)}
        disabled={downloadingId === record.id}
        aria-label={`Download payslip PDF for ${record.employee.name}, ${record.month}`}
        title="Download payslip"
      >
        {downloadingId === record.id ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8"
              aria-label={`More actions for ${record.employee.name}, ${record.month}`}
              title="More actions"
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditDetails?.(record)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              Edit payroll details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {record.status === "pending" && (
              <DropdownMenuItem onClick={() => onMarkProcessed?.(record)}>
                <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                Mark as processed
              </DropdownMenuItem>
            )}
            {(record.status === "pending" || record.status === "processing") && (
              <DropdownMenuItem onClick={() => onMarkPaid?.(record)}>
                <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                Mark as paid
              </DropdownMenuItem>
            )}
            {(record.status === "processing" || record.status === "paid") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onRevertToPending?.(record)}
                  className="text-amber-700 focus:text-amber-700 dark:text-amber-400"
                >
                  <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
                  Revert to pending
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {canManage && selectedIds.size > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} record{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="mr-1 h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canMarkProcessed && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkProcessed}
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Mark as processed
              </Button>
            )}
            {canMarkPaid && (
              <Button
                size="sm"
                onClick={handleBulkPaid}
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Mark as paid
              </Button>
            )}
            {canRevert && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-600/30 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                onClick={handleBulkRevert}
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                Revert to pending
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden" data-testid="payroll-cards">
        {canManage && records.length > 1 && (
          <label className="flex min-h-10 items-center gap-3 px-1 text-sm text-muted-foreground">
            <Checkbox
              checked={selectedIds.size === records.length && records.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            Select all
          </label>
        )}
        {records.map((record) => (
          <div
            key={record.id}
            className={`rounded-xl border border-border bg-card p-4 ${selectedIds.has(record.id) ? "ring-2 ring-primary/40" : ""}`}
          >
            <div className="flex items-start gap-3">
              {canManage && (
                <Checkbox
                  className="mt-3"
                  checked={selectedIds.has(record.id)}
                  onCheckedChange={() => toggleSelection(record.id)}
                  aria-label={`Select ${record.employee.name}`}
                />
              )}
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={record.employee.avatar} alt="" />
                <AvatarFallback>{initials(record.employee.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{record.employee.name}</p>
                <p className="truncate text-xs text-muted-foreground">{record.month}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">Net salary</p>
                <p className="font-semibold text-foreground">₹{record.netSalary.toLocaleString("en-IN")}</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Basic</dt>
                <dd className="text-foreground">₹{record.basic.toLocaleString("en-IN")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Allowances</dt>
                <dd className="text-emerald-700 dark:text-emerald-400">+₹{record.allowances.toLocaleString("en-IN")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Deductions</dt>
                <dd className="text-destructive">-₹{record.deductions.toLocaleString("en-IN")}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2">
              {renderStatus(record)}
              <div className="-mr-2 shrink-0">{renderActions(record)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedIds.size === records.length && records.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead className="w-[220px]">Employee</TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">Allowances</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net salary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} data-state={selectedIds.has(record.id) ? "selected" : undefined}>
                {canManage && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(record.id)}
                      onCheckedChange={() => toggleSelection(record.id)}
                      aria-label={`Select ${record.employee.name}`}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={record.employee.avatar} alt="" />
                      <AvatarFallback>{initials(record.employee.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{record.employee.name}</p>
                      <p className="max-w-[200px] truncate text-xs text-muted-foreground" title={record.employee.email}>{record.employee.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{record.month}</TableCell>
                <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                  ₹{record.basic.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-emerald-700 dark:text-emerald-400">
                  +₹{record.allowances.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-destructive">
                  -₹{record.deductions.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-semibold text-foreground">
                  ₹{record.netSalary.toLocaleString('en-IN')}
                </TableCell>
                <TableCell>{renderStatus(record)}</TableCell>
                <TableCell className="text-right">{renderActions(record)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
