import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pencil, Loader2, Ban, CheckCircle, Link, Unlink, KeyRound, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statusBadgeClass } from "@/lib/statusStyles";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { UserPermissionsDialog } from "./UserPermissionsDialog";
import { levelLabel, moduleLabel, useAllUserPermissions, useRolePermissions } from "./permissionsData";

type AppRole = Database["public"]["Enums"]["app_role"];
type EmployeeStatus = Database["public"]["Enums"]["employee_status"];

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  /** Highest-ranked role, for display and the role editor */
  role: AppRole | null;
  /** Every user_roles row (a user can have more than one) */
  role_rows: { id: string; role: AppRole }[];
  employee_status: EmployeeStatus | null;
  blocked: boolean;
  employee_id: string | null;
}

interface UnlinkedEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  designation: string;
}

const roleLabels: Record<AppRole, string> = {
  admin: "Administrator",
  hr: "HR Manager",
  manager: "Manager",
  employee: "Employee",
};

// Each role gets its own light tint so Administrator and HR Manager are easy to tell apart.
const roleBadgeClass: Record<AppRole, string> = {
  admin: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  hr: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  manager: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  employee: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

const ROLE_RANK: Record<AppRole, number> = { admin: 4, hr: 3, manager: 2, employee: 1 };

const statusLabels: Record<EmployeeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  onboarding: "Onboarding",
  offboarded: "Offboarded",
};


export function UserRolesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("employee");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [permissionsUser, setPermissionsUser] = useState<UserWithRole | null>(null);

  const { data: rolePermissions = [], isLoading: loadingRolePerms } = useRolePermissions();
  const { data: userPermissions = [], isLoading: loadingUserPerms } = useAllUserPermissions();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, blocked')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role');

      if (rolesError) throw rolesError;

      // Fetch employees to get status and id
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, user_id, status');

      if (employeesError) throw employeesError;

      // Map roles and status to users
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const roleRows = (roles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => ({ id: r.id, role: r.role as AppRole }))
          .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);
        const employee = employees?.find(e => e.user_id === profile.id);
        return {
          ...profile,
          role: roleRows[0]?.role ?? null,
          role_rows: roleRows,
          employee_status: employee?.status as EmployeeStatus | null,
          blocked: profile.blocked ?? false,
          employee_id: employee?.id || null,
        };
      });

      return usersWithRoles;
    },
  });

  // Fetch unlinked employees (those without a user_id)
  const { data: unlinkedEmployees = [] } = useQuery({
    queryKey: ['unlinked-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, email, designation')
        .is('user_id', null)
        .order('first_name');
      if (error) throw error;
      return data as UnlinkedEmployee[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role, existingRows }: { userId: string; role: AppRole; existingRows: { id: string; role: AppRole }[] }) => {
      if (existingRows.length > 0) {
        // Keep one row with the chosen role and remove any others, so the user
        // ends up with exactly the selected role. Prefer reusing a row that
        // already has it (avoids tripping the last-admin guard needlessly).
        const keep = existingRows.find(r => r.role === role) ?? existingRows[0];
        if (keep.role !== role) {
          const { error } = await supabase
            .from('user_roles')
            .update({ role })
            .eq('id', keep.id);
          if (error) throw error;
        }
        const extra = existingRows.filter(r => r.id !== keep.id).map(r => r.id);
        if (extra.length > 0) {
          const { error } = await supabase.from('user_roles').delete().in('id', extra);
          if (error) throw error;
        }
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setDialogOpen(false);
      setSelectedUser(null);
      toast({ title: "Role updated", description: "User role has been updated successfully." });
    },
    onError: (error: Error) => {
      // e.g. "Cannot remove the last admin. Make someone else an admin first."
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({ title: "Couldn't change role", description: error.message, variant: "destructive" });
    },
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async ({ userId, block }: { userId: string; block: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          blocked: block,
          blocked_at: block ? new Date().toISOString() : null,
          blocked_by: block ? currentUser?.id : null,
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      setBlockDialogOpen(false);
      setSelectedUser(null);
      toast({ 
        title: variables.block ? "User blocked" : "User unblocked", 
        description: variables.block 
          ? "User has been blocked and can no longer login." 
          : "User has been unblocked and can now login."
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const linkEmployeeMutation = useMutation({
    mutationFn: async ({ employeeId, userId }: { employeeId: string; userId: string }) => {
      const { error } = await supabase
        .from('employees')
        .update({ user_id: userId })
        .eq('id', employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setLinkDialogOpen(false);
      setSelectedUser(null);
      setSelectedEmployeeId("");
      toast({ title: "Employee linked", description: "User has been linked to the employee record." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unlinkEmployeeMutation = useMutation({
    mutationFn: async ({ employeeId }: { employeeId: string }) => {
      const { error } = await supabase
        .from('employees')
        .update({ user_id: null })
        .eq('id', employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setUnlinkDialogOpen(false);
      setSelectedUser(null);
      toast({ title: "Employee unlinked", description: "User has been unlinked from the employee record." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditRole = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedRole(user.role || "employee");
    setDialogOpen(true);
  };

  const handleBlockClick = (user: UserWithRole) => {
    setSelectedUser(user);
    setBlockDialogOpen(true);
  };

  const handleLinkClick = (user: UserWithRole) => {
    setSelectedUser(user);
    // Pre-select employee with matching email if available
    const matchingEmployee = unlinkedEmployees.find(e => e.email.toLowerCase() === user.email.toLowerCase());
    setSelectedEmployeeId(matchingEmployee?.id || "");
    setLinkDialogOpen(true);
  };

  const handleUnlinkClick = (user: UserWithRole) => {
    setSelectedUser(user);
    setUnlinkDialogOpen(true);
  };

  const handleToggleBlock = () => {
    if (!selectedUser) return;
    toggleBlockMutation.mutate({
      userId: selectedUser.id,
      block: !selectedUser.blocked,
    });
  };

  const handleSaveRole = () => {
    if (!selectedUser) return;
    updateRoleMutation.mutate({
      userId: selectedUser.id,
      role: selectedRole,
      existingRows: selectedUser.role_rows,
    });
  };

  const handleLinkEmployee = () => {
    if (!selectedUser || !selectedEmployeeId) return;
    linkEmployeeMutation.mutate({
      employeeId: selectedEmployeeId,
      userId: selectedUser.id,
    });
  };

  const handleUnlinkEmployee = () => {
    if (!selectedUser || !selectedUser.employee_id) return;
    unlinkEmployeeMutation.mutate({
      employeeId: selectedUser.employee_id,
    });
  };

  const getUserInitials = (name: string | null, email: string) => {
    const displayName = name || email;
    return displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const grantsByUser = new Map<string, typeof userPermissions>();
  for (const g of userPermissions) {
    const list = grantsByUser.get(g.user_id) ?? [];
    list.push(g);
    grantsByUser.set(g.user_id, list);
  }

  const renderAccess = (user: UserWithRole) => {
    if (user.role === 'admin') {
      return <span className="text-xs text-muted-foreground">Full access</span>;
    }
    const grants = grantsByUser.get(user.id) ?? [];
    if (grants.length === 0) {
      return <span className="text-xs text-muted-foreground">Role defaults</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {grants.map(g => (
          <Badge
            key={g.module}
            variant="outline"
            className={cn("whitespace-nowrap text-xs font-normal", statusBadgeClass(g.level === 'manage' ? 'assigned' : 'draft'))}
          >
            {moduleLabel(g.module)} · {levelLabel(g.level).toLowerCase()}
          </Badge>
        ))}
      </div>
    );
  };

  const renderStatus = (user: UserWithRole) => {
    if (user.blocked) {
      return <Badge variant="outline" className={cn("whitespace-nowrap", statusBadgeClass("blocked"))}>Blocked</Badge>;
    }
    if (user.employee_status) {
      return (
        <Badge variant="outline" className={cn("whitespace-nowrap", statusBadgeClass(user.employee_status === "offboarded" ? "inactive" : user.employee_status))}>
          {statusLabels[user.employee_status]}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={cn("whitespace-nowrap", statusBadgeClass("not_linked"))} title="No employee record linked to this login">
        Not linked
      </Badge>
    );
  };

  const renderRoles = (user: UserWithRole) =>
    user.role_rows.length > 0 ? (
      user.role_rows.map(r => (
        <Badge key={r.id} variant="outline" className={cn("whitespace-nowrap", roleBadgeClass[r.role])}>
          {roleLabels[r.role]}
        </Badge>
      ))
    ) : (
      <Badge variant="outline" className="whitespace-nowrap">No role</Badge>
    );

  const renderRowMenu = (user: UserWithRole) => {
    const name = user.full_name || user.email;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-9 sm:w-9"
            aria-label={`More actions for ${name}`}
            title="More actions"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleEditRole(user)}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Change role
          </DropdownMenuItem>
          {user.employee_id ? (
            <DropdownMenuItem onClick={() => handleUnlinkClick(user)}>
              <Unlink className="mr-2 h-4 w-4" aria-hidden="true" />
              Unlink employee record
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => handleLinkClick(user)} disabled={unlinkedEmployees.length === 0}>
              <Link className="mr-2 h-4 w-4" aria-hidden="true" />
              Link to employee
            </DropdownMenuItem>
          )}
          {user.id !== currentUser?.id && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleBlockClick(user)}
                className={user.blocked ? "text-emerald-700 focus:text-emerald-700" : "text-destructive focus:text-destructive"}
              >
                {user.blocked ? <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" /> : <Ban className="mr-2 h-4 w-4" aria-hidden="true" />}
                {user.blocked ? "Unblock user" : "Block user"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Sort unlinked employees to show matching email first
  const sortedUnlinkedEmployees = selectedUser
    ? [...unlinkedEmployees].sort((a, b) => {
        const aMatches = a.email.toLowerCase() === selectedUser.email.toLowerCase();
        const bMatches = b.email.toLowerCase() === selectedUser.email.toLowerCase();
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
      })
    : unlinkedEmployees;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users &amp; access</CardTitle>
        <CardDescription>
          To give one person access to more modules (for example Assets), use{" "}
          <span className="font-medium text-foreground">Extra access</span> on their row. This only affects that
          person.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No users found.</div>
        ) : (
          <>
            {/* Mobile: one card per user */}
            <ul className="space-y-3 sm:hidden" aria-label="Users">
              {users.map((user) => (
                <li key={user.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={user.avatar_url || undefined} alt="" />
                      <AvatarFallback>{getUserInitials(user.full_name, user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{user.full_name || "Unnamed user"}</p>
                      <p className="truncate text-xs text-muted-foreground" title={user.email}>{user.email}</p>
                    </div>
                    <div className="-mr-1 -mt-1 shrink-0">{renderRowMenu(user)}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {renderStatus(user)}
                    {renderRoles(user)}
                  </div>
                  <div className="mt-2">{renderAccess(user)}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-10 w-full"
                    onClick={() => setPermissionsUser(user)}
                    aria-label={`Extra access for ${user.full_name || user.email}`}
                  >
                    <KeyRound className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Extra access
                  </Button>
                </li>
              ))}
            </ul>

            {/* Tablet / desktop: table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden xl:table-cell">Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Extra access</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={user.avatar_url || undefined} alt="" />
                            <AvatarFallback>{getUserInitials(user.full_name, user.email)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium">{user.full_name || "Unnamed user"}</p>
                            <p className="text-xs text-muted-foreground xl:hidden">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground xl:table-cell">{user.email}</TableCell>
                      <TableCell>{renderStatus(user)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">{renderRoles(user)}</div>
                      </TableCell>
                      <TableCell className="hidden max-w-[260px] md:table-cell">{renderAccess(user)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPermissionsUser(user)}
                            title="Give this person access to extra modules"
                            aria-label={`Extra access for ${user.full_name || user.email}`}
                          >
                            <KeyRound className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            Extra access
                          </Button>
                          {renderRowMenu(user)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change role</DialogTitle>
              <DialogDescription>
                Change the role for {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedUser && selectedUser.role_rows.length > 1 && (
                <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  This user currently has several roles ({selectedUser.role_rows.map(r => roleLabels[r.role]).join(", ")}).
                  Saving replaces them with the role selected here.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="user-role-select">Role</Label>
                <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
                  <SelectTrigger id="user-role-select">
                    {/* Only the role name in the trigger; descriptions stay in the list */}
                    <SelectValue>{roleLabels[selectedRole]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin" textValue="Administrator">
                      <div className="flex flex-col items-start text-left">
                        <span>Administrator</span>
                        <span className="text-xs text-muted-foreground">Full system access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="hr" textValue="HR Manager">
                      <div className="flex flex-col items-start text-left">
                        <span>HR Manager</span>
                        <span className="text-xs text-muted-foreground">Module access set under "Defaults for each role"</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="manager" textValue="Manager">
                      <div className="flex flex-col items-start text-left">
                        <span>Manager</span>
                        <span className="text-xs text-muted-foreground">Their team, plus their role defaults</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="employee" textValue="Employee">
                      <div className="flex flex-col items-start text-left">
                        <span>Employee</span>
                        <span className="text-xs text-muted-foreground">Self-service, plus their role defaults</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveRole} disabled={updateRoleMutation.isPending}>
                {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={blockDialogOpen} onOpenChange={(open) => {
          setBlockDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {selectedUser?.blocked ? "Unblock user" : "Block user"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedUser?.blocked 
                  ? `Are you sure you want to unblock ${selectedUser?.full_name || selectedUser?.email}? They will be able to login again.`
                  : `Are you sure you want to block ${selectedUser?.full_name || selectedUser?.email}? They will not be able to login until unblocked.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleToggleBlock}
                className={selectedUser?.blocked ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              >
                {toggleBlockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedUser?.blocked ? "Unblock" : "Block"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Link Employee Dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) {
            setSelectedUser(null);
            setSelectedEmployeeId("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link employee record</DialogTitle>
              <DialogDescription>
                Link {selectedUser?.full_name || selectedUser?.email} to an existing employee record
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="link-employee-select">Employee</Label>
                {sortedUnlinkedEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unlinked employees available</p>
                ) : (
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger id="link-employee-select">
                      <SelectValue placeholder="Select an employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedUnlinkedEmployees.map((emp) => {
                        const isMatch = selectedUser && emp.email.toLowerCase() === selectedUser.email.toLowerCase();
                        return (
                          <SelectItem key={emp.id} value={emp.id}>
                            <div className="flex items-center gap-2">
                              <span>{emp.first_name} {emp.last_name}</span>
                              <span className="text-xs text-muted-foreground">({emp.employee_code})</span>
                              {isMatch && (
                                <Badge variant="secondary" className="text-xs">Recommended</Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {selectedEmployeeId && (
                <div className="rounded-md border p-3 text-sm">
                  {(() => {
                    const emp = unlinkedEmployees.find(e => e.id === selectedEmployeeId);
                    if (!emp) return null;
                    return (
                      <div className="space-y-1">
                        <p><span className="text-muted-foreground">Name:</span> {emp.first_name} {emp.last_name}</p>
                        <p><span className="text-muted-foreground">Code:</span> {emp.employee_code}</p>
                        <p className="break-all"><span className="text-muted-foreground">Email:</span> {emp.email}</p>
                        <p><span className="text-muted-foreground">Designation:</span> {emp.designation}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleLinkEmployee} disabled={!selectedEmployeeId || linkEmployeeMutation.isPending}>
                {linkEmployeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Link employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <UserPermissionsDialog
          open={!!permissionsUser}
          onOpenChange={(open) => { if (!open) setPermissionsUser(null); }}
          user={permissionsUser ? {
            id: permissionsUser.id,
            full_name: permissionsUser.full_name,
            email: permissionsUser.email,
            roles: permissionsUser.role_rows.map(r => r.role),
          } : null}
          rolePermissions={rolePermissions}
          userPermissions={userPermissions}
          loading={loadingRolePerms || loadingUserPerms}
        />

        {/* Unlink Employee Dialog */}
        <AlertDialog open={unlinkDialogOpen} onOpenChange={(open) => {
          setUnlinkDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unlink employee record</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to unlink {selectedUser?.full_name || selectedUser?.email} from their employee record? 
                The employee record will remain but won't be associated with this user account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnlinkEmployee}>
                {unlinkEmployeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unlink
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
