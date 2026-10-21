import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Package } from "lucide-react";
import { useAssetReport } from "@/hooks/useAssetReport";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { drawPdfHeader, drawPdfFooter, fetchImageAsDataUrl, formatCurrencyForPdf, PDF_TABLE_HEAD_STYLE, PDF_COLORS } from "@/lib/pdfTheme";
import { statusBadgeClass } from "@/lib/statusStyles";
import { ASSET_STATUS_LABELS, assetStatusTone, type AssetStatus } from "@/hooks/useAssets";
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

function getStatusBadge(status: string) {
  return (
    <Badge variant="outline" className={`whitespace-nowrap ${statusBadgeClass(assetStatusTone(status as AssetStatus))}`}>
      {ASSET_STATUS_LABELS[status as AssetStatus] ?? status}
    </Badge>
  );
}

export function AssetInventoryReport() {
  const { data: report, isLoading, error } = useAssetReport();
  const { data: branding } = useCompanyBranding();

  const exportToPDF = async () => {
    if (!report) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const logoDataUrl = await fetchImageAsDataUrl(branding?.logoUrl);

    let yPos = drawPdfHeader(doc, {
      title: "Asset Inventory Report",
      companyName: branding?.companyName,
      companyAddress: branding?.companyAddress,
      logoDataUrl,
      pageWidth,
      margin,
    });

    // Summary statistics
    doc.setTextColor(...PDF_COLORS.dark);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Assets: ${report.totalAssets}`, margin, yPos);
    yPos += 6;
    doc.text(`Total Value: ${formatCurrencyForPdf(report.totalValue)}`, margin, yPos);
    yPos += 6;
    doc.text(
      `Repair spend: ${formatCurrencyForPdf(report.repairSpendThisYear)} this year, ${formatCurrencyForPdf(report.repairSpendTotal)} in total`,
      margin,
      yPos,
    );
    yPos += 10;

    // Status breakdown
    doc.text("By Status:", margin, yPos);
    yPos += 6;
    report.byStatus.forEach((item) => {
      doc.text(`  ${ASSET_STATUS_LABELS[item.status as AssetStatus] ?? item.status}: ${item.count}`, margin, yPos);
      yPos += 5;
    });

    // Category breakdown
    yPos += 4;
    doc.text("By Category:", margin, yPos);
    yPos += 6;
    report.byCategory.forEach((item) => {
      doc.text(`  ${item.category}: ${item.count}`, margin, yPos);
      yPos += 5;
    });

    // Asset details table
    yPos += 6;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Asset Details", margin, yPos);

    autoTable(doc, {
      startY: yPos + 6,
      head: [["Code", "Name", "Category", "Status", "Cost", "Repairs", "Assigned To"]],
      body: report.records.map((asset) => [
        asset.assetCode,
        asset.name,
        asset.category,
        ASSET_STATUS_LABELS[asset.status as AssetStatus] ?? asset.status,
        formatCurrencyForPdf(asset.purchaseCost),
        asset.repairSpend ? formatCurrencyForPdf(asset.repairSpend) : "-",
        asset.assignedTo,
      ]),
      styles: { fontSize: 8 },
      headStyles: PDF_TABLE_HEAD_STYLE,
    });

    if (report.repairs.length > 0) {
      const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Repairs", margin, afterTable);
      autoTable(doc, {
        startY: afterTable + 4,
        head: [["Asset", "Problem", "Vendor", "Sent", "Back", "Cost"]],
        body: report.repairs.map((r) => [
          `${r.assetName} (${r.assetCode})`,
          r.problem,
          r.vendor ?? "-",
          format(parseISO(r.sentDate), "d MMM yyyy"),
          r.returnedDate ? format(parseISO(r.returnedDate), "d MMM yyyy") : "In repair",
          r.cost != null ? formatCurrencyForPdf(r.cost) : r.estimatedCost != null ? `est. ${formatCurrencyForPdf(r.estimatedCost)}` : "-",
        ]),
        foot: [["Total spent", "", "", "", "", formatCurrencyForPdf(report.repairSpendTotal)]],
        styles: { fontSize: 8 },
        headStyles: PDF_TABLE_HEAD_STYLE,
        footStyles: { fillColor: PDF_COLORS.ruleLight, textColor: PDF_COLORS.dark, fontStyle: "bold" },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawPdfFooter(doc, { pageWidth, pageHeight, margin, pageNumber: i, totalPages: pageCount });
    }

    doc.save(`asset-inventory-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error loading asset report</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Package className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 space-y-1.5">
            <CardTitle>Asset inventory report</CardTitle>
            <CardDescription>Complete inventory of all company assets</CardDescription>
          </div>
        </div>
        <Button onClick={exportToPDF} disabled={isLoading || !report} className="w-full shrink-0 sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : report ? (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
              <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Total assets</p>
                <p className="text-2xl font-bold">{report.totalAssets}</p>
              </div>
              <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Total value</p>
                <p className="break-words text-lg font-bold sm:text-2xl">
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(report.totalValue)}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold">
                  {report.byStatus.find((s) => s.status === "available")?.count || 0}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Assigned</p>
                <p className="text-2xl font-bold">
                  {report.byStatus.find((s) => s.status === "assigned")?.count || 0}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">In repair, damaged or lost</p>
                <p className="text-2xl font-bold">
                  {report.byStatus
                    .filter((s) => s.status === "in_repair" || s.status === "damaged" || s.status === "lost")
                    .reduce((n, s) => n + s.count, 0)}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Repair spend this year</p>
                <p className="break-words text-lg font-bold sm:text-2xl">
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(report.repairSpendThisYear)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(report.repairSpendTotal)} all time
                </p>
              </div>
            </div>

            {/* Asset table */}
            <div className="hidden rounded-md border sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Assigned to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No assets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.records.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.assetCode}</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell>{asset.category}</TableCell>
                        <TableCell>{getStatusBadge(asset.status)}</TableCell>
                        <TableCell>{formatCurrency(asset.purchaseCost)}</TableCell>
                        <TableCell>{asset.assignedTo}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-3 sm:hidden" aria-label="Assets">
              {report.records.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">No assets found</li>
              ) : (
                report.records.map((asset) => (
                  <li key={asset.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{asset.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[asset.assetCode, asset.category].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                      {getStatusBadge(asset.status)}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Cost</dt>
                        <dd className="tabular-nums">{formatCurrency(asset.purchaseCost)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Assigned to</dt>
                        <dd className="truncate">{asset.assignedTo || "—"}</dd>
                      </div>
                    </dl>
                  </li>
                ))
              )}
            </ul>

            {report.repairs.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">Repairs</h3>
                <ul className="space-y-3 sm:hidden" aria-label="Repairs">
                  {report.repairs.map((r) => (
                    <li key={r.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.assetName}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.assetCode}
                            {r.vendor && ` · ${r.vendor}`}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums">
                          {r.cost != null ? formatCurrency(r.cost) : r.estimatedCost != null ? `est. ${formatCurrency(r.estimatedCost)}` : "—"}
                        </span>
                      </div>
                      <p className="mt-1">{r.problem}</p>
                      <p className="text-xs text-muted-foreground">
                        Sent {format(parseISO(r.sentDate), "MMM d, yyyy")} ·{" "}
                        {r.returnedDate ? `back ${format(parseISO(r.returnedDate), "MMM d, yyyy")}` : "in repair"}
                        {r.outcome === "beyond_repair" && " · beyond repair"}
                      </p>
                    </li>
                  ))}
                  <li className="flex justify-between px-1 font-semibold">
                    <span>Total spent</span>
                    <span className="tabular-nums">{formatCurrency(report.repairSpendTotal)}</span>
                  </li>
                </ul>
                <div className="hidden overflow-x-auto rounded-md border sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Back</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.repairs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="min-w-[160px]">
                            <p className="font-medium">{r.assetName}</p>
                            <p className="text-xs text-muted-foreground">{r.assetCode}</p>
                          </TableCell>
                          <TableCell className="min-w-[180px]">{r.problem}</TableCell>
                          <TableCell>{r.vendor ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{format(parseISO(r.sentDate), "MMM d, yyyy")}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.returnedDate ? (
                              <>
                                {format(parseISO(r.returnedDate), "MMM d, yyyy")}
                                {r.outcome === "beyond_repair" && <span className="block text-xs text-destructive">Beyond repair</span>}
                              </>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400">In repair</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {r.cost != null ? formatCurrency(r.cost) : r.estimatedCost != null ? (
                              <span className="text-muted-foreground">est. {formatCurrency(r.estimatedCost)}</span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={5} className="font-semibold">Total spent</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(report.repairSpendTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
