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
import { Plus, Search, Package, Laptop, Monitor, Smartphone } from "lucide-react";
import { useAssets, useAssetStats, useCreateAsset, useUpdateAsset, useDeleteAsset, useAssignAsset, useReturnAsset, type Asset } from "@/hooks/useAssets";
import { useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";

const Assets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
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
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const assignAsset = useAssignAsset();
  const returnAsset = useReturnAsset();

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

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
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
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
              {assets.length === 0 && (
                <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Asset
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAssets.map((asset) => (
              <AssetCard 
                key={asset.id} 
                asset={asset} 
                onEdit={handleEditAsset}
                onDelete={handleDeleteAsset}
                onAssign={handleAssignAsset}
                onReturn={handleReturnAsset}
              />
            ))}
          </div>
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
    </DashboardLayout>
  );
};

export default Assets;