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
import { Building2, CalendarDays, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useEmployees";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

const Settings = () => {
  const [activeTab, setActiveTab] = useState("departments");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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

  // Department mutations
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

  // Leave type mutations
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
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">Manage system configurations</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="departments" className="gap-2">
              <Building2 className="h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="leave-types" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Leave Types
            </TabsTrigger>
          </TabsList>

          {/* Departments Tab */}
          <TabsContent value="departments" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
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
                      <Plus className="mr-2 h-4 w-4" />
                      Add Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingDept ? 'Edit Department' : 'Add Department'}</DialogTitle>
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
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell className="text-muted-foreground">{dept.description || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEditDept(dept)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteDeptMutation.mutate(dept.id)}
                                disabled={deleteDeptMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
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

          {/* Leave Types Tab */}
          <TabsContent value="leave-types" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Leave Types</CardTitle>
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
                      <Plus className="mr-2 h-4 w-4" />
                      Add Leave Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingLeave ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
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
                        <Label htmlFor="daysPerYear">Days Per Year</Label>
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
                          <Label htmlFor="isPaid">Paid Leave</Label>
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
                        <TableHead>Days/Year</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveTypes.map((leave) => (
                        <TableRow key={leave.id}>
                          <TableCell className="font-medium">{leave.name}</TableCell>
                          <TableCell>{leave.days_per_year}</TableCell>
                          <TableCell>
                            <Badge variant={leave.is_paid ? "default" : "secondary"}>
                              {leave.is_paid ? "Paid" : "Unpaid"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{leave.description || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEditLeave(leave)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteLeaveMutation.mutate(leave.id)}
                                disabled={deleteLeaveMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
