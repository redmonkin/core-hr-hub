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
  DialogDescription,
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
import { useEmployees, useEmployeeDirectory, useDepartments, useBulkDeleteEmployees, useBulkUpdateEmployeeStatus } from "@/hooks/useEmployees";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeDocuments } from "@/components/documents/EmployeeDocuments";
import { usePermissions } from "@/hooks/usePermissions";
import { EmployeeViewDialog } from "@/components/employees/EmployeeViewDialog";
import { EmployeeEditDialog } from "@/components/employees/EmployeeEditDialog";
import { BulkDeleteDialog } from "@/components/employees/BulkDeleteDialog";
import { BulkAssignManagerDialog } from "@/components/employees/BulkAssignManagerDialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { sendInvitation } from "@/components/onboarding/inviteEmployee";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { drawPdfHeader, drawPdfFooter, fetchImageAsDataUrl, PDF_TABLE_HEAD_STYLE, PDF_COLORS } from "@/lib/pdfTheme";
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

  const { can, isLoading: isLoadingRole } = usePermissions();
  const queryClient = useQueryClient();
  // Full records for people with access to the Employees module; everyone
  // else gets the directory (name, contact, designation, department).
  const canViewEmployees = can("employees", "view");
  const canManageEmployees = can("employees", "manage");
  const canAddEmployees = can("onboarding", "manage");
  const { data: fullEmployees = [], isLoading: isLoadingFullEmployees } = useEmployees({
    enabled: !isLoadingRole && canViewEmployees,
  });
  const { data: directoryEmployees = [], isLoading: isLoadingDirectoryEmployees } = useEmployeeDirectory({
    enabled: !isLoadingRole && !canViewEmployees,
  });
  const employees = canViewEmployees ? fullEmployees : directoryEmployees;
  const isLoadingEmployees = canViewEmployees ? isLoadingFullEmployees : isLoadingDirectoryEmployees;
  const { data: departments = [] } = useDepartments();
  const { data: branding } = useCompanyBranding();
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

  const exportToPDF = async (startDate?: Date, endDate?: Date) => {
    const dataToExport = filterByDateRange(sortedEmployees, startDate, endDate);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const logoDataUrl = await fetchImageAsDataUrl(branding?.logoUrl);

    const subtitle = startDate || endDate
      ? `Date Range: ${startDate ? format(startDate, "PP") : "Start"} - ${endDate ? format(endDate, "PP") : "End"}`
      : undefined;

    let currentY = drawPdfHeader(doc, {
      title: "Employee Directory",
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
    doc.text(`Total Employees: ${dataToExport.length}`, margin, currentY);
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
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
      headStyles: PDF_TABLE_HEAD_STYLE,
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawPdfFooter(doc, { pageWidth, pageHeight, margin, pageNumber: i, totalPages: pageCount });
    }

    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    doc.save(`employee-directory${dateRange}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success(`${dataToExport.length} employees exported to PDF`);
  };

  const handleInvite = async (employee: Employee) => {
    const pending = toast.loading(`Sending an invitation to ${employee.email}…`);
    try {
      const result = await sendInvitation(employee.id);
      toast.success(
        result.status === "linked"
          ? `${employee.email} already had an account, so it's now linked to ${employee.name}.`
          : `Invitation sent. ${employee.name} will get an email to set up their account.`,
        { id: pending },
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The invitation couldn't be sent", { id: pending });
    }
  };

  const handleBulkAction = (action: string, ids: string[]) => {
    const selectedEmployees = employees.filter(e => ids.includes(e.id));
    
    switch (action) {
      case 'export': {
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
      }

      case 'email': {
        // Copy emails to clipboard
        const emails = selectedEmployees.map(e => e.email).join(', ');
        navigator.clipboard.writeText(emails);
        toast.success(`${selectedEmployees.length} email addresses copied to clipboard`);
        break;
      }
        
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
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {canViewEmployees ? "Employee directory" : "Team directory"}
            </h1>
            <p className="text-muted-foreground">
              {canManageEmployees ? "Manage and view all employees" : canViewEmployees ? "View all employees" : "View your colleagues"}
            </p>
          </div>
          {canViewEmployees && (
            <div className="flex flex-wrap gap-3">
              <DateRangeExportDialog
                title="Export Employee Directory"
                description="Export employee directory with optional date range filter based on join date."
                onExportCSV={exportToCSV}
                onExportPDF={exportToPDF}
              />
              {canAddEmployees && (
              <Link to="/onboarding">
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add employee
                </Button>
              </Link>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search employees..."
              aria-label="Search employees by name or email"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by department">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
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
              <h3 className="text-lg font-semibold text-foreground">No employees found</h3>
              <p className="text-muted-foreground">
                {employees.length === 0
                  ? canAddEmployees
                    ? "Start by adding your first employee"
                    : "No team members available to display"
                  : "No employees match your search criteria"}
              </p>
              {employees.length === 0 && canAddEmployees && (
                <Link to="/onboarding" className="mt-4">
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add employee
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
              onEdit={canManageEmployees ? (employee) => setEditEmployee(employee) : undefined}
              onManageDocuments={canManageEmployees ? (employee) => setDocumentsEmployee(employee) : undefined}
              onInvite={can("onboarding", "manage") ? handleInvite : undefined}
              canManage={canManageEmployees}
              sortKey={sortConfig.key}
              sortDirection={sortConfig.direction}
              onSort={requestSort}
              selectedIds={selectedEmployeeIds}
              onSelectionChange={setSelectedEmployeeIds}
              onBulkAction={handleBulkAction}
            />
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground sm:justify-start">
                  <span className="whitespace-nowrap">
                    {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems} employees
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap" id="employees-page-size-label">Rows per page</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => setPageSize(Number(value))}
                    >
                      <SelectTrigger className="h-8 w-[70px]" aria-labelledby="employees-page-size-label">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Pagination className="mx-0 w-auto justify-center sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => canGoPrevious && goToPreviousPage()}
                        aria-disabled={!canGoPrevious}
                        className={!canGoPrevious ? "pointer-events-none text-muted-foreground" : "cursor-pointer"}
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
                        aria-disabled={!canGoNext}
                        className={!canGoNext ? "pointer-events-none text-muted-foreground" : "cursor-pointer"}
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="break-words">Documents · {documentsEmployee?.name}</DialogTitle>
              <DialogDescription>Upload, view and manage this employee's documents.</DialogDescription>
            </DialogHeader>
            {documentsEmployee && (
              <EmployeeDocuments employeeId={documentsEmployee.id} embedded />
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