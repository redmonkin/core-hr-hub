import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmployeeTable, Employee } from "@/components/employees/EmployeeTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserPlus, Search, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useEmployees, useDepartments, useBulkDeleteEmployees, useBulkUpdateEmployeeStatus } from "@/hooks/useEmployees";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeDocuments } from "@/components/documents/EmployeeDocuments";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { EmployeeViewDialog } from "@/components/employees/EmployeeViewDialog";
import { EmployeeEditDialog } from "@/components/employees/EmployeeEditDialog";
import { BulkDeleteDialog } from "@/components/employees/BulkDeleteDialog";
import { BulkAssignManagerDialog } from "@/components/employees/BulkAssignManagerDialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DateRangeExportDialog } from "@/components/export/DateRangeExportDialog";
import { format, parseISO, isWithinInterval, parse } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { useSorting } from "@/hooks/useSorting";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [documentsEmployee, setDocumentsEmployee] = useState<Employee | null>(null);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [employeesToDelete, setEmployeesToDelete] = useState<Employee[]>([]);
  const [bulkAssignManagerOpen, setBulkAssignManagerOpen] = useState(false);
  const [employeesToAssignManager, setEmployeesToAssignManager] = useState<Employee[]>([]);

  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: departments = [] } = useDepartments();
  const { isAdminOrHR, isLoading: isLoadingRole } = useIsAdminOrHR();
  const bulkDeleteMutation = useBulkDeleteEmployees();
  const bulkStatusMutation = useBulkUpdateEmployeeStatus();

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment =
      departmentFilter === "all" || employee.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  // Apply sorting
  const {
    sortedItems: sortedEmployees,
    sortConfig,
    requestSort,
  } = useSorting<Employee>(filteredEmployees);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedEmployees,
    setPage,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    canGoNext,
    canGoPrevious,
  } = usePagination(sortedEmployees, { initialPageSize: 10 });

  const isLoading = isLoadingEmployees || isLoadingRole;

  const filterByDateRange = (items: Employee[], startDate?: Date, endDate?: Date) => {
    if (!startDate && !endDate) return items;
    
    return items.filter((emp) => {
      // Parse the formatted date string "MMM d, yyyy" back to a Date object
      const joinDate = parse(emp.joinDate, "MMM d, yyyy", new Date());
      
      if (isNaN(joinDate.getTime())) return true; // Skip invalid dates
      
      if (startDate && endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        return isWithinInterval(joinDate, { start: startDate, end: endOfDay });
      }
      if (startDate) {
        return joinDate >= startDate;
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        return joinDate <= endOfDay;
      }
      return true;
    });
  };

  const exportToCSV = (startDate?: Date, endDate?: Date) => {
    const dataToExport = filterByDateRange(sortedEmployees, startDate, endDate);
    const headers = ["Employee No.", "Name", "Email", "Department", "Designation", "Status", "Join Date"];
    const csvContent = [
      headers.join(","),
      ...dataToExport.map((emp) =>
        [
          `"${emp.employeeCode}"`,
          `"${emp.name}"`,
          `"${emp.email}"`,
          `"${emp.department}"`,
          `"${emp.designation}"`,
          `"${emp.status}"`,
          `"${emp.joinDate}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    link.download = `employee-directory${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success(`${dataToExport.length} employees exported to CSV`);
  };

  const exportToPDF = (startDate?: Date, endDate?: Date) => {
    const dataToExport = filterByDateRange(sortedEmployees, startDate, endDate);
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Employee Directory", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
    if (startDate || endDate) {
      doc.text(`Date Range: ${startDate ? format(startDate, "PP") : "Start"} - ${endDate ? format(endDate, "PP") : "End"}`, 14, 36);
      doc.text(`Total Employees: ${dataToExport.length}`, 14, 42);
    } else {
      doc.text(`Total Employees: ${dataToExport.length}`, 14, 36);
    }

    autoTable(doc, {
      startY: startDate || endDate ? 50 : 44,
      head: [["Emp. No.", "Name", "Email", "Department", "Designation", "Status", "Join Date"]],
      body: dataToExport.map((emp) => [
        emp.employeeCode,
        emp.name,
        emp.email,
        emp.department,
        emp.designation,
        emp.status,
        emp.joinDate,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    doc.save(`employee-directory${dateRange}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success(`${dataToExport.length} employees exported to PDF`);
  };

  const handleBulkAction = (action: string, ids: string[]) => {
    const selectedEmployees = employees.filter(e => ids.includes(e.id));
    
    switch (action) {
      case 'export':
        // Export selected employees to CSV
        const headers = ["Employee No.", "Name", "Email", "Department", "Designation", "Status", "Join Date"];
        const csvContent = [
          headers.join(","),
          ...selectedEmployees.map((emp) =>
            [
              `"${emp.employeeCode}"`,
              `"${emp.name}"`,
              `"${emp.email}"`,
              `"${emp.department}"`,
              `"${emp.designation}"`,
              `"${emp.status}"`,
              `"${emp.joinDate}"`,
            ].join(",")
          ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `selected-employees-${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        toast.success(`${selectedEmployees.length} employees exported`);
        setSelectedEmployeeIds([]);
        break;
        
      case 'email':
        // Copy emails to clipboard
        const emails = selectedEmployees.map(e => e.email).join(', ');
        navigator.clipboard.writeText(emails);
        toast.success(`${selectedEmployees.length} email addresses copied to clipboard`);
        break;
        
      case 'activate':
        bulkStatusMutation.mutate(
          { employeeIds: ids, status: 'active' },
          {
            onSuccess: ({ updatedCount }) => {
              toast.success(`${updatedCount} employee${updatedCount > 1 ? 's' : ''} set to active`);
              setSelectedEmployeeIds([]);
            },
            onError: (error) => {
              toast.error(error.message);
            },
          }
        );
        break;
        
      case 'deactivate':
        bulkStatusMutation.mutate(
          { employeeIds: ids, status: 'inactive' },
          {
            onSuccess: ({ updatedCount }) => {
              toast.success(`${updatedCount} employee${updatedCount > 1 ? 's' : ''} set to inactive`);
              setSelectedEmployeeIds([]);
            },
            onError: (error) => {
              toast.error(error.message);
            },
          }
        );
        break;
        
      case 'delete':
        setEmployeesToDelete(selectedEmployees);
        setBulkDeleteOpen(true);
        break;
        
      case 'assign-manager':
        setEmployeesToAssignManager(selectedEmployees);
        setBulkAssignManagerOpen(true);
        break;
        
      default:
        break;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {isAdminOrHR ? "Employee Directory" : "Team Directory"}
            </h2>
            <p className="text-muted-foreground">
              {isAdminOrHR ? "Manage and view all employees" : "View your colleagues"}
            </p>
          </div>
          {isAdminOrHR && (
            <div className="flex gap-3">
              <DateRangeExportDialog
                title="Export Employee Directory"
                description="Export employee directory with optional date range filter based on join date."
                onExportCSV={exportToCSV}
                onExportPDF={exportToPDF}
              />
              <Link to="/onboarding">
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">No Employees Found</h3>
              <p className="text-muted-foreground">
                {employees.length === 0
                  ? isAdminOrHR 
                    ? "Start by adding your first employee"
                    : "No team members available to display"
                  : "No employees match your search criteria"}
              </p>
              {employees.length === 0 && isAdminOrHR && (
                <Link to="/onboarding" className="mt-4">
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Employee
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <EmployeeTable 
              employees={paginatedEmployees} 
              onView={(employee) => setViewEmployee(employee)}
              onEdit={isAdminOrHR ? (employee) => setEditEmployee(employee) : undefined}
              onManageDocuments={isAdminOrHR ? (employee) => setDocumentsEmployee(employee) : undefined}
              isAdminOrHR={isAdminOrHR}
              sortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={requestSort}
              selectedIds={selectedEmployeeIds}
              onSelectionChange={setSelectedEmployeeIds}
              onBulkAction={handleBulkAction}
            />
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} employees
                  </span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => setPageSize(Number(value))}
                  >
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>per page</span>
                </div>
                
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => canGoPrevious && goToPreviousPage()}
                        className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
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
          </div>
        )}

        {/* View Profile Dialog */}
        <EmployeeViewDialog 
          employee={viewEmployee}
          open={!!viewEmployee}
          onOpenChange={(open) => !open && setViewEmployee(null)}
        />

        {/* Edit Employee Dialog */}
        <EmployeeEditDialog 
          employee={editEmployee}
          open={!!editEmployee}
          onOpenChange={(open) => !open && setEditEmployee(null)}
        />

        {/* Documents Dialog */}
        <Dialog open={!!documentsEmployee} onOpenChange={(open) => !open && setDocumentsEmployee(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Documents - {documentsEmployee?.name}</DialogTitle>
            </DialogHeader>
            {documentsEmployee && (
              <EmployeeDocuments employeeId={documentsEmployee.id} />
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Confirmation Dialog */}
        <BulkDeleteDialog
          open={bulkDeleteOpen}
          onOpenChange={(open) => {
            if (!bulkDeleteMutation.isPending) {
              setBulkDeleteOpen(open);
            }
          }}
          employees={employeesToDelete}
          isDeleting={bulkDeleteMutation.isPending}
          onConfirm={() => {
            const idsToDelete = employeesToDelete.map(e => e.id);
            bulkDeleteMutation.mutate(idsToDelete, {
              onSuccess: ({ deletedCount }) => {
                toast.success(`${deletedCount} employee${deletedCount > 1 ? 's' : ''} deleted successfully`);
                setSelectedEmployeeIds([]);
                setEmployeesToDelete([]);
                setBulkDeleteOpen(false);
              },
              onError: (error) => {
                toast.error(`Failed to delete employees: ${error.message}`);
              },
            });
          }}
        />

        {/* Bulk Assign Manager Dialog */}
        <BulkAssignManagerDialog
          open={bulkAssignManagerOpen}
          onOpenChange={setBulkAssignManagerOpen}
          employees={employeesToAssignManager}
          onSuccess={() => {
            setSelectedEmployeeIds([]);
            setEmployeesToAssignManager([]);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default Employees;