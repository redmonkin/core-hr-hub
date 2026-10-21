import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AssetCard } from "@/components/assets/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Package, ArrowUpDown, ShieldAlert, UserCheck, CheckCircle2, Wrench, AlertTriangle, LayoutGrid, List } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useSorting } from "@/hooks/useSorting";
import { DropdownMenu as SortDropdownMenu, DropdownMenuContent as SortDropdownMenuContent, DropdownMenuItem as SortDropdownMenuItem, DropdownMenuTrigger as SortDropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useAssets, useCreateAsset, useUpdateAsset, useDeleteAsset, useAssignAsset, useReturnAsset, useAssetIssues, ASSET_TYPES, ASSET_STATUSES, ASSET_STATUS_LABELS, type Asset, type AssetIssue, type AssetType } from "@/hooks/useAssets";
import { AssetActionDialog, type AssetDialogAction } from "@/components/assets/AssetActionDialog";
import type { AssetAction } from "@/components/assets/AssetActionsMenu";
import { AssetHistoryDialog } from "@/components/assets/AssetHistoryDialog";
import { AssetIssuesPanel } from "@/components/assets/AssetIssuesPanel";
import { AssetTable } from "@/components/assets/AssetTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DateRangeExportDialog } from "@/components/export/DateRangeExportDialog";
import { format, parseISO, isWithinInterval, isAfter, isBefore } from "date-fns";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { drawPdfHeader, drawPdfFooter, fetchImageAsDataUrl, PDF_TABLE_HEAD_STYLE, PDF_COLORS } from "@/lib/pdfTheme";
const ASSET_TYPE_LABELS: Record<AssetType, { singular: string; plural: string }> = {
  laptop: { singular: "Laptop", plural: "Laptops" },
  desktop: { singular: "Desktop", plural: "Desktops" },
  monitor: { singular: "Monitor", plural: "Monitors" },
  phone: { singular: "Phone", plural: "Phones" },
  tablet: { singular: "Tablet", plural: "Tablets" },
  accessory: { singular: "Accessory", plural: "Accessories" },
  other: { singular: "Other", plural: "Other" },
};
const EMPTY_FORM = {
  name: "",
  category: "laptop",
  serial_number: "",
  purchase_date: "",
  purchase_cost: "",
  vendor: "",
  warranty_end_date: "",
  notes: ""
};

const VIEW_KEY = "peoplo.assets.view";
type AssetFormData = typeof EMPTY_FORM;

const Assets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  // "active" = everything except retired
  const [statusFilter, setStatusFilter] = useState("active");
  const [searchParams, setSearchParams] = useSearchParams();
  const pageTab = searchParams.get("tab") === "issues" ? "issues" : "inventory";
  const setPageTab = (tab: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "issues") next.set("tab", "issues");
      else next.delete("tab");
      return next;
    });
  const [view, setView] = useState<"cards" | "table">(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table";
    } catch {
      return "table";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // storage unavailable: the choice just isn't remembered
    }
  }, [view]);
  const [actionDialog, setActionDialog] = useState<{ asset: Asset; action: AssetDialogAction; issue?: AssetIssue } | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [formData, setFormData] = useState<AssetFormData>(EMPTY_FORM);
  const {
    data: assets = [],
    isLoading
  } = useAssets();
  const {
    data: employees = []
  } = useEmployees();
  const { can } = usePermissions();
  const canViewAssets = can("assets", "view");
  const canManageAssets = can("assets", "manage");
  const { data: branding } = useCompanyBranding();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const assignAsset = useAssignAsset();
  const returnAsset = useReturnAsset();
  const { data: issues = [], isLoading: issuesLoading } = useAssetIssues(canViewAssets);
  const filteredAssets = assets.filter(asset => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      asset.name.toLowerCase().includes(q) ||
      asset.serialNumber.toLowerCase().includes(q) ||
      asset.assetCode.toLowerCase().includes(q) ||
      (asset.assignedTo?.name.toLowerCase().includes(q) ?? false);
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active"
        ? asset.status !== "retired"
        : statusFilter === "damaged_or_lost"
          ? asset.status === "damaged" || asset.status === "lost"
          : asset.status === statusFilter);
    return matchesSearch && matchesType && matchesStatus;
  });

  // Apply sorting
  const {
    sortedItems: sortedAssets,
    sortConfig,
    requestSort
  } = useSorting(filteredAssets);
  const sortOptions = [{
    key: "name",
    label: "Name"
  }, {
    key: "type",
    label: "Type"
  }, {
    key: "status",
    label: "Status"
  }, {
    key: "cost",
    label: "Cost"
  }] as const;
  const {
    paginatedItems: paginatedAssets,
    currentPage,
    totalPages,
    totalItems,
    setPage,
    setPageSize,
    pageSize,
    goToNextPage,
    goToPreviousPage,
    canGoNext,
    canGoPrevious
  } = usePagination(sortedAssets, {
    initialPageSize: 12
  });
  const filterByDateRange = (items: Asset[], startDate?: Date, endDate?: Date) => {
    if (!startDate && !endDate) return items;
    return items.filter(asset => {
      const purchaseDate = asset.purchaseDate ? parseISO(asset.purchaseDate) : null;
      if (!purchaseDate) return !startDate && !endDate;
      if (startDate && endDate) {
        return isWithinInterval(purchaseDate, {
          start: startDate,
          end: endDate
        });
      }
      if (startDate) return isAfter(purchaseDate, startDate) || purchaseDate.getTime() === startDate.getTime();
      if (endDate) return isBefore(purchaseDate, endDate) || purchaseDate.getTime() === endDate.getTime();
      return true;
    });
  };
  const exportToCSV = (startDate?: Date, endDate?: Date) => {
    const dataToExport = filterByDateRange(sortedAssets, startDate, endDate);
    const headers = ["Code", "Name", "Category", "Serial Number", "Status", "Cost", "Repair spend", "Purchase Date", "Warranty ends", "Assigned To"];
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csvContent = [headers.join(","), ...dataToExport.map(asset => [asset.assetCode, asset.name, asset.type, asset.serialNumber, ASSET_STATUS_LABELS[asset.status], asset.cost, asset.repairSpend, asset.purchaseDate || "", asset.warrantyEnd, asset.assignedTo?.name || "Unassigned"].map(cell).join(","))].join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    link.download = `assets${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success(`${dataToExport.length} assets exported to CSV`);
  };
  const exportToPDF = async (startDate?: Date, endDate?: Date) => {
    const dataToExport = filterByDateRange(sortedAssets, startDate, endDate);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const logoDataUrl = await fetchImageAsDataUrl(branding?.logoUrl);

    const subtitle = startDate || endDate
      ? `Date Range: ${startDate ? format(startDate, "PP") : "Start"} - ${endDate ? format(endDate, "PP") : "End"}`
      : undefined;

    let currentY = drawPdfHeader(doc, {
      title: "Asset Inventory",
      subtitle,
      companyName: branding?.companyName,
      companyAddress: branding?.companyAddress,
      logoDataUrl,
      pageWidth,
      margin,
    });

    doc.setTextColor(...PDF_COLORS.dark);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Assets: ${dataToExport.length}`, margin, currentY);
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
      head: [["Code", "Name", "Category", "Serial Number", "Status", "Cost", "Repairs", "Assigned To"]],
      body: dataToExport.map(asset => [asset.assetCode, asset.name, asset.type, asset.serialNumber, ASSET_STATUS_LABELS[asset.status], `Rs. ${asset.cost.toLocaleString("en-IN")}`, asset.repairSpend ? `Rs. ${asset.repairSpend.toLocaleString("en-IN")}` : "-", asset.assignedTo?.name || "Unassigned"]),
      styles: {
        fontSize: 8
      },
      headStyles: PDF_TABLE_HEAD_STYLE
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawPdfFooter(doc, { pageWidth, pageHeight, margin, pageNumber: i, totalPages: pageCount });
    }

    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    doc.save(`assets${dateRange}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success(`${dataToExport.length} assets exported to PDF`);
  };
  const handleAddAsset = () => {
    if (!formData.name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    createAsset.mutate({
      name: formData.name,
      category: formData.category,
      serial_number: formData.serial_number || undefined,
      purchase_date: formData.purchase_date || undefined,
      purchase_cost: formData.purchase_cost ? parseFloat(formData.purchase_cost) : undefined,
      vendor: formData.vendor || undefined,
      warranty_end_date: formData.warranty_end_date || undefined,
      notes: formData.notes || undefined
    }, {
      onSuccess: () => {
        toast.success("Asset added successfully");
        setIsAddDialogOpen(false);
        setFormData(EMPTY_FORM);
      },
      onError: () => {
        toast.error("Failed to add asset");
      }
    });
  };
  const handleEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      name: asset.name,
      // Keep a custom category as-is instead of silently renaming it.
      category: asset.type === "other" ? asset.category : asset.type,
      serial_number: asset.serialNumber,
      purchase_date: asset.purchaseDateRaw,
      purchase_cost: asset.cost ? asset.cost.toString() : "",
      vendor: asset.vendor,
      warranty_end_date: asset.warrantyEnd,
      notes: asset.notes || ""
    });
    setIsEditDialogOpen(true);
  };
  const handleUpdateAsset = () => {
    if (!selectedAsset || !formData.name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    updateAsset.mutate({
      id: selectedAsset.id,
      name: formData.name,
      category: formData.category,
      // Send every field (null when cleared) so the saved record matches the form exactly.
      serial_number: formData.serial_number.trim() || null,
      purchase_date: formData.purchase_date || null,
      purchase_cost: formData.purchase_cost ? parseFloat(formData.purchase_cost) : null,
      vendor: formData.vendor.trim() || null,
      warranty_end_date: formData.warranty_end_date || null,
      notes: formData.notes.trim() || null
    }, {
      onSuccess: () => {
        toast.success("Asset updated successfully");
        setIsEditDialogOpen(false);
        setSelectedAsset(null);
      },
      onError: () => {
        toast.error("Failed to update asset");
      }
    });
  };
  const handleDeleteAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsDeleteDialogOpen(true);
  };
  const confirmDelete = () => {
    if (!selectedAsset) return;
    deleteAsset.mutate(selectedAsset.id, {
      onSuccess: () => {
        toast.success("Asset deleted successfully");
        setIsDeleteDialogOpen(false);
        setSelectedAsset(null);
      },
      onError: () => {
        toast.error("Failed to delete asset");
      }
    });
  };
  const handleAssignAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setSelectedEmployeeId("");
    setAssignmentNotes("");
    setIsAssignDialogOpen(true);
  };
  const confirmAssign = () => {
    if (!selectedAsset || !selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }
    assignAsset.mutate({
      assetId: selectedAsset.id,
      employeeId: selectedEmployeeId,
      notes: assignmentNotes || undefined
    }, {
      onSuccess: () => {
        toast.success("Asset assigned successfully");
        setIsAssignDialogOpen(false);
        setSelectedAsset(null);
        setSelectedEmployeeId("");
        setAssignmentNotes("");
      },
      onError: () => {
        toast.error("Failed to assign asset");
      }
    });
  };
  const handleReturnAsset = (asset: Asset) => {
    returnAsset.mutate(asset.id, {
      onSuccess: () => {
        toast.success("Asset marked as returned");
      },
      onError: () => {
        toast.error("Failed to return asset");
      }
    });
  };
  const handleAction = (action: AssetAction, asset: Asset) => {
    switch (action) {
      case "edit":
        return handleEditAsset(asset);
      case "history":
        return setHistoryAsset(asset);
      case "assign":
        return handleAssignAsset(asset);
      case "return":
        return handleReturnAsset(asset);
      case "delete":
        return handleDeleteAsset(asset);
      default:
        return setActionDialog({ asset, action });
    }
  };
  const counts = useMemo(() => {
    const by = (st: Asset["status"]) => assets.filter((a) => a.status === st).length;
    return {
      active: assets.filter((a) => a.status !== "retired").length,
      assigned: by("assigned"),
      available: by("available"),
      inRepair: by("in_repair"),
      damagedOrLost: by("damaged") + by("lost"),
    };
  }, [assets]);
  const assetStats = [
    { label: "Assets in use or stock", value: counts.active, icon: <Package className="h-5 w-5" aria-hidden="true" />, filter: "active" },
    { label: "Assigned", value: counts.assigned, icon: <UserCheck className="h-5 w-5" aria-hidden="true" />, filter: "assigned" },
    { label: "Available", value: counts.available, icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />, filter: "available" },
    { label: "In repair", value: counts.inRepair, icon: <Wrench className="h-5 w-5" aria-hidden="true" />, filter: "in_repair" },
    { label: "Damaged or lost", value: counts.damagedOrLost, icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />, filter: "damaged_or_lost" },
  ];
  const categoryOptions: { value: string; label: string }[] = ASSET_TYPES.filter(t => t !== "other").map(t => ({
    value: t,
    label: ASSET_TYPE_LABELS[t].singular
  }));
  if (formData.category && !categoryOptions.some(o => o.value === formData.category)) {
    categoryOptions.push({ value: formData.category, label: formData.category });
  }
  const updateField = (field: keyof AssetFormData) => (value: string) => setFormData(prev => ({
    ...prev,
    [field]: value
  }));
  const renderAssetFields = (idPrefix: string) => <div className="space-y-4 py-2 sm:py-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}name`}>Asset name *</Label>
        <Input id={`${idPrefix}name`} value={formData.name} onChange={e => updateField("name")(e.target.value)} placeholder="e.g., MacBook Pro 16" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}category`}>Category</Label>
        <Select value={formData.category} onValueChange={updateField("category")}>
          <SelectTrigger id={`${idPrefix}category`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}serial_number`}>Serial number</Label>
        <Input id={`${idPrefix}serial_number`} value={formData.serial_number} onChange={e => updateField("serial_number")(e.target.value)} placeholder="e.g., ABC123XYZ" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${idPrefix}purchase_date`}>Purchase date</Label>
          <Input id={`${idPrefix}purchase_date`} type="date" className="block w-full min-w-0" value={formData.purchase_date} onChange={e => updateField("purchase_date")(e.target.value)} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${idPrefix}purchase_cost`}>Cost (₹)</Label>
          <Input id={`${idPrefix}purchase_cost`} type="number" inputMode="decimal" min="0" value={formData.purchase_cost} onChange={e => updateField("purchase_cost")(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}vendor`}>Vendor</Label>
        <Input id={`${idPrefix}vendor`} value={formData.vendor} onChange={e => updateField("vendor")(e.target.value)} placeholder="e.g., Apple Store" />
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${idPrefix}warranty_end_date`}>Warranty ends</Label>
        <Input id={`${idPrefix}warranty_end_date`} type="date" className="block w-full min-w-0" value={formData.warranty_end_date} onChange={e => updateField("warranty_end_date")(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}notes`}>Notes</Label>
        <Textarea id={`${idPrefix}notes`} value={formData.notes} onChange={e => updateField("notes")(e.target.value)} placeholder="e.g., 16GB RAM, 512GB SSD, M3 Pro chip" rows={3} />
      </div>
    </div>;
  if (!canViewAssets) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-sm text-muted-foreground">Ask an administrator for access to the Assets module.</p>
        </div>
      </DashboardLayout>
    );
  }

  return <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Assets</h1>
            <p className="text-muted-foreground">Track and manage company assets</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <DateRangeExportDialog title="Export Assets" description="Export asset inventory with optional date range filter based on purchase date." onExportCSV={exportToCSV} onExportPDF={exportToPDF} />
            {canManageAssets && <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Add asset
              </Button>}
          </div>
        </div>

        <Tabs value={pageTab} onValueChange={setPageTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="issues">
              Problems reported
              {issues.length > 0 && <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100">{issues.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issues">
            <AssetIssuesPanel
              issues={issues}
              isLoading={issuesLoading}
              assets={assets}
              canManage={canManageAssets}
              onSendForRepair={(asset, issue) => setActionDialog({ asset, action: "repair", issue })}
            />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
        {/* Stats (tap to filter) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {assetStats.map((stat, i) => <button key={stat.label} type="button" onClick={() => setStatusFilter(stat.filter)} aria-pressed={statusFilter === stat.filter} className={`rounded-xl border bg-card text-left transition-colors hover:border-primary/50 ${statusFilter === stat.filter ? "border-primary ring-1 ring-primary" : ""} ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
              <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
                <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">{stat.icon}</div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-foreground sm:text-2xl">{stat.value}</p>
                  <p className="text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                </div>
              </div>
            </button>)}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search assets..." aria-label="Search assets" className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{ASSET_TYPE_LABELS[t].plural}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">All except retired</SelectItem>
              <SelectItem value="all">All, including retired</SelectItem>
              <SelectItem value="damaged_or_lost">Damaged or lost</SelectItem>
              {ASSET_STATUSES.map(st => <SelectItem key={st} value={st}>{ASSET_STATUS_LABELS[st]}</SelectItem>)}
            </SelectContent>
          </Select>
          <SortDropdownMenu>
            <SortDropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full gap-2 sm:w-auto">
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                Sort: {sortConfig.key ? sortOptions.find(o => o.key === sortConfig.key)?.label : "None"}
                {sortConfig.direction && (sortConfig.direction === "asc" ? " ↑" : " ↓")}
              </Button>
            </SortDropdownMenuTrigger>
            <SortDropdownMenuContent align="end">
              {sortOptions.map(option => <SortDropdownMenuItem key={option.key} onClick={() => requestSort(option.key as keyof Asset)} className={sortConfig.key === option.key ? "bg-accent" : ""}>
                  {option.label}
                  {sortConfig.key === option.key && <span className="ml-2">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>}
                </SortDropdownMenuItem>)}
            </SortDropdownMenuContent>
          </SortDropdownMenu>
          <div className="hidden shrink-0 rounded-md border p-0.5 sm:flex" role="group" aria-label="Layout">
            <Button type="button" variant={view === "table" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("table")} aria-pressed={view === "table"} aria-label="Table view" title="Table view">
              <List className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button type="button" variant={view === "cards" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("cards")} aria-pressed={view === "cards"} aria-label="Card view" title="Card view">
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Asset Grid */}
        {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div> : filteredAssets.length === 0 ? <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">No assets found</h3>
              <p className="text-muted-foreground">
                {assets.length === 0 ? "Start by adding your first asset" : "No assets match your search criteria"}
              </p>
              {assets.length === 0 && canManageAssets && <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add asset
                </Button>}
            </CardContent>
          </Card> : <>
            {view === "table" && <div className="hidden sm:block">
                <AssetTable assets={paginatedAssets} canManage={canManageAssets} onAction={handleAction} />
              </div>}
            <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${view === "table" ? "sm:hidden" : ""}`}>
              {paginatedAssets.map(asset => <AssetCard key={asset.id} asset={asset} onAction={handleAction} canManage={canManageAssets} />)}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Show</span>
                  <Select value={pageSize.toString()} onValueChange={v => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px]" aria-label="Assets per page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[6, 12, 24, 48].map(size => <SelectItem key={size} value={size.toString()}>{size}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span>of {totalItems} assets</span>
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => canGoPrevious && goToPreviousPage()} className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                    </PaginationItem>
                    {(() => {
                const pages: (number | "ellipsis")[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (currentPage > 3) pages.push("ellipsis");
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                    pages.push(i);
                  }
                  if (currentPage < totalPages - 2) pages.push("ellipsis");
                  pages.push(totalPages);
                }
                return pages.map((page, idx) => page === "ellipsis" ? <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem> : <PaginationItem key={page}>
                            <PaginationLink onClick={() => setPage(page)} isActive={currentPage === page} className="cursor-pointer">
                              {page}
                            </PaginationLink>
                          </PaginationItem>);
              })()}
                    <PaginationItem>
                      <PaginationNext onClick={() => canGoNext && goToNextPage()} className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>}
          </>}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Asset Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add new asset</DialogTitle>
            <DialogDescription>Enter the details of the asset to add it to the inventory.</DialogDescription>
          </DialogHeader>
          {renderAssetFields("")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAsset} disabled={createAsset.isPending}>
              {createAsset.isPending ? "Adding..." : "Add asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit asset</DialogTitle>
            <DialogDescription>Update the asset details below.</DialogDescription>
          </DialogHeader>
          {renderAssetFields("edit-")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAsset} disabled={updateAsset.isPending}>
              {updateAsset.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedAsset?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteAsset.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Asset Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign asset</DialogTitle>
            <DialogDescription>
              Assign "{selectedAsset?.name}" to an employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Select Employee *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(emp => emp.status === "active").map(emp => <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - {emp.department}
                      </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-notes">Notes (optional)</Label>
              <Textarea id="assign-notes" value={assignmentNotes} onChange={e => setAssignmentNotes(e.target.value)} placeholder="e.g., Assigned for project work" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAssign} disabled={assignAsset.isPending || !selectedEmployeeId}>
              {assignAsset.isPending ? "Assigning..." : "Assign asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssetHistoryDialog asset={historyAsset} onClose={() => setHistoryAsset(null)} />
      <AssetActionDialog
        asset={actionDialog?.asset ?? null}
        action={actionDialog?.action ?? null}
        issue={actionDialog?.issue}
        onClose={() => setActionDialog(null)}
      />
    </DashboardLayout>;
};
export default Assets;