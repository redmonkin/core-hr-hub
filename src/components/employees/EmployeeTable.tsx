import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Trash2, FileText } from "lucide-react";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { SortDirection } from "@/hooks/useSorting";

export interface Employee {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  department: string;
  designation: string;
  joinDate: string;
  status: "active" | "inactive" | "onboarding" | "offboarded";
}

interface EmployeeTableProps {
  employees: Employee[];
  onView?: (employee: Employee) => void;
  onEdit?: (employee: Employee) => void;
  onDelete?: (employee: Employee) => void;
  onManageDocuments?: (employee: Employee) => void;
  isAdminOrHR?: boolean;
  sortKey?: keyof Employee | null;
  sortDirection?: SortDirection;
  onSort?: (key: keyof Employee) => void;
}

const statusStyles = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  inactive: "bg-muted text-muted-foreground border-border",
  onboarding: "bg-primary/10 text-primary border-primary/20",
};

export function EmployeeTable({ 
  employees, 
  onView, 
  onEdit, 
  onDelete, 
  onManageDocuments, 
  isAdminOrHR = false,
  sortKey,
  sortDirection,
  onSort,
}: EmployeeTableProps) {
  const handleSort = (key: string) => {
    onSort?.(key as keyof Employee);
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {onSort ? (
              <>
                <SortableTableHead
                  sortKey="name"
                  currentSortKey={sortKey ?? null}
                  direction={sortKey === "name" ? sortDirection ?? null : null}
                  onSort={handleSort}
                  className="w-[300px]"
                >
                  Employee
                </SortableTableHead>
                <SortableTableHead
                  sortKey="department"
                  currentSortKey={sortKey ?? null}
                  direction={sortKey === "department" ? sortDirection ?? null : null}
                  onSort={handleSort}
                >
                  Department
                </SortableTableHead>
                <SortableTableHead
                  sortKey="designation"
                  currentSortKey={sortKey ?? null}
                  direction={sortKey === "designation" ? sortDirection ?? null : null}
                  onSort={handleSort}
                >
                  Designation
                </SortableTableHead>
                <SortableTableHead
                  sortKey="joinDate"
                  currentSortKey={sortKey ?? null}
                  direction={sortKey === "joinDate" ? sortDirection ?? null : null}
                  onSort={handleSort}
                >
                  Join Date
                </SortableTableHead>
                <SortableTableHead
                  sortKey="status"
                  currentSortKey={sortKey ?? null}
                  direction={sortKey === "status" ? sortDirection ?? null : null}
                  onSort={handleSort}
                >
                  Status
                </SortableTableHead>
              </>
            ) : (
              <>
                <TableHead className="w-[300px]">Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Status</TableHead>
              </>
            )}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={employee.avatar} />
                    <AvatarFallback>
                      {employee.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{employee.department}</TableCell>
              <TableCell className="text-muted-foreground">{employee.designation}</TableCell>
              <TableCell className="text-muted-foreground">{employee.joinDate}</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusStyles[employee.status]}>
                  {employee.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView?.(employee)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Profile
                    </DropdownMenuItem>
                    {isAdminOrHR && (
                      <>
                        <DropdownMenuItem onClick={() => onEdit?.(employee)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onManageDocuments?.(employee)}>
                          <FileText className="mr-2 h-4 w-4" />
                          Documents
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete?.(employee)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
