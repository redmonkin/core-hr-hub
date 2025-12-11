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
import { UserPlus, Search, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { useEmployees, useDepartments } from "@/hooks/useEmployees";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeDocuments } from "@/components/documents/EmployeeDocuments";

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [documentsEmployee, setDocumentsEmployee] = useState<Employee | null>(null);

  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: departments = [] } = useDepartments();

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment =
      departmentFilter === "all" || employee.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Employee Directory</h2>
            <p className="text-muted-foreground">Manage and view all employees</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Link to="/onboarding">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </Link>
          </div>
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
        {isLoadingEmployees ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UserPlus className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">No Employees Found</h3>
              <p className="text-muted-foreground">
                {employees.length === 0
                  ? "Start by adding your first employee"
                  : "No employees match your search criteria"}
              </p>
              {employees.length === 0 && (
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
            onManageDocuments={(employee) => setDocumentsEmployee(employee)}
          />
        )}

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