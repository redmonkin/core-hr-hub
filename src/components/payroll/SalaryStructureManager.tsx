import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, IndianRupee, Search } from "lucide-react";
import { toast } from "sonner";
import {
  useSalaryStructures,
  useCreateSalaryStructure,
  useUpdateSalaryStructure,
  useDeleteSalaryStructure,
  type SalaryStructure,
} from "@/hooks/usePayroll";
import { useEmployees } from "@/hooks/useEmployees";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface SalaryStructureManagerProps {
  /** Allow adding, editing and deleting structures (payroll:manage). */
  canManage?: boolean;
}

export function SalaryStructureManager({ canManage = true }: SalaryStructureManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<SalaryStructure | null>(null);
  const [formData, setFormData] = useState({
    employee_id: "",
    basic_salary: "",
    hra: "",
    transport_allowance: "",
    medical_allowance: "",
    other_allowances: "",
    tax_deduction: "",
    pf_deduction: "",
    effective_from: new Date().toISOString().split("T")[0],
  });

  const { data: structures = [], isLoading } = useSalaryStructures();
  const { data: employees = [] } = useEmployees();
  const createStructure = useCreateSalaryStructure();
  const updateStructure = useUpdateSalaryStructure();
  const deleteStructure = useDeleteSalaryStructure();

  // Filter employees who don't have a salary structure yet
  const employeesWithoutStructure = employees.filter(
    (emp) => emp.status === "active" && !structures.find((s) => s.employeeId === emp.id)
  );

  const filteredStructures = structures.filter(
    (s) =>
      s.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employeeEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      employee_id: "",
      basic_salary: "",
      hra: "",
      transport_allowance: "",
      medical_allowance: "",
      other_allowances: "",
      tax_deduction: "",
      pf_deduction: "",
      effective_from: new Date().toISOString().split("T")[0],
    });
  };

  const handleAdd = () => {
    if (!formData.employee_id || !formData.basic_salary) {
      toast.error("Employee and basic salary are required");
      return;
    }

    createStructure.mutate(
      {
        employee_id: formData.employee_id,
        basic_salary: parseFloat(formData.basic_salary),
        hra: formData.hra ? parseFloat(formData.hra) : undefined,
        transport_allowance: formData.transport_allowance ? parseFloat(formData.transport_allowance) : undefined,
        medical_allowance: formData.medical_allowance ? parseFloat(formData.medical_allowance) : undefined,
        other_allowances: formData.other_allowances ? parseFloat(formData.other_allowances) : undefined,
        tax_deduction: formData.tax_deduction ? parseFloat(formData.tax_deduction) : undefined,
        pf_deduction: formData.pf_deduction ? parseFloat(formData.pf_deduction) : undefined,
        effective_from: formData.effective_from,
      },
      {
        onSuccess: () => {
          toast.success("Salary structure created successfully");
          setIsAddDialogOpen(false);
          resetForm();
        },
        onError: () => {
          toast.error("Failed to create salary structure");
        },
      }
    );
  };

  const handleEdit = (structure: SalaryStructure) => {
    setSelectedStructure(structure);
    setFormData({
      employee_id: structure.employeeId,
      basic_salary: structure.basicSalary.toString(),
      hra: structure.hra.toString(),
      transport_allowance: structure.transportAllowance.toString(),
      medical_allowance: structure.medicalAllowance.toString(),
      other_allowances: structure.otherAllowances.toString(),
      tax_deduction: structure.taxDeduction.toString(),
      pf_deduction: structure.pfDeduction.toString(),
      effective_from: structure.effectiveFrom,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedStructure || !formData.basic_salary) {
      toast.error("Basic salary is required");
      return;
    }

    updateStructure.mutate(
      {
        id: selectedStructure.id,
        basic_salary: parseFloat(formData.basic_salary),
        hra: formData.hra ? parseFloat(formData.hra) : 0,
        transport_allowance: formData.transport_allowance ? parseFloat(formData.transport_allowance) : 0,
        medical_allowance: formData.medical_allowance ? parseFloat(formData.medical_allowance) : 0,
        other_allowances: formData.other_allowances ? parseFloat(formData.other_allowances) : 0,
        tax_deduction: formData.tax_deduction ? parseFloat(formData.tax_deduction) : 0,
        pf_deduction: formData.pf_deduction ? parseFloat(formData.pf_deduction) : 0,
        effective_from: formData.effective_from,
      },
      {
        onSuccess: () => {
          toast.success("Salary structure updated successfully");
          setIsEditDialogOpen(false);
          setSelectedStructure(null);
          resetForm();
        },
        onError: () => {
          toast.error("Failed to update salary structure");
        },
      }
    );
  };

  const handleDelete = (structure: SalaryStructure) => {
    setSelectedStructure(structure);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedStructure) return;

    deleteStructure.mutate(selectedStructure.id, {
      onSuccess: () => {
        toast.success("Salary structure deleted successfully");
        setIsDeleteDialogOpen(false);
        setSelectedStructure(null);
      },
      onError: () => {
        toast.error("Failed to delete salary structure");
      },
    });
  };

  const calculateNetSalary = () => {
    const basic = parseFloat(formData.basic_salary) || 0;
    const allowances =
      (parseFloat(formData.hra) || 0) +
      (parseFloat(formData.transport_allowance) || 0) +
      (parseFloat(formData.medical_allowance) || 0) +
      (parseFloat(formData.other_allowances) || 0);
    const deductions =
      (parseFloat(formData.tax_deduction) || 0) +
      (parseFloat(formData.pf_deduction) || 0);
    return basic + allowances - deductions;
  };

  type AmountField = "basic_salary" | "hra" | "transport_allowance" | "medical_allowance" | "other_allowances" | "tax_deduction" | "pf_deduction";

  const amountInput = (idPrefix: string, field: AmountField, label: string, placeholder = "0", labelClassName = "text-xs") => (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}${field}`} className={labelClassName}>{label}</Label>
      <Input
        id={`${idPrefix}${field}`}
        type="number"
        inputMode="decimal"
        min="0"
        value={formData[field]}
        onChange={(e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  // A render function (not a nested component) so inputs keep focus while typing.
  const renderSalaryFormFields = (idPrefix: string) => (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        All amounts below are <span className="font-medium text-foreground">monthly</span> figures, not annual (CTC).
      </p>

      {amountInput(idPrefix, "basic_salary", "Basic salary (monthly) *", "50000", "")}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-muted-foreground">Allowances</legend>
        <div className="grid grid-cols-2 gap-4">
          {amountInput(idPrefix, "hra", "HRA")}
          {amountInput(idPrefix, "transport_allowance", "Transport")}
          {amountInput(idPrefix, "medical_allowance", "Medical")}
          {amountInput(idPrefix, "other_allowances", "Other")}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-muted-foreground">Deductions</legend>
        <div className="grid grid-cols-2 gap-4">
          {amountInput(idPrefix, "tax_deduction", "Tax")}
          {amountInput(idPrefix, "pf_deduction", "PF")}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}effective_from`}>Effective from</Label>
        <Input
          id={`${idPrefix}effective_from`}
          type="date"
          className="block w-full min-w-0"
          value={formData.effective_from}
          onChange={(e) => setFormData((prev) => ({ ...prev, effective_from: e.target.value }))}
        />
      </div>

      <div className="rounded-lg bg-primary/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Net salary</span>
          <span className="text-lg font-bold text-foreground">{formatCurrency(calculateNetSalary())}</span>
        </div>
      </div>
    </div>
  );

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("");

  const renderRowActions = (structure: SalaryStructure) =>
    canManage ? (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-9 sm:w-9"
          onClick={() => handleEdit(structure)}
          aria-label={`Edit salary structure for ${structure.employeeName}`}
          title="Edit"
        >
          <Edit className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-destructive hover:text-destructive sm:h-9 sm:w-9"
          onClick={() => handleDelete(structure)}
          aria-label={`Delete salary structure for ${structure.employeeName}`}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            aria-label="Search salary structures"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {canManage && (
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={employeesWithoutStructure.length === 0}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add salary structure
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredStructures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <IndianRupee className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">No salary structures</h3>
            <p className="text-muted-foreground">
              {structures.length === 0
                ? "Add salary structures to enable payroll generation"
                : "No structures match your search"}
            </p>
            {canManage && structures.length === 0 && employeesWithoutStructure.length > 0 && (
              <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add first salary structure
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-3 sm:hidden">
            {filteredStructures.map((structure) => (
              <div key={structure.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={structure.employeeAvatar} alt="" />
                    <AvatarFallback>{initials(structure.employeeName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{structure.employeeName}</p>
                    <p className="truncate text-xs text-muted-foreground">{structure.employeeEmail}</p>
                  </div>
                  <div className="-mr-2 -mt-1 shrink-0">{renderRowActions(structure)}</div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Basic</dt>
                    <dd className="text-foreground">{formatCurrency(structure.basicSalary)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Allowances</dt>
                    <dd className="text-emerald-700 dark:text-emerald-400">+{formatCurrency(structure.totalAllowances)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Deductions</dt>
                    <dd className="text-destructive">-{formatCurrency(structure.totalDeductions)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Net salary (monthly)</span>
                  <span className="font-semibold text-foreground">{formatCurrency(structure.netSalary)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / tablet: table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Allowances</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net salary</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStructures.map((structure) => (
                    <TableRow key={structure.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={structure.employeeAvatar} alt="" />
                            <AvatarFallback>{initials(structure.employeeName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{structure.employeeName}</p>
                            <p className="max-w-[220px] truncate text-xs text-muted-foreground" title={structure.employeeEmail}>{structure.employeeEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">
                        {formatCurrency(structure.basicSalary)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-emerald-700 dark:text-emerald-400">
                        +{formatCurrency(structure.totalAllowances)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-destructive">
                        -{formatCurrency(structure.totalDeductions)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold text-foreground">
                        {formatCurrency(structure.netSalary)}
                      </TableCell>
                      {canManage && <TableCell className="text-right">{renderRowActions(structure)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add salary structure</DialogTitle>
            <DialogDescription>Set up salary components for an employee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-salary-employee">Employee *</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
              >
                <SelectTrigger id="add-salary-employee">
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeesWithoutStructure.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} - {emp.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderSalaryFormFields("add-salary-")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createStructure.isPending}>
              {createStructure.isPending ? "Creating..." : "Create structure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit salary structure</DialogTitle>
            <DialogDescription>
              Update salary for {selectedStructure?.employeeName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {renderSalaryFormFields("edit-salary-")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateStructure.isPending}>
              {updateStructure.isPending ? "Updating..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete salary structure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the salary structure for {selectedStructure?.employeeName}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStructure.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}