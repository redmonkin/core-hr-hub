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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  FileText, 
  ChevronDown,
  UserX,
  UserCheck,
  Mail,
  Download,
  UserCog,
  Trash2,
  Send
} from "lucide-react";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { SortDirection } from "@/hooks/useSorting";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string;
  department: string;
  designation: string;
  joinDate: string;
  status: "active" | "inactive" | "onboarding" | "offboarded";
  hasAccount?: boolean;
}

interface EmployeeTableProps {
  employees: Employee[];
  onView?: (employee: Employee) => void;
  onEdit?: (employee: Employee) => void;
  
  onManageDocuments?: (employee: Employee) => void;
  /** Offered for people without a sign-in account (needs onboarding:manage). */
  onInvite?: (employee: Employee) => void;
  /** Show edit/documents actions and bulk selection (employees:manage). */
  canManage?: boolean;
  sortKey?: keyof Employee | null;
  sortDirection?: SortDirection;
  onSort?: (key: keyof Employee) => void;
  // Bulk selection props
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onBulkAction?: (action: string, ids: string[]) => void;
}

export function EmployeeTable({ 
  employees, 
  onView, 
  onEdit, 
   
  onManageDocuments, 
  onInvite,
  canManage = false,
  sortKey,
  sortDirection,
  onSort,
  selectedIds = [],
  onSelectionChange,
  onBulkAction,
}: EmployeeTableProps) {
  const handleSort = (key: string) => {
    onSort?.(key as keyof Employee);
  };

  const allSelected = employees.length > 0 && selectedIds.length === employees.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < employees.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange?.(employees.map(e => e.id));
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange?.([...selectedIds, id]);
    } else {
      onSelectionChange?.(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const showBulkActions = canManage && onSelectionChange && onBulkAction;

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const renderRowMenu = (employee: Employee) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-8 sm:w-8"
          aria-label={`Actions for ${employee.name}`}
          title="Actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView?.(employee)}>
          <Eye className="mr-2 h-4 w-4" />
          View profile
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuItem onClick={() => onEdit?.(employee)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onManageDocuments?.(employee)}>
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </DropdownMenuItem>
          </>
        )}
        {onInvite && employee.hasAccount === false && employee.status !== "offboarded" && (
          <DropdownMenuItem onClick={() => onInvite(employee)}>
            <Send className="mr-2 h-4 w-4" />
            Invite to sign in
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {showBulkActions && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <span className="whitespace-nowrap text-sm font-medium" aria-live="polite">
            {selectedIds.length}<span className="hidden sm:inline">&nbsp;employee{selectedIds.length > 1 ? 's' : ''}</span>&nbsp;selected
          </span>
          <div className="flex items-center gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Bulk actions
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onBulkAction?.('export', selectedIds)}>
                  <Download className="mr-2 h-4 w-4" />
                  Export selected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkAction?.('email', selectedIds)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Copy emails
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBulkAction?.('assign-manager', selectedIds)}>
                  <UserCog className="mr-2 h-4 w-4" />
                  Assign manager
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBulkAction?.('activate', selectedIds)}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Set as active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkAction?.('deactivate', selectedIds)}>
                  <UserX className="mr-2 h-4 w-4" />
                  Set as inactive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onBulkAction?.('delete', selectedIds)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onSelectionChange?.([])}
              aria-label="Clear selection"
            >
              Clear<span className="hidden sm:inline">&nbsp;selection</span>
            </Button>
          </div>
        </div>
      )}

      <div className="hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {showBulkActions && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    aria-label="Select all employees on this page"
                  />
                </TableHead>
              )}
              {onSort ? (
                <>
                  <SortableTableHead
                    sortKey="employeeCode"
                    currentSortKey={sortKey ?? null}
                    direction={sortKey === "employeeCode" ? sortDirection ?? null : null}
                    onSort={handleSort}
                    className="w-[110px] whitespace-nowrap"
                  >
                    Emp. No.
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="name"
                    currentSortKey={sortKey ?? null}
                    direction={sortKey === "name" ? sortDirection ?? null : null}
                    onSort={handleSort}
                    className="w-[260px]"
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
                  <TableHead className="w-[110px] whitespace-nowrap">Emp. No.</TableHead>
                  <TableHead className="w-[260px]">Employee</TableHead>
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
              <TableRow
                key={employee.id}
                data-employee-row
                className={selectedIds.includes(employee.id) ? "bg-primary/5" : ""}
              >
                {showBulkActions && (
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.includes(employee.id)}
                      onCheckedChange={(checked) => handleSelectOne(employee.id, checked as boolean)}
                      aria-label={`Select ${employee.name}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {employee.employeeCode}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={employee.avatar} />
                      <AvatarFallback>
                        {initials(employee.name)}
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
                <TableCell className="whitespace-nowrap text-muted-foreground">{employee.joinDate}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClass(employee.status)}>
                    {formatStatus(employee.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {renderRowMenu(employee)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 sm:hidden">
        {showBulkActions && (
          <label className="flex items-center gap-3 px-1 text-sm text-muted-foreground">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => handleSelectAll(checked === true)}
              aria-label="Select all employees on this page"
            />
            Select all on this page
          </label>
        )}
        {employees.map((employee) => {
          const selected = selectedIds.includes(employee.id);
          return (
            <div
              key={employee.id}
              data-employee-row
              className={`rounded-xl border bg-card p-3 ${selected ? "border-primary/40 bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-start gap-3">
                {showBulkActions && (
                  <Checkbox
                    className="mt-3"
                    checked={selected}
                    onCheckedChange={(checked) => handleSelectOne(employee.id, checked === true)}
                    aria-label={`Select ${employee.name}`}
                  />
                )}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={employee.avatar} />
                  <AvatarFallback>{initials(employee.name)}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onView?.(employee)}
                >
                  <p className="truncate font-medium text-foreground">{employee.name}</p>
                  <p className="truncate text-sm text-muted-foreground" title={employee.email}>
                    {employee.email}
                  </p>
                </button>
                {renderRowMenu(employee)}
              </div>
              <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground ${showBulkActions ? "pl-[4.75rem]" : "pl-[3.25rem]"}`}>
                <Badge variant="outline" className={statusBadgeClass(employee.status)}>
                  {formatStatus(employee.status)}
                </Badge>
                <span className="font-mono text-xs">{employee.employeeCode}</span>
                {employee.designation && <span>{employee.designation}</span>}
                {employee.department && <span>{employee.department}</span>}
                {employee.joinDate && <span>Joined {employee.joinDate}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
