import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Calendar, Loader2, Search } from "lucide-react";
import {
  formatBalanceCell,
  useLeaveBalanceReport,
  usedShare,
  type LeaveBalanceCell,
} from "@/hooks/useLeaveBalanceReport";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { drawPdfHeader, drawPdfFooter, fetchImageAsDataUrl, PDF_TABLE_HEAD_STYLE, PDF_COLORS } from "@/lib/pdfTheme";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

type SortKey = "name" | "most-used" | "least-left";

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

/** Bar colour by how much of the allowance is gone. */
function barClass(share: number): string {
  if (share >= 0.9) return "bg-red-500 dark:bg-red-400";
  if (share >= 0.6) return "bg-amber-500 dark:bg-amber-400";
  return "bg-primary";
}

function BalanceCell({ cell }: { cell: LeaveBalanceCell }) {
  if (!cell.eligible) {
    return (
      <span className="text-muted-foreground" title="Not eligible">
        —
      </span>
    );
  }
  const share = usedShare(cell);
  const capped = cell.total > 0;
  return (
    <div className="min-w-[88px] space-y-1">
      <div className="flex items-baseline justify-between gap-2 tabular-nums">
        <span className="font-medium text-foreground">{formatBalanceCell(cell)}</span>
        {capped && (
          <span className={cn("text-xs", cell.remaining <= 0 ? "text-destructive" : "text-muted-foreground")}>
            {cell.remaining <= 0 ? "none left" : `${cell.remaining} left`}
          </span>
        )}
      </div>
      {capped && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${cell.used} of ${cell.total} days used`}
        >
          <div className={cn("h-full rounded-full", barClass(share))} style={{ width: `${share * 100}%` }} />
        </div>
      )}
      {cell.pending > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">+{cell.pending} pending</p>
      )}
    </div>
  );
}

export function LeaveBalanceReport() {
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [isExporting, setIsExporting] = useState(false);

  const { data: report, isLoading } = useLeaveBalanceReport(parseInt(selectedYear));
  const { data: branding } = useCompanyBranding();

  const departments = useMemo(
    () => [...new Set((report?.records ?? []).map((r) => r.department))].sort(),
    [report],
  );

  const rows = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    const filtered = report.records.filter(
      (r) =>
        (department === "all" || r.department === department) &&
        (!q || r.employeeName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q)),
    );
    const usedOf = (r: (typeof filtered)[number]) => r.balances.reduce((s, b) => s + (b.eligible ? b.used : 0), 0);
    const leftOf = (r: (typeof filtered)[number]) =>
      r.balances.reduce((s, b) => s + (b.eligible && b.total > 0 ? b.remaining : 0), 0);
    return [...filtered].sort((a, b) =>
      sort === "most-used"
        ? usedOf(b) - usedOf(a)
        : sort === "least-left"
          ? leftOf(a) - leftOf(b)
          : a.employeeName.localeCompare(b.employeeName),
    );
  }, [report, department, search, sort]);

  // Summary of what's shown
  const summary = useMemo(() => {
    let used = 0;
    let pending = 0;
    let runningLow = 0;
    for (const r of rows) {
      let low = false;
      for (const b of r.balances) {
        if (!b.eligible) continue;
        used += b.used;
        pending += b.pending;
        if (b.total > 0 && b.remaining <= 2) low = true;
      }
      if (low) runningLow++;
    }
    return { used, pending, runningLow };
  }, [rows]);

  const exportToPDF = async () => {
    if (!report || rows.length === 0) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const logoDataUrl = await fetchImageAsDataUrl(branding?.logoUrl);

      let currentY = drawPdfHeader(doc, {
        title: "Leave Balance Report",
        subtitle: `Year ${report.year}${department !== "all" ? ` · ${department}` : ""}`,
        companyName: branding?.companyName,
        companyAddress: branding?.companyAddress,
        logoDataUrl,
        pageWidth,
        margin,
      });

      doc.setTextColor(...PDF_COLORS.dark);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${plural(rows.length, "employee")} · ${summary.used} days taken · ${summary.pending} days pending approval`,
        margin,
        currentY,
      );
      currentY += 6;

      const head = [
        "Employee",
        "Department",
        ...report.leaveTypes.map((lt) => (lt.daysPerYear > 0 ? `${lt.name}\n(${lt.daysPerYear}/yr)` : lt.name)),
      ];
      const body = rows.map((r) => [
        `${r.employeeName}\n${r.employeeCode}`,
        r.department,
        ...r.balances.map((b) => {
          const text = formatBalanceCell(b);
          const extras = [b.eligible && b.total > 0 ? `${b.remaining} left` : "", b.pending > 0 ? `+${b.pending} pending` : ""]
            .filter(Boolean)
            .join(", ");
          return extras ? `${text}\n${extras}` : text;
        }),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [head],
        body,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { ...PDF_TABLE_HEAD_STYLE, fontSize: 7.5, cellPadding: 2, halign: "center", valign: "middle" },
        bodyStyles: { fontSize: 7.5, cellPadding: 2, halign: "center", valign: "middle", lineColor: PDF_COLORS.ruleLight },
        columnStyles: { 0: { halign: "left", cellWidth: 40 }, 1: { halign: "left", cellWidth: 30 } },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setTextColor(...PDF_COLORS.gray);
        doc.setFontSize(7.5);
        doc.text("Used / allowed days this year. — = not eligible. Uncapped types show days taken.", margin, pageHeight - 22);
        drawPdfFooter(doc, { pageWidth, pageHeight, margin, pageNumber: i, totalPages: pageCount });
      }

      doc.save(`Leave_Balance_Report_${report.year}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" aria-hidden="true" />
              Leave balance report
            </CardTitle>
            <CardDescription>Days used out of each person's allowance, by leave type</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]" aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportToPDF} disabled={isExporting || rows.length === 0} className="flex-1 sm:flex-none">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export PDF
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID"
              aria-label="Search employees"
              className="pl-9"
            />
          </div>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-full sm:w-[190px]" aria-label="Department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full sm:w-[170px]" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by name</SelectItem>
              <SelectItem value="most-used">Most leave used</SelectItem>
              <SelectItem value="least-left">Least leave left</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : report && report.records.length > 0 ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Employees", rows.length],
                ["Days taken", summary.used],
                ["Days pending approval", summary.pending],
                ["Running low (≤ 2 days left)", summary.runningLow],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No employees match these filters.</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-md border sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 z-10 min-w-[200px] bg-background">Employee</TableHead>
                        {report.leaveTypes.map((lt) => (
                          <TableHead key={lt.id} className="min-w-[120px] border-l">
                            <span className="block text-foreground">{lt.name}</span>
                            <span className="block text-xs font-normal">
                              {lt.daysPerYear > 0 ? `${lt.daysPerYear} days/yr` : "No fixed limit"}
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((record) => (
                        <TableRow key={record.employeeId}>
                          <TableCell className="sticky left-0 z-10 bg-background">
                            <p className="font-medium">{record.employeeName}</p>
                            <p className="text-xs text-muted-foreground">
                              {record.employeeCode} · {record.department}
                            </p>
                          </TableCell>
                          {record.balances.map((cell) => (
                            <TableCell key={cell.leaveTypeId} className="border-l align-top">
                              <BalanceCell cell={cell} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <ul className="space-y-3 sm:hidden" aria-label="Leave balances">
                  {rows.map((record) => (
                    <li key={record.employeeId} className="rounded-lg border p-3">
                      <p className="truncate font-medium">{record.employeeName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {record.employeeCode} · {record.department}
                      </p>
                      <dl className="mt-3 space-y-3 text-sm">
                        {record.balances
                          .filter((cell) => cell.eligible)
                          .map((cell) => (
                            <div key={cell.leaveTypeId}>
                              <dt className="mb-1 text-xs text-muted-foreground">
                                {report.leaveTypes.find((lt) => lt.id === cell.leaveTypeId)?.name}
                              </dt>
                              <dd>
                                <BalanceCell cell={cell} />
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </li>
                  ))}
                </ul>

                <p className="text-xs text-muted-foreground">
                  Each cell shows days used out of the yearly allowance (approved leave starting in {report.year}). The bar
                  turns amber past 60% and red past 90%. — means the person isn't eligible for that leave type.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-lg font-medium">No employees to show</p>
            <p className="text-sm text-muted-foreground">Active employees and their leave appear here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
