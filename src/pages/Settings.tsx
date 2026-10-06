import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, CalendarDays, Plus, Pencil, Trash2, Loader2, ShieldAlert, Users, Hash, Globe, MapPin, Palette, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useEmployees";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { canAccessSettings } from "@/lib/permissions";
import { UserRolesManager } from "@/components/settings/UserRolesManager";
import { RolePermissionsMatrix } from "@/components/settings/RolePermissionsMatrix";
import { EmployeeCodeSettings } from "@/components/settings/EmployeeCodeSettings";
import DomainWhitelistSettings from "@/components/settings/DomainWhitelistSettings";
import OfficeLocationSettings from "@/components/settings/OfficeLocationSettings";
import { BrandingSettings } from "@/components/settings/BrandingSettings";
import { PayrollSettings } from "@/components/settings/PayrollSettings";
import { toneClass } from "@/lib/statusStyles";

// Fetch leave types
const useLeaveTypes = () => {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });
};

interface DepartmentForm {
  name: string;
  description: string;
}

interface LeaveTypeForm {
  name: string;
  description: string;
  days_per_year: number;
  is_paid: boolean;
}

type SettingsTab =
  | "user-roles"
  | "departments"
  | "leave-types"
  | "employee-id"
  | "domain-whitelist"
  | "office-location"
  | "branding"
  | "payroll";

const Settings = () => {
  const [requestedTab, setRequestedTab] = useState<SettingsTab | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const perms = usePermissions();
  const { can, isAdmin, isLoading: roleLoading } = perms;

  const tabAllowed: Record<SettingsTab, boolean> = {
    "user-roles": isAdmin,
    departments: can('employees', 'manage'),
    "leave-types": can('leaves', 'manage'),
    "employee-id": can('settings', 'manage'),
    "domain-whitelist": can('settings', 'manage'),
    "office-location": can('settings', 'manage'),
    branding: can('settings', 'manage'),
    // Approval rules for pay changes: admins only (enforced in the database too)
    payroll: isAdmin,
  };
  // Display order; the first tab the user can use is the default
  const TAB_ORDER: SettingsTab[] = [
    "user-roles", "departments", "leave-types", "employee-id", "domain-whitelist", "office-location", "branding", "payroll",
  ];
  const allowedTabs = TAB_ORDER.filter((t) => tabAllowed[t]);
  const activeTab: SettingsTab | undefined =
    requestedTab && tabAllowed[requestedTab] ? requestedTab : allowedTabs[0];
  
  // Department state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<{ id: string } | null>(null);
  const [deptForm, setDeptForm] = useState<DepartmentForm>({ name: '', description: '' });
  
  // Leave type state
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<{ id: string } | null>(null);
  const [leaveForm, setLeaveForm] = useState<LeaveTypeForm>({ 
    name: '', 
    description: '', 
    days_per_year: 0, 
    is_paid: true 
  });

  const { data: departments = [], isLoading: loadingDepts } = useDepartments();
  const { data: leaveTypes = [], isLoading: loadingLeaves } = useLeaveTypes();

  // Department mutations - must be before any early returns
  const createDeptMutation = useMutation({
    mutationFn: async (data: DepartmentForm) => {
      const { error } = await supabase.from('departments').insert({
        name: data.name.trim(),
        description: data.description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeptDialogOpen(false);
      setDeptForm({ name: '', description: '' });
      toast({ title: "Department created", description: "New department has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DepartmentForm }) => {
      const { error } = await supabase.from('departments').update({
        name: data.name.trim(),
        description: data.description.trim() || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeptDialogOpen(false);
      setEditingDept(null);
      setDeptForm({ name: '', description: '' });
      toast({ title: "Department updated", description: "Department has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: "Department deleted", description: "Department has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Leave type mutations - must be before any early returns
  const createLeaveMutation = useMutation({
    mutationFn: async (data: LeaveTypeForm) => {
      const { error } = await supabase.from('leave_types').insert({
        name: data.name.trim(),
        description: data.description.trim() || null,
        days_per_year: data.days_per_year,
        is_paid: data.is_paid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      setLeaveDialogOpen(false);
      setLeaveForm({ name: '', description: '', days_per_year: 0, is_paid: true });
      toast({ title: "Leave type created", description: "New leave type has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateLeaveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LeaveTypeForm }) => {
      const { error } = await supabase.from('leave_types').update({
        name: data.name.trim(),
        description: data.description.trim() || null,
        days_per_year: data.days_per_year,
        is_paid: data.is_paid,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      setLeaveDialogOpen(false);
      setEditingLeave(null);
      setLeaveForm({ name: '', description: '', days_per_year: 0, is_paid: true });
      toast({ title: "Leave type updated", description: "Leave type has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leave_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      toast({ title: "Leave type deleted", description: "Leave type has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Show loading while checking role
  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Same rule as the sidebar: admin, or manage on employees/leaves/settings
  if (!canAccessSettings(perms) || allowedTabs.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-sm text-muted-foreground">Ask an administrator if you need access to settings.</p>
        </div>
      </DashboardLayout>
    );
  }


  const handleEditDept = (dept: { id: string; name: string; description: string | null }) => {
    setEditingDept({ id: dept.id });
    setDeptForm({ name: dept.name, description: dept.description || '' });
    setDeptDialogOpen(true);
  };

  const handleEditLeave = (leave: { id: string; name: string; description: string | null; days_per_year: number; is_paid: boolean | null }) => {
    setEditingLeave({ id: leave.id });
    setLeaveForm({ 
      name: leave.name, 
      description: leave.description || '', 
      days_per_year: leave.days_per_year,
      is_paid: leave.is_paid ?? true,
    });
    setLeaveDialogOpen(true);
  };

  const handleDeptSubmit = () => {
    if (!deptForm.name.trim()) {
      toast({ title: "Error", description: "Department name is required", variant: "destructive" });
      return;
    }
    if (editingDept) {
      updateDeptMutation.mutate({ id: editingDept.id, data: deptForm });
    } else {
      createDeptMutation.mutate(deptForm);
    }
  };

  const handleLeaveSubmit = () => {
    if (!leaveForm.name.trim()) {
      toast({ title: "Error", description: "Leave type name is required", variant: "destructive" });
      return;
    }
    if (editingLeave) {
      updateLeaveMutation.mutate({ id: editingLeave.id, data: leaveForm });
    } else {
      createLeaveMutation.mutate(leaveForm);
    }
  };

  const isDeptSaving = createDeptMutation.isPending || updateDeptMutation.isPending;
  const isLeaveSaving = createLeaveMutation.isPending || updateLeaveMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Settings</h1>
          <p className="text-muted-foreground">Manage system configurations</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setRequestedTab(v as SettingsTab)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-start" aria-label="Settings sections">
            {tabAllowed["user-roles"] && (
              <TabsTrigger
                value="user-roles"
                className="min-h-10 w-full justify-start gap-2 sm:min-h-0 sm:w-auto sm:justify-center"
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>Users &amp; access</span>
              </TabsTrigger>
            )}
            {tabAllowed.departments && (
              <TabsTrigger value="departments" className="min-h-10 w-full justify-start gap-2 sm:min-h-0 sm:w-auto sm:justify-center">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                <span>Departments</span>
              </TabsTrigger>
            )}
            {tabAllowed["leave-types"] && (
              <TabsTrigger value="leave-types" className="min-h-10 w-full justify-start gap-2 sm:min-h-0 sm:w-auto sm:justify-center">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span>Leave types</span>
              </TabsTrigger>
            )}
            {tabAllowed["employee-id"] && (
              <TabsTrigger value="employee-id" className="min-h-10 w-full justify-start gap-2 sm:min-h-0 sm:w-auto sm:justify-center">
                <Hash className="h-4 w-4" aria-hidden="true" />
                <span>Employee ID</span>
              </TabsTrigger>
            )}
            {tabAllowed["domain-whitelist"] && (
              <TabsTrigger value="domain-whitelist" className="min-h-10 w-full justify-start gap-2 sm:min-h-0 sm:w-auto sm:justify-center">
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span>Domain whitelist</span>
              </TabsTrigger>
            )}
            {tabAllowed["office-location"] && (
              <TabsTrigger value="office-location" className="min-h-10 w-full justify-start gap-2 sm:min-h-0 sm:w-auto sm:justify-center">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>Office location</span>
              </TabsTrigger>
            )}
            {tabAllowed.branding && (
              <TabsTrigger value="branding" className="min-h-10 w-full justify-start gap-2 sm:min-h-0 sm:w-auto sm:justify-center">
                <Palette className="h-4 w-4" aria-hidden="true" />
                <span>Branding</span>
              </TabsTrigger>
            )}
            {tabAllowed.payroll && (
              <TabsTrigger value="payroll" className="min-h-10 w-full justify-start gap-2 sm:min-h-0 sm:w-auto sm:justify-center">
                <IndianRupee className="h-4 w-4" aria-hidden="true" />
                <span>Payroll</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Departments Tab */}
          {tabAllowed.departments && (
          <TabsContent value="departments" className="mt-6">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Departments</CardTitle>
                  <CardDescription>Manage company departments</CardDescription>
                </div>
                <Dialog open={deptDialogOpen} onOpenChange={(open) => {
                  setDeptDialogOpen(open);
                  if (!open) {
                    setEditingDept(null);
                    setDeptForm({ name: '', description: '' });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Add department
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingDept ? 'Edit department' : 'Add department'}</DialogTitle>
                      <DialogDescription>
                        {editingDept ? 'Update department details' : 'Create a new department'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="deptName">Name *</Label>
                        <Input
                          id="deptName"
                          value={deptForm.name}
                          onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Engineering"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deptDescription">Description</Label>
                        <Textarea
                          id="deptDescription"
                          value={deptForm.description}
                          onChange={(e) => setDeptForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief description of the department"
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleDeptSubmit} disabled={isDeptSaving}>
                        {isDeptSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingDept ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingDepts ? (
                  <div className="py-8 text-center text-muted-foreground">Loading departments...</div>
                ) : departments.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">No departments found. Add your first department.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Description</TableHead>
                        <TableHead className="w-24 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell>
                            <p className="font-medium">{dept.name}</p>
                            {dept.description && <p className="text-xs text-muted-foreground sm:hidden">{dept.description}</p>}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">{dept.description || '—'}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => handleEditDept(dept)} aria-label={`Edit ${dept.name}`} title="Edit">
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 text-destructive hover:text-destructive"
                                onClick={() => deleteDeptMutation.mutate(dept.id)}
                                disabled={deleteDeptMutation.isPending}
                                aria-label={`Delete ${dept.name}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Leave Types Tab */}
          {tabAllowed["leave-types"] && (
          <TabsContent value="leave-types" className="mt-6">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Leave types</CardTitle>
                  <CardDescription>Configure available leave types and their policies</CardDescription>
                </div>
                <Dialog open={leaveDialogOpen} onOpenChange={(open) => {
                  setLeaveDialogOpen(open);
                  if (!open) {
                    setEditingLeave(null);
                    setLeaveForm({ name: '', description: '', days_per_year: 0, is_paid: true });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Add leave type
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingLeave ? 'Edit leave type' : 'Add leave type'}</DialogTitle>
                      <DialogDescription>
                        {editingLeave ? 'Update leave type details' : 'Create a new leave type'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="leaveName">Name *</Label>
                        <Input
                          id="leaveName"
                          value={leaveForm.name}
                          onChange={(e) => setLeaveForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Annual Leave"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="leaveDescription">Description</Label>
                        <Textarea
                          id="leaveDescription"
                          value={leaveForm.description}
                          onChange={(e) => setLeaveForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief description of this leave type"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="daysPerYear">Days per year</Label>
                        <Input
                          id="daysPerYear"
                          type="number"
                          min="0"
                          value={leaveForm.days_per_year}
                          onChange={(e) => setLeaveForm(prev => ({ ...prev, days_per_year: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <Label htmlFor="isPaid">Paid leave</Label>
                          <p className="text-xs text-muted-foreground">Employee receives salary during this leave</p>
                        </div>
                        <Switch
                          id="isPaid"
                          checked={leaveForm.is_paid}
                          onCheckedChange={(checked) => setLeaveForm(prev => ({ ...prev, is_paid: checked }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleLeaveSubmit} disabled={isLeaveSaving}>
                        {isLeaveSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingLeave ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingLeaves ? (
                  <div className="py-8 text-center text-muted-foreground">Loading leave types...</div>
                ) : leaveTypes.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">No leave types found. Add your first leave type.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="whitespace-nowrap">Days/year</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="hidden md:table-cell">Description</TableHead>
                        <TableHead className="w-24 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveTypes.map((leave) => (
                        <TableRow key={leave.id}>
                          <TableCell>
                            <p className="font-medium">{leave.name}</p>
                            <Badge variant="outline" className={`mt-1 sm:hidden ${toneClass(leave.is_paid ? "success" : "neutral")}`}>
                              {leave.is_paid ? "Paid" : "Unpaid"}
                            </Badge>
                          </TableCell>
                          <TableCell>{leave.days_per_year}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className={toneClass(leave.is_paid ? "success" : "neutral")}>
                              {leave.is_paid ? "Paid" : "Unpaid"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">{leave.description || '—'}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => handleEditLeave(leave)} aria-label={`Edit ${leave.name}`} title="Edit">
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 text-destructive hover:text-destructive"
                                onClick={() => deleteLeaveMutation.mutate(leave.id)}
                                disabled={deleteLeaveMutation.isPending}
                                aria-label={`Delete ${leave.name}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Users & access - admin only (RLS also restricts roles/permissions to admins) */}
          {tabAllowed["user-roles"] && (
            <TabsContent value="user-roles" className="mt-6 space-y-6">
              <UserRolesManager />
              <RolePermissionsMatrix />
            </TabsContent>
          )}

          {/* Employee ID Pattern Tab - settings:manage */}
          {tabAllowed["employee-id"] && (
            <TabsContent value="employee-id" className="mt-6">
              <EmployeeCodeSettings />
            </TabsContent>
          )}

          {/* Domain Whitelist Tab - settings:manage */}
          {tabAllowed["domain-whitelist"] && (
            <TabsContent value="domain-whitelist" className="mt-6">
              <DomainWhitelistSettings />
            </TabsContent>
          )}

          {/* Office Location Tab - settings:manage */}
          {tabAllowed["office-location"] && (
            <TabsContent value="office-location" className="mt-6">
              <OfficeLocationSettings />
            </TabsContent>
          )}

          {/* Branding Tab - settings:manage */}
          {tabAllowed["branding"] && (
            <TabsContent value="branding" className="mt-6">
              <BrandingSettings />
            </TabsContent>
          )}

          {tabAllowed.payroll && (
            <TabsContent value="payroll" className="mt-6">
              <PayrollSettings />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
