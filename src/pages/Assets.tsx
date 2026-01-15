import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AssetCard } from "@/components/assets/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Package, Laptop, Monitor, Smartphone, ArrowUpDown } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { useSorting } from "@/hooks/useSorting";
import {
  DropdownMenu as SortDropdownMenu,
  DropdownMenuContent as SortDropdownMenuContent,
  DropdownMenuItem as SortDropdownMenuItem,
  DropdownMenuTrigger as SortDropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAssets, useAssetStats, useCreateAsset, useUpdateAsset, useDeleteAsset, useAssignAsset, useReturnAsset, useAssetHistory, type Asset } from "@/hooks/useAssets";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DateRangeExportDialog } from "@/components/export/DateRangeExportDialog";
import { format, parseISO, isWithinInterval, isAfter, isBefore } from "date-fns";

const Assets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    category: "laptop",
    serial_number: "",
    purchase_date: "",
    purchase_cost: "",
    vendor: "",
    notes: "",
  });

  const { data: assets = [], isLoading } = useAssets();
  const { data: stats } = useAssetStats();
  const { data: employees = [] } = useEmployees();
  const { isAdminOrHR } = useIsAdminOrHR();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const assignAsset = useAssignAsset();
  const returnAsset = useReturnAsset();
  const { data: assetHistory = [], isLoading: isHistoryLoading } = useAssetHistory(historyAssetId);

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Apply sorting
  const {
    sortedItems: sortedAssets,
    sortConfig,
    requestSort,
  } = useSorting(filteredAssets);

  const sortOptions = [
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "cost", label: "Cost" },
  ] as const;

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
    canGoPrevious,
  } = usePagination(sortedAssets, { initialPageSize: 12 });

  const filterByDateRange = (items: Asset[], startDate?: Date, endDate?: Date) => {
    if (!startDate && !endDate) return items;
    
    return items.filter((asset) => {
      const purchaseDate = asset.purchaseDate ? parseISO(asset.purchaseDate) : null;
      if (!purchaseDate) return !startDate && !endDate;
      
      if (startDate && endDate) {
        return isWithinInterval(purchaseDate, { start: startDate, end: endDate });
      }
      if (startDate) return isAfter(purchaseDate, startDate) || purchaseDate.getTime() === startDate.getTime();
      if (endDate) return isBefore(purchaseDate, endDate) || purchaseDate.getTime() === endDate.getTime();
      return true;
    });
  };

  const exportToCSV = (startDate?: Date, endDate?: Date) => {
    const dataToExport = filterByDateRange(sortedAssets, startDate, endDate);
    const headers = ["Name", "Category", "Serial Number", "Status", "Cost", "Purchase Date", "Assigned To"];
    const csvContent = [
      headers.join(","),
      ...dataToExport.map((asset) =>
        [
          `"${asset.name}"`,
          `"${asset.type}"`,
          `"${asset.serialNumber}"`,
          `"${asset.status}"`,
          `"${asset.cost}"`,
          `"${asset.purchaseDate || ''}"`,
          `"${asset.assignedTo?.name || 'Unassigned'}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    link.download = `assets${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success(`${dataToExport.length} assets exported to CSV`);
  };

  const exportToPDF = (startDate?: Date, endDate?: Date) => {
    const dataToExport = filterByDateRange(sortedAssets, startDate, endDate);
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Asset Inventory", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
    if (startDate || endDate) {
      doc.text(`Date Range: ${startDate ? format(startDate, "PP") : "Start"} - ${endDate ? format(endDate, "PP") : "End"}`, 14, 36);
      doc.text(`Total Assets: ${dataToExport.length}`, 14, 42);
    } else {
      doc.text(`Total Assets: ${dataToExport.length}`, 14, 36);
    }

    autoTable(doc, {
      startY: startDate || endDate ? 50 : 44,
      head: [["Name", "Category", "Serial Number", "Status", "Cost", "Assigned To"]],
      body: dataToExport.map((asset) => [
        asset.name,
        asset.type,
        asset.serialNumber,
        asset.status,
        `₹${asset.cost.toLocaleString()}`,
        asset.assignedTo?.name || "Unassigned",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    doc.save(`assets${dateRange}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success(`${dataToExport.length} assets exported to PDF`);
  };

  const handleAddAsset = () => {
    if (!formData.name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    createAsset.mutate(
      {
        name: formData.name,
        category: formData.category,
        serial_number: formData.serial_number || undefined,
        purchase_date: formData.purchase_date || undefined,
        purchase_cost: formData.purchase_cost ? parseFloat(formData.purchase_cost) : undefined,
        vendor: formData.vendor || undefined,
        notes: formData.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Asset added successfully");
          setIsAddDialogOpen(false);
          setFormData({
            name: "",
            category: "laptop",
            serial_number: "",
            purchase_date: "",
            purchase_cost: "",
            vendor: "",
            notes: "",
          });
        },
        onError: () => {
          toast.error("Failed to add asset");
        },
      }
    );
  };

  const handleEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      name: asset.name,
      category: asset.type,
      serial_number: asset.serialNumber,
      purchase_date: "",
      purchase_cost: asset.cost.toString(),
      vendor: "",
      notes: asset.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateAsset = () => {
    if (!selectedAsset || !formData.name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    updateAsset.mutate(
      {
        id: selectedAsset.id,
        name: formData.name,
        category: formData.category,
        serial_number: formData.serial_number || undefined,
        purchase_date: formData.purchase_date || undefined,
        purchase_cost: formData.purchase_cost ? parseFloat(formData.purchase_cost) : undefined,
        vendor: formData.vendor || undefined,
        notes: formData.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Asset updated successfully");
          setIsEditDialogOpen(false);
          setSelectedAsset(null);
        },
        onError: () => {
          toast.error("Failed to update asset");
        },
      }
    );
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
      },
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
    assignAsset.mutate(
      {
        assetId: selectedAsset.id,
        employeeId: selectedEmployeeId,
        notes: assignmentNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Asset assigned successfully");
          setIsAssignDialogOpen(false);
          setSelectedAsset(null);
          setSelectedEmployeeId("");
          setAssignmentNotes("");
        },
        onError: () => {
          toast.error("Failed to assign asset");
        },
      }
    );
  };

  const handleReturnAsset = (asset: Asset) => {
    returnAsset.mutate(asset.id, {
      onSuccess: () => {
        toast.success("Asset marked as returned");
      },
      onError: () => {
        toast.error("Failed to return asset");
      },
    });
  };

  const handleViewHistory = (asset: Asset) => {
    setSelectedAsset(asset);
    setHistoryAssetId(asset.id);
    setIsHistoryDialogOpen(true);
  };

  const assetStats = [
    { label: "Total Assets", value: stats?.total || 0, icon: <Package className="h-5 w-5" /> },
    { label: "Laptops", value: stats?.laptops || 0, icon: <Laptop className="h-5 w-5" /> },
    { label: "Monitors", value: stats?.monitors || 0, icon: <Monitor className="h-5 w-5" /> },
    { label: "Mobile Devices", value: stats?.phones || 0, icon: <Smartphone className="h-5 w-5" /> },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Asset Management</h2>
            <p className="text-muted-foreground">Track and manage company assets</p>
          </div>
          <div className="flex gap-3">
            {isAdminOrHR && (
              <>
                <DateRangeExportDialog
                  title="Export Assets"
                  description="Export asset inventory with optional date range filter based on purchase date."
                  onExportCSV={exportToCSV}
                  onExportPDF={exportToPDF}
                />
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Asset
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {assetStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">{stat.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="laptop">Laptops</SelectItem>
              <SelectItem value="monitor">Monitors</SelectItem>
              <SelectItem value="phone">Phones</SelectItem>
              <SelectItem value="accessory">Accessories</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
          <SortDropdownMenu>
            <SortDropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort: {sortConfig.key ? sortOptions.find(o => o.key === sortConfig.key)?.label : "None"}
                {sortConfig.direction && (sortConfig.direction === "asc" ? " ↑" : " ↓")}
              </Button>
            </SortDropdownMenuTrigger>
            <SortDropdownMenuContent align="end">
              {sortOptions.map((option) => (
                <SortDropdownMenuItem
                  key={option.key}
                  onClick={() => requestSort(option.key as keyof Asset)}
                  className={sortConfig.key === option.key ? "bg-accent" : ""}
                >
                  {option.label}
                  {sortConfig.key === option.key && (
                    <span className="ml-2">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                  )}
                </SortDropdownMenuItem>
              ))}
            </SortDropdownMenuContent>
          </SortDropdownMenu>
        </div>

        {/* Asset Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">No Assets Found</h3>
              <p className="text-muted-foreground">
                {assets.length === 0
                  ? "Start by adding your first asset"
                  : "No assets match your search criteria"}
              </p>
              {assets.length === 0 && isAdminOrHR && (
                <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Asset
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedAssets.map((asset) => (
                <AssetCard 
                  key={asset.id} 
                  asset={asset} 
                  onEdit={handleEditAsset}
                  onDelete={handleDeleteAsset}
                  onAssign={handleAssignAsset}
                  onReturn={handleReturnAsset}
                  onViewHistory={handleViewHistory}
                  showAdminActions={isAdminOrHR}
                />
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Show</span>
                  <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[6, 12, 24, 48].map((size) => (
                        <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>of {totalItems} assets</span>
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => canGoPrevious && goToPreviousPage()}
                        className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
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
                      return pages.map((page, idx) =>
                        page === "ellipsis" ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      );
                    })()}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => canGoNext && goToNextPage()}
                        className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Asset Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Asset Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., MacBook Pro 16"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="monitor">Monitor</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="accessory">Accessory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                placeholder="e.g., ABC123XYZ"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_cost">Cost</Label>
                <Input
                  id="purchase_cost"
                  type="number"
                  value={formData.purchase_cost}
                  onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="e.g., Apple Store"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., 16GB RAM, 512GB SSD, M3 Pro chip"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAsset} disabled={createAsset.isPending}>
              {createAsset.isPending ? "Adding..." : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>Update the asset details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Asset Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., MacBook Pro 16"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="monitor">Monitor</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="accessory">Accessory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-serial_number">Serial Number</Label>
              <Input
                id="edit-serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                placeholder="e.g., ABC123XYZ"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-purchase_date">Purchase Date</Label>
                <Input
                  id="edit-purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-purchase_cost">Cost</Label>
                <Input
                  id="edit-purchase_cost"
                  type="number"
                  value={formData.purchase_cost}
                  onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vendor">Vendor</Label>
              <Input
                id="edit-vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="e.g., Apple Store"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., 16GB RAM, 512GB SSD, M3 Pro chip"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAsset} disabled={updateAsset.isPending}>
              {updateAsset.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedAsset?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAsset.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Asset Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Asset</DialogTitle>
            <DialogDescription>
              Assign "{selectedAsset?.name}" to an employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Select Employee *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((emp) => emp.status === "active")
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - {emp.department}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-notes">Notes (optional)</Label>
              <Textarea
                id="assign-notes"
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="e.g., Assigned for project work"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAssign} disabled={assignAsset.isPending || !selectedEmployeeId}>
              {assignAsset.isPending ? "Assigning..." : "Assign Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => {
        setIsHistoryDialogOpen(open);
        if (!open) {
          setHistoryAssetId(null);
          setSelectedAsset(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assignment History</DialogTitle>
            <DialogDescription>
              History for "{selectedAsset?.name}"
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {isHistoryLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : assetHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground">No assignment history found</p>
              </div>
            ) : (
              <div className="space-y-3 p-1">
                {assetHistory.map((assignment, index) => (
                  <div
                    key={assignment.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={assignment.employee.avatar} />
                          <AvatarFallback>
                            {assignment.employee.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{assignment.employee.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.assignedDate} — {assignment.returnedDate || "Present"}
                          </p>
                        </div>
                      </div>
                      <Badge variant={index === 0 && !assignment.returnedDate ? "default" : "secondary"}>
                        {index === 0 && !assignment.returnedDate ? "Current" : "Returned"}
                      </Badge>
                    </div>
                    {assignment.notes && (
                      <p className="mt-2 text-sm text-muted-foreground">{assignment.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Assets;