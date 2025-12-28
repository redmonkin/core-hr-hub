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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Upload, User, Briefcase, FileText, Loader2, ShieldAlert, Calendar, Mail, Phone, MapPin, Pencil, X, Check, Download, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useEmployees";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
          email,
          phone,
          address,
          avatar_url,
          hire_date,
          designation,
          department_id,
          manager_id,
          departments (name)
        `)
        .eq('status', 'onboarding');
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch documents for a specific employee
const useEmployeeDocuments = (employeeId: string | null) => {
  return useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
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

interface DocumentUpload {
  file: File | null;
  uploading: boolean;
  uploaded: boolean;
  url: string | null;
}

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

const DOCUMENT_TYPES = [
  { key: 'id_proof', label: 'ID Proof', accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'offer_letter', label: 'Offer Letter', accept: '.pdf,.doc,.docx' },
  { key: 'resume', label: 'Resume', accept: '.pdf,.doc,.docx' },
];

const initialDocuments: Record<string, DocumentUpload> = {
  id_proof: { file: null, uploading: false, uploaded: false, url: null },
  offer_letter: { file: null, uploading: false, uploaded: false, url: null },
  resume: { file: null, uploading: false, uploaded: false, url: null },
};

const Onboarding = () => {
  const [activeTab, setActiveTab] = useState("add");
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    departmentId: '',
    designation: '',
    managerId: '',
    joinDate: '',
  });
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [documents, setDocuments] = useState<Record<string, DocumentUpload>>(initialDocuments);
  const [additionalDoc, setAdditionalDoc] = useState<{ file: File | null; type: string }>({ file: null, type: '' });
  const [isUploadingAdditional, setIsUploadingAdditional] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdminOrHR, isLoading: roleLoading } = useIsAdminOrHR();
  
  const { data: departments = [], isLoading: loadingDepartments } = useDepartments();
  const { data: managers = [], isLoading: loadingManagers } = useManagers();
  const { data: onboardingEmployees = [], isLoading: loadingOnboarding } = useOnboardingEmployees();
  const { data: unlinkedUsers = [], isLoading: loadingUsers } = useUnlinkedUsers();
  const { data: employeeDocs = [], isLoading: loadingDocs } = useEmployeeDocuments(selectedEmployee?.id || null);

  // Get signed URL for document download
  const getDocumentUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('employee-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to get document URL",
        variant: "destructive",
      });
      return null;
    }
    return data.signedUrl;
  };

  const handleViewDocument = async (filePath: string) => {
    const url = await getDocumentUrl(filePath);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleDownloadDocument = async (filePath: string, fileName: string) => {
    const url = await getDocumentUrl(filePath);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileSelect = (docType: string, file: File | null) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], file, uploaded: false, url: null }
    }));
  };

  // Upload a single document
  const uploadDocument = async (employeeId: string, docType: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${employeeId}/${docType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(fileName);

    // Store document reference in database
    const { error: dbError } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: employeeId,
        document_type: docType,
        document_name: file.name,
        file_url: fileName, // Store path, not public URL (bucket is private)
      });

    if (dbError) throw dbError;

    return fileName;
  };

  // Upload additional document for existing employee
  const handleUploadAdditionalDocument = async () => {
    if (!selectedEmployee || !additionalDoc.file || !additionalDoc.type) {
      toast({
        title: "Error",
        description: "Please select a document type and file",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAdditional(true);
    try {
      await uploadDocument(selectedEmployee.id, additionalDoc.type, additionalDoc.file);
      queryClient.invalidateQueries({ queryKey: ['employee-documents', selectedEmployee.id] });
      setAdditionalDoc({ file: null, type: '' });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAdditional(false);
    }
  };

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Get department name for notification
      const selectedDept = departments.find(d => d.id === data.departmentId);

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

      // Upload documents
      const docsToUpload = Object.entries(documents).filter(([_, doc]) => doc.file);
      for (const [docType, doc] of docsToUpload) {
        if (doc.file) {
          try {
            await uploadDocument(employee.id, docType, doc.file);
          } catch (err) {
            console.error(`Failed to upload ${docType}:`, err);
          }
        }
      }

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

      // Send onboarding notification (fire and forget)
      supabase.functions.invoke("onboarding-notification", {
        body: {
          employee_id: employee.id,
          employee_name: `${data.firstName.trim()} ${data.lastName.trim()}`,
          employee_email: data.email.trim(),
          designation: data.designation.trim(),
          department_name: selectedDept?.name,
          join_date: data.joinDate,
          manager_id: data.managerId || undefined,
        }
      }).catch(err => {
        console.error("Failed to send onboarding notification:", err);
      });

      return employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-users'] });
      setFormData(initialFormData);
      setDocuments(initialDocuments);
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

  const activateEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      // Update employee status to active
      const { error: updateError } = await supabase
        .from('employees')
        .update({ status: 'active' })
        .eq('id', employeeId);
      
      if (updateError) throw updateError;

      // Initialize leave balances for the current year
      const currentYear = new Date().getFullYear();
      const { data: leaveTypes, error: leaveTypesError } = await supabase
        .from('leave_types')
        .select('id, days_per_year');
      
      if (leaveTypesError) throw leaveTypesError;

      if (leaveTypes && leaveTypes.length > 0) {
        const leaveBalances = leaveTypes.map(lt => ({
          employee_id: employeeId,
          leave_type_id: lt.id,
          year: currentYear,
          total_days: lt.days_per_year,
          used_days: 0,
        }));

        const { error: balanceError } = await supabase
          .from('leave_balances')
          .upsert(leaveBalances, { onConflict: 'employee_id,leave_type_id,year' });
        
        if (balanceError) {
          console.error('Failed to initialize leave balances:', balanceError);
        }
      }

      return employeeId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSelectedEmployee(null);
      toast({
        title: "Employee Activated",
        description: "Employee has been marked as active and leave balances have been initialized.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate employee.",
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: typeof editFormData & { id: string }) => {
      const { error } = await supabase
        .from('employees')
        .update({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim() || null,
          address: data.address.trim() || null,
          department_id: data.departmentId || null,
          designation: data.designation.trim(),
          manager_id: data.managerId || null,
          hire_date: data.joinDate,
        })
        .eq('id', data.id);
      
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditing(false);
      setSelectedEmployee(null);
      toast({
        title: "Employee Updated",
        description: "Employee details have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee.",
        variant: "destructive",
      });
    },
  });

  const openEditMode = (employee: any) => {
    setEditFormData({
      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      address: employee.address || '',
      departmentId: employee.department_id || '',
      designation: employee.designation || '',
      managerId: employee.manager_id || '',
      joinDate: employee.hire_date || '',
    });
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    if (!selectedEmployee) return;
    
    if (!editFormData.firstName.trim()) {
      toast({ title: "Error", description: "First name is required", variant: "destructive" });
      return;
    }
    if (!editFormData.lastName.trim()) {
      toast({ title: "Error", description: "Last name is required", variant: "destructive" });
      return;
    }
    if (!editFormData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    if (!editFormData.designation.trim()) {
      toast({ title: "Error", description: "Designation is required", variant: "destructive" });
      return;
    }
    if (!editFormData.joinDate) {
      toast({ title: "Error", description: "Join date is required", variant: "destructive" });
      return;
    }

    updateEmployeeMutation.mutate({ ...editFormData, id: selectedEmployee.id });
  };

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
                        <CardDescription>Upload required documents (optional)</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {DOCUMENT_TYPES.map((docType) => {
                        const doc = documents[docType.key];
                        return (
                          <label
                            key={docType.key}
                            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
                              doc.file 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-primary hover:bg-primary/5'
                            } ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <input
                              type="file"
                              accept={docType.accept}
                              className="sr-only"
                              disabled={isSubmitting}
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                handleFileSelect(docType.key, file);
                              }}
                            />
                            {doc.file ? (
                              <>
                                <Check className="mb-2 h-8 w-8 text-primary" />
                                <p className="text-sm font-medium text-foreground truncate max-w-full px-2">
                                  {doc.file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(doc.file.size / 1024).toFixed(1)} KB
                                </p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-2 right-2 h-6 w-6"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleFileSelect(docType.key, null);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                                <p className="text-sm font-medium text-foreground">{docType.label}</p>
                                <p className="text-xs text-muted-foreground">Click to upload</p>
                              </>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setFormData(initialFormData);
                    setDocuments(initialDocuments);
                  }}
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
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedEmployee(employee)}
                            >
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

        {/* Employee Details Dialog */}
        <Dialog 
          open={!!selectedEmployee} 
          onOpenChange={(open) => {
            if (!open) {
              setSelectedEmployee(null);
              setIsEditing(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Employee' : 'Employee Details'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update onboarding employee information' : 'Onboarding employee information'}
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && !isEditing && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedEmployee.avatar_url || undefined} />
                      <AvatarFallback className="text-lg">
                        {`${selectedEmployee.first_name} ${selectedEmployee.last_name}`.split(" ").map((n: string) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-semibold">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedEmployee.designation || 'No designation'}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => openEditMode(selectedEmployee)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Department</p>
                      <p className="text-sm font-medium">{selectedEmployee.departments?.name || 'Unassigned'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="text-sm font-medium">
                        {selectedEmployee.hire_date 
                          ? new Date(selectedEmployee.hire_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                          : 'TBD'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{selectedEmployee.email || '-'}</p>
                    </div>
                  </div>
                  
                  {selectedEmployee.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">{selectedEmployee.phone}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedEmployee.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Address</p>
                        <p className="text-sm font-medium">{selectedEmployee.address}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Documents Section */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documents
                  </p>
                  {loadingDocs ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : employeeDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No documents uploaded</p>
                  ) : (
                    <div className="space-y-2">
                      {employeeDocs.map((doc) => {
                        const docTypeLabel = DOCUMENT_TYPES.find(d => d.key === doc.document_type)?.label || doc.document_type;
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{docTypeLabel}</p>
                                <p className="text-xs text-muted-foreground truncate">{doc.document_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleViewDocument(doc.file_url)}
                                title="View"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDownloadDocument(doc.file_url, doc.document_name)}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Upload Additional Document */}
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground">Upload Additional Document</p>
                    <div className="flex gap-2">
                      <Select
                        value={additionalDoc.type}
                        onValueChange={(value) => setAdditionalDoc(prev => ({ ...prev, type: value }))}
                        disabled={isUploadingAdditional}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((docType) => (
                            <SelectItem key={docType.key} value={docType.key}>
                              {docType.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          disabled={isUploadingAdditional}
                          onChange={(e) => setAdditionalDoc(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                          className="text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={handleUploadAdditionalDocument}
                        disabled={isUploadingAdditional || !additionalDoc.file || !additionalDoc.type}
                      >
                        {isUploadingAdditional ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {additionalDoc.file && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {additionalDoc.file.name}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <Badge variant="secondary">Onboarding</Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm"
                        disabled={activateEmployeeMutation.isPending}
                      >
                        {activateEmployeeMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Activate Employee
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Activate Employee</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark {selectedEmployee.first_name} {selectedEmployee.last_name} as an active employee and initialize their leave balances for the current year. Are you sure?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => activateEmployeeMutation.mutate(selectedEmployee.id)}
                        >
                          Activate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
            
            {selectedEmployee && isEditing && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-firstName">First Name *</Label>
                    <Input
                      id="edit-firstName"
                      value={editFormData.firstName}
                      onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      disabled={updateEmployeeMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-lastName">Last Name *</Label>
                    <Input
                      id="edit-lastName"
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      disabled={updateEmployeeMutation.isPending}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-designation">Designation *</Label>
                  <Input
                    id="edit-designation"
                    value={editFormData.designation}
                    onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department</Label>
                  <Select
                    value={editFormData.departmentId}
                    onValueChange={(value) => setEditFormData({ ...editFormData, departmentId: value })}
                    disabled={updateEmployeeMutation.isPending || loadingDepartments}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
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
                  <Label htmlFor="edit-manager">Manager</Label>
                  <Select
                    value={editFormData.managerId}
                    onValueChange={(value) => setEditFormData({ ...editFormData, managerId: value === 'none' ? '' : value })}
                    disabled={updateEmployeeMutation.isPending || loadingManagers}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-joinDate">Join Date *</Label>
                  <Input
                    id="edit-joinDate"
                    type="date"
                    value={editFormData.joinDate}
                    onChange={(e) => setEditFormData({ ...editFormData, joinDate: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Textarea
                    id="edit-address"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    disabled={updateEmployeeMutation.isPending}
                    rows={2}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={updateEmployeeMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEditSubmit}
                    disabled={updateEmployeeMutation.isPending}
                  >
                    {updateEmployeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Onboarding;
