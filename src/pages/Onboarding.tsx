import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Upload, User, Briefcase, FileText, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useEmployees";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdminOrHR } from "@/hooks/useUserRole";

// Fetch employees who are in onboarding status
const useOnboardingEmployees = () => {
  return useQuery({
    queryKey: ['onboarding-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          avatar_url,
          hire_date,
          department_id,
          departments (name)
        `)
        .eq('status', 'onboarding');
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch active employees who can be managers
const useManagers = () => {
  return useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('status', 'active')
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch users without employee records (available to link)
const useUnlinkedUsers = () => {
  return useQuery({
    queryKey: ['unlinked-users'],
    queryFn: async () => {
      // Get all user IDs that are already linked to employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('user_id')
        .not('user_id', 'is', null);
      
      if (empError) throw empError;
      
      const linkedUserIds = employees?.map(e => e.user_id) || [];
      
      // Get profiles not linked to employees
      let query = supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .order('email');
      
      if (linkedUserIds.length > 0) {
        query = query.not('id', 'in', `(${linkedUserIds.join(',')})`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Generate unique employee code
const generateEmployeeCode = () => {
  const prefix = 'EMP';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
};

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  departmentId: string;
  designation: string;
  managerId: string;
  joinDate: string;
  salary: string;
  isDepartmentManager: boolean;
  linkedUserId: string;
}

const initialFormData: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  departmentId: '',
  designation: '',
  managerId: '',
  joinDate: '',
  salary: '',
  isDepartmentManager: false,
  linkedUserId: '',
};

const Onboarding = () => {
  const [activeTab, setActiveTab] = useState("add");
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdminOrHR, isLoading: roleLoading } = useIsAdminOrHR();
  
  const { data: departments = [], isLoading: loadingDepartments } = useDepartments();
  const { data: managers = [], isLoading: loadingManagers } = useManagers();
  const { data: onboardingEmployees = [], isLoading: loadingOnboarding } = useOnboardingEmployees();
  const { data: unlinkedUsers = [], isLoading: loadingUsers } = useUnlinkedUsers();

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

  // Redirect non-admin/HR users
  if (!isAdminOrHR) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-sm text-muted-foreground">Only administrators and HR personnel can manage onboarding.</p>
        </div>
      </DashboardLayout>
    );
  }

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Create employee
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .insert({
          employee_code: generateEmployeeCode(),
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim() || null,
          address: data.address.trim() || null,
          department_id: data.departmentId || null,
          designation: data.designation.trim(),
          manager_id: data.managerId || null,
          hire_date: data.joinDate,
          status: 'onboarding',
          user_id: data.linkedUserId || null,
        })
        .select()
        .single();
      
      if (employeeError) throw employeeError;

      // If salary is provided, create salary structure
      if (data.salary && parseFloat(data.salary) > 0) {
        const { error: salaryError } = await supabase
          .from('salary_structures')
          .insert({
            employee_id: employee.id,
            basic_salary: parseFloat(data.salary),
            effective_from: data.joinDate,
          });
        
        if (salaryError) throw salaryError;
      }

      return employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-users'] });
      setFormData(initialFormData);
      setActiveTab('pending');
      toast({
        title: "Employee Added",
        description: "New employee has been added to the onboarding queue.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add employee. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // When a user is selected, auto-fill name and email
  const handleUserSelect = (userId: string) => {
    const actualUserId = userId === 'none' ? '' : userId;
    handleInputChange('linkedUserId', actualUserId);
    
    if (actualUserId) {
      const selectedUser = unlinkedUsers.find(u => u.id === actualUserId);
      if (selectedUser) {
        const nameParts = (selectedUser.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        setFormData(prev => ({
          ...prev,
          linkedUserId: actualUserId,
          firstName: prev.firstName || firstName,
          lastName: prev.lastName || lastName,
          email: prev.email || selectedUser.email || '',
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.firstName.trim()) {
      toast({ title: "Error", description: "First name is required", variant: "destructive" });
      return;
    }
    if (!formData.lastName.trim()) {
      toast({ title: "Error", description: "Last name is required", variant: "destructive" });
      return;
    }
    if (!formData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    if (!formData.designation.trim()) {
      toast({ title: "Error", description: "Designation is required", variant: "destructive" });
      return;
    }
    if (!formData.joinDate) {
      toast({ title: "Error", description: "Join date is required", variant: "destructive" });
      return;
    }

    createEmployeeMutation.mutate(formData);
  };

  const isSubmitting = createEmployeeMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="add">Add New Employee</TabsTrigger>
            <TabsTrigger value="pending">
              Pending Onboarding
              <Badge variant="secondary" className="ml-2">
                {onboardingEmployees.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Personal Information</CardTitle>
                        <CardDescription>Basic details of the employee</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Link User Account */}
                    <div className="space-y-2">
                      <Label htmlFor="linkedUser">Link to User Account</Label>
                      <Select 
                        disabled={loadingUsers || isSubmitting}
                        value={formData.linkedUserId}
                        onValueChange={handleUserSelect}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingUsers ? "Loading..." : "Select user account (optional)"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No linked account</SelectItem>
                          {unlinkedUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name || user.email} {user.full_name && `(${user.email})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Link this employee to an existing user account so they can log in
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input 
                          id="firstName" 
                          placeholder="John" 
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input 
                          id="lastName" 
                          placeholder="Doe" 
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="john.doe@company.com" 
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        id="phone" 
                        placeholder="+1 (555) 000-0000" 
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea 
                        id="address" 
                        placeholder="Enter full address" 
                        rows={3} 
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Job Information */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Briefcase className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Job Information</CardTitle>
                        <CardDescription>Role and department details</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select 
                        disabled={loadingDepartments || isSubmitting}
                        value={formData.departmentId}
                        onValueChange={(value) => handleInputChange('departmentId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingDepartments ? "Loading..." : "Select department"} />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="designation">Designation *</Label>
                      <Input 
                        id="designation" 
                        placeholder="e.g., Senior Developer" 
                        value={formData.designation}
                        onChange={(e) => handleInputChange('designation', e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="isDeptManager">Department Manager</Label>
                        <p className="text-xs text-muted-foreground">
                          Tag this employee as the head of their department
                        </p>
                      </div>
                      <Switch
                        id="isDeptManager"
                        checked={formData.isDepartmentManager}
                        onCheckedChange={(checked) => handleInputChange('isDepartmentManager', checked)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager">Reporting Manager</Label>
                      <Select 
                        disabled={loadingManagers || isSubmitting}
                        value={formData.managerId}
                        onValueChange={(value) => handleInputChange('managerId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingManagers ? "Loading..." : "Select manager"} />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.first_name} {manager.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="joinDate">Join Date *</Label>
                        <Input 
                          id="joinDate" 
                          type="date" 
                          value={formData.joinDate}
                          onChange={(e) => handleInputChange('joinDate', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="salary">Base Salary</Label>
                        <Input 
                          id="salary" 
                          type="number" 
                          placeholder="50000" 
                          value={formData.salary}
                          onChange={(e) => handleInputChange('salary', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Documents</CardTitle>
                        <CardDescription>Upload required documents (coming soon)</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {["ID Proof", "Offer Letter", "Resume"].map((doc) => (
                        <div
                          key={doc}
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary hover:bg-primary/5 opacity-50 cursor-not-allowed"
                        >
                          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">{doc}</p>
                          <p className="text-xs text-muted-foreground">Coming soon</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setFormData(initialFormData)}
                >
                  Clear Form
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Employee
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <div className="space-y-4">
              {loadingOnboarding ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Loading onboarding employees...
                  </CardContent>
                </Card>
              ) : onboardingEmployees.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No employees currently in onboarding
                  </CardContent>
                </Card>
              ) : (
                onboardingEmployees.map((employee) => {
                  const name = `${employee.first_name} ${employee.last_name}`;
                  const departmentName = employee.departments?.name || 'Unassigned';
                  const hireDate = employee.hire_date 
                    ? new Date(employee.hire_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'TBD';
                  
                  return (
                    <Card key={employee.id}>
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={employee.avatar_url || undefined} />
                              <AvatarFallback>
                                {name.split(" ").map((n) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold text-foreground">{name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {departmentName} · Starts {hireDate}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary">Onboarding</Badge>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Onboarding;
