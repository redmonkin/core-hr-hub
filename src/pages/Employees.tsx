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
import { UserPlus, Search, Download } from "lucide-react";
import { Link } from "react-router-dom";

const mockEmployees: Employee[] = [
  {
    id: "1",
    name: "Sarah Miller",
    email: "sarah.miller@company.com",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    department: "Engineering",
    designation: "Senior Developer",
    joinDate: "Jan 15, 2023",
    status: "active",
  },
  {
    id: "2",
    name: "Mike Johnson",
    email: "mike.johnson@company.com",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    department: "Design",
    designation: "UI/UX Designer",
    joinDate: "Mar 22, 2023",
    status: "active",
  },
  {
    id: "3",
    name: "Emily Chen",
    email: "emily.chen@company.com",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    department: "Marketing",
    designation: "Marketing Manager",
    joinDate: "Feb 10, 2023",
    status: "active",
  },
  {
    id: "4",
    name: "David Brown",
    email: "david.brown@company.com",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    department: "Engineering",
    designation: "Frontend Developer",
    joinDate: "Dec 5, 2024",
    status: "onboarding",
  },
  {
    id: "5",
    name: "Lisa Wang",
    email: "lisa.wang@company.com",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    department: "HR",
    designation: "HR Specialist",
    joinDate: "Apr 18, 2022",
    status: "active",
  },
  {
    id: "6",
    name: "James Wilson",
    email: "james.wilson@company.com",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    department: "Finance",
    designation: "Financial Analyst",
    joinDate: "Jul 8, 2023",
    status: "inactive",
  },
];

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const filteredEmployees = mockEmployees.filter((employee) => {
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
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Design">Design</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <EmployeeTable employees={filteredEmployees} />
      </div>
    </DashboardLayout>
  );
};

export default Employees;
