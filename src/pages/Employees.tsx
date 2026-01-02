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
import { UserPlus, Search, Download, Users, FileSpreadsheet, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { useEmployees, useDepartments } from "@/hooks/useEmployees";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeDocuments } from "@/components/documents/EmployeeDocuments";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { EmployeeViewDialog } from "@/components/employees/EmployeeViewDialog";
import { EmployeeEditDialog } from "@/components/employees/EmployeeEditDialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [documentsEmployee, setDocumentsEmployee] = useState<Employee | null>(null);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: departments = [] } = useDepartments();
  const { isAdminOrHR, isLoading: isLoadingRole } = useIsAdminOrHR();

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment =
      departmentFilter === "all" || employee.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const isLoading = isLoadingEmployees || isLoadingRole;

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Department", "Designation", "Status", "Join Date"];
    const csvContent = [
      headers.join(","),
      ...filteredEmployees.map((emp) =>
        [
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
    link.download = `employee-directory-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Employee directory exported to CSV");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Employee Directory", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Employees: ${filteredEmployees.length}`, 14, 36);

    autoTable(doc, {
      startY: 44,
      head: [["Name", "Email", "Department", "Designation", "Status", "Join Date"]],
      body: filteredEmployees.map((emp) => [
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

    doc.save(`employee-directory-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Employee directory exported to PDF");
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={exportToCSV}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          <EmployeeTable 
            employees={filteredEmployees} 
            onView={(employee) => setViewEmployee(employee)}
            onEdit={isAdminOrHR ? (employee) => setEditEmployee(employee) : undefined}
            onManageDocuments={isAdminOrHR ? (employee) => setDocumentsEmployee(employee) : undefined}
            isAdminOrHR={isAdminOrHR}
          />
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
      </div>
    </DashboardLayout>
  );
};

export default Employees;